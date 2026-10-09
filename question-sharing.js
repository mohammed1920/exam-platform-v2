/* Mizan question sharing and share-card rendering.
 * Rendering and sharing behavior is preserved; app state is passed explicitly.
 */
(function () {
  'use strict';

  function buildDeepLink(app, q) {
    const origin = window.location.origin;
    const basePath = examEngine.basePath || '';
    let bookId, chapterNum;

    if (app.isCustomExam && q.sourceBook) {
      const srcBook = app.books.find(b => b.title === q.sourceBook);
      bookId = srcBook ? srcBook.id : null;
      chapterNum = q.sourceChapter;
    } else {
      bookId = app.currentBook.id;
      chapterNum = app.currentChapter;
    }

    if (!bookId || !chapterNum) return `${origin}${basePath}/`;

    let url = `${origin}${basePath}/?book=${encodeURIComponent(bookId)}&chapter=${chapterNum}`;
    const stableQuestionId = q.uid || q.id;
    if (stableQuestionId) {
      url += `&qid=${encodeURIComponent(stableQuestionId)}`;
    } else if (!app.isCustomExam) {
      // بدون id: نستخدم رقم موقع السؤال داخل الفصل كبديل (غير متاح بدقة أثناء الاختبار العشوائي)
      const posIdx = app.currentQuestions.indexOf(q);
      if (posIdx !== -1) url += `&q=${posIdx + 1}`;
    }
    return url;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = (text || '').split(' ');
    const lines = [];
    let current = '';
    words.forEach(word => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  async function generateShareCard(app, q) {
    const W = 1080;

    try {
      await Promise.all([
        document.fonts.load('700 46px "Aref Ruqaa"'),
        document.fonts.load('500 30px "Tajawal"'),
        document.fonts.load('700 26px "Tajawal"'),
        document.fonts.load('800 32px "Tajawal"')
      ]);
      await document.fonts.ready;
    } catch (e) { /* لو فشل تحميل الخط نكمل بالخط الاحتياطي */ }

    // كانفاس مؤقت فقط لقياس عدد أسطر السؤال قبل تحديد طول البطاقة النهائي
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    mctx.font = '700 46px "Aref Ruqaa", serif';
    const lines = wrapText(mctx, q.question, W - 220);

    // هوامش أمان أعلى وأسفل الصورة: فراغ فاضي (نفس لون الورقة) نتركه عمداً
    // حتى لو تيليجرام أو أي تطبيق قص/غطّى حواف الصورة عند عرضها مع رابط أو تعليق،
    // يبقى المحتوى المهم (الختم، الأسئلة، الخيارات) بعيد عن منطقة القص
    const TOP_SAFE = 90;
    const BOTTOM_SAFE = 110;
    const sealCenterY = TOP_SAFE + 70;
    const optHeight = 74;

    // نحسب الارتفاع الكلي المطلوب مسبقاً بنفس منطق الرسم بالأسفل بالضبط
    let estimatedY = sealCenterY + 105 + 48 + 34 + 70 + (lines.length * 62) + 55;
    estimatedY += q.options.length * (optHeight + 20);
    estimatedY += 20 + 70 + 62;
    const H = Math.round(estimatedY + BOTTOM_SAFE);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const C = {
      paper: '#FFFFFF', paperLine: '#E2E8F0', navy: '#0F172A',
      gold: '#D4AF37', goldLight: '#F3E5AB', ink: '#0F172A', inkSoft: '#64748B'
    };
    const cx = W / 2;

    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.paperLine;
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);
    ctx.strokeStyle = 'rgba(37,99,235,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    let y = sealCenterY;
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(-8 * Math.PI / 180);
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚖️', 0, 6);
    ctx.restore();

    y += 105;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.inkSoft;
    ctx.font = '700 26px Tajawal, sans-serif';
    ctx.fillText('منصة الاختبارات القانونية', cx, y);

    y += 48;
    const bookTitle = (app.isCustomExam && q.sourceBook) ? q.sourceBook : app.currentBook.title;
    const chapterNum = (app.isCustomExam && q.sourceChapter) ? q.sourceChapter : app.currentChapter;
    ctx.font = '500 28px Tajawal, sans-serif';
    ctx.fillStyle = C.navy;
    ctx.fillText(`${bookTitle} · الفصل ${chapterNum}`, cx, y);

    y += 34;
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 60, y);
    ctx.lineTo(cx + 60, y);
    ctx.stroke();

    y += 70;
    ctx.font = '700 46px "Aref Ruqaa", serif';
    ctx.fillStyle = C.ink;
    lines.forEach(line => {
      y += 62;
      ctx.fillText(line, cx, y);
    });
    y += 55;

    const optLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    const optX = 80;
    const optWidth = W - 160;
    q.options.forEach((opt, i) => {
      roundRect(ctx, optX, y, optWidth, optHeight, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.strokeStyle = C.paperLine;
      ctx.lineWidth = 2;
      ctx.stroke();

      const circleR = 24;
      const circleCx = W - optX - 40;
      const circleCy = y + optHeight / 2;
      ctx.beginPath();
      ctx.arc(circleCx, circleCy, circleR, 0, Math.PI * 2);
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = C.navy;
      ctx.font = '800 26px Tajawal, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(optLetters[i] || '', circleCx, circleCy + 2);

      ctx.textAlign = 'right';
      ctx.fillStyle = C.ink;
      ctx.font = '500 30px Tajawal, sans-serif';
      ctx.fillText(opt, circleCx - circleR - 20, circleCy);

      y += optHeight + 20;
    });

    y += 20;
    ctx.strokeStyle = C.paperLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(W - 80, y);
    ctx.stroke();

    y += 70;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ctaText = '✋ جاوب بنفسك الآن';
    ctx.font = '800 32px Tajawal, sans-serif';
    const ctaWidth = ctx.measureText(ctaText).width + 80;
    const ctaHeight = 64;
    roundRect(ctx, cx - ctaWidth / 2, y - ctaHeight / 2, ctaWidth, ctaHeight, 32);
    ctx.fillStyle = C.navy;
    ctx.fill();
    ctx.fillStyle = C.goldLight;
    ctx.fillText(ctaText, cx, y + 2);

    y += 62;
    const domain = window.location.host + (examEngine.basePath || '');
    ctx.direction = 'ltr';
    const linkText = `🔗  ${domain}`;
    ctx.font = '700 30px Tajawal, sans-serif';
    const linkPadX = 40;
    const linkWidth = ctx.measureText(linkText).width + linkPadX * 2;
    const linkHeight = 60;
    roundRect(ctx, cx - linkWidth / 2, y - linkHeight / 2, linkWidth, linkHeight, 30);
    ctx.fillStyle = C.navy;
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.goldLight;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(linkText, cx, y + 2);
    ctx.direction = 'rtl';

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  }

  async function shareQuestion(app) {
    if (!window.publicAuth.user) {
      window.publicAuth.requireAuth(() => app.shareQuestion());
      return;
    }
    const q = examEngine.questions[examEngine.currentQuestionIndex];
    if (!q) return;
    const btn = document.getElementById('share-question-btn');
    const iconEl = btn ? btn.querySelector('.share-icon') : null;
    const originalIcon = iconEl ? iconEl.innerText : '📤';
    if (btn) btn.disabled = true;
    if (iconEl) iconEl.innerText = '⏳';

    try {
      const blob = await generateShareCard(app, q);
      const shareUrl = buildDeepLink(app, q);
      const file = new File([blob], 'question.jpg', { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'سؤال من منصة الاختبارات القانونية',
          text: `جرب تجاوب على هذا السؤال 👇\n${shareUrl}`
        });
      } else if (navigator.share) {
        await navigator.share({ title: 'سؤال من منصة الاختبارات القانونية', text: shareUrl, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('تم نسخ رابط السؤال (المشاركة المباشرة غير مدعومة بهذا المتصفح).');
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('فشلت المشاركة:', err);
    } finally {
      if (btn) btn.disabled = false;
      if (iconEl) iconEl.innerText = originalIcon;
    }
  }


  window.MizanQuestionSharing = Object.freeze({
    buildDeepLink: (app, q) => buildDeepLink(app, q),
    roundRect: (ctx, x, y, w, h, r) => roundRect(ctx, x, y, w, h, r),
    wrapText: (ctx, text, maxWidth) => wrapText(ctx, text, maxWidth),
    generateShareCard: (app, q) => generateShareCard(app, q),
    shareQuestion: app => shareQuestion(app)
  });
})();
