<div align="center">

# PC Optimizer

**한국어** · [English](README.en.md) · [日本語](README.ja.md) · [中文](README.zh.md)

Windows 전용 PC 최적화 데스크톱 애플리케이션

</div>

---

## 프로덕트 설명

**PC Optimizer**는 Windows PC의 성능을 실시간으로 모니터링하고 최적화하는 데스크톱 애플리케이션입니다. **Electron + Vite + React 18** 기반의 단일 창(single-window) 앱으로, 좌측 메뉴에서 기능 패널을 전환하며 사용합니다.

주요 기능은 다음과 같습니다.

- **실시간 리소스 모니터링** — CPU · 메모리 · 디스크 · 이더넷 · Wi‑Fi · GPU 사용률을 2초 주기로 수집해 차트로 표시합니다.
- **대상별 최적화** — 모니터링 중인 각 구성요소를 개별적으로 최적화합니다.
- **Windows Boost** — 시각 효과, 백그라운드 서비스, 임시 파일 등을 정리해 시스템을 가볍게 만듭니다.
- **Sound Boost** — 볼륨 증폭과 EQ를 제공하며, Equalizer APO를 앱에서 직접 내려받아 설치·연동합니다.
- **Game Mode / Fast Ping** — 게이밍 모드와 네트워크 지연(핑) 최적화를 적용합니다.
- **Delta Force Cleaner** — 게임 캐시를 정리하고 Windows API 기반 최적화를 수행합니다.
- **Updates** — `winget`으로 설치된 소프트웨어의 실제 업그레이드 가능 여부를 확인하고 업데이트합니다.

> ⚠️ 최적화 동작 상당수는 Windows 관리자 권한과 시스템 명령(`powercfg`, `netsh`, `reg`, `winget`, PowerShell 등)을 사용합니다. 패키징된 설치본은 관리자 권한으로 실행됩니다 (`electron-builder.yml`의 `requestedExecutionLevel: requireAdministrator`).

---

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 데스크톱 셸 | Electron 28 (`contextIsolation` + `sandbox` 활성, `nodeIntegration` 비활성) |
| 렌더러 | React 18, React Router (HashRouter), Vite 5 |
| 시스템 정보 | `systeminformation`, Windows 네이티브 명령 (WMI / `typeperf` / `netsh` 등) |
| 레지스트리 | `winreg` + `reg` CLI |
| 패키지 업데이트 | `winget` (Windows Package Manager) |
| 테스트 | Vitest + React Testing Library |
| 타입 검사 | TypeScript (`checkJs` 점진 도입) |
| 품질 도구 | ESLint (react / react-hooks), Prettier |
| 패키징 | electron-builder (NSIS 인스톨러) |

---

## 디렉토리 구조

```
Optimizer-Product/
├── electron/                     # Electron 백엔드 (메인 프로세스)
│   ├── main.js                   # 앱 진입점 · BrowserWindow · IPC 핸들러 등록
│   ├── preload.js                # contextBridge로 렌더러에 안전한 API 노출
│   ├── launch.cjs                # 개발용 실행 스크립트
│   └── services/                 # 기능별 서비스 모듈
│       ├── _exec.js              # 공용 프로세스 실행 유틸 (execAsync / execFile / PowerShell / timeout)
│       ├── cache.js              # 정적·동적 통계 캐시 (키별 TTL)
│       ├── systemStats.js        # 통합 시스템 통계 수집 (핫 패스)
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── audio.js              # 사운드 부스트 / Equalizer APO 연동
│       ├── gaming.js · fastPing.js · deltaForceCleaner.js
│       ├── updater.js            # winget 기반 소프트웨어 업데이트
│       ├── wingetParse.js        # winget 출력 파서 (순수 함수)
│       └── ...                   # driver, recovery, history, platform 등
├── src/                          # React 프론트엔드 (렌더러)
│   ├── App.jsx                   # 라우터 · 로딩 · ErrorBoundary
│   ├── components/               # UI 컴포넌트
│   │   ├── MainPage.jsx          # 좌측 메뉴 + 기능 패널 컨테이너
│   │   ├── SmartOptimization.jsx # 리소스 모니터 + 대상별 최적화
│   │   ├── WindowsBoost.jsx · SoundBoost.jsx
│   │   ├── DeltaForceCleaner.jsx · GameMode.jsx
│   │   ├── SoftwareUpdater.jsx   # winget 소프트웨어 · 드라이버 업데이트
│   │   └── chart/drawChart.js    # Canvas 2D 차트 (순수 함수)
│   ├── styles/                   # 컴포넌트별 CSS + index.css (:root 디자인 토큰)
│   └── utils/errorHandler.js     # 공용 에러 처리 유틸
├── test/                         # Vitest 단위 · 스모크 테스트
├── index.html                    # CSP · 진입 HTML
├── vite.config.js
├── vitest.config.js
├── tsconfig.json                 # checkJs 타입 검사 (noEmit)
├── electron-builder.yml          # NSIS 인스톨러 설정
└── package.json
```

---

## 실제 기능 패널

앱은 `MainPage` 하나에서 좌측 메뉴로 아래 패널을 전환합니다.

| 메뉴 | 컴포넌트 | 설명 |
|---|---|---|
| Smart Optimization | `SmartOptimization` | CPU / 메모리 / 디스크 / 이더넷 / Wi‑Fi / GPU 실시간 모니터링 + 대상별 최적화 |
| Windows Boost | `WindowsBoost` | 시각 효과 · 백그라운드 서비스 · 임시 파일 정리 등 시스템 부스트 |
| Sound Boost | `SoundBoost` | 볼륨 증폭 · EQ (Equalizer APO 자동 설치 · 연동) |
| Delta Force Cleaner | `DeltaForceCleaner` | 게임 캐시 정리 · Windows API 최적화 |
| Game Mode | `GameMode` | 게이밍 모드 On/Off · Fast Ping 최적화 |
| Updates | `SoftwareUpdater` | winget 기반 소프트웨어 업데이트 + 드라이버 목록 / 업데이트 |

---

## 개발 / 빌드

```bash
npm install

# 개발
npm run dev          # Vite 개발 서버 (http://localhost:5173)
npm start            # 개발 서버 + Electron 동시 실행
npm run electron     # Electron만 실행 (dev 서버가 떠 있을 때)

# 빌드 / 배포
npm run build        # 렌더러 프로덕션 번들 (dist/)
npm run dist:win     # Windows NSIS 인스톨러 생성 (dist-installer/)

# 품질
npm run lint         # ESLint 검사
npm run lint:fix     # ESLint 자동 수정
npm run format       # Prettier 포매팅
npm test             # Vitest 단위 · 스모크 테스트
npm run typecheck    # tsc --noEmit (JSDoc + @ts-check 파일 타입 검사)
```

> `dist/`, `dist-installer/` 등 빌드 산출물은 저장소에 커밋하지 않습니다 (`.gitignore` 참고).

---

## 라이선스

MIT License. 자세한 내용은 [LICENSE](LICENSE)를 참고하세요.
