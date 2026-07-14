<div align="center">

# PC Optimizer

[한국어](README.md) · **English** · [日本語](README.ja.md) · [中文](README.zh.md)

A Windows-only PC optimization desktop application

</div>

---

## Product Overview

**PC Optimizer** is a desktop application that monitors and optimizes Windows PC performance in real time. It is a single-window app built on **Electron + Vite + React 18**, where you switch between feature panels from the left-hand menu.

- **Real-time resource monitoring** — Collects CPU, memory, disk, Ethernet, Wi‑Fi, and GPU metrics every 2 seconds and renders them as charts. For GPUs that report temperature, the temperature is shown; for integrated GPUs that do not, utilization is shown instead.
- **Per-target optimization** — Optimize each monitored component individually.
- **Windows Boost / Game Mode** — Applied and reverted instantly with a single ON/OFF toggle.
- **Sound Boost** — Volume amplification and a 10-band EQ, with Equalizer APO downloaded, installed, and integrated directly by the app.
- **Fast Ping button** — Press the lightning button at the bottom right to run bulk optimization → bulk acceleration → ping optimization, in that order.
- **Delta Force Cleaner** — Cleans up game logs and caches.
- **Updates** — Uses `winget` to check whether installed software is genuinely upgradable, and updates it.

### Two Design Principles

**1. The optimization features run with user privileges only.**
Smart Optimization, Windows Boost, Game Mode, and Fast Ping use only the `HKCU` registry, the user's TEMP folder, and `powercfg`. Every action requiring administrator privileges (HKLM writes, service control, global `netsh` tuning, `defrag` / `chkdsk` / DISM) has been removed from the code. Registry **writes target HKCU exclusively**; HKLM is read-only, used for things like enumerating installed software.

> That said, the app itself still runs elevated (`requestedExecutionLevel: requireAdministrator`). The **driver update in the Updates panel** invokes `pnputil /update-driver`, and that one command genuinely requires elevation.

**2. OFF restores the value from just before you turned it ON — not the "Windows default."**
Before a toggle is turned on, the registry values and power plan it will touch are captured as a snapshot and saved to a file, and OFF restores exactly those values. Writing back hardcoded defaults would mean that a user who was originally on the High Performance power plan gets switched to Balanced after ON→OFF — that is, OFF would create a setting that did not exist before ON. Values that did not exist before the toggle was turned on are deleted on restore, and values whose backup failed are left untouched.

> ⚠️ **Irreversible actions**: Windows Boost's temp-file deletion and DNS cache flush are not subject to restore. Temp-file cleanup removes **only old files**, skipping anything created after the app started or accessed within the last hour.

---

## Tech Stack

| Area | Technology |
|---|---|
| Desktop shell | Electron 28 (`contextIsolation` + `sandbox` enabled, `nodeIntegration` disabled) |
| Renderer | React 18, React Router (HashRouter), Vite 5 |
| System info | `systeminformation`, native Windows commands (WMI / `typeperf` / `nvidia-smi`, etc.) |
| Registry | `winreg` + `reg` CLI (HKCU only) |
| Package updates | `winget` (Windows Package Manager) |
| Testing | Vitest + React Testing Library (45 tests) |
| Type checking | TypeScript (`checkJs`, gradual adoption) |
| Quality tools | ESLint (react / react-hooks), Prettier — zero warnings |
| Packaging | electron-builder (NSIS installer) |

---

## Directory Structure

```
Optimizer-Product/
├── electron/                       # Electron backend (main process)
│   ├── main.js                     # App entry point · BrowserWindow · IPC handler registration
│   ├── preload.js                  # Exposes a safe API to the renderer via contextBridge
│   ├── launch.cjs                  # GUI launcher (strips ELECTRON_RUN_AS_NODE)
│   └── services/
│       ├── _exec.js                # Shared process-exec utils (execAsync / timeout)
│       ├── cache.js                # Static & dynamic stats cache (per-key TTL)
│       ├── systemStats.js          # Unified system stats collection (hot path)
│       ├── registrySnapshot.js     # Snapshot & restore of pre-apply values (distinguishes read failure from absent value)
│       ├── optimizationState.js    # Toggle applied-state + snapshot persistence
│       ├── gaming.js               # Game Mode apply / revert
│       ├── deltaForceCleaner.js    # Windows Boost · game log cleanup · temp-file cleanup
│       ├── fastPing.js             # Bulk optimization · bulk acceleration · ping optimization
│       ├── audio.js                # Sound boost / Equalizer APO integration
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── updater.js · driver.js  # winget software · driver updates
│       └── wingetParse.js          # winget output parser (pure function)
├── src/                            # React frontend (renderer)
│   ├── App.jsx                     # Router · loading · ErrorBoundary
│   ├── components/
│   │   ├── MainPage.jsx            # Left menu · panel container · Fast Ping button · progress toast
│   │   ├── SmartOptimization.jsx   # Resource monitor + per-target optimization
│   │   ├── WindowsBoost.jsx · GameMode.jsx     # ON/OFF toggle panels
│   │   ├── SoundBoost.jsx          # Volume · 10-band EQ · Equalizer APO
│   │   ├── DeltaForceCleaner.jsx · SoftwareUpdater.jsx
│   │   └── chart/drawChart.js      # Canvas 2D chart (pure function)
│   ├── hooks/
│   │   ├── useAppliedState.js      # Toggle state restoration (persists across page navigation · app restarts)
│   │   └── useOptimizationProgress.js  # Relays backend step-by-step progress to a toast
│   ├── styles/                     # Per-component CSS + index.css (:root design tokens)
│   └── utils/errorHandler.js
├── test/                           # Vitest unit & smoke tests
├── index.html                      # CSP · entry HTML
├── vite.config.js · vitest.config.js
├── tsconfig.json                   # checkJs type checking (noEmit)
├── electron-builder.yml            # NSIS installer config
└── package.json
```

---

## Feature Panels

The app switches between the panels below from the left menu inside a single `MainPage`.

| Menu | Component | Description |
|---|---|---|
| Smart Optimization | `SmartOptimization` | Real-time CPU / memory / disk / Ethernet / Wi‑Fi / GPU monitoring + per-target optimization |
| Windows Boost | `WindowsBoost` | Temp-file cleanup · game mode · Game DVR · visual effects · memory (ON/OFF toggle) |
| Sound Boost | `SoundBoost` | Volume amplification · 10-band EQ (auto-installs and integrates Equalizer APO) |
| Delta Force Cleaner | `DeltaForceCleaner` | Game log · cache cleanup |
| Game Mode | `GameMode` | FPS · mouse acceleration · input responsiveness · power plan (ON/OFF toggle) |
| Updates | `SoftwareUpdater` | winget-based software updates + driver list / updates |

The **Fast Ping button** (lightning icon) at the bottom right can be pressed from any panel to run bulk optimization → bulk acceleration → ping optimization in one go. Progress is shown in a toast at the bottom left, reflecting the backend's actual steps.

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
