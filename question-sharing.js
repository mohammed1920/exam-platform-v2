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

    const routeBase = `${origin}${basePath}${basePath ? '/' : ''}`;
    if (!bookId || !chapterNum) return routeBase;

    let url = `${routeBase}?book=${encodeURIComponent(bookId)}&chapter=${chapterNum}`;
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
    const PAD = 72;
    const CONTENT_W = W - PAD * 2;

    try {
      await Promise.all([
        document.fonts.load('700 46px "Aref Ruqaa"'),
        document.fonts.load('500 30px "Tajawal"'),
        document.fonts.load('700 26px "Tajawal"'),
        document.fonts.load('800 32px "Tajawal"'),
        document.fonts.load('700 34px "IBM Plex Sans Arabic"')
      ]);
      await document.fonts.ready;
    } catch (e) { /* نستمر بالخطوط الاحتياطية إذا تعذر التحميل */ }

    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    mctx.font = '700 46px "Aref Ruqaa", serif';
    const lines = wrapText(mctx, q.question, CONTENT_W - 88);
    const optLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    const optionFont = '500 29px Tajawal, sans-serif';
    const optionTextWidth = CONTENT_W - 148;
    const optionRows = q.options.map(opt => {
      mctx.font = optionFont;
      const wrapped = wrapText(mctx, opt, optionTextWidth);
      return Math.max(82, wrapped.length * 38 + 34);
    });

    const TOP = 64;
    const logoSize = 110;
    const titleY = TOP + logoSize + 53;
    const subtitleY = titleY + 52;
    const dividerY = subtitleY + 31;
    const questionTop = dividerY + 70;
    const questionHeight = Math.max(160, lines.length * 64 + 82);
    const optionsTop = questionTop + questionHeight + 30;
    const optionsGap = 16;
    const optionsHeight = optionRows.reduce((sum, h) => sum + h, 0) + Math.max(0, q.options.length - 1) * optionsGap;
    const footerTop = optionsTop + optionsHeight + 34;
    const H = Math.round(footerTop + 166 + 54);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const C = {
      paper: '#F6F8FB',
      surface: '#FFFFFF',
      navy: '#0F172A',
      navySoft: '#172B4D',
      blue: '#2563EB',
      gold: '#D4AF37',
      goldSoft: '#F3E5AB',
      ink: '#111827',
      muted: '#66758A',
      line: '#DCE4ED',
      paleBlue: '#EEF4FF'
    };
    const cx = W / 2;

    // خلفية نظيفة بإطار رفيع ولمسة علوية من هوية ميزان.
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.navy;
    ctx.fillRect(0, 0, W, 14);
    ctx.fillStyle = C.gold;
    ctx.fillRect(0, 14, W, 5);
    roundRect(ctx, 28, 28, W - 56, H - 56, 30);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    // استخدام شعار ميزان الموجود بالمشروع نفسه بدلاً من رمز ميزان عام.
    const logoUrl = new URL('icons/icon-512.png', window.location.href).href;
    const logo = await new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = logoUrl;
    });

    let y = TOP + 10;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, y + logoSize / 2, logoSize / 2 + 7, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 4;
    ctx.stroke();
    if (logo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, y + logoSize / 2, logoSize / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logo, cx - logoSize / 2, y, logoSize, logoSize);
      ctx.restore();
    } else {
      // بديل بسيط عند تعذر تحميل ملف الأيقونة.
      ctx.fillStyle = C.navy;
      ctx.font = '700 30px "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ميزان', cx, y + logoSize / 2);
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.navy;
    ctx.font = '800 38px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText('منصة ميزان', cx, titleY);
    ctx.fillStyle = C.muted;
    ctx.font = '500 24px "Tajawal", sans-serif';
    ctx.fillText('حيث يُقاس الفهم القانوني بدقة', cx, titleY + 36);

    const bookTitle = (app.isCustomExam && q.sourceBook) ? q.sourceBook : app.currentBook.title;
    const chapterNum = (app.isCustomExam && q.sourceChapter) ? q.sourceChapter : app.currentChapter;
    const meta = `${bookTitle}  ·  الفصل ${chapterNum}`;
    const metaY = subtitleY + 37;
    const metaW = Math.min(CONTENT_W, Math.max(340, (() => {
      ctx.font = '700 25px Tajawal, sans-serif';
      return ctx.measureText(meta).width + 64;
    })()));
    roundRect(ctx, cx - metaW / 2, metaY - 33, metaW, 50, 25);
    ctx.fillStyle = C.paleBlue;
    ctx.fill();
    ctx.strokeStyle = '#D6E4FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.navySoft;
    ctx.font = '700 25px Tajawal, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta, cx, metaY - 8);

    // خط فاصل باللون الذهبي قبل نص السؤال.
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 64, dividerY);
    ctx.lineTo(cx + 64, dividerY);
    ctx.stroke();

    // سؤال رئيسي داخل بطاقة واضحة، مع ارتفاع محسوب من عدد الأسطر.
    roundRect(ctx, PAD, questionTop, CONTENT_W, questionHeight, 24);
    ctx.fillStyle = '#FBFCFE';
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.blue;
    roundRect(ctx, W - PAD - 8, questionTop + 28, 5, questionHeight - 56, 3);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = '700 46px "Aref Ruqaa", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let textY = questionTop + (questionHeight - lines.length * 64) / 2 + 42;
    lines.forEach(line => {
      ctx.fillText(line, cx, textY);
      textY += 64;
    });

    let optionY = optionsTop;
    q.options.forEach((opt, i) => {
      const rowH = optionRows[i];
      roundRect(ctx, PAD, optionY, CONTENT_W, rowH, 18);
      ctx.fillStyle = C.surface;
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.stroke();

      const circleR = 25;
      const circleCx = W - PAD - 37;
      const circleCy = optionY + rowH / 2;
      ctx.beginPath();
      ctx.arc(circleCx, circleCy, circleR, 0, Math.PI * 2);
      ctx.fillStyle = C.navy;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 25px Tajawal, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(optLetters[i] || String(i + 1), circleCx, circleCy + 1);

      ctx.font = optionFont;
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'right';
      const wrappedOption = wrapText(ctx, opt, optionTextWidth);
      const lineHeight = 38;
      const firstY = circleCy - ((wrappedOption.length - 1) * lineHeight) / 2;
      wrappedOption.forEach((line, lineIndex) => {
        ctx.fillText(line, circleCx - circleR - 23, firstY + lineIndex * lineHeight);
      });
      optionY += rowH + optionsGap;
    });

    // التذييل يركز على الدعوة للتجربة والرابط فقط.
    const footerLineY = footerTop;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, footerLineY);
    ctx.lineTo(W - PAD, footerLineY);
    ctx.stroke();

    const ctaY = footerTop + 52;
    const ctaText = 'جاوب بنفسك الآن';
    ctx.font = '800 31px "Tajawal", sans-serif';
    const ctaWidth = Math.min(CONTENT_W, ctx.measureText(ctaText).width + 116);
    const ctaHeight = 62;
    roundRect(ctx, cx - ctaWidth / 2, ctaY - ctaHeight / 2, ctaWidth, ctaHeight, 31);
    ctx.fillStyle = C.navy;
    ctx.fill();
    ctx.fillStyle = C.goldSoft;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✋  ' + ctaText, cx, ctaY + 1);

    const domain = window.location.host + (examEngine.basePath || '');
    const linkY = footerTop + 124;
    const linkText = domain;
    ctx.font = '700 27px "Tajawal", sans-serif';
    const linkWidth = Math.min(CONTENT_W, ctx.measureText(linkText).width + 82);
    roundRect(ctx, cx - linkWidth / 2, linkY - 27, linkWidth, 54, 27);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.navy;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↗  ' + linkText, cx, linkY);
    ctx.direction = 'rtl';

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.94));
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
          title: 'سؤال من منصة ميزان',
          text: `جرب تجاوب على هذا السؤال 👇\n${shareUrl}`
        });
      } else if (navigator.share) {
        await navigator.share({ title: 'سؤال من منصة ميزان', text: shareUrl, url: shareUrl });
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
    shareQuestion: app => shareQuestion(app)
  });
})();
