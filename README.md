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
