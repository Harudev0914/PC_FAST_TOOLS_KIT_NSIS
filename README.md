# PC Optimizer

## 디렉토리 구조

```
Setup_NSIS/
├── electron/                 # Electron 백엔드
│   ├── main.js              # 메인 프로세스
│   ├── preload.js           # 프리로드 스크립트
│   └── services/            # 서비스 모듈
│       ├── cpu.js           # CPU 최적화
│       ├── memory.js        # 메모리 최적화
│       ├── disk.js          # 디스크 최적화
│       ├── network.js       # 네트워크 최적화
│       ├── gpuOptimize.js   # GPU 최적화
│       ├── audio.js         # 오디오 증폭
│       ├── gaming.js        # 게이밍 모드
│       ├── cleaner.js       # 컴퓨터 클리너
│       ├── recovery.js      # 파일 복구
│       ├── updater.js       # 소프트웨어 업데이터
│       ├── driver.js        # 드라이버 업데이터
│       ├── history.js       # 기록 자동삭제
│       ├── sharedMemory.js  # 공유 메모리
│       ├── ipcAllocator.js  # IPC 할당자
│       ├── systemStats.js   # 시스템 통계
│       ├── permissions.js   # 권한 관리
│       └── platform.js      # 플랫폼 서비스
├── src/                      # React 프론트엔드
│   ├── components/          # React 컴포넌트
│   ├── styles/             # CSS 스타일
│   └── utils/              # 유틸리티
│       └── errorHandler.js # 에러 핸들링
└── package.json            # 프로젝트 설정
```

## 에러 핸들링

에러 처리에 대한 자세한 내용은 코드베이스 내 `src/utils/errorHandler.js`를 참조하세요.

### 주요 에러 처리 함수
- `handleHttpError(statusCode, errorMessage)` - HTTP 에러 처리
- `handleIpcError(error, context)` - IPC 에러 처리
- `handleFileSystemError(error, filePath)` - 파일 시스템 에러 처리
- `withErrorHandling(asyncFn, options)` - 비동기 함수 래퍼
- `getUserFriendlyErrorMessage(error)` - 사용자 친화적 에러 메시지
- `isNetworkError(error)` - 네트워크 에러 확인

## 함수 활용도 요약

### 매우 높음 (⭐⭐⭐⭐⭐)
- `systemStats.getAllStats()` - 2초마다 호출
- `cpu.getStats()`, `cpu.optimize()` - SmartOptimization에서 주기적 호출
- `memory.getStats()`, `memory.optimize()` - SmartOptimization에서 주기적 호출
- `diskDetails.getDiskDetails()` - 모든 디스크 정보 수집 시 호출
- `gpuStats.getDetailedGPUInfo()` - GPU 통계 수집 시 호출
- `networkStats.getNetworkAdapterStats()` - 네트워크 통계 수집 시 호출
- `permissions.isAdmin()` - 모든 최적화 서비스에서 사용
- `platform.executeCommand()` - 모든 서비스에서 명령 실행 시 사용

### 높음 (⭐⭐⭐⭐)
- `cache.getStaticCache()`, `cache.setStaticCache()` - systemStats에서 사용
- `audio.getDevices()`, `audio.applySoundBoost()` - AudioAmplifier에서 사용
- `gaming.enable()`, `gaming.disable()` - GamingMode에서 사용
- `cleaner.scan()`, `cleaner.clean()` - Cleaner에서 사용
- `memoryDetails.getMemoryDetails()` - systemStats에서 사용

### 보통 (⭐⭐⭐)
- `network.optimize()` - NetworkOptimizer에서 사용
- `networkOptimization.optimizeAll()` - NetworkOptimizer에서 사용
- `recovery.scan()`, `recovery.recover()` - FileRecovery에서 사용
- `updater.getInstalled()` - SoftwareUpdater에서 사용
- `driver.getDrivers()` - DriverUpdater에서 사용
- `history.clear()` - HistoryCleaner에서 사용

### 낮음 (⭐⭐)
- `deltaForceCleaner.*` - DeltaForceCleaner에서만 사용
- `computeOptimization.*` - CPUOptimizer에서 선택적 사용
- `fastPing.*` - SmartOptimization에서 선택적 사용

### 매우 낮음 (⭐)
- `cpuOptimize.optimize()` - 사용되지 않음
- `ipcAllocator.*` - 향후 확장용
