<div align="center">

# PC Optimizer

[한국어](README.md) · **English** · [日本語](README.ja.md) · [中文](README.zh.md)

A Windows PC optimization desktop application

</div>

---

## Overview

**PC Optimizer** is a desktop application that monitors and optimizes Windows PC performance in real time. It is a single-window app built on **Electron + Vite + React 18**, where you switch between feature panels from the left-hand menu.

Key capabilities:

- **Real-time resource monitoring** — Collects CPU, memory, disk, Ethernet, Wi‑Fi, and GPU usage every 2 seconds and renders them as charts.
- **Per-target optimization** — Optimize each monitored component individually.
- **Windows Boost** — Trims visual effects, background services, and temporary files to lighten the system.
- **Sound Boost** — Volume amplification and EQ, with Equalizer APO downloaded and installed directly by the app.
- **Game Mode / Fast Ping** — Applies gaming mode and network latency (ping) optimizations.
- **Delta Force Cleaner** — Clears game caches and performs Windows API based optimizations.
- **Updates** — Uses `winget` to detect genuinely upgradable installed software and update it.

> ⚠️ Many optimization actions require Windows administrator privileges and invoke system commands (`powercfg`, `netsh`, `reg`, `winget`, PowerShell, etc.). The packaged installer runs elevated (`requestedExecutionLevel: requireAdministrator` in `electron-builder.yml`).

---

## Tech Stack

| Area | Technology |
|---|---|
| Desktop shell | Electron 28 (`contextIsolation` + `sandbox` enabled, `nodeIntegration` disabled) |
| Renderer | React 18, React Router (HashRouter), Vite 5 |
| System info | `systeminformation`, native Windows commands (WMI / `typeperf` / `netsh`, etc.) |
| Registry | `winreg` + `reg` CLI |
| Package updates | `winget` (Windows Package Manager) |
| Testing | Vitest + React Testing Library |
| Type checking | TypeScript (`checkJs`, gradual adoption) |
| Quality tools | ESLint (react / react-hooks), Prettier |
| Packaging | electron-builder (NSIS installer) |

---

## Directory Structure

```
Optimizer-Product/
├── electron/                     # Electron backend (main process)
│   ├── main.js                   # Entry point · BrowserWindow · IPC handler registration
│   ├── preload.js                # Exposes a safe API to the renderer via contextBridge
│   ├── launch.cjs                # Development launch script
│   └── services/                 # Feature service modules
│       ├── _exec.js              # Shared process-exec utils (execAsync / execFile / PowerShell / timeout)
│       ├── cache.js              # Static & dynamic stats cache (per-key TTL)
│       ├── systemStats.js        # Unified system stats collection (hot path)
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── audio.js              # Sound boost / Equalizer APO integration
│       ├── gaming.js · fastPing.js · deltaForceCleaner.js
│       ├── updater.js            # winget-based software updates
│       ├── wingetParse.js        # winget output parser (pure function)
│       └── ...                   # driver, recovery, history, platform, etc.
├── src/                          # React frontend (renderer)
│   ├── App.jsx                   # Router · loading · ErrorBoundary
│   ├── components/               # UI components
│   │   ├── MainPage.jsx          # Left menu + feature panel container
│   │   ├── SmartOptimization.jsx # Resource monitor + per-target optimization
│   │   ├── WindowsBoost.jsx · SoundBoost.jsx
│   │   ├── DeltaForceCleaner.jsx · GameMode.jsx
│   │   ├── SoftwareUpdater.jsx   # winget software · driver updates
│   │   └── chart/drawChart.js    # Canvas 2D chart (pure function)
│   ├── styles/                   # Per-component CSS + index.css (:root design tokens)
│   └── utils/errorHandler.js     # Shared error-handling utils
├── test/                         # Vitest unit & smoke tests
├── index.html                    # CSP · entry HTML
├── vite.config.js
├── vitest.config.js
├── tsconfig.json                 # checkJs type checking (noEmit)
├── electron-builder.yml          # NSIS installer config
└── package.json
```

---

## Feature Panels

The app switches between the panels below from the left menu inside a single `MainPage`.

| Menu | Component | Description |
|---|---|---|
| Smart Optimization | `SmartOptimization` | Real-time CPU / memory / disk / Ethernet / Wi‑Fi / GPU monitoring + per-target optimization |
| Windows Boost | `WindowsBoost` | System boost: visual effects, background services, temp-file cleanup |
| Sound Boost | `SoundBoost` | Volume amplification · EQ (auto-installs and integrates Equalizer APO) |
| Delta Force Cleaner | `DeltaForceCleaner` | Game cache cleanup · Windows API optimization |
| Game Mode | `GameMode` | Gaming mode on/off · Fast Ping optimization |
| Updates | `SoftwareUpdater` | winget-based software updates + driver list / updates |

---

## Development / Build

```bash
npm install

# Development
npm run dev          # Vite dev server (http://localhost:5173)
npm start            # Dev server + Electron together
npm run electron     # Electron only (when the dev server is already running)

# Build / Release
npm run build        # Renderer production bundle (dist/)
npm run dist:win     # Build the Windows NSIS installer (dist-installer/)

# Quality
npm run lint         # Run ESLint
npm run lint:fix     # ESLint autofix
npm run format       # Prettier formatting
npm test             # Vitest unit & smoke tests
npm run typecheck    # tsc --noEmit (type-checks JSDoc + @ts-check files)
```

> Build artifacts such as `dist/` and `dist-installer/` are not committed to the repository (see `.gitignore`).

---

## License

MIT License. See [LICENSE](LICENSE) for details.
