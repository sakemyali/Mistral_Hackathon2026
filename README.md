# Ghost Overlay

**Mistral AI Hackathon Tokyo 2026**

A transparent, always-on-top screen overlay that renders AI-powered subtitles over any application — Zoom calls, IDEs, browsers, fullscreen presentations — while remaining invisible to mouse interaction.

Think of it as a real-time AI copilot that floats above everything on your screen.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss&logoColor=white)

---

## How It Works

1. The overlay is a frameless, transparent Electron window pinned above all other windows (including fullscreen apps)
2. Click-through detection lets mouse events pass to apps underneath — only the visible UI panels capture input
3. Press a hotkey to capture context and get an AI-generated response rendered as animated subtitles
4. Subtitles appear with a typewriter effect inside a draggable, resizable glassmorphism panel

## Quick Start

```bash
npm install
npm start
```

## Hotkeys

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+S` | Show / hide overlay |
| `Ctrl+Shift+C` | Trigger AI capture |
| `Escape` | Close panel (tap twice to hide overlay) |

## Features

- **Click-through transparency** — the overlay is invisible to your mouse except where UI elements exist
- **Glassmorphism UI** — frosted glass panels with backdrop blur over your desktop
- **Draggable & resizable** subtitle area and control panel
- **Typewriter animation** — responses stream in character-by-character
- **Adjustable opacity & font size** via the control panel

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Electron 33 |
| UI framework | React 18 |
| Styling | Tailwind CSS 3.4 + custom glassmorphism |
| Build | Webpack 5 + Babel |

## Project Structure

```
main.js              Electron main process — window, hotkeys, IPC
preload.js           Security bridge (contextBridge → window.ghostAPI)
src/
  App.jsx            Root component, state management, IPC wiring
  OverlayRenderer.jsx  Subtitle display, typewriter, drag/resize
  ControlPanel.jsx   HUD card with capture button and sliders
styles/
  globals.css        Tailwind directives, glass effects, animations
```

## Team

Built at the Mistral AI Hackathon, Tokyo 2026.