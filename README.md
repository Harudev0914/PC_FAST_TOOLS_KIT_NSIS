# PC Optimizer

Windows 전용 PC 최적화 데스크톱 앱. **Electron + Vite + React 18**로 만든 단일 창(single-window) 애플리케이션으로, 시스템 리소스 모니터링과 CPU/메모리/디스크/네트워크/GPU 최적화, 사운드 부스트, 게임 모드 등을 제공합니다.

> 최적화 동작 상당수는 Windows 관리자 권한과 시스템 명령(`powercfg`, `netsh`, `reg`, `winget`, PowerShell 등)을 사용합니다. 패키징 설치본은 관리자 권한으로 실행됩니다(`electron-builder.yml`의 `requestedExecutionLevel: requireAdministrator`).

---

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 데스크톱 셸 | Electron 28 (contextIsolation + sandbox, nodeIntegration 비활성) |
| 렌더러 | React 18, React Router(HashRouter), Vite 5 |
| 시스템 정보 | `systeminformation`, Windows 네이티브 명령(WMI/typeperf/netsh 등) |
| 레지스트리 | `winreg` + `reg` CLI |
| 패키지 업데이트 | `winget` (Windows Package Manager) |
| 품질 도구 | ESLint(react/react-hooks), Prettier |

---

## 디렉토리 구조

```
Optimizer-Product/
├── electron/                     # Electron 백엔드 (메인 프로세스)
│   ├── main.js                   # 앱 진입점 · BrowserWindow · IPC 핸들러 등록
│   ├── preload.js                # contextBridge로 렌더러에 안전한 API 노출
│   ├── launch.cjs                # 개발용 실행 스크립트
│   └── services/                 # 기능별 서비스 모듈
│       ├── _exec.js              # ★ 공용 프로세스 실행 유틸(execAsync/execFile/PowerShell/timeout)
│       ├── cache.js              # 정적/동적 통계 캐시 (키별 TTL)
│       ├── systemStats.js        # 통합 시스템 통계 수집(핫 패스)
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── audio.js              # 사운드 부스트 / Equalizer APO 연동
│       ├── gaming.js · fastPing.js · deltaForceCleaner.js
│       ├── updater.js            # winget 기반 소프트웨어 업데이트 확인
│       └── ...                   # driver, recovery, history, platform 등
├── src/                          # React 프론트엔드 (렌더러)
│   ├── App.jsx                   # 라우터 · 로딩 · ErrorBoundary
│   ├── components/               # UI 컴포넌트
│   │   ├── MainPage.jsx          # 좌측 메뉴 + 5개 기능 패널 컨테이너
│   │   ├── SmartOptimization.jsx # 리소스 모니터 + 개별 최적화
│   │   ├── WindowsBoost.jsx · SoundBoost.jsx
│   │   ├── DeltaForceCleaner.jsx · GameMode.jsx
│   │   └── (TitleBar, LoadingScreen, ErrorBoundary, 에러 페이지)
│   ├── styles/                   # 컴포넌트별 CSS + index.css(:root 디자인 토큰)
│   └── utils/errorHandler.js     # 공용 에러 처리 유틸
├── index.html                    # CSP · 진입 HTML
├── vite.config.js
├── electron-builder.yml          # NSIS 인스톨러 설정
└── package.json
```

## 실제 기능 패널 (렌더러 라우팅)

앱은 `MainPage` 하나에 좌측 메뉴로 5개 패널을 전환합니다.

| 메뉴 | 컴포넌트 | 설명 |
|---|---|---|
| Smart Optimization | `SmartOptimization` | CPU/메모리/디스크/이더넷/Wi‑Fi/GPU 실시간 모니터링 + 대상별 최적화 |
| Windows Boost | `WindowsBoost` | Windows 시각 효과/서비스 등 부스트 |
| Sound Boost | `SoundBoost` | 볼륨 증폭 · EQ (Equalizer APO 자동 설치·연동) |
| Delta Force Cleaner | `DeltaForceCleaner` | 게임 캐시 정리 · Windows API 최적화 |
| Game Mode | `GameMode` | 게이밍 모드 On/Off, Fast Ping 최적화 |

---

## 개발 / 빌드

```bash
npm install

npm run dev          # Vite 개발 서버 (http://localhost:5173)
npm start            # 개발 서버 + Electron 동시 실행
npm run electron     # Electron만 실행 (dev 서버가 떠 있을 때)

npm run build        # 렌더러 프로덕션 번들 (dist/)
npm run dist:win     # Windows NSIS 인스톨러 생성 (dist-installer/)

npm run lint         # ESLint 검사
npm run lint:fix     # 자동 수정
npm run format       # Prettier 포매팅
```

> `dist/`, `dist-installer/` 등 빌드 산출물은 저장소에 커밋하지 않습니다(`.gitignore` 참고).

---

## 아키텍처 노트

### 프로세스 실행 유틸 (`electron/services/_exec.js`)
모든 서비스가 공용 실행 헬퍼를 재사용합니다. 기존에는 동일한 `execAsync` 래퍼(기본 타임아웃 2분 · 버퍼 20MB)와 PowerShell UTF‑8 프리앰블, timeout 레이스 헬퍼가 ~19개 파일에 복붙되어 있었습니다.

```js
const { execAsync, execFileAsync, executePowerShell, withTimeout } = require('./_exec');
```

- 사용자 입력이 섞이는 명령은 셸을 거치지 않는 `execFileAsync`(인자 배열)로 실행해 **명령 주입을 차단**합니다.

### 통계 캐시 (`cache.js`)
`systemStats.getAllStats()`는 렌더러가 2초 주기로 폴링하며, 내부적으로 여러 네이티브 프로세스(`tasklist`/`wmic`/`typeperf`/`nvidia-smi`/PowerShell)를 스폰합니다. 비용이 큰 지표(프로세스 수·GPU·네트워크)를 **키별 TTL 동적 캐시**로 감싸 폴링 주기 내 중복 스폰을 제거했습니다.

### 소프트웨어 업데이트 (`updater.js`)
`winget upgrade` 출력을 파싱해 실제 업그레이드 가능한 패키지를 반환합니다(OS 언어와 무관하게 표를 파싱). IPC: `updater:getInstalled`, `updater:checkUpdates`, `updater:checkAllUpdates`, `updater:update`.

### 디자인 토큰 (`src/styles/index.css`)
`:root`에 색상/여백/반경 토큰을 정의했습니다. 새 스타일은 하드코딩 색상 대신 `var(--…)`를 사용하세요.

### 보안
- `BrowserWindow`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `enableRemoteModule: false`.
- 렌더러는 `preload.js`의 `contextBridge`로 노출된 화이트리스트 API만 사용합니다.
- `index.html`에 CSP 메타 태그 적용.

---

## 에러 핸들링

`src/utils/errorHandler.js` 참고.

- `handleHttpError(statusCode, errorMessage)` — HTTP 에러 처리
- `handleIpcError(error, context)` — IPC 에러 처리
- `handleFileSystemError(error, filePath)` — 파일 시스템 에러 처리
- `withErrorHandling(asyncFn, options)` — 비동기 함수 래퍼
- `getUserFriendlyErrorMessage(error)` — 사용자 친화적 메시지
- `isNetworkError(error)` — 네트워크 에러 판별

---

## 알려진 개선 과제 (Roadmap)

리팩터링을 이어갈 다음 후보들입니다.

- **`SmartOptimization.jsx` 분해** — 2,800줄 단일 컴포넌트를 패널(Cpu/Memory/Disk/Network/Gpu)·훅(`useSystemStats`, `useOptimizer`)·`drawChart`로 분리.
- **IPC 핸들러 래퍼** — `main.js`의 82개 핸들러에 반복되는 try/catch를 공용 `wrap()` + 채널 테이블로 축약.
- **CSS 토큰 전면 적용** — 남은 하드코딩 색상을 `var(--…)`로 치환.
- **미사용 백엔드 정리** — `ipcAllocator`/`sharedMemory`(비활성) 및 UI가 없는 IPC 채널 정리.
- **드라이버·소프트웨어 업데이트 UI 재도입** — 백엔드는 동작하나 현재 렌더러 패널이 없음.
- **테스트 도입** — Vitest + React Testing Library 기반 스모크 테스트.
- **TypeScript 점진 도입**.

---

## 라이선스

MIT License. 자세한 내용은 [LICENSE](LICENSE) 참고.
