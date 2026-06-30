// =================================================================
// OpenAI chat completion wrapper (with tool calling).
//
// Uses direct fetch instead of the `openai` npm SDK so it works
// identically on React Native (web, iOS, Android) with no extra
// dependencies or polyfills.
//
// SECURITY NOTE:
// The API key is read from EXPO_PUBLIC_OPENAI_API_KEY which Expo
// bundles into the client. That's fine for local development; for
// production, replace this module with calls to a small backend
// proxy that holds the real key server-side.
// =================================================================

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o';

export const hasApiKey = () =>
  typeof API_KEY === 'string' && API_KEY.startsWith('sk-');

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
      'OpenAI key missing. Set EXPO_PUBLIC_OPENAI_API_KEY in your .env file ' +
      '(see .env.example) and restart the dev server.'
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

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
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
