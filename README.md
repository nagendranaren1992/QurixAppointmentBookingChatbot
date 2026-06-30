# Qurix Healthcare Chatbot

A conversational, AI-powered appointment-booking assistant built in **React Native** (Expo). Runs on **Web, iOS, and Android** from a single codebase. The chat is driven by OpenAI's tool-calling — the agent talks naturally with the patient and invokes the Qurix API behind the scenes to find doctors, check availability, and book the appointment.

---

## Features

- Natural-language chat: "I need a cardiologist tomorrow" → agent searches, finds slots, books.
- LLM-driven flow (OpenAI tool calling) — no rigid step machine.
- Inline pickers for structured choices (doctor / time / procedure).
- Hard confirmation card before any booking call is made.
- Patient lookup by mobile; auto-collects new-patient details otherwise.
- Follow-up procedure (`OPREVISIT`) is shown only when the patient is eligible.
- Branded Qurix UI — sidebar dashboard on desktop, full-screen on mobile.
- Mock mode for offline testing (toggle `USE_MOCK` in `src/services/api.js`).

---

## Project Structure

```
QurixChatbot/
├── App.js                          # Entry — responsive dashboard layout
├── index.js                        # Expo root registration
├── metro.config.js                 # Wires react-native-svg-transformer
├── app.json / babel.config.js
├── package.json
├── .env / .env.example             # OpenAI key (git-ignored)
├── assets/
│   └── qurix_logo.svg
└── src/
    ├── constants/
    │   └── theme.js                # Qurix brand colors, sizes, shadows
    ├── services/
    │   ├── api.js                  # Real + mock API + booking payload builder
    │   ├── llm.js                  # OpenAI chat-completion wrapper (fetch)
    │   ├── agentPrompt.js          # System prompt for the agent
    │   └── agentTools.js           # Tool schema + handlers
    ├── models/
    │   ├── department.js           # Department + nested doctors
    │   ├── sessionInstance.js      # Doctor availability + flat slots
    │   ├── patient.js              # Patient lookup
    │   └── procedure.js            # Procedure list + eligibility filter
    ├── utils/
    │   └── validators.js           # Mobile / name / DOB validators
    └── components/
        ├── ChatBot.js              # Conversational agent UI (main)
        ├── BrandLogo.js            # SVG logo wrapper
        ├── ChatHeader.js
        ├── ChatMessage.js
        ├── TypingIndicator.js
        ├── ChatInput.js
        ├── OptionList.js
        ├── DOBPicker.js            # (legacy — not used by agent)
        └── BookingConfirmation.js
```

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure your OpenAI key (see next section)
cp .env.example .env
# then edit .env

# 3. Run on web
npm run web

# 4. Or run on native
npm run android
npm run ios          # macOS only
```

---

## OpenAI Setup

The chatbot uses **GPT-4o** with tool calling. You need an API key.

1. Get a key from https://platform.openai.com/api-keys
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and paste your key:
   ```
   EXPO_PUBLIC_OPENAI_API_KEY=sk-...
   # Optional, defaults to gpt-4o:
   # EXPO_PUBLIC_OPENAI_MODEL=gpt-4o-mini
   ```
4. **Restart the dev server.** Expo only reads `.env` on startup; hot reload won't pick up env changes.

The chat will show a yellow banner if the key is missing.

### Production warning

Any variable prefixed `EXPO_PUBLIC_` is bundled into the client — fine for local dev, **not safe for production**. Before shipping:

1. Stand up a small backend (Node/Express, Cloudflare Worker, Next.js API route, etc.) that holds the real key.
2. Replace `src/services/llm.js` so its single `fetch()` call points at your backend endpoint instead of `api.openai.com` directly.
3. The rest of the agent code stays unchanged.

---

## API Endpoints

`src/services/api.js` talks to the Qurix preprod by default:

```js
const BASE_URL = 'https://preprod.qurix.io/preprodhims/openapi';
```

| Step | Method | Endpoint | Notes |
|---|---|---|---|
| Departments + doctors | POST | `/listOfAllSessionsDoctors` | Returns nested doctors per department |
| Doctor availability | POST | `/sessioninstances` | Body: `{ doctorId, locationId, dates }` |
| Patient lookup | GET | `/patients?mobileNo=...&orgId=...&isActive=...&locids=...` | 404 = no patient (handled gracefully) |
| Procedures for session | POST | `/listOfDoctorWiseProceduresV2` | Body: `{ sessionId, locationId }` |
| Book appointment | POST | `/createPatientAppointment/other/` | Combined patient-create + booking |

Static defaults (`locationId`, `orgId`, `locIds`) are tagged with `TODO` comments in `api.js` for future dynamic resolution.

### Mock mode

Flip the switch in `src/services/api.js` for offline testing:

```js
export const USE_MOCK = true;
```

Try mobile `9876543210` (ends in 0) for an existing patient, anything else for the new-patient flow.

---

## How the Agent Works

```
┌─────────────────────────────────────────────────────────┐
│  User types / picks a chip → user message              │
│                ↓                                        │
│  ChatBot.js runs OpenAI tool-calling loop              │
│                ↓                                        │
│  LLM may call: search_doctors, get_doctor_availability, │
│                lookup_patient, list_procedures,         │
│                request_booking                          │
│                ↓                                        │
│  Each tool wraps a call in api.js + its model mapper    │
│                ↓                                        │
│  Tool result returns to LLM; UI auto-renders any        │
│  selectable result as inline chips                      │
│                ↓                                        │
│  For request_booking: UI pauses LLM, shows confirmation │
│  card, only fires the booking API on explicit Confirm  │
└─────────────────────────────────────────────────────────┘
```

Key files:

- `src/services/agentTools.js` — tool schema sent to OpenAI + handlers.
- `src/services/agentPrompt.js` — system prompt (date is injected per session).
- `src/services/llm.js` — single `fetch()` against `chat.completions`.
- `src/components/ChatBot.js` — the agent loop + UI orchestration.

Adding a new tool: define it in `TOOL_SCHEMA`, add a handler, add a `case` in `callTool`. If it returns selectable items, also extend `widgetFromToolResult` and the `renderWidget()` switch in `ChatBot.js`.

---

## Brand Customization

Edit `src/constants/theme.js`:

- `COLORS.primary` — the main brand blue used in header, sidebar, user bubbles.
- `BRAND.name`, `BRAND.tagline`, `BRAND.supportPhone`, `BRAND.supportEmail` — copy.

The logo is bundled at `assets/qurix_logo.svg` and rendered via `<BrandLogo />` (uses `react-native-svg-transformer` so SVGs import as React components).

---

## Responsive Behavior

- **Desktop (≥ 900px wide):** branded sidebar + centered chat window.
- **Mobile / narrow (< 900px):** full-screen chatbot.
- Works the same in a browser, in a WebView, and as a native iOS/Android app.

---

## Support

- Phone: +91-7075740042
- Email: hello@qurix.com
- Website: https://qurix.com
