const FIRESTORE_PROJECT = 'iraq-law-test';
const FIREBASE_API_KEY = 'AIzaSyDDZNWGjUfcuyXHyWtILZ06hnOWW-ZxGIM';
const SITE_URL = 'https://www.mizan-iraq.com';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
const ARTICLE_TAGS = new Set(['p','br','strong','b','em','i','u','h2','h3','h4','ul','ol','li','blockquote']);
const ARTICLE_COLORS = new Set(['#0f172a','#1d4ed8','#047857','#b45309','#b91c1c','#6d28d9']);
function renderArticleContent(value) {
  const source = String(value ?? '');
  if (!source.includes('<')) return escapeHtml(source).replace(/\r?\n/g, '<br>');
  return source
    .replace(/<(script|style|iframe|object|svg|math|form|button|textarea|input|img|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|svg|math|form|button|textarea|input|img|video|audio)\b[^>]*\/?>/gi, '')
    .replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (whole, rawTag, rawAttrs) => {
      const tag = rawTag.toLowerCase();
      if (!ARTICLE_TAGS.has(tag)) return '';
      let style = '';
      const match = String(rawAttrs).match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const value = match ? (match[1] || match[2] || match[3] || '') : '';
      const color = value.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-f]{6})\s*(?:;|$)/i)?.[1]?.toLowerCase();
      const background = value.match(/(?:^|;)\s*background-color\s*:\s*(#[0-9a-f]{6})\s*(?:;|$)/i)?.[1]?.toLowerCase();
      const align = value.match(/(?:^|;)\s*text-align\s*:\s*(left|right|center|justify)\s*(?:;|$)/i)?.[1]?.toLowerCase();
      const styles = [];
      if (color && ARTICLE_COLORS.has(color)) styles.push('color:'+color);
      if (background && ARTICLE_COLORS.has(background)) styles.push('background-color:'+background);
      if (align) styles.push('text-align:'+align);
      if (styles.length) style = ' style="'+styles.join(';')+'"';
      return '<'+tag+style+'>';
    })
    .replace(/<\/(?!p\b|strong\b|b\b|em\b|i\b|u\b|h2\b|h3\b|h4\b|ul\b|ol\b|li\b|blockquote\b)[a-z][^>]*>/gi, '')
    .replace(/<(p|strong|b|em|i|u|h2|h3|h4|ul|ol|li|blockquote)\s+([^>]*)>/gi, '<$1>');
}


function field(fields, name) {
  const value = fields?.[name];
  if (!value) return '';
  if (typeof value.stringValue === 'string') return value.stringValue;
  if (typeof value.timestampValue === 'string') return value.timestampValue;
  if (typeof value.integerValue === 'string') return value.integerValue;
  if (typeof value.doubleValue === 'number') return String(value.doubleValue);
  return '';
}

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Baghdad'
  }).format(date);
}

function page(status, title, description, canonical, body) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<meta name="robots" content="${status === 200 ? 'index,follow' : 'noindex,nofollow'}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="منبر ميزان">
<meta property="og:locale" content="ar_IQ">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:#1d2939;font-family:Tahoma,Arial,sans-serif;line-height:1.9}.top{background:#102b46;color:#fff;padding:18px max(20px,calc((100% - 900px)/2));font-weight:700}.wrap{max-width:900px;margin:28px auto;padding:0 18px}.article{background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:clamp(22px,5vw,48px);box-shadow:0 8px 30px #1018280b}.meta{color:#667085;font-size:14px;display:flex;gap:12px;flex-wrap:wrap}h1{font-size:clamp(25px,4vw,38px);line-height:1.5;margin:14px 0 18px;color:#102b46}.excerpt{font-size:18px;color:#475467;border-right:3px solid #c59b55;padding:4px 15px;margin:20px 0}.content{overflow-wrap:anywhere;font-size:17px;text-align:right}.content h2{font-size:1.35em;margin:1.1em 0 .5em;color:#102b46}.content h3{font-size:1.15em;margin:1em 0 .45em}.content p{margin:.55em 0}.content ul,.content ol{padding-inline-start:1.7em}.content blockquote{margin:1em 0;padding:.7em 1em;border-inline-start:3px solid #2563eb;background:#edf4ff;border-radius:8px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.actions a,.actions button{border:0;border-radius:10px;padding:11px 16px;font:inherit;text-decoration:none;cursor:pointer;background:#102b46;color:#fff}.actions a.secondary{background:#edf1f5;color:#102b46}footer{text-align:center;color:#667085;font-size:13px;padding:20px}
</style>
</head>
<body>
<header class="top"><a href="/" style="color:inherit;text-decoration:none">⚖ ميزان — منبر المقالات القانونية</a></header>
<main class="wrap">${body}</main>
<footer>© ميزان. المحتوى للتعلم والمعرفة القانونية ولا يغني عن الرجوع إلى المصادر الرسمية.</footer>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const rawId = req.query?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (req.method !== 'GET' || typeof id !== 'string' || !id.trim() || id.length > 512) {
    res.setHeader('Allow', 'GET');
    res.status(400).send('طلب غير صالح');
    return;
  }

  const canonical = `${SITE_URL}/pulpit/${encodeURIComponent(id)}`;
  if (req.query?.format === 'json') {
    try {
      const endpoint = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/mizanArticles/${encodeURIComponent(id)}?key=${FIREBASE_API_KEY}`;
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(response.status === 404 ? 404 : 502).json({ error: 'article_unavailable' });
        return;
      }
      const document = await response.json();
      const fields = document.fields || {};
      if (field(fields, 'status') !== 'published') {
        res.setHeader('Cache-Control', 'no-store');
        res.status(404).json({ error: 'article_unavailable' });
        return;
      }
      const value = name => field(fields, name);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        id,
        title: value('title') || 'مقال قانوني من منبر ميزان',
        excerpt: value('excerpt'),
        content: value('content'),
        authorName: value('authorName') || 'كاتب مساهم',
        authorUid: value('authorUid'),
        authorTitle: value('authorTitle'),
        authorSpecialization: value('authorSpecialization'),
        type: value('type') || 'مقالة قانونية',
        publishedAt: value('publishedAt') || value('createdAt'),
        status: 'published'
      });
      return;
    } catch (error) {
      console.error('Mizan article JSON endpoint error:', error);
      res.setHeader('Cache-Control', 'no-store');
      res.status(502).json({ error: 'article_fetch_failed' });
      return;
    }
  }
  // Human visitors go straight to the real Mizan app. Social crawlers still
  // receive server-rendered Open Graph metadata for link previews.
  const userAgent = String(req.headers['user-agent'] || '');
  const isPreviewCrawler = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot|Applebot|Pinterestbot|Embedly|Quora Link Preview|vkShare|W3C_Validator/i.test(userAgent);
  if (!isPreviewCrawler) {
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, `${SITE_URL}/?article=${encodeURIComponent(id)}`);
    return;
  }

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/mizanArticles/${encodeURIComponent(id)}?key=${FIREBASE_API_KEY}`;
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(response.status === 404 ? 404 : 502).send(page(404, 'المقال غير متاح | ميزان', 'هذا المقال غير متاح أو غير منشور.', canonical, '<section class="article"><h1>المقال غير متاح</h1><p>قد يكون المقال غير منشور أو لم يعد متاحاً.</p><div class="actions"><a href="/">العودة إلى ميزان</a></div></section>'));
      return;
    }

    const document = await response.json();
    const fields = document.fields || {};
    if (field(fields, 'status') !== 'published') {
      res.setHeader('Cache-Control', 'no-store');
      res.status(404).send(page(404, 'المقال غير متاح | ميزان', 'هذا المقال غير متاح أو غير منشور.', canonical, '<section class="article"><h1>المقال غير متاح</h1><p>قد يكون المقال غير منشور أو لم يعد متاحاً.</p><div class="actions"><a href="/">العودة إلى ميزان</a></div></section>'));
      return;
    }

    const title = field(fields, 'title') || 'مقال قانوني من منبر ميزان';
    const excerpt = field(fields, 'excerpt');
    const content = field(fields, 'content');
    const author = field(fields, 'authorName') || 'كاتب مساهم';
    const type = field(fields, 'type') || 'مقالة قانونية';
    const publishedAt = dateLabel(field(fields, 'publishedAt') || field(fields, 'createdAt'));
    const description = (excerpt || content).replace(/\s+/g, ' ').trim().slice(0, 240) || 'مقال قانوني منشور في منبر ميزان.';
    const body = `<article class="article"><div class="meta"><span>${escapeHtml(type)}</span>${publishedAt ? `<time>${escapeHtml(publishedAt)}</time>` : ''}<span>${escapeHtml(author)}</span></div><h1>${escapeHtml(title)}</h1>${excerpt ? `<div class="excerpt">${escapeHtml(excerpt)}</div>` : ''}<div class="content">${renderArticleContent(content)}</div><div class="actions"><button type="button" id="share">مشاركة المقال</button><a class="secondary" href="/">العودة إلى ميزان</a></div></article><script>document.getElementById('share').addEventListener('click',async()=>{const data={title:document.title,text:document.title,url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);alert('تم نسخ رابط المقال')}}catch(e){if(e.name!=='AbortError')alert('تعذرت المشاركة؛ انسخ الرابط من شريط العنوان')}});</script>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).send(page(200, `${title} | منبر ميزان`, description, canonical, body));
  } catch (error) {
    console.error('Article page render failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).send(page(500, 'تعذر تحميل المقال | ميزان', 'تعذر تحميل المقال حالياً.', canonical, '<section class="article"><h1>تعذر تحميل المقال</h1><p>حاول مرة أخرى بعد قليل.</p><div class="actions"><a href="/">العودة إلى ميزان</a></div></section>'));
  }
};
