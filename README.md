<div align="center">

# PC Optimizer

**한국어** · [English](README.en.md) · [日本語](README.ja.md) · [中文](README.zh.md)

Windows 전용 PC 최적화 데스크톱 애플리케이션

</div>

---

## 프로덕트 설명
  
**PC Optimizer**는 Windows PC의 성능을 실시간으로 모니터링하고 최적화하는 데스크톱 애플리케이션입니다. **Electron + Vite + React 18** 기반의 단일 창(single-window) 앱으로, 좌측 메뉴에서 기능 패널을 전환하며 사용합니다.

- **실시간 리소스 모니터링** — CPU · 메모리 · 디스크 · 이더넷 · Wi‑Fi · GPU를 2초 주기로 수집해 차트로 표시합니다. GPU는 온도를 보고하는 장치면 온도를, 그렇지 않은 내장 GPU면 사용률을 보여줍니다.
- **대상별 최적화** — 모니터링 중인 각 구성요소를 개별적으로 최적화합니다.
- **Windows Boost / Game Mode** — ON/OFF 토글 한 번으로 즉시 적용·해제합니다.
- **Sound Boost** — 볼륨 증폭과 10밴드 EQ를 제공하며, Equalizer APO를 앱에서 직접 내려받아 설치·연동합니다.
- **Fast Ping 버튼** — 우측 하단 번개 버튼을 누르면 일괄 최적화 → 일괄 가속화 → 핑 최적화를 순서대로 모두 실행합니다.
- **Delta Force Cleaner** — 게임 로그·캐시를 정리합니다.
- **Updates** — `winget`으로 설치된 소프트웨어의 실제 업그레이드 가능 여부를 확인하고 업데이트합니다.

### 두 가지 설계 원칙

**1. 최적화 기능은 사용자 권한만으로 동작합니다.**
Smart Optimization · Windows Boost · Game Mode · Fast Ping은 `HKCU` 레지스트리, 사용자 TEMP 폴더, `powercfg`만 사용합니다. 관리자 권한이 필요한 동작(HKLM 쓰기, 서비스 제어, `netsh` 전역 튜닝, `defrag`/`chkdsk`/DISM)은 코드에서 전부 제거했습니다. 레지스트리 **쓰기는 HKCU 전용**이며, HKLM은 설치된 소프트웨어 목록 조회 등 읽기에만 씁니다.

> 다만 앱 자체는 여전히 관리자 권한으로 실행됩니다 (`requestedExecutionLevel: requireAdministrator`). **Updates 패널의 드라이버 업데이트**가 `pnputil /update-driver`를 호출하는데, 이 명령만은 승격이 필수이기 때문입니다.

**2. OFF는 "Windows 기본값"이 아니라 "켜기 직전 값"으로 되돌립니다.**
토글을 켜기 전에 건드릴 레지스트리 값과 전원 계획을 스냅샷으로 찍어 파일에 저장하고, OFF에서 그 값을 그대로 복원합니다. 하드코딩된 기본값을 써 넣으면, 원래 고성능 전원 계획을 쓰던 사용자가 ON→OFF 했을 때 균형 조정으로 바뀌어 버립니다 — 켜기 전엔 없던 설정을 OFF가 만들어내는 셈입니다. 켜기 전에 존재하지 않던 값은 복원 시 삭제하고, 백업에 실패한 값은 아예 건드리지 않습니다.

> ⚠️ **되돌릴 수 없는 동작**: Windows Boost의 임시 파일 삭제와 DNS 캐시 플러시는 복원 대상이 아닙니다. 임시 파일 정리는 **오래된 파일만** 지우며, 앱이 시작된 뒤 생성됐거나 최근 1시간 내에 사용된 항목은 건너뜁니다.

---

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 데스크톱 셸 | Electron 28 (`contextIsolation` + `sandbox` 활성, `nodeIntegration` 비활성) |
| 렌더러 | React 18, React Router (HashRouter), Vite 5 |
| 시스템 정보 | `systeminformation`, Windows 네이티브 명령 (WMI / `typeperf` / `nvidia-smi` 등) |
| 레지스트리 | `winreg` + `reg` CLI (HKCU 전용) |
| 패키지 업데이트 | `winget` (Windows Package Manager) |
| 테스트 | Vitest + React Testing Library (45개) |
| 타입 검사 | TypeScript (`checkJs` 점진 도입) |
| 품질 도구 | ESLint (react / react-hooks), Prettier — 경고 0 |
| 패키징 | electron-builder (NSIS 인스톨러) |

---

## 디렉토리 구조

```
Optimizer-Product/
├── electron/                       # Electron 백엔드 (메인 프로세스)
│   ├── main.js                     # 앱 진입점 · BrowserWindow · IPC 핸들러 등록
│   ├── preload.js                  # contextBridge로 렌더러에 안전한 API 노출
│   ├── launch.cjs                  # GUI 런처 (ELECTRON_RUN_AS_NODE 제거)
│   └── services/
│       ├── _exec.js                # 공용 프로세스 실행 유틸 (execAsync / timeout)
│       ├── cache.js                # 정적·동적 통계 캐시 (키별 TTL)
│       ├── systemStats.js          # 통합 시스템 통계 수집 (핫 패스)
│       ├── registrySnapshot.js     # 적용 직전 값 스냅샷 · 복원 (읽기 실패와 값 부재를 구분)
│       ├── optimizationState.js    # 토글 적용 여부 + 스냅샷 영속화
│       ├── gaming.js               # Game Mode 적용 / 해제
│       ├── deltaForceCleaner.js    # Windows Boost · 게임 로그 정리 · 임시 파일 정리
│       ├── fastPing.js             # 일괄 최적화 · 일괄 가속화 · 핑 최적화
│       ├── audio.js                # 사운드 부스트 / Equalizer APO 연동
│       ├── cpu.js · memory.js · disk.js · network.js · gpuOptimize.js
│       ├── updater.js · driver.js  # winget 소프트웨어 · 드라이버 업데이트
│       └── wingetParse.js          # winget 출력 파서 (순수 함수)
├── src/                            # React 프론트엔드 (렌더러)
│   ├── App.jsx                     # 라우터 · 로딩 · ErrorBoundary
│   ├── components/
│   │   ├── MainPage.jsx            # 좌측 메뉴 · 패널 컨테이너 · Fast Ping 버튼 · 진행률 토스트
│   │   ├── SmartOptimization.jsx   # 리소스 모니터 + 대상별 최적화
│   │   ├── WindowsBoost.jsx · GameMode.jsx     # ON/OFF 토글 패널
│   │   ├── SoundBoost.jsx          # 볼륨 · 10밴드 EQ · Equalizer APO
│   │   ├── DeltaForceCleaner.jsx · SoftwareUpdater.jsx
│   │   └── chart/drawChart.js      # Canvas 2D 차트 (순수 함수)
│   ├── hooks/
│   │   ├── useAppliedState.js      # 토글 상태 복원 (페이지 이동 · 앱 재시작 후에도 유지)
│   │   └── useOptimizationProgress.js  # 백엔드 단계별 진행률을 토스트로 중계
│   ├── styles/                     # 컴포넌트별 CSS + index.css (:root 디자인 토큰)
│   └── utils/errorHandler.js
├── test/                           # Vitest 단위 · 스모크 테스트
├── index.html                      # CSP · 진입 HTML
├── vite.config.js · vitest.config.js
├── tsconfig.json                   # checkJs 타입 검사 (noEmit)
├── electron-builder.yml            # NSIS 인스톨러 설정
└── package.json
```

---

## 기능 패널

앱은 `MainPage` 하나에서 좌측 메뉴로 아래 패널을 전환합니다.

| 메뉴 | 컴포넌트 | 설명 |
|---|---|---|
| Smart Optimization | `SmartOptimization` | CPU / 메모리 / 디스크 / 이더넷 / Wi‑Fi / GPU 실시간 모니터링 + 대상별 최적화 |
| Windows Boost | `WindowsBoost` | 임시 파일 정리 · 게임 모드 · Game DVR · 시각 효과 · 메모리 (ON/OFF 토글) |
| Sound Boost | `SoundBoost` | 볼륨 증폭 · 10밴드 EQ (Equalizer APO 자동 설치 · 연동) |
| Delta Force Cleaner | `DeltaForceCleaner` | 게임 로그 · 캐시 정리 |
| Game Mode | `GameMode` | FPS · 마우스 가속 · 입력 반응속도 · 전원 계획 (ON/OFF 토글) |
| Updates | `SoftwareUpdater` | winget 기반 소프트웨어 업데이트 + 드라이버 목록 / 업데이트 |

우측 하단의 **Fast Ping 버튼**(번개 아이콘)은 어느 패널에서든 눌러 일괄 최적화 → 일괄 가속화 → 핑 최적화를 한 번에 실행합니다. 진행 상황은 좌측 하단 토스트에 백엔드의 실제 단계로 표시됩니다.

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
