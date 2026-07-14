<div align="center">

# PC Optimizer

[한국어](README.md) · [English](README.en.md) · **日本語** · [中文](README.zh.md)

Windows 専用の PC 最適化デスクトップアプリケーション

</div>

---

## プロダクト概要

**PC Optimizer** は、Windows PC のパフォーマンスをリアルタイムで監視・最適化するデスクトップアプリケーションです。**Electron + Vite + React 18** で構築されたシングルウィンドウ（single-window）アプリで、左側のメニューから機能パネルを切り替えて使用します。

- **リアルタイムリソース監視** — CPU・メモリ・ディスク・イーサネット・Wi‑Fi・GPU を 2 秒間隔で収集し、チャートで表示します。GPU は温度を報告するデバイスであれば温度を、報告しない内蔵 GPU の場合は使用率を表示します。
- **対象別の最適化** — 監視中の各コンポーネントを個別に最適化します。
- **Windows Boost / Game Mode** — ON/OFF トグル 1 回で即座に適用・解除します。
- **Sound Boost** — 音量増幅と 10 バンド EQ を提供し、Equalizer APO をアプリから直接ダウンロードしてインストール・連携します。
- **Fast Ping ボタン** — 右下の雷アイコンを押すと、一括最適化 → 一括高速化 → ping 最適化を順番にすべて実行します。
- **Delta Force Cleaner** — ゲームのログ・キャッシュを整理します。
- **Updates** — `winget` でインストールされたソフトウェアについて、実際にアップグレード可能かどうかを確認して更新します。

### 2 つの設計原則

**1. 最適化機能はユーザー権限のみで動作します。**
Smart Optimization・Windows Boost・Game Mode・Fast Ping は `HKCU` レジストリ、ユーザーの TEMP フォルダ、`powercfg` のみを使用します。管理者権限を必要とする動作（HKLM への書き込み、サービス制御、`netsh` によるグローバルチューニング、`defrag` / `chkdsk` / DISM）はコードからすべて削除しました。レジストリへの**書き込みは HKCU 専用**で、HKLM はインストール済みソフトウェアの一覧取得など読み取りにのみ使用します。

> ただし、アプリ自体は引き続き管理者権限で実行されます（`requestedExecutionLevel: requireAdministrator`）。**Updates パネルのドライバー更新**が `pnputil /update-driver` を呼び出しており、このコマンドだけは昇格が必須のためです。

**2. OFF は「Windows の既定値」ではなく「ON にする直前の値」に戻します。**
トグルを ON にする前に、変更対象のレジストリ値と電源プランをスナップショットとしてファイルに保存し、OFF ではその値をそのまま復元します。ハードコードされた既定値を書き込んでしまうと、もともと高パフォーマンスの電源プランを使っていたユーザーが ON→OFF した際に「バランス」に変わってしまいます — ON にする前には存在しなかった設定を OFF が作り出してしまうわけです。ON にする前に存在しなかった値は復元時に削除し、バックアップに失敗した値は一切変更しません。

> ⚠️ **元に戻せない動作**: Windows Boost の一時ファイル削除と DNS キャッシュのフラッシュは復元の対象外です。一時ファイルの整理は**古いファイルのみ**を削除し、アプリの起動後に作成された項目や、直近 1 時間以内に使用された項目はスキップします。

---

## 技術スタック

| 領域 | 使用技術 |
|---|---|
| デスクトップシェル | Electron 28（`contextIsolation` + `sandbox` 有効、`nodeIntegration` 無効） |
| レンダラー | React 18、React Router（HashRouter）、Vite 5 |
| システム情報 | `systeminformation`、Windows ネイティブコマンド（WMI / `typeperf` / `nvidia-smi` など） |
| レジストリ | `winreg` + `reg` CLI（HKCU 専用） |
| パッケージ更新 | `winget`（Windows Package Manager） |
| テスト | Vitest + React Testing Library（45 件） |
| 型チェック | TypeScript（`checkJs` を段階的に導入） |
| 品質ツール | ESLint（react / react-hooks）、Prettier — 警告 0 |
| パッケージング | electron-builder（NSIS インストーラー） |

---

## ディレクトリ構成

```
Optimizer-Product/
├── electron/                       # Electron バックエンド（メインプロセス）
│   ├── main.js                     # アプリのエントリポイント · BrowserWindow · IPC ハンドラ登録
│   ├── preload.js                  # contextBridge でレンダラーに安全な API を公開
│   ├── launch.cjs                  # GUI ランチャー（ELECTRON_RUN_AS_NODE を除去）
│   └── services/
│       ├── _exec.js                # 共通プロセス実行ユーティリティ（execAsync / timeout）
│       ├── cache.js                # 静的・動的な統計キャッシュ（キー単位の TTL）
│       ├── systemStats.js          # システム統計の統合収集（ホットパス）
│       ├── registrySnapshot.js     # 適用直前の値のスナップショット · 復元（読み取り失敗と値の不在を区別）
│       ├── optimizationState.js    # トグルの適用状態 + スナップショットの永続化
│       ├── gaming.js               # Game Mode の適用 / 解除
│       ├── deltaForceCleaner.js    # Windows Boost · ゲームログ整理 · 一時ファイル整理
│       ├── fastPing.js             # 一括最適化 · 一括高速化 · ping 最適化
│       ├── audio.js                # サウンドブースト / Equalizer APO 連携
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── updater.js · driver.js  # winget ソフトウェア · ドライバー更新
│       └── wingetParse.js          # winget 出力パーサー（純粋関数）
├── src/                            # React フロントエンド（レンダラー）
│   ├── App.jsx                     # ルーター · ローディング · ErrorBoundary
│   ├── components/
│   │   ├── MainPage.jsx            # 左メニュー · パネルコンテナ · Fast Ping ボタン · 進捗トースト
│   │   ├── SmartOptimization.jsx   # リソースモニター + 対象別の最適化
│   │   ├── WindowsBoost.jsx · GameMode.jsx     # ON/OFF トグルパネル
│   │   ├── SoundBoost.jsx          # 音量 · 10 バンド EQ · Equalizer APO
│   │   ├── DeltaForceCleaner.jsx · SoftwareUpdater.jsx
│   │   └── chart/drawChart.js      # Canvas 2D チャート（純粋関数）
│   ├── hooks/
│   │   ├── useAppliedState.js      # トグル状態の復元（ページ遷移 · アプリ再起動後も維持）
│   │   └── useOptimizationProgress.js  # バックエンドの段階別進捗をトーストへ中継
│   ├── styles/                     # コンポーネント別 CSS + index.css（:root デザイントークン）
│   └── utils/errorHandler.js
├── test/                           # Vitest のユニット · スモークテスト
├── index.html                      # CSP · エントリ HTML
├── vite.config.js · vitest.config.js
├── tsconfig.json                   # checkJs 型チェック（noEmit）
├── electron-builder.yml            # NSIS インストーラー設定
└── package.json
```

---

## 機能パネル

アプリは単一の `MainPage` 内で、左メニューから以下のパネルを切り替えます。

| メニュー | コンポーネント | 説明 |
|---|---|---|
| Smart Optimization | `SmartOptimization` | CPU / メモリ / ディスク / イーサネット / Wi‑Fi / GPU のリアルタイム監視 + 対象別の最適化 |
| Windows Boost | `WindowsBoost` | 一時ファイル整理 · ゲームモード · Game DVR · 視覚効果 · メモリ（ON/OFF トグル） |
| Sound Boost | `SoundBoost` | 音量増幅 · 10 バンド EQ（Equalizer APO の自動インストール · 連携） |
| Delta Force Cleaner | `DeltaForceCleaner` | ゲームのログ · キャッシュ整理 |
| Game Mode | `GameMode` | FPS · マウスアクセラレーション · 入力応答速度 · 電源プラン（ON/OFF トグル） |
| Updates | `SoftwareUpdater` | winget ベースのソフトウェア更新 + ドライバー一覧 / 更新 |

右下の **Fast Ping ボタン**（雷アイコン）は、どのパネルからでも押すことができ、一括最適化 → 一括高速化 → ping 最適化を一度に実行します。進行状況は左下のトーストに、バックエンドの実際の段階として表示されます。

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
npm test             # Vitest のユニット · スモークテスト
npm run typecheck    # tsc --noEmit（JSDoc + @ts-check ファイルの型チェック）
```

> `dist/` や `dist-installer/` などのビルド成果物はリポジトリにコミットしません（`.gitignore` を参照）。

---

## ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
