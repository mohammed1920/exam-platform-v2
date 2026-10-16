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
    const urls = new Set([`${SITE_URL}/`]);
    let pageToken = '';
    do {
      const query = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) query.set('pageToken', pageToken);
      const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/mizanArticles?${query.toString()}&key=${API_KEY}`;
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Firestore sitemap query failed: ${response.status}`);
      const result = await response.json();
      for (const document of result.documents || []) {
        if (document?.fields?.status?.stringValue !== 'published') continue;
        const id = document.name?.split('/').pop();
        if (id) urls.add(`${SITE_URL}/pulpit/${encodeURIComponent(id)}`);
      }
      pageToken = result.nextPageToken || '';
    } while (pageToken);
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
