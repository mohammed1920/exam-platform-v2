const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'iraq-law-test';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDDZNWGjUfcuyXHyWtILZ06hnOWW-ZxGIM';
const VALID_CATEGORIES = new Set(['civil', 'criminal', 'administrative', 'personal']);
const MAX_BODY_BYTES = 30000;

function send(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(payload);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const firebaseApiKey = FIREBASE_API_KEY;
  if (!githubToken) {
    return send(res, 503, { error: 'github_configuration_missing' });
  }

  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return send(res, 401, { error: 'authentication_required' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) {
      return send(res, 413, { error: 'payload_too_large' });
    }

    const identityResponse = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(firebaseApiKey),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: match[1] }) }
    );
    if (!identityResponse.ok) return send(res, 401, { error: 'invalid_session' });
    const identity = await identityResponse.json();
    const user = identity.users?.[0];
    if (!user?.localId) return send(res, 401, { error: 'invalid_session' });

    const adminResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents/admins/${encodeURIComponent(user.localId)}?key=${encodeURIComponent(firebaseApiKey)}`,
      { headers: { Authorization: 'Bearer ' + match[1], Accept: 'application/json' } }
    );
    if (!adminResponse.ok) return send(res, 403, { error: 'admin_verification_failed' });
    const adminDoc = await adminResponse.json();
    const fields = adminDoc.fields || {};
    if (fields.role?.stringValue !== 'admin' || fields.enabled?.booleanValue === false) {
      return send(res, 403, { error: 'admin_only' });
    }

    const id = String(body.id || '').trim();
    const category = String(body.category || '').trim();
    const title = String(body.title || '').trim();
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(id) || !VALID_CATEGORIES.has(category) || title.length < 3 || title.length > 180) {
      return send(res, 400, { error: 'invalid_procedure_data' });
    }

    const procedure = {
      id,
      title,
      category,
      summary: String(body.summary || '').slice(0, 2000),
      requirements: String(body.requirements || '').slice(0, 5000),
      documents: String(body.documents || '').slice(0, 5000),
      steps: String(body.steps || '').slice(0, 10000),
      legalBasis: String(body.legalBasis || '').slice(0, 5000),
      fees: String(body.fees || '').slice(0, 500),
      duration: String(body.duration || '').slice(0, 500),
      published: body.published === true,
      updatedAt: new Date().toISOString()
    };
    const path = `data/procedures/${category}/${id}.json`;
    const apiBase = 'https://api.github.com/repos/mohammed1920/exam-platform-v2/contents/' + path.split('/').map(encodeURIComponent).join('/');
    const headers = {
      Authorization: 'Bearer ' + githubToken,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };

    const existingResponse = await fetch(apiBase + '?ref=main', { headers });
    let sha;
    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      sha = existing.sha;
    } else if (existingResponse.status !== 404) {
      console.error('GitHub file lookup failed:', existingResponse.status);
      return send(res, 502, { error: 'github_file_lookup_failed' });
    }

    const writeBody = {
      message: `Save legal procedure: ${title}`,
      content: Buffer.from(JSON.stringify(procedure, null, 2) + '\n', 'utf8').toString('base64'),
      branch: 'main'
    };
    if (sha) writeBody.sha = sha;
    const writeResponse = await fetch(apiBase, { method: 'PUT', headers, body: JSON.stringify(writeBody) });
    if (!writeResponse.ok) {
      console.error('GitHub procedure write failed:', writeResponse.status, await writeResponse.text());
      return send(res, 502, { error: 'github_file_write_failed' });
    }
    const result = await writeResponse.json();
    return send(res, 200, { success: true, path, commit: result.commit?.sha || null });
  } catch (error) {
    console.error('Procedure file endpoint failed:', error);
    return send(res, 500, { error: 'procedure_file_save_failed' });
  }
};
