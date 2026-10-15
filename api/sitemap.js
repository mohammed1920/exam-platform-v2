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
    const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${API_KEY}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'mizanArticles' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'published' }
            }
          },
          limit: 1000
        }
      })
    });
    if (!response.ok) throw new Error(`Firestore sitemap query failed: ${response.status}`);
    const rows = await response.json();
    const urls = new Set([`${SITE_URL}/`]);
    for (const row of rows) {
      const name = row?.document?.name;
      if (!name || row?.document?.fields?.status?.stringValue !== 'published') continue;
      const id = name.split('/').pop();
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
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.mizan-iraq.com/</loc></url></urlset>');
  }
};
