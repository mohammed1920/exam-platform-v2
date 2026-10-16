const PROJECT = 'iraq-law-test';
const API_KEY = 'AIzaSyDDZNWGjUfcuyXHyWtILZ06hnOWW-ZxGIM';
const SITE_URL = 'https://www.mizan-iraq.com';

function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character]);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    // Query only publicly published articles. This matches the public site's
    // Firestore query instead of listing the whole collection (which can be
    // denied by Firestore rules even when published articles are readable).
    const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${API_KEY}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'mizanArticles' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'published' }
            }
          }
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Firestore published-articles query failed: ${response.status} ${details.slice(0, 300)}`);
    }

    const results = await response.json();
    const urls = new Set([`${SITE_URL}/`]);

    for (const item of results || []) {
      const document = item?.document;
      if (!document || document.fields?.status?.stringValue !== 'published') continue;
      const id = document.name?.split('/').pop();
      if (id) urls.add(`${SITE_URL}/pulpit/${encodeURIComponent(id)}`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].map(url => `  <url><loc>${xmlEscape(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.status(200).send(xml);
  } catch (error) {
    console.error('Mizan sitemap generation failed:', error);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    // Do not return a misleading successful sitemap containing only the home page.
    res.status(500).send('Unable to generate sitemap');
  }
};
