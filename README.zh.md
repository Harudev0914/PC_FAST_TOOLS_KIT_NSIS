<div align="center">

# PC Optimizer

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · **中文**

Windows 专用的电脑优化桌面应用

</div>

---

## 产品简介

**PC Optimizer** 是一款实时监控并优化 Windows 电脑性能的桌面应用。它是基于 **Electron + Vite + React 18** 构建的单窗口（single-window）应用，通过左侧菜单在各功能面板之间切换使用。

- **实时资源监控** —— 每 2 秒采集一次 CPU、内存、磁盘、以太网、Wi‑Fi、GPU 数据并以图表展示。GPU 方面，若设备会上报温度则显示温度；若为不上报温度的核显，则显示使用率。
- **按目标优化** —— 可对监控中的各个组件单独进行优化。
- **Windows Boost / Game Mode** —— 只需一次 ON/OFF 切换即可立即应用或解除。
- **Sound Boost** —— 提供音量增强与 10 段 EQ，并由应用直接下载、安装并集成 Equalizer APO。
- **Fast Ping 按钮** —— 点击右下角的闪电按钮，将依次执行批量优化 → 批量加速 → Ping 优化。
- **Delta Force Cleaner** —— 清理游戏日志与缓存。
- **Updates** —— 通过 `winget` 检测已安装软件的实际可升级状态并进行更新。

### 两条设计原则

**1. 优化功能仅以用户权限运行。**
Smart Optimization、Windows Boost、Game Mode 与 Fast Ping 只使用 `HKCU` 注册表、用户 TEMP 文件夹以及 `powercfg`。所有需要管理员权限的操作（写入 HKLM、服务控制、`netsh` 全局调优、`defrag`/`chkdsk`/DISM）都已从代码中彻底移除。注册表**写入仅限 HKCU**，HKLM 只用于读取，例如枚举已安装的软件。

> 不过应用本身仍以管理员权限运行（`requestedExecutionLevel: requireAdministrator`）。原因是 **Updates 面板的驱动更新**会调用 `pnputil /update-driver`，只有这一条命令确实必须提权。

**2. OFF 并非还原为“Windows 默认值”，而是还原为“开启前的值”。**
在打开开关之前，会先把将要修改的注册表值与电源计划拍成快照保存到文件，OFF 时再原样恢复这些值。如果写入硬编码的默认值，那么原本使用高性能电源计划的用户在 ON→OFF 之后就会被改成平衡模式 —— 相当于 OFF 反而制造出了开启前并不存在的设置。开启前本就不存在的值在还原时会被删除，而备份失败的值则完全不做改动。

> ⚠️ **不可逆的操作**：Windows Boost 的临时文件删除与 DNS 缓存刷新不在还原范围内。临时文件清理**只会删除较旧的文件**，应用启动之后创建的、或最近 1 小时内使用过的项目会被跳过。

---

## 技术栈

| 领域 | 使用技术 |
|---|---|
| 桌面外壳 | Electron 28（启用 `contextIsolation` + `sandbox`，禁用 `nodeIntegration`） |
| 渲染进程 | React 18、React Router（HashRouter）、Vite 5 |
| 系统信息 | `systeminformation`、Windows 原生命令（WMI / `typeperf` / `nvidia-smi` 等） |
| 注册表 | `winreg` + `reg` CLI（仅 HKCU） |
| 软件包更新 | `winget`（Windows Package Manager） |
| 测试 | Vitest + React Testing Library（45 个） |
| 类型检查 | TypeScript（`checkJs` 渐进式引入） |
| 质量工具 | ESLint（react / react-hooks）、Prettier —— 0 警告 |
| 打包 | electron-builder（NSIS 安装程序） |

---

## 目录结构

```
Optimizer-Product/
├── electron/                       # Electron 后端（主进程）
│   ├── main.js                     # 应用入口 · BrowserWindow · IPC 处理器注册
│   ├── preload.js                  # 通过 contextBridge 向渲染进程暴露安全 API
│   ├── launch.cjs                  # GUI 启动器（移除 ELECTRON_RUN_AS_NODE）
│   └── services/
│       ├── _exec.js                # 通用进程执行工具（execAsync / timeout）
│       ├── cache.js                # 静态与动态统计缓存（按键 TTL）
│       ├── systemStats.js          # 系统统计的统一采集（热路径）
│       ├── registrySnapshot.js     # 应用前的值快照 · 还原（区分读取失败与值不存在）
│       ├── optimizationState.js    # 开关的应用状态 + 快照持久化
│       ├── gaming.js               # Game Mode 应用 / 解除
│       ├── deltaForceCleaner.js    # Windows Boost · 游戏日志清理 · 临时文件清理
│       ├── fastPing.js             # 批量优化 · 批量加速 · Ping 优化
│       ├── audio.js                # 音量增强 / Equalizer APO 集成
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── updater.js · driver.js  # winget 软件 · 驱动更新
│       └── wingetParse.js          # winget 输出解析器（纯函数）
├── src/                            # React 前端（渲染进程）
│   ├── App.jsx                     # 路由 · 加载 · ErrorBoundary
│   ├── components/
│   │   ├── MainPage.jsx            # 左侧菜单 · 面板容器 · Fast Ping 按钮 · 进度提示
│   │   ├── SmartOptimization.jsx   # 资源监控 + 按目标优化
│   │   ├── WindowsBoost.jsx · GameMode.jsx     # ON/OFF 开关面板
│   │   ├── SoundBoost.jsx          # 音量 · 10 段 EQ · Equalizer APO
│   │   ├── DeltaForceCleaner.jsx · SoftwareUpdater.jsx
│   │   └── chart/drawChart.js      # Canvas 2D 图表（纯函数）
│   ├── hooks/
│   │   ├── useAppliedState.js      # 开关状态还原（页面切换 · 应用重启后依然保持）
│   │   └── useOptimizationProgress.js  # 将后端各阶段进度以提示形式中继显示
│   ├── styles/                     # 各组件 CSS + index.css（:root 设计令牌）
│   └── utils/errorHandler.js
├── test/                           # Vitest 单元与冒烟测试
├── index.html                      # CSP · 入口 HTML
├── vite.config.js · vitest.config.js
├── tsconfig.json                   # checkJs 类型检查（noEmit）
├── electron-builder.yml            # NSIS 安装程序配置
└── package.json
```

---

## 功能面板

应用在单个 `MainPage` 中通过左侧菜单切换以下面板。

| 菜单 | 组件 | 说明 |
|---|---|---|
| Smart Optimization | `SmartOptimization` | CPU / 内存 / 磁盘 / 以太网 / Wi‑Fi / GPU 实时监控 + 按目标优化 |
| Windows Boost | `WindowsBoost` | 临时文件清理 · 游戏模式 · Game DVR · 视觉特效 · 内存（ON/OFF 开关） |
| Sound Boost | `SoundBoost` | 音量增强 · 10 段 EQ（自动安装并集成 Equalizer APO） |
| Delta Force Cleaner | `DeltaForceCleaner` | 游戏日志 · 缓存清理 |
| Game Mode | `GameMode` | FPS · 鼠标加速 · 输入响应速度 · 电源计划（ON/OFF 开关） |
| Updates | `SoftwareUpdater` | 基于 winget 的软件更新 + 驱动列表 / 更新 |

右下角的 **Fast Ping 按钮**（闪电图标）在任意面板下均可点击，一次性执行批量优化 → 批量加速 → Ping 优化。进度会在左下角的提示中，按后端的实际执行阶段显示。

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
