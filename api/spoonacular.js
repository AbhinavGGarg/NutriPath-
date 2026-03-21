const SPOONACULAR_API_BASE = 'https://api.spoonacular.com';

function parseBody(rawBody) {
  if (!rawBody) return {};
  if (typeof rawBody === 'object') return rawBody;
  if (typeof rawBody !== 'string') return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

function safePath(path) {
  const value = String(path || '');
  if (!value.startsWith('/')) return null;
  if (value.includes('://')) return null;
  if (value.includes('..')) return null;
  return value;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'SPOONACULAR_API_KEY is not configured on the server.' });
    return;
  }

  const payload = parseBody(req.body);
  const method = String(payload?.method || 'GET').toUpperCase();
  const params = payload?.params && typeof payload.params === 'object' ? payload.params : {};
  const form = payload?.form && typeof payload.form === 'object' ? payload.form : null;
  const path = safePath(payload?.path);

  if (!path) {
    res.status(400).json({ error: 'Invalid Spoonacular path.' });
    return;
  }

  const allowedMethods = new Set(['GET', 'POST']);
  if (!allowedMethods.has(method)) {
    res.status(400).json({ error: `Unsupported method: ${method}` });
    return;
  }

  const url = new URL(`${SPOONACULAR_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set('apiKey', apiKey);

  const request = {
    method,
    headers: {
      Accept: 'application/json',
    },
  };

  if (method !== 'GET' && form) {
    request.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    request.body = new URLSearchParams(
      Object.entries(form).reduce((acc, [key, value]) => {
        if (value === undefined || value === null || value === '') return acc;
        acc[key] = String(value);
        return acc;
      }, {}),
    ).toString();
  }

  try {
    const upstream = await fetch(url.toString(), request);
    const raw = await upstream.text();

    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (!upstream.ok) {
      const message =
        json?.message ||
        json?.status ||
        json?.error ||
        raw ||
        `Spoonacular request failed (${upstream.status})`;
      res.status(upstream.status).json({ error: String(message) });
      return;
    }

    if (json !== null) {
      res.status(200).json(json);
      return;
    }

    res.status(200).send(raw);
  } catch (error) {
    res.status(502).json({ error: 'Recipe service is temporarily unavailable.' });
  }
};
