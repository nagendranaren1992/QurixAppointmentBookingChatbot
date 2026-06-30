# Qurix Healthcare Chatbot

A professional, end-to-end appointment booking chatbot built in **React Native** (Expo) that runs on **Web, iOS, and Android** from a single codebase. Designed for the Qurix healthcare platform.

---

## ✨ Features

- 🤖 Step-by-step conversational appointment booking
- 🏥 Department → Doctor → Slot → Procedure flow
- 📱 Mobile-number lookup with existing-patient detection
- 👤 New patient registration (name, gender, DOB)
- ✅ Final confirmation screen with booking summary
- 🎨 Qurix-branded design (sidebar dashboard on desktop, full-screen on mobile)
- 🔌 Mock API for instant testing, easy switch to real backend
- ✅ Input validation (mobile, name, DOB)
- ⚡ Smooth typing indicator and message animations

---

## 📁 Project Structure

```
QurixChatbot/
├── App.js                       # Entry — responsive dashboard layout
├── index.js                     # Expo root registration
├── package.json
├── app.json                     # Expo config (icons, splash, brand color)
├── babel.config.js
└── src/
    ├── constants/
    │   └── theme.js             # Qurix brand colors, fonts, shadows
    ├── services/
    │   └── api.js               # API + mock data (toggle USE_MOCK)
    ├── utils/
    │   └── validators.js        # Mobile / name / DOB validators
    └── components/
        ├── ChatBot.js           # Main orchestrator (state machine)
        ├── ChatHeader.js        # Branded header with logo
        ├── ChatMessage.js       # Bot/user bubble
        ├── TypingIndicator.js   # Animated 3-dot indicator
        ├── ChatInput.js         # Text input + send button
        ├── DOBPicker.js         # Date picker (web + native)
        ├── OptionList.js        # Selectable list (cards / pills)
        └── BookingConfirmation.js
```

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run on web (recommended for first test)
npm run web

# 3. Run on mobile
npm run android      # Android
npm run ios          # iOS (Mac only)
```

> The app launches with **mock data enabled**, so you can fully test the booking flow without any backend.

---

## 🔌 Connecting Your Real API

Open `src/services/api.js` and change two things:

```js
const BASE_URL = 'https://your-real-api.com/v1';  // <-- your API
export const USE_MOCK = false;                    // <-- turn mock off
```

The API expects the following endpoints — **adjust the paths** in `api.js` to match yours:

| Step | Method | Endpoint | Response |
|------|--------|----------|----------|
| 1. Departments | GET | `/departments` | `[{ departmentId, departmentName, icon? }]` |
| 2. Doctors | GET | `/departments/:id/doctors` | `[{ doctorId, doctorName, qualification?, experience? }]` |
| 3. Availability | GET | `/doctors/:id/availability` | `[{ sessionId, date, startTime, endTime, available }]` |
| 4. Procedures | GET | `/sessions/:id/procedures` | `[{ procedureId, procedureName, fee, type }]` |
| 5. Patient lookup | GET | `/patients/lookup?mobile=XXX` | `{ exists, patients: [...] }` |
| 6. Create patient | POST | `/patients` | `{ patientId, ... }` |
| 7. Book | POST | `/appointments` | `{ appointmentId, status, ... }` |

If your endpoints don't match exactly, simply edit the relevant function in `api.js` — the rest of the app doesn't need to change.

### Authentication

If your API requires a bearer token:

```js
import { setAuthToken } from './src/services/api';
setAuthToken('your-jwt-here');
```

---

## 🎨 Brand Colors

Defined in `src/constants/theme.js` — currently set to a deep professional blue (`#0B5FFF`) matching the Qurix platform. The logo is loaded directly from `https://qurix.com/images/brand/logo.svg` at runtime, so it always stays in sync with your brand.

To bundle the logo locally instead, save it to `assets/logo.svg` and update `BRAND.logoUrl` in `theme.js`:

```js
import LogoLocal from './assets/logo.svg';
export const BRAND = { logoUrl: LogoLocal, ... };
```

---

## 🧩 Conversation Flow

```
WELCOME
   ↓
SELECT_DEPARTMENT   (cards, 2-column grid)
   ↓
SELECT_DOCTOR        (cards with qualification + experience)
   ↓
SELECT_SLOT          (cards, 2-column grid)
   ↓
ASK_MOBILE           (text input, 10-digit validation)
   ├─ Number found ──→ SELECT_EXISTING_PATIENT
   │                       ↓
   │                   (or Add new patient)
   └─ New number ──→ ASK_FIRST_NAME → ASK_LAST_NAME →
                     ASK_GENDER → ASK_DOB
   ↓
SELECT_PROCEDURE     (cards with fee)
   ↓
CONFIRM_BOOKING      (summary card + Book button)
   ↓
BOOKED               (success screen)
```

The whole state machine lives in `ChatBot.js` — easy to extend if you need to insert new steps (e.g. insurance, symptoms).

---

## 📱 Responsive Behavior

- **Desktop (≥ 900px wide):** branded sidebar + centered chat window
- **Tablet / Mobile (< 900px):** full-screen chatbot
- Works the same in a browser, in a WebView, and as a native iOS/Android app.

---

## 🧪 Testing the Mock Flow

Try these mobile numbers in the mock mode:
- **9876543210** (ends in `0`) → returns 2 existing patients
- **9876543211** (any other) → goes to new-patient flow

---

## 📞 Support

- Phone: +91-7075740042
- Email: hello@qurix.com
- Website: https://qurix.com
