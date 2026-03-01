# dorAImon - AI-Powered Real-Time Productivity Assistant

> **Mistral AI Hackathon 2026 Submission**
> *An intelligent screen monitoring system that understands what you're doing, provides contextual assistance, and translates content in real-time — powered by 4 Mistral models running in parallel.*

[![Mistral AI](https://img.shields.io/badge/Powered%20by-Mistral%20AI-orange?style=flat-square)](https://mistral.ai)
[![ElevenLabs](https://img.shields.io/badge/Voice-ElevenLabs-blue?style=flat-square)](https://elevenlabs.io)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## Overview

**dorAImon** is an always-on desktop AI assistant that monitors your screen in real-time using **4 Mistral models in parallel**, understands your workflow, and provides proactive assistance. It runs as a transparent Electron overlay that never steals focus from your active applications.

- **Extracts text** from your screen using Mistral OCR + Pixtral-12B vision (2 FPS)
- **Understands context** through scene analysis with Pixtral-12B (apps, activities, visual cues)
- **Detects your state** via Ministral-3B intent classification (normal, hesitant, typo)
- **Assists intelligently** using Codestral for code suggestions, fixes, and explanations
- **Translates on-screen content** with Mistral Large in a floating overlay
- **Speaks naturally** using ElevenLabs multilingual TTS with context-aware narration
- **Chats interactively** about what's on your screen using Devstral

### The "Vibe Agent"

The core innovation: dorAImon doesn't wait for commands — it **reads your productivity vibe**. Through a 6-gate throttling system and turn-aware history, it provides suggestions at exactly the right moment. When you're stuck (hesitant), it offers help. When you're flowing (normal), it stays quiet. When you make errors (typo), it gently corrects.

---

## Architecture

```
+------------------------------------------------------------------+
|             Electron Transparent Overlay (React + Zustand)         |
|  - Always-on-top, click-through window spanning all monitors      |
|  - Code suggestion panel with inline diffs + apply/dismiss        |
|  - Translation sidebar with click-to-highlight original text      |
|  - Interactive chat widget + animated dorAImon face               |
+-------------------------------+----------------------------------+
                                | WebSocket (ws://localhost:8000)
+-------------------------------+----------------------------------+
|                     FastAPI Backend (Python)                       |
|                                                                   |
|   3 Parallel Real-Time Pipelines                                  |
|   +-----------+  +-----------+  +-----------+                     |
|   | OCR       |  | Vision    |  | Classifier|                     |
|   | Pixtral   |  | Pixtral   |  | Ministral |                     |
|   | 2 FPS     |  | 0.25 FPS  |  | 0.5 FPS   |                     |
|   +-----------+  +-----------+  +-----------+                     |
|         |              |              |                            |
|         +--------------+--------------+                           |
|                        v                                          |
|                  Agent Router                                     |
|                        v                                          |
|   +----------------------------------------------------+         |
|   | VibeAgent (Codestral)                               |         |
|   | - 6-gate throttling (intent, dedup, cooldown, etc.) |         |
|   | - Turn-aware suggestion history                     |         |
|   | - Code diff generation                              |         |
|   +----------------------------------------------------+         |
|                        v                                          |
|   +----------------------------------------------------+         |
|   | Narration Service (Ministral-3B + ElevenLabs TTS)   |         |
|   | - Context-aware text generation                     |         |
|   | - Multilingual voice switching (10 languages)       |         |
|   +----------------------------------------------------+         |
|                                                                   |
|   Translation Engine: Mistral Large API                           |
|   Chat Engine: Devstral (Codestral)                               |
|   Metrics: Weights & Biases (optional)                            |
+-------------------------------------------------------------------+
```

### Mistral Models Used

| Model | Role | Rate | Details |
|-------|------|------|---------|
| **Pixtral-12B** | Vision OCR | 2 FPS | Text extraction with bounding boxes |
| **Pixtral-12B** | Scene Analysis | 0.25 FPS | Active app, activity, visual cues |
| **Ministral-3B** | Intent Classification | 0.5 FPS | Normal / hesitant / typo detection |
| **Ministral-3B** | Narration Generation | On-demand | Context-aware TTS text |
| **Codestral** | Code Assistant (VibeAgent) | On-demand | Suggestions, fixes, explanations |
| **Codestral** | Chat | On-demand | Interactive Q&A about screen content |
| **Mistral Large** | Translation | On-demand | Batch multilingual translation |

---

## Features

### Code Suggestions & Fixes

When the VibeAgent detects you're stuck or making errors, it analyzes visible code with Codestral and shows an inline diff panel with:
- Original vs. corrected code
- One-line explanation
- **Apply** (pastes fix) or **Dismiss** buttons
- Optional voice narration of the suggestion

### Real-Time Translation Overlay

- Extracts on-screen text via OCR, groups into paragraphs
- Translates via Mistral Large with auto language detection
- Click any translated line to highlight its original position on screen
- Draggable floating sidebar, 800ms throttle for smooth updates

### Interactive Chat

- Ask questions about what's on your screen
- Works even when the assistant is toggled off
- Uses current OCR + vision context for grounded answers
- Powered by Devstral (Codestral)

### Voice Narration

- Ministral-3B generates context-aware narration text
- ElevenLabs TTS with automatic language-based voice switching
- Three modes: `silent`, `voice`, `auto` (confidence-based)
- 8-second narration guard prevents audio overlap

### Transparent Overlay

- Always-on-top Electron window, fully click-through
- Spans all monitors automatically
- Animated dorAImon face reacts to intent state
- Opacity slider, minimize/expand toggle
- System tray with quick controls

---

## The VibeAgent: 6-Gate Throttling

The VibeAgent is the intelligent core that decides **when** to offer help. All 6 gates must pass before a suggestion is shown:

| Gate | Purpose |
|------|---------|
| **Intent Filter** | Only activates on `hesitant`, `typo`, or `normal` with confidence > 0.5 |
| **Pending Suggestion** | Waits until user dismisses/applies the previous suggestion (auto-clears after 60s) |
| **Exact Dedup** | MD5 hash prevents identical suggestions |
| **Cooldown** | 10s for hesitant/typo, 30s for normal state |
| **Narration Guard** | 8s minimum between voice narrations |
| **Similarity Gate** | SequenceMatcher (85% threshold) catches near-duplicate OCR text |

The agent also maintains a turn-aware history of the last 5 suggestions (included in the LLM prompt to avoid repetition) and records user feedback (applied/dismissed).

---

## Getting Started

### Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **Mistral API Key** — [console.mistral.ai](https://console.mistral.ai)
- **ElevenLabs API Key** (optional, for voice) — [elevenlabs.io](https://elevenlabs.io)

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd dorAImon

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and add your MISTRAL_API_KEY (and optionally ELEVENLABS_API_KEY)
```

### Running

**One-command launch** (installs deps automatically on first run):

```bash
./start.sh
```

**Stop:**

```bash
./start.sh stop
# or press Ctrl+C in the terminal
# or press Alt+Q
```

**Manual start** (two terminals):

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

---

## Hotkeys

| Shortcut | Action |
|----------|--------|
| `Alt+H` | Toggle overlay visibility (minimize/expand) |
| `Alt+T` | Toggle translation mode |
| `Alt+S` | Toggle assistant (VibeAgent) |
| `Alt+A` | Apply current code suggestion |
| `Alt+D` | Dismiss current code suggestion |
| `Alt+C` | Toggle chat widget |
| `Alt+Q` | Quit dorAImon |

---

## Configuration

All settings via environment variables in `backend/.env`:

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `MISTRAL_API_KEY` | — | **Required.** Mistral AI API key |
| `ELEVENLABS_API_KEY` | — | Required for voice narration |

### Pipeline Rates

| Variable | Default | Description |
|----------|---------|-------------|
| `OCR_FPS` | `2` | OCR capture rate (frames per second) |
| `VISION_FPS` | `0.25` | Scene analysis rate (every 4s) |
| `CLASSIFIER_FPS` | `0.5` | Intent classification rate (every 2s) |
| `CAPTURE_MONITOR` | `1` | Monitor index to capture (1 = primary) |

### Models

| Variable | Default | Description |
|----------|---------|-------------|
| `MISTRAL_OCR_MODEL` | `mistral-ocr-latest` | OCR model |
| `PIXTRAL_MODEL` | `pixtral-12b-2409` | Vision model |
| `MINISTRAL_MODEL` | `ministral-3b-latest` | Classification + narration model |
| `DEVSTRAL_MODEL` | `codestral-latest` | Code analysis + chat model |
| `MISTRAL_TEXT_MODEL` | `mistral-large-latest` | Translation model |

### Voice

| Variable | Default | Description |
|----------|---------|-------------|
| `VOICE_MODE` | `auto` | `silent` / `voice` / `auto` |
| `VOICE_ID_JP` | `pFZP5JQG7iQjIQuC4Bku` | Japanese ElevenLabs voice ID |
| `VOICE_ID_EN` | `JBFqnCBsd6RMkjVDRZzb` | English ElevenLabs voice ID |

### Agent Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `VIBE_COOLDOWN_SECONDS` | `10` | Min seconds between suggestions (hesitant/typo) |
| `NORMAL_COOLDOWN_SECONDS` | `30` | Min seconds between suggestions (normal state) |
| `VIBE_SIMILARITY_THRESHOLD` | `0.85` | Dedup threshold (0.0 - 1.0) |
| `VIBE_NARRATION_GUARD_SECONDS` | `8` | Min seconds between narrations |
| `VIBE_PENDING_TIMEOUT_SECONDS` | `60` | Auto-clear pending suggestion |

### Observability

| Variable | Default | Description |
|----------|---------|-------------|
| `WANDB_ENABLED` | `false` | Enable Weights & Biases metrics |
| `WANDB_PROJECT` | `dorAImon` | W&B project name |
| `WANDB_RUN_NAME` | — | Custom run name (auto-generated if empty) |

---

## Project Structure

```
dorAImon/
|-- start.sh                         # One-command launcher
|
|-- backend/                         # FastAPI Python backend
|   |-- main.py                      # WebSocket server + lifecycle
|   |-- pipelines.py                 # Multi-pipeline orchestrator (OCR, Vision, Classifier)
|   |-- capture.py                   # Screen capture (mss)
|   |-- ocr.py                       # OCR wrapper
|   |-- vision.py                    # Pixtral-12B scene analysis
|   |-- classifier.py                # Ministral-3B intent classification
|   |-- translator.py                # Mistral Large translation
|   |-- api.py                       # Mistral API client with rate limiting
|   |-- prompts.py                   # Centralized LLM prompts
|   |-- config.py                    # Environment variable loading
|   |-- metrics.py                   # Weights & Biases integration
|   |-- doraimon_integration.py      # Legacy OCR pipeline bridge
|   |
|   |-- agents/
|   |   |-- base.py                  # Abstract BaseAgent + AgentContext/AgentResponse
|   |   |-- registry.py              # Agent router
|   |   |-- vibe_agent.py            # VibeAgent (Codestral + 6-gate throttling + history)
|   |   +-- narration_service.py     # ElevenLabs TTS narration
|   |
|   +-- doraimon_modules/            # Image processing pipeline modules
|       |-- pipeline.py              # OCR + coordinate extraction pipeline
|       |-- mistral_ops.py           # Mistral API operations
|       |-- coord_renderer.py        # Coordinate rendering
|       |-- output_processing.py     # Output formatting
|       |-- io_utils.py              # I/O utilities
|       +-- prompts.py               # Pipeline-specific prompts
|
+-- frontend/                        # Electron + React overlay
    |-- electron/
    |   |-- main/index.ts            # Window management, tray, global hotkeys, IPC
    |   +-- preload/index.ts         # IPC bridge (renderer <-> main)
    |
    +-- src/
        |-- App.tsx                  # Root component (WebSocket + IPC wiring)
        |-- main.tsx                 # Entry point
        |-- index.css                # Tailwind styles
        |
        |-- components/
        |   |-- Overlay.tsx          # Main transparent overlay container
        |   |-- Widget.tsx           # Settings panel (toggles, language, monitor, opacity)
        |   |-- TranslationPanel.tsx # Floating translation sidebar
        |   |-- CodeSuggestionPanel.tsx  # Code diff + apply/dismiss
        |   |-- ChatWidget.tsx       # Interactive chat interface
        |   |-- DoraimonFace.tsx     # Animated character (reacts to intent)
        |   |-- IntentBadge.tsx      # Intent + confidence display
        |   |-- LanguagePicker.tsx   # Source/target language selector
        |   |-- VoiceSelector.tsx    # ElevenLabs voice picker
        |   |-- MinimizedHead.tsx    # Compact mode UI
        |   |-- OpacitySlider.tsx    # Overlay transparency control
        |   |-- OCRPanel.tsx         # Raw OCR text display
        |   +-- DoraimonLoading.tsx  # Loading animation
        |
        |-- hooks/
        |   |-- useWebSocket.ts     # WebSocket connection + auto-reconnect
        |   |-- useTranslation.ts   # Translation throttle + paragraph grouping
        |   +-- useNarration.ts     # Audio playback (base64 decode + Web Audio)
        |
        |-- store/
        |   +-- appStore.ts         # Zustand global state
        |
        +-- types/
            +-- index.ts            # TypeScript interfaces
```

---

## Hackathon Track Alignment

### Mistral AI Track

*"Build anything with the Mistral API. Create agents, tools, products, experiments... no constraints, just ship something ambitious, creative, and impactful."*

dorAImon orchestrates **4 Mistral models** (Pixtral-12B, Ministral-3B, Codestral, Mistral Large) across 3 parallel real-time pipelines with staggered FPS rates, feeding into an extensible agent system with a novel "vibe" detection paradigm.

### ElevenLabs - Best Use of ElevenLabs

Context-aware narration that adapts tone to user intent (encouraging when hesitant, gentle when typo, informative when normal), with automatic multilingual voice switching across 10 languages and smart 8-second narration guard.

### Mistral - Best Vibe Usage

The entire system is built around "vibe" — a 3-state productivity classification (normal/hesitant/typo) that drives adaptive, non-intrusive assistance through the 6-gate VibeAgent.

### Hugging Face - Best Use of Agent Skills

Extensible agent registry with pluggable agents, structured `AgentContext` passing (intent + confidence + OCR + vision), turn-aware history, and feedback learning.

---

## Roadmap

- [ ] Video stream analysis (gestures, reading patterns)
- [ ] Audio input integration (meeting summaries)
- [ ] Fine-tuned models via W&B integration
- [ ] Team mode (shared translations)
- [ ] Session replay (productivity pattern review)
- [ ] Custom agent creation (visual agent builder)
- [ ] On-device deployment for edge inference
- [ ] RLHF from user feedback
- [ ] Multi-agent coordination (Debug + Code + Test agents)
- [ ] IDE plugins (VS Code, JetBrains)

---

## Acknowledgements

- **[Mistral AI](https://mistral.ai)** — The suite of models powering dorAImon's intelligence
- **[ElevenLabs](https://elevenlabs.io)** — Natural multilingual TTS
- **[Weights & Biases](https://wandb.ai)** — Observability and metrics
- **[mss](https://github.com/BoboTiG/python-mss)** — Fast cross-platform screen capture
- **[FastAPI](https://fastapi.tiangolo.com)** — Real-time WebSocket backend
- **42 Tokyo** — Supporting our hackathon participation

---

## License

MIT License — See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with Mistral AI, ElevenLabs, and open-source technologies for the Mistral AI Hackathon 2026**

</div>
