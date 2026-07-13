<div align="center">

# PC Optimizer

[한국어](README.md) · [English](README.en.md) · **日本語** · [中文](README.zh.md)

Windows 専用の PC 最適化デスクトップアプリケーション

</div>

---

## プロダクト概要

**PC Optimizer** は、Windows PC のパフォーマンスをリアルタイムで監視・最適化するデスクトップアプリケーションです。**Electron + Vite + React 18** で構築されたシングルウィンドウアプリで、左側のメニューから各機能パネルを切り替えて使用します。

主な機能は次のとおりです。

- **リアルタイムリソース監視** — CPU・メモリ・ディスク・イーサネット・Wi‑Fi・GPU の使用率を 2 秒間隔で収集し、チャートで表示します。
- **対象別の最適化** — 監視中の各コンポーネントを個別に最適化します。
- **Windows Boost** — 視覚効果、バックグラウンドサービス、一時ファイルなどを整理してシステムを軽量化します。
- **Sound Boost** — 音量増幅と EQ を提供し、Equalizer APO をアプリから直接ダウンロード・インストールして連携します。
- **Game Mode / Fast Ping** — ゲーミングモードとネットワーク遅延（ping）の最適化を適用します。
- **Delta Force Cleaner** — ゲームキャッシュを整理し、Windows API ベースの最適化を実行します。
- **Updates** — `winget` を用いて、インストール済みソフトウェアの実際に更新可能なバージョンを確認し、アップデートします。

> ⚠️ 最適化処理の多くは Windows の管理者権限と各種システムコマンド（`powercfg`、`netsh`、`reg`、`winget`、PowerShell など）を使用します。パッケージ化されたインストーラーは管理者権限で実行されます（`electron-builder.yml` の `requestedExecutionLevel: requireAdministrator`）。

---

## 技術スタック

| 領域 | 使用技術 |
|---|---|
| デスクトップシェル | Electron 28（`contextIsolation` + `sandbox` 有効、`nodeIntegration` 無効） |
| レンダラー | React 18、React Router（HashRouter）、Vite 5 |
| システム情報 | `systeminformation`、Windows ネイティブコマンド（WMI / `typeperf` / `netsh` など） |
| レジストリ | `winreg` + `reg` CLI |
| パッケージ更新 | `winget`（Windows Package Manager） |
| テスト | Vitest + React Testing Library |
| 型チェック | TypeScript（`checkJs` を段階的に導入） |
| 品質ツール | ESLint（react / react-hooks）、Prettier |
| パッケージング | electron-builder（NSIS インストーラー） |

---

## ディレクトリ構成

```
Optimizer-Product/
├── electron/                     # Electron バックエンド（メインプロセス）
│   ├── main.js                   # エントリポイント · BrowserWindow · IPC ハンドラ登録
│   ├── preload.js                # contextBridge でレンダラーに安全な API を公開
│   ├── launch.cjs                # 開発用の起動スクリプト
│   └── services/                 # 機能別サービスモジュール
│       ├── _exec.js              # 共通プロセス実行ユーティリティ（execAsync / execFile / PowerShell / timeout）
│       ├── cache.js              # 静的・動的な統計キャッシュ（キー単位の TTL）
│       ├── systemStats.js        # システム統計の統合収集（ホットパス）
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── audio.js              # サウンドブースト / Equalizer APO 連携
│       ├── gaming.js · fastPing.js · deltaForceCleaner.js
│       ├── updater.js            # winget ベースのソフトウェア更新
│       ├── wingetParse.js        # winget 出力パーサー（純粋関数）
│       └── ...                   # driver、recovery、history、platform など
├── src/                          # React フロントエンド（レンダラー）
│   ├── App.jsx                   # ルーター · ローディング · ErrorBoundary
│   ├── components/               # UI コンポーネント
│   │   ├── MainPage.jsx          # 左メニュー + 機能パネルのコンテナ
│   │   ├── SmartOptimization.jsx # リソースモニター + 対象別の最適化
│   │   ├── WindowsBoost.jsx · SoundBoost.jsx
│   │   ├── DeltaForceCleaner.jsx · GameMode.jsx
│   │   ├── SoftwareUpdater.jsx   # winget ソフトウェア · ドライバー更新
│   │   └── chart/drawChart.js    # Canvas 2D チャート（純粋関数）
│   ├── styles/                   # コンポーネント別 CSS + index.css（:root デザイントークン）
│   └── utils/errorHandler.js     # 共通エラーハンドリングユーティリティ
├── test/                         # Vitest のユニット・スモークテスト
├── index.html                    # CSP · エントリ HTML
├── vite.config.js
├── vitest.config.js
├── tsconfig.json                 # checkJs 型チェック（noEmit）
├── electron-builder.yml          # NSIS インストーラー設定
└── package.json
```

---

## 機能パネル

アプリは単一の `MainPage` 内で、左メニューから以下のパネルを切り替えます。

| メニュー | コンポーネント | 説明 |
|---|---|---|
| Smart Optimization | `SmartOptimization` | CPU / メモリ / ディスク / イーサネット / Wi‑Fi / GPU のリアルタイム監視 + 対象別の最適化 |
| Windows Boost | `WindowsBoost` | 視覚効果・バックグラウンドサービス・一時ファイル整理などのシステムブースト |
| Sound Boost | `SoundBoost` | 音量増幅 · EQ（Equalizer APO の自動インストール・連携） |
| Delta Force Cleaner | `DeltaForceCleaner` | ゲームキャッシュの整理 · Windows API による最適化 |
| Game Mode | `GameMode` | ゲーミングモードの ON/OFF · Fast Ping 最適化 |
| Updates | `SoftwareUpdater` | winget ベースのソフトウェア更新 + ドライバー一覧 / 更新 |

---

## 開発 / ビルド

```bash
npm install

# 開発
npm run dev          # Vite 開発サーバー (http://localhost:5173)
npm start            # 開発サーバー + Electron を同時に起動
npm run electron     # Electron のみ起動（開発サーバーが起動済みの場合）

# ビルド / リリース
npm run build        # レンダラーの本番バンドル (dist/)
npm run dist:win     # Windows NSIS インストーラーを生成 (dist-installer/)

# 品質
npm run lint         # ESLint チェック
npm run lint:fix     # ESLint 自動修正
npm run format       # Prettier フォーマット
npm test             # Vitest のユニット・スモークテスト
npm run typecheck    # tsc --noEmit（JSDoc + @ts-check ファイルの型チェック）
```

> `dist/` や `dist-installer/` などのビルド成果物はリポジトリにコミットしません（`.gitignore` を参照）。

---

## ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
