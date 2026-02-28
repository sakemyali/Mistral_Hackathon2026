# DorAImon

**Mistral AI Hackathon Tokyo 2026**

A self-improving AI assistant that lives as an invisible overlay on your screen. DorAImon watches what you're doing — coding, reading foreign text, hitting errors — and proactively helps through a multi-agent pipeline powered by Mistral AI.

Captures your screen at 2fps, runs Pixtral vision analysis, classifies intent, routes to the right agent, and renders contextual help as glassmorphism overlays — all while staying invisible to your mouse and screen recordings.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Mistral](https://img.shields.io/badge/Mistral_AI-FF7000?logo=data:image/svg+xml;base64,&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss&logoColor=white)

---

## How It Works

```
Screen (2fps) -> Pixtral Vision -> Classify -> Route -> Execute -> Render -> Feedback -> Loop
```

1. **Screen Capture** — 2fps screenshots via Electron `desktopCapturer`
2. **Vision Analysis** — Pixtral-12B analyzes what's on screen (throttled every 3s)
3. **Intent Classifier** — heuristic + vision-augmented detection: hesitation, foreign text, errors, fluent typing
4. **Action Router** — selects the right agent based on intent + confidence
5. **Agent Execution** — Mistral (vision/translate), Vibe (code suggestions), ElevenLabs (voice)
6. **Overlay Render** — glassmorphism UI: translation boxes, code diffs, subtitles, debug panel
7. **User Feedback** — accept/reject logged to W&B as reward signals for self-improvement

## Quick Start

```bash
git clone <repo>
cd doraimon
cp .env.example .env
# Add your MISTRAL_API_KEY (required for real vision/translation)
npm install
npm start
```

Works without API keys too — falls back to stubs for demo/development.

## Hotkeys

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+S` | Show / hide overlay |
| `Ctrl+Shift+C` | Manual AI capture |
| `Escape` | Close panel (tap twice to hide overlay) |

## Agents

| Agent | Model | Role |
|---|---|---|
| **Mistral** | Pixtral-12B / Mistral Large | Vision analysis, OCR, translation, language detection |
| **Vibe** | Vibe CLI | Code suggestions, error fixes, refactoring |
| **ElevenLabs** | eleven_multilingual_v2 | Voice narration personality |
| **W&B** | Weights & Biases | Experiment tracking, RL reward logging |

## Features

- **Click-through transparency** — overlay is invisible to your mouse except UI elements
- **Content-protected** — hidden from screen recordings (OBS, Zoom, etc.)
- **Real Mistral vision** — Pixtral-12B analyzes your screen, feeds the classifier
- **Google Lens-style translation** — OCR bounding boxes with translated text overlays
- **Code suggestion cards** — accept/reject Vibe-generated diffs
- **Voice assistant** — DorAImon narrates what it's doing (Silent/Voice/Auto modes)
- **Debug panel** — real-time pipeline visualization (intent, confidence, agent, latency)
- **Self-improving** — user actions logged as reward signals for offline RL training

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Electron 33 |
| UI framework | React 18 |
| Styling | Tailwind CSS 3.4 + glassmorphism |
| Vision AI | Mistral AI (Pixtral-12B + Mistral Large) via `@mistralai/mistralai` SDK |
| Code agent | Vibe CLI |
| Voice | ElevenLabs |
| Tracking | Weights & Biases |
| Build | Webpack 5 + Babel |

## Project Structure

```
main.js                  Electron main — capture loop, pipeline, hotkeys, IPC
preload.js               Security bridge (contextBridge)
services/
  base-service.js        Abstract service interface
  index.js               Service registry + router
  classifier.js          Intent detection (heuristic + vision)
  router.js              Agent selection logic
  mistral.js             Pixtral vision, translation, chat (real SDK)
  vibe.js                Code suggestions via CLI subprocess
  elevenlabs.js          Voice narration assistant
  wandb.js               Experiment tracking + feedback logging
src/
  App.jsx                Root component, pipeline wiring
  OverlayRenderer.jsx    Subtitle display, typewriter animation
  ControlPanel.jsx       HUD controls, pipeline status, voice toggle
  components/
    TextOverlay.jsx      Google Lens-style translation boxes
    SuggestionCard.jsx   Code diff cards (accept/reject)
    DebugPanel.jsx       Agent routing visualization
```

## Environment Variables

```bash
MISTRAL_API_KEY=         # Required for real vision/translation
ELEVENLABS_API_KEY=      # Optional — voice narration
WANDB_API_KEY=           # Optional — experiment tracking
CAPTURE_FPS=2            # Screen capture framerate
VISION_THROTTLE_MS=3000  # Throttle Pixtral calls (ms)
DEBUG_MODE=true          # Enable debug logging
```

## Team

Built at the Mistral AI Hackathon, Tokyo 2026.
