# One Journey — Ahmedabad & Gandhinagar Transit Planner

A multimodal transit planner for **Ahmedabad and Gandhinagar** covering Metro, AMTS, BRTS, and GTSL bus networks. Built with React + Vite, with an optional Node.js AI chat backend powered by IBM Granite / watsonx.ai.

## 📽️ Demo Video

▶️ [Watch the demo on Google Drive](https://drive.google.com/file/d/17O1Utm_oaBaTooLouDkwnChWLzcAHfGu/view?usp=sharing)

---

## Features

- **Multimodal routing** — plans journeys across Metro, AMTS, BRTS, and GTSL in a single search
- **Smart location search** — autocomplete with metro stations, bus stops, landmarks, and live OpenStreetMap geocoding
- **Interactive map** — Leaflet-based route map with colour-coded legs and walk paths
- **AI Transit Chatbot** — floating chat assistant for route questions; works offline with a local rule-based engine or live via IBM Granite
- **Voice input** — browser Web Speech API with automatic `gu-IN` / `hi-IN` / `en-IN` locale selection and language-not-supported fallback
- **Multilingual UI** — English, ગુજરાતી, and हिन्दी with full i18n coverage
- **Offline-first** — all routing runs client-side from a bundled transit dataset; no server required for journey planning

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6 |
| Map | Leaflet 1.9 |
| AI Backend | Node.js (ESM), IBM watsonx.ai / Granite |
| Styling | Plain CSS (custom properties) |
| Build | Vite (`npm run build`) |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the AI backend (optional)

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
API_KEY=your_ibm_api_key
PROJECT_ID=your_watsonx_project_id
AI_URL=https://us-south.ml.cloud.ibm.com   # optional, defaults to Dallas
MODEL_ID=ibm/granite-3-8b-instruct          # optional
PORT=3001
```

> **Without credentials** the chatbot runs in offline mode using a built-in local transit engine. All journey planning always works offline regardless of this setting.

### 3. Start the development server

```bash
npm run dev
```

The Vite dev server starts at `http://localhost:5173`. The AI API routes (`/api/chat`, `/api/chat/status`) are served by a Vite middleware plugin — no separate server process needed during development.

### 4. Build for production

```bash
npm run build
```

Output is in `dist/`.

### 5. Run the production build with the AI backend

```bash
npm run server        # starts Node.js backend on PORT (default 3001)
npm run preview       # serves the Vite build at http://localhost:4173
```

Or serve `dist/` from any static host and point your frontend's `/api/*` proxy to the Node backend.

---

## Project Structure

```
one-journey-react/
├── src/
│   ├── main.jsx              # App entry, router, all page layout
│   ├── styles.css            # Single CSS file (custom properties theme)
│   ├── i18n.js               # All translation strings (en / gu / hi)
│   ├── components/
│   │   ├── Chatbot.jsx       # Floating PIP chat window with voice input
│   │   ├── LocationInput.jsx # Autocomplete location field
│   │   └── RouteMap.jsx      # Leaflet interactive route map
│   ├── services/
│   │   └── geocoding.js      # Location search (offline stops + live OSM)
│   └── data/
│       ├── journey_demo_data.json   # Transit nodes, edges, headways
│       └── stop_names_i18n.json     # Stop name translations (lazy-loaded)
├── server/
│   ├── index.js              # Node HTTP server (API routes)
│   ├── chatService.js        # AI chat handler + local fallback engine
│   └── watsonxService.js     # IBM watsonx.ai client
├── scripts/
│   └── translate-stops.js    # Build script for stop name i18n
├── vite.config.js            # Vite config + AI backend dev middleware
├── .env.example              # Environment variable template
└── package.json
```

---

## API Reference

The Node backend exposes three endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/chat/status` | Returns AI configuration status and model name |
| `POST` | `/api/chat` | Sends a message, returns `{ reply, provider, model }` |
| `GET` | `/api/health` | Health check — returns `{ status: "ok" }` |

**POST `/api/chat` request body:**
```json
{
  "messages": [{ "role": "user", "content": "How do I get to GIFT City?" }],
  "language": "en"
}
```

---

## Voice Input

The chatbot mic button uses the browser's Web Speech API:

- Automatically selects `gu-IN`, `hi-IN`, or `en-IN` based on the active language
- Falls back to `en-IN` if the browser does not support the selected locale
- Shows inline error messages in the active language for mic permission denial or no-speech events

Supported in Chrome, Edge, and Safari. The button is hidden on browsers that do not expose `SpeechRecognition`.

---

## Translate Stop Names

To regenerate the stop name translations from source data:

```bash
npm run translate-stops
```

---

## License

Private — not licensed for public distribution.
