# Qurix Chatbot OpenAI Proxy

A 60-line Vercel serverless function that sits between the public chatbot
(served from GitHub Pages) and `api.openai.com/v1/chat/completions`. The
OpenAI key lives only in this proxy's environment variables, so it is
never shipped to the browser.

## Endpoint

```
POST /api/chat
Content-Type: application/json

{ "model": "...", "messages": [...], "tools": [...], ... }
```

Body, status, and response shape are forwarded as-is to OpenAI. The client
should send the exact body it would have sent to OpenAI directly, minus the
`Authorization` header.

## Access control

Requests are gated by an `Origin` allowlist (see `api/chat.js`):

- `https://nagendranaren1992.github.io` (GitHub Pages deploy)
- A few `localhost:*` ports (Expo dev server)

To add more origins, set the `ALLOWED_ORIGINS` env var on Vercel to a
comma-separated list. `Origin` is browser-supplied and can be spoofed, so
treat this as casual-abuse protection, not strong auth.

## First-time deploy

Prereqs: a free Vercel account, Node 18+, and a valid OpenAI key.

```bash
cd server
npx vercel login            # follow the link, sign in
npx vercel link             # create or link a Vercel project (accept defaults)
npx vercel env add OPENAI_API_KEY production
# paste the OpenAI key when prompted
npx vercel --prod           # deploys; prints the production URL
```

The final command prints something like
`https://qurix-chatbot-proxy.vercel.app`. The chatbot calls
`https://qurix-chatbot-proxy.vercel.app/api/chat`.

## Redeploys after code changes

```bash
cd server
npx vercel --prod
```

## Local dev

```bash
cd server
cp .env.example .env.local
# edit .env.local and paste a real key
npx vercel dev              # serves on http://localhost:3000
```

Then point the chatbot at `http://localhost:3000/api/chat` by setting
`EXPO_PUBLIC_LLM_PROXY_URL=http://localhost:3000/api/chat` in the root
`.env` and running `npm run web` from the project root.
