# dorAImon

Real-time AI productivity monitor that watches your screen, understands what you're doing, and provides live translation overlays — all running locally with a transparent Electron overlay.

## What It Does

dorAImon captures your screen in real-time and runs three parallel AI pipelines:

- **OCR Pipeline (2 FPS)** — Extracts all visible text with bounding boxes using Tesseract
- **Vision Pipeline (0.25 FPS)** — Analyzes the screen with Pixtral-12B to understand what app/site you're using and what you're doing
- **Intent Classifier (0.5 FPS)** — Classifies your productivity state as `normal`, `hesitant` (stuck/distracted), or `typo` using Ministral-3B

On top of that, a **floating translation panel** overlays your screen — translating any on-screen text in real-time with language auto-detection. Click any translated line to highlight where the original text is on screen.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Electron Overlay (React + Zustand + Tailwind)  │
│  - Transparent, click-through, always-on-top    │
│  - Spans all monitors                           │
│  - Translation panel, region selector, widget   │
└──────────────────────┬──────────────────────────┘
                       │ WebSocket (ws://localhost:8000)
┌──────────────────────┴──────────────────────────┐
│  FastAPI Backend (Python)                        │
│  ┌────────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ OCR (2fps) │ │ Vision   │ │ Classifier    │  │
│  │ Tesseract  │ │ Pixtral  │ │ Ministral-3B  │  │
│  └────────────┘ └──────────┘ └───────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Translator (Argos Translate — offline)     │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **Tesseract OCR** — `brew install tesseract` (macOS) or `apt install tesseract-ocr` (Linux)
- **Mistral API key** — Get one at [console.mistral.ai](https://console.mistral.ai)

## Setup

### 1. Clone and configure

```bash
git clone <repo-url> && cd dorAImon
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your Mistral API key:

```env
MISTRAL_API_KEY=your_key_here
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

## Running

The easiest way — start both backend and frontend with one command:

```bash
./start.sh
```

To stop:

```bash
./start.sh stop
```

### Manual start

```bash
# Terminal 1 — Backend
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

## Hotkeys

| Shortcut | Action |
|----------|--------|
| `Alt+H` | Toggle overlay visibility |
| `Alt+T` | Toggle translation mode |
| `Alt+R` | Select screen region for OCR |
| `Alt+Q` | Quit dorAImon |
| `Escape` | Cancel region selection |

## Configuration

All config is via environment variables in `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `MISTRAL_API_KEY` | — | **Required.** Mistral AI API key |
| `CAPTURE_MONITOR` | `1` | Which monitor to capture (1 = primary) |
| `OCR_FPS` | `2` | OCR capture rate |
| `VISION_FPS` | `0.25` | Vision analysis rate (every 4s) |
| `CLASSIFIER_FPS` | `0.5` | Intent classification rate (every 2s) |
| `WS_PORT` | `8000` | WebSocket server port |
| `WANDB_ENABLED` | `false` | Enable Weights & Biases metrics logging |
| `WANDB_PROJECT` | `dorAImon` | W&B project name |

## Translation

The overlay includes a draggable floating translation panel (Cluely-style sidebar):

- **Real-time** — Translates on-screen text as you browse, with 800ms throttle
- **Auto-detect** — Automatically detects the source language using `langdetect`
- **Click to highlight** — Click any translated line to see where the original text is on screen
- **Offline** — Uses Argos Translate for local, private translation
- **10 languages** — English, Japanese, French, Spanish, German, Chinese, Korean, Portuguese, Arabic, Russian

## Project Structure

```
dorAImon/
├── start.sh                    # One-command launcher
├── backend/
│   ├── main.py                 # FastAPI + WebSocket server
│   ├── capture.py              # Screen capture (mss)
│   ├── ocr.py                  # Tesseract OCR with bounding boxes
│   ├── vision.py               # Pixtral-12B screen analysis
│   ├── classifier.py           # Ministral-3B intent classifier
│   ├── translator.py           # Argos Translate (offline)
│   ├── pipelines.py            # Pipeline orchestrator
│   ├── metrics.py              # W&B metrics logging
│   ├── config.py               # Environment config
│   ├── agents/                 # Extensible agent system
│   │   ├── base.py             # Abstract agent interface
│   │   └── registry.py         # Agent router
│   └── requirements.txt
└── frontend/
    ├── electron/
    │   ├── main/index.ts       # Electron main process (overlay, tray, hotkeys)
    │   └── preload/index.ts    # IPC bridge
    └── src/
        ├── App.tsx             # Root app with WebSocket + IPC wiring
        ├── components/
        │   ├── Overlay.tsx     # Main overlay container
        │   ├── Widget.tsx      # Productivity widget
        │   ├── TranslationPanel.tsx  # Floating translation sidebar
        │   ├── LanguagePicker.tsx    # Source/target language selector
        │   └── RegionSelector.tsx    # Screen region selection tool
        ├── hooks/
        │   ├── useWebSocket.ts      # WebSocket connection manager
        │   └── useTranslation.ts    # Translation throttle + paragraph merging
        ├── store/appStore.ts        # Zustand global state
        └── types/index.ts           # TypeScript interfaces
```

## Building for Production

```bash
cd frontend
npm run build
```

This compiles TypeScript, bundles with Vite, and packages the Electron app.

## License

MIT
