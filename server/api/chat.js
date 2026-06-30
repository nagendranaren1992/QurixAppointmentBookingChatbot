// =================================================================
// Qurix chatbot OpenAI proxy (Vercel serverless function).
//
// The static GitHub Pages site posts the OpenAI-format chat-completion
// request to this endpoint. This function injects the real OpenAI API
// key (held only in the OPENAI_API_KEY server env var) and forwards
// the call upstream, so the key is never present in the browser bundle.
//
// Access is gated by an Origin allowlist. This is not strong auth —
// Origin is a browser header and can be spoofed by a determined caller
// — but it stops casual abuse and keeps the OpenAI bill under control
// for an internal team-share demo. Add a shared secret header if you
// need stronger gating.
// =================================================================

const DEFAULT_ALLOWED_ORIGINS = [
  'https://nagendranaren1992.github.io',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
];

const getAllowedOrigins = () => {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra])];
};

const isOriginAllowed = (origin, allowed) =>
  !!origin && allowed.includes(origin);

const applyCors = (req, res, allowed) => {
  const origin = req.headers.origin || '';
  if (isOriginAllowed(origin, allowed)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
};

export default async function handler(req, res) {
  const allowed = getAllowedOrigins();
  const origin = req.headers.origin || '';

  applyCors(req, res, allowed);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  if (!isOriginAllowed(origin, allowed)) {
    res.status(403).json({
      error: 'Origin not allowed.',
      hint: 'Add this origin to the ALLOWED_ORIGINS env var on the proxy.',
    });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.startsWith('sk-')) {
    res.status(500).json({
      error: 'Server is missing a valid OPENAI_API_KEY env var.',
    });
    return;
  }

  // Vercel auto-parses JSON bodies for application/json requests.
  const body = req.body;
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) {
    res.status(400).json({
      error: 'Request body must be a JSON object with a `messages` array.',
    });
    return;
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/json'
    );
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: 'Upstream OpenAI request failed.',
      detail: String(err && err.message ? err.message : err),
    });
  }
}
