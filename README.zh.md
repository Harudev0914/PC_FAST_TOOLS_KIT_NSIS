<div align="center">

# PC Optimizer

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · **中文**

一款 Windows 专用的电脑优化桌面应用

</div>

---

## 产品简介

**PC Optimizer** 是一款实时监控并优化 Windows 电脑性能的桌面应用。它基于 **Electron + Vite + React 18** 构建，是单窗口（single-window）应用，通过左侧菜单在各功能面板之间切换。

主要功能如下：

- **实时资源监控** —— 每 2 秒采集一次 CPU、内存、磁盘、以太网、Wi‑Fi、GPU 的使用率，并以图表展示。
- **按目标优化** —— 可对监控中的各个组件单独进行优化。
- **Windows Boost** —— 清理视觉特效、后台服务和临时文件，为系统减负。
- **Sound Boost** —— 提供音量增强与 EQ，并由应用直接下载、安装并集成 Equalizer APO。
- **Game Mode / Fast Ping** —— 启用游戏模式并优化网络延迟（ping）。
- **Delta Force Cleaner** —— 清理游戏缓存，并执行基于 Windows API 的优化。
- **Updates** —— 通过 `winget` 检测已安装软件的实际可升级版本并进行更新。

> ⚠️ 大部分优化操作需要 Windows 管理员权限，并会调用系统命令（`powercfg`、`netsh`、`reg`、`winget`、PowerShell 等）。打包后的安装程序以管理员权限运行（`electron-builder.yml` 中的 `requestedExecutionLevel: requireAdministrator`）。

---

## 技术栈

| 领域 | 使用技术 |
|---|---|
| 桌面外壳 | Electron 28（启用 `contextIsolation` + `sandbox`，禁用 `nodeIntegration`） |
| 渲染进程 | React 18、React Router（HashRouter）、Vite 5 |
| 系统信息 | `systeminformation`、Windows 原生命令（WMI / `typeperf` / `netsh` 等） |
| 注册表 | `winreg` + `reg` CLI |
| 软件包更新 | `winget`（Windows 包管理器） |
| 测试 | Vitest + React Testing Library |
| 类型检查 | TypeScript（`checkJs`，渐进式引入） |
| 质量工具 | ESLint（react / react-hooks）、Prettier |
| 打包 | electron-builder（NSIS 安装程序） |

---

## 目录结构

```
Optimizer-Product/
├── electron/                     # Electron 后端（主进程）
│   ├── main.js                   # 应用入口 · BrowserWindow · IPC 处理器注册
│   ├── preload.js                # 通过 contextBridge 向渲染进程暴露安全 API
│   ├── launch.cjs                # 开发用启动脚本
│   └── services/                 # 按功能划分的服务模块
│       ├── _exec.js              # 通用进程执行工具（execAsync / execFile / PowerShell / timeout）
│       ├── cache.js              # 静态与动态统计缓存（按键 TTL）
│       ├── systemStats.js        # 系统统计的统一采集（热路径）
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── audio.js              # 音量增强 / Equalizer APO 集成
│       ├── gaming.js · fastPing.js · deltaForceCleaner.js
│       ├── updater.js            # 基于 winget 的软件更新
│       ├── wingetParse.js        # winget 输出解析器（纯函数）
│       └── ...                   # driver、recovery、history、platform 等
├── src/                          # React 前端（渲染进程）
│   ├── App.jsx                   # 路由 · 加载 · ErrorBoundary
│   ├── components/               # UI 组件
│   │   ├── MainPage.jsx          # 左侧菜单 + 功能面板容器
│   │   ├── SmartOptimization.jsx # 资源监控 + 按目标优化
│   │   ├── WindowsBoost.jsx · SoundBoost.jsx
│   │   ├── DeltaForceCleaner.jsx · GameMode.jsx
│   │   ├── SoftwareUpdater.jsx   # winget 软件 · 驱动更新
│   │   └── chart/drawChart.js    # Canvas 2D 图表（纯函数）
│   ├── styles/                   # 各组件 CSS + index.css（:root 设计令牌）
│   └── utils/errorHandler.js     # 通用错误处理工具
├── test/                         # Vitest 单元与冒烟测试
├── index.html                    # CSP · 入口 HTML
├── vite.config.js
├── vitest.config.js
├── tsconfig.json                 # checkJs 类型检查（noEmit）
├── electron-builder.yml          # NSIS 安装程序配置
└── package.json
```

---

## 功能面板

应用在单个 `MainPage` 中通过左侧菜单切换以下面板。

| 菜单 | 组件 | 说明 |
|---|---|---|
| Smart Optimization | `SmartOptimization` | CPU / 内存 / 磁盘 / 以太网 / Wi‑Fi / GPU 实时监控 + 按目标优化 |
| Windows Boost | `WindowsBoost` | 系统加速：视觉特效、后台服务、临时文件清理 |
| Sound Boost | `SoundBoost` | 音量增强 · EQ（自动安装并集成 Equalizer APO） |
| Delta Force Cleaner | `DeltaForceCleaner` | 游戏缓存清理 · Windows API 优化 |
| Game Mode | `GameMode` | 游戏模式开/关 · Fast Ping 优化 |
| Updates | `SoftwareUpdater` | 基于 winget 的软件更新 + 驱动列表 / 更新 |

---

## 开发 / 构建

```bash
npm install

# 开发
npm run dev          # Vite 开发服务器 (http://localhost:5173)
npm start            # 同时启动开发服务器与 Electron
npm run electron     # 仅启动 Electron（开发服务器已在运行时）

# 构建 / 发布
npm run build        # 渲染进程生产构建 (dist/)
npm run dist:win     # 生成 Windows NSIS 安装程序 (dist-installer/)

# 质量
npm run lint         # 运行 ESLint
npm run lint:fix     # ESLint 自动修复
npm run format       # Prettier 格式化
npm test             # Vitest 单元与冒烟测试
npm run typecheck    # tsc --noEmit（检查 JSDoc + @ts-check 文件的类型）
```

> `dist/`、`dist-installer/` 等构建产物不会提交到仓库（参见 `.gitignore`）。

---

## 许可证

MIT License。详情请参阅 [LICENSE](LICENSE)。
