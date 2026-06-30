// =================================================================
// OpenAI chat completion wrapper (with tool calling).
//
// Uses direct fetch instead of the `openai` npm SDK so it works
// identically on React Native (web, iOS, Android) with no extra
// dependencies or polyfills.
//
// Two modes, picked at build time:
//
//   1. Proxy mode (recommended for any public deploy)
//      Set EXPO_PUBLIC_LLM_PROXY_URL to a backend endpoint that
//      forwards the request to OpenAI and injects the real key
//      server-side. The client sends NO Authorization header and
//      no OpenAI key is bundled.  See server/ for a ready-to-deploy
//      Vercel function.
//
//   2. Direct mode (local development only)
//      If EXPO_PUBLIC_LLM_PROXY_URL is empty, the client calls
//      api.openai.com directly using EXPO_PUBLIC_OPENAI_API_KEY.
//      NEVER ship a build in this mode publicly — OpenAI's secret
//      scanner will revoke the key within minutes.
// =================================================================

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const PROXY_URL = process.env.EXPO_PUBLIC_LLM_PROXY_URL || '';
const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o';

const useProxy = () => PROXY_URL.length > 0;

export const hasApiKey = () =>
  useProxy() || (typeof API_KEY === 'string' && API_KEY.startsWith('sk-'));

/**
 * Run one chat-completion round against OpenAI with tool calling enabled.
 *
 * @param {Array} messages  Array of OpenAI-format messages
 *                          (role: system|user|assistant|tool, content, tool_calls, tool_call_id, name)
 * @param {Array} tools     Array of OpenAI-format tool definitions
 *                          ({ type: 'function', function: { name, description, parameters } })
 * @param {Object} [opts]
 * @param {string} [opts.model]        Override the configured model
 * @param {number} [opts.temperature]  Default 0.3 for crisp, consistent replies
 * @param {AbortSignal} [opts.signal]  For cancellation
 * @returns {Promise<{role, content, tool_calls?}>}  The assistant message
 */
export const chatCompletion = async (messages, tools = [], opts = {}) => {
  if (!hasApiKey()) {
    throw new Error(
      'No LLM endpoint configured. Set EXPO_PUBLIC_LLM_PROXY_URL (recommended) ' +
      'or EXPO_PUBLIC_OPENAI_API_KEY in your .env file (see .env.example) and ' +
      'restart the dev server.'
    );
  }

  const body = {
    model: opts.model || MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
  };

  if (Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const url = useProxy() ? PROXY_URL : OPENAI_URL;
  const headers = { 'Content-Type': 'application/json' };
  if (!useProxy()) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch (_) {
      detail = await res.text();
    }
    const err = new Error(`OpenAI request failed (${res.status}): ${detail}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  if (!message) {
    throw new Error('OpenAI returned an empty response.');
  }
  return message;
};

export const LLM_MODEL = MODEL;
