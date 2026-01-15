# PC Optimizer

Windows 시스템 최적화 및 관리 데스크톱 애플리케이션

## 개발자 정보

- **개발자**: KR_Tuki
- **최종 업데이트**: 2024-12-30

## 기술 스택

### 프론트엔드
- React 18
- React Router
- Recharts (차트)
- Vite (빌드 도구)

### 백엔드
- Electron
- Node.js
- systeminformation (시스템 정보 수집)
- winreg (Windows 레지스트리)
- child_process (시스템 명령 실행)

### 빌드 및 배포
- electron-builder
- NSIS (Windows 설치 프로그램)

## 프로젝트 구조

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

## 설치 및 실행

### 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (React)
npm run dev

# Electron 앱 실행 (별도 터미널)
npm run electron
```

### 프로덕션 빌드

```bash
# React 빌드
npm run build

# Electron 앱 빌드
npm run dist

# Windows EXE 빌드
npm run dist:win
```

## 시스템 요구사항

- Windows 10 이상
- 관리자 권한 (일부 기능 사용 시 필요)
- Node.js 16 이상

## 모듈별 상세 설명

### 1. CPU 최적화 (`electron/services/cpu.js`)

**기능**: CPU 성능 최적화 및 통계 수집

**함수 목록**:
- `getStats()` - CPU 통계 조회 (코어 수, 모델, 사용률)
- `optimize(options)` - CPU 최적화 실행
  - 프로세스 CPU 어피니티 최적화
  - CPU 스케줄러 우선순위 조정
  - 하이퍼스레딩 최적화
  - CPU 전압/클럭 최적화 (터보 부스트 활성화)
  - 인터럽트 처리 최적화
- `setPriority(pid, priority)` - 프로세스 우선순위 설정

**활용도**: ⭐⭐⭐⭐⭐ (매우 높음)
- SmartOptimization 컴포넌트에서 주기적으로 호출
- CPUOptimizer 컴포넌트에서 최적화 실행

**의존성**: `winreg`, `permissions`, `systeminformation`

---

### 2. 메모리 최적화 (`electron/services/memory.js`)

**기능**: 메모리 관리 및 최적화

**함수 목록**:
- `getStats()` - 메모리 통계 조회 (사용량, 총량, 사용률)
- `getProcesses()` - 메모리 사용 프로세스 목록 조회
- `killProcess(pid)` - 프로세스 종료
- `optimize(options)` - 메모리 최적화 실행
  - Idle 작업 완료
  - 메모리 가비지 컬렉션
  - Standby 메모리 정리
  - 페이지 파일 최적화
  - Prefetch 최적화
  - 불필요한 프로세스 종료

**활용도**: ⭐⭐⭐⭐⭐ (매우 높음)
- SmartOptimization 컴포넌트에서 주기적으로 호출
- MemoryOptimizer 컴포넌트에서 최적화 실행

**의존성**: `winreg`, `permissions`, `platform`, `os`

---

### 3. 디스크 최적화 (`electron/services/disk.js`)

**기능**: 디스크 정리 및 최적화

**함수 목록**:
- `optimize(options)` - 디스크 최적화 실행
  - 디스크 정리 (임시 파일, 캐시)
  - 디스크 조각 모음
  - 디스크 상태 점검
- `getDiskType(diskLetter)` - 디스크 타입 확인 (SSD/HDD)

**활용도**: ⭐⭐⭐⭐ (높음)
- SmartOptimization 컴포넌트에서 최적화 실행
- diskDetails 서비스와 연동

**의존성**: `cleaner`, `diskDetails`, `platform`, `winreg`

---

### 4. 디스크 상세 정보 (`electron/services/diskDetails.js`)

**기능**: 디스크 상세 정보 및 성능 데이터 수집

**함수 목록**:
- `getDiskDetails(diskLetter)` - 디스크 상세 정보 조회
  - 모델, 타입, 벤더, 시리얼 번호
  - 활성 시간, 읽기/쓰기 속도
  - 응답 시간, 전송 속도

**활용도**: ⭐⭐⭐⭐⭐ (매우 높음)
- systemStats에서 모든 디스크 정보 수집 시 호출
- SmartOptimization에서 실시간 디스크 성능 모니터링

**의존성**: `systeminformation`

---

### 5. 네트워크 최적화 (`electron/services/network.js`)

**기능**: 네트워크 설정 최적화

**함수 목록**:
- `getStats()` - 네트워크 통계 조회
- `pingTest(host)` - 네트워크 핑 테스트
- `optimize(options)` - 네트워크 최적화 실행
  - TCP/IP 설정 최적화
  - DNS 캐시 플러시
  - 네트워크 버퍼 크기 조정
  - QoS 설정

**활용도**: ⭐⭐⭐⭐ (높음)
- NetworkOptimizer 컴포넌트에서 최적화 실행
- SmartOptimization에서 네트워크 통계 수집

**의존성**: `winreg`

---

### 6. 고급 네트워크 최적화 (`electron/services/networkOptimization.js`)

**기능**: QUIC/HTTP/3, ENet, IOCP 등 고급 네트워크 API 최적화

**함수 목록**:
- `detectMsQuic()` - MsQuic 라이브러리 감지
- `enableQUIC(options)` - QUIC/HTTP/3 활성화
- `detectENet()` - ENet 라이브러리 감지
- `optimizeENet(options)` - ENet 최적화 (게임용 UDP)
- `optimizeIOCP(options)` - IOCP 최적화 (Windows I/O Completion Ports)
- `optimizeAll(options)` - 모든 네트워크 API 최적화
- `detectAvailableAPIs()` - 사용 가능한 API 감지

**활용도**: ⭐⭐⭐ (보통)
- NetworkOptimizer 컴포넌트에서 고급 최적화 옵션으로 사용

**의존성**: `winreg`, `permissions`, `fs`, `path`

---

### 7. 네트워크 통계 (`electron/services/networkStats.js`)

**기능**: 네트워크 어댑터 통계 수집

**함수 목록**:
- `getNetworkAdapterStats()` - 네트워크 어댑터 통계 조회
- `getWiFiInfo()` - WiFi 정보 조회 (SSID, 신호 강도)

**활용도**: ⭐⭐⭐⭐⭐ (매우 높음)
- systemStats에서 네트워크 통계 수집 시 호출
- SmartOptimization에서 실시간 네트워크 모니터링

**의존성**: `systeminformation`

---

### 8. 네트워크 어댑터 정보 (`electron/services/networkAdapterInfo.js`)

**기능**: 네트워크 어댑터 상세 정보 수집

**함수 목록**:
- `getAdapterInfo(adapterName)` - 어댑터 정보 조회 (IPv4, IPv6, 연결 타입)

**활용도**: ⭐⭐⭐ (보통)
- networkStats에서 어댑터 정보 보완 시 사용

**의존성**: `platform`

---

### 9. GPU 최적화 (`electron/services/gpuOptimize.js`)

**기능**: GPU 성능 최적화

**함수 목록**:
- `optimize(options)` - GPU 최적화 실행
  - GPU 전원 관리 최적화
  - GPU 스케줄링 최적화
  - DirectX 최적화
  - GPU 메모리 관리

**활용도**: ⭐⭐⭐ (보통)
- SmartOptimization에서 GPU 최적화 실행

**의존성**: `winreg`, `permissions`

---

### 10. GPU 통계 (`electron/services/gpuStats.js`)

**기능**: GPU 상세 통계 수집

**함수 목록**:
- `getDetailedGPUInfo()` - GPU 상세 정보 조회
  - 사용률, 메모리, 온도, 전력
  - 드라이버 버전, DirectX 버전

**활용도**: ⭐⭐⭐⭐⭐ (매우 높음)
- systemStats에서 GPU 통계 수집 시 호출
- SmartOptimization에서 실시간 GPU 모니터링

**의존성**: `gpuUsage`, `gpuDetails`, `systeminformation`

---

### 11. GPU 상세 정보 (`electron/services/gpuDetails.js`)

**기능**: GPU 엔진별 사용률 및 상세 정보 수집

**함수 목록**:
- `getGPUDetails()` - GPU 상세 정보 조회
- `getGPUUsageByType(engType)` - 특정 엔진 타입 사용률 조회
- `getSharedGPUMemory()` - 공유 GPU 메모리 조회
- `getDirectXVersion()` - DirectX 버전 조회
- `getPhysicalLocation()` - GPU 물리적 위치 조회

**활용도**: ⭐⭐⭐⭐ (높음)
- gpuStats에서 GPU 상세 정보 수집 시 호출

**의존성**: `platform`, `systeminformation`

---

### 12. GPU 사용률 (`electron/services/gpuUsage.js`)

**기능**: Intel GPU 사용률 수집

**함수 목록**:
- `getIntelGPUUsage()` - Intel GPU 사용률 조회 (Task Manager 방식)

**활용도**: ⭐⭐⭐ (보통)
- gpuStats에서 Intel GPU 사용률 수집 시 호출

**의존성**: 없음

---

### 13. 오디오 증폭 (`electron/services/audio.js`)

**기능**: 오디오 장치 제어 및 사운드 부스트

**함수 목록**:
- `getDevices()` - 오디오 장치 목록 조회
- `setVolume(deviceId, volume)` - 볼륨 설정
- `boost(enabled)` - 사운드 부스트 활성화/비활성화
- `getSettings()` - 사운드 부스트 설정 조회
- `applySoundBoost(settings)` - 사운드 부스트 설정 적용
- `getEQPresets()` - EQ 프리셋 목록 조회
- `detectModels()` - 오디오 모델 감지

**활용도**: ⭐⭐⭐⭐ (높음)
- AudioAmplifier 컴포넌트에서 오디오 제어
- SoundBoost 컴포넌트에서 사운드 부스트

**의존성**: `winreg`, `fs`, `path`, `os`

---

### 14. 게이밍 모드 (`electron/services/gaming.js`)

**기능**: Windows 게임 모드 활성화 및 최적화

**함수 목록**:
- `enable()` - 게이밍 모드 활성화
- `disable()` - 게이밍 모드 비활성화
- `getStatus()` - 게이밍 모드 상태 조회
- `enableGameMode(options)` - 게임 모드 활성화 (고급 옵션)
- `disableGameMode()` - 게임 모드 비활성화

**활용도**: ⭐⭐⭐⭐ (높음)
- GamingMode 컴포넌트에서 게이밍 모드 제어
- GameMode 컴포넌트에서 게임 모드 제어

**의존성**: `winreg`

---

### 15. 컴퓨터 클리너 (`electron/services/cleaner.js`)

**기능**: 불필요한 파일 및 캐시 정리

**함수 목록**:
- `scan()` - 정리 가능한 파일 스캔
- `clean(options)` - 파일 정리 실행
  - 임시 파일 정리
  - 브라우저 캐시 정리
  - 레지스트리 정리
  - 시스템 파일 정리

**활용도**: ⭐⭐⭐⭐ (높음)
- Cleaner 컴포넌트에서 파일 정리 실행

**의존성**: `fs`, `path`, `os`

---

### 16. Delta Force 클리너 (`electron/services/deltaForceCleaner.js`)

**기능**: Delta Force 게임 로그 파일 정리 및 Windows API 최적화

**함수 목록**:
- `scan(dirPath)` - 디렉토리 스캔
- `clean(dirPath)` - 로그 파일 정리
- `findDirectory()` - Delta Force 디렉토리 찾기
- `getGameExplorerGames()` - 게임 탐색기 게임 목록 조회
- `installGameToExplorer(gamePath, gdfPath)` - 게임 탐색기에 게임 설치
- `uninstallGameFromExplorer(instanceID)` - 게임 탐색기에서 게임 제거
- `optimizeWithWindowsAPI(options)` - Windows API 최적화
- `manageApplicationsAndServices(options)` - 애플리케이션 및 서비스 관리

**활용도**: ⭐⭐ (낮음)
- DeltaForceCleaner 컴포넌트에서 사용

**의존성**: `fs`, `path`, `os`, `winreg`

---

### 17. 파일 복구 (`electron/services/recovery.js`)

**기능**: 삭제된 파일 스캔 및 복구

**함수 목록**:
- `scan(options)` - 삭제된 파일 스캔
- `recover(filePath, destination)` - 파일 복구

**활용도**: ⭐⭐⭐ (보통)
- FileRecovery 컴포넌트에서 파일 복구 실행

**의존성**: `fs`, `path`

---

### 18. 소프트웨어 업데이터 (`electron/services/updater.js`)

**기능**: 설치된 소프트웨어 목록 조회 및 업데이트 확인

**함수 목록**:
- `getInstalled()` - 설치된 소프트웨어 목록 조회
- `checkUpdates(software)` - 업데이트 확인
- `update(software)` - 소프트웨어 업데이트

**활용도**: ⭐⭐⭐ (보통)
- SoftwareUpdater 컴포넌트에서 소프트웨어 관리

**의존성**: `winreg`

---

### 19. 드라이버 업데이터 (`electron/services/driver.js`)

**기능**: 드라이버 목록 조회 및 업데이트

**함수 목록**:
- `getDrivers()` - 드라이버 목록 조회
- `checkUpdates()` - 드라이버 업데이트 확인
- `update(driver)` - 드라이버 업데이트

**활용도**: ⭐⭐⭐ (보통)
- DriverUpdater 컴포넌트에서 드라이버 관리

**의존성**: 없음

---

### 20. 기록 자동삭제 (`electron/services/history.js`)

**기능**: 브라우저 및 Windows 활동 기록 삭제

**함수 목록**:
- `getTypes()` - 삭제 가능한 기록 타입 목록 조회
- `clear(types)` - 기록 삭제 실행
- `schedule(config)` - 자동 삭제 스케줄 설정

**활용도**: ⭐⭐⭐ (보통)
- HistoryCleaner 컴포넌트에서 기록 삭제 실행

**의존성**: `fs`, `path`, `os`

---

### 21. IPC 가상메모리 할당자 (`electron/services/sharedMemory.js`, `ipcAllocator.js`)

**기능**: Windows Memory-Mapped Files 기반 Zero-copy 데이터 공유

**함수 목록** (sharedMemory.js):
- `SharedMemoryAllocator` 클래스
  - `create(name, size)` - 공유 메모리 생성
  - `open(name)` - 공유 메모리 열기
  - `malloc(size, type)` - 메모리 할당
  - `free(offset)` - 메모리 해제
  - `read(offset, size)` - 메모리 읽기
  - `write(offset, data)` - 메모리 쓰기
  - `getStats()` - 할당자 통계 조회

**함수 목록** (ipcAllocator.js):
- `IPCAllocator` 클래스
- `getIPCAllocator(name, size)` - IPC 할당자 인스턴스 가져오기

**활용도**: ⭐⭐ (낮음)
- 대용량 시스템 통계 데이터 공유 시 사용 (향후 확장)

**의존성**: `fs`, `path`, `os`

---

### 22. 시스템 통계 (`electron/services/systemStats.js`)

**기능**: 통합 시스템 통계 수집 (CPU, Memory, Disk, Network, GPU)

**함수 목록**:
- `getAllStats(options)` - 모든 시스템 통계 조회
- `getCPUUsage()` - CPU 사용률 조회
- `getMemoryUsage()` - 메모리 사용량 조회
- `getDiskUsage()` - 디스크 사용량 조회
- `getGPUUsage()` - GPU 사용률 조회
- `getNetworkStats()` - 네트워크 통계 조회

**활용도**: ⭐⭐⭐⭐⭐ (매우 높음)
- SmartOptimization 컴포넌트에서 주기적으로 호출 (2초마다)
- Dashboard 컴포넌트에서 시스템 통계 표시

**의존성**: `networkStats`, `gpuStats`, `memoryDetails`, `networkAdapterInfo`, `diskDetails`, `platform`, `cache`

---

### 23. 메모리 상세 정보 (`electron/services/memoryDetails.js`)

**기능**: 메모리 상세 정보 수집 (캐시, 커밋, 페이징 풀 등)

**함수 목록**:
- `getMemoryDetails()` - 메모리 상세 정보 조회
  - 사용 가능한 메모리
  - 캐시된 메모리
  - 커밋된 메모리
  - 페이징 풀, 비페이징 풀
  - 압축된 메모리
  - 하드웨어 예약 메모리

**활용도**: ⭐⭐⭐⭐ (높음)
- systemStats에서 메모리 상세 정보 수집 시 호출

**의존성**: `systeminformation`

---

### 24. 권한 관리 (`electron/services/permissions.js`)

**기능**: 관리자 권한 확인 및 요청

**함수 목록**:
- `isAdmin()` - 관리자 권한 확인
- `requestAdmin()` - 관리자 권한 요청
- `confirmAction(action, details)` - 작업 확인

**활용도**: ⭐⭐⭐⭐⭐ (매우 높음)
- 모든 최적화 서비스에서 관리자 권한 확인 시 사용

**의존성**: `platform`

---

### 25. 플랫폼 서비스 (`electron/services/platform.js`)

**기능**: OS별 플랫폼 정보 및 명령 실행

**함수 목록**:
- `getOSInfo()` - OS 정보 조회
- `isAdmin()` - 관리자 권한 확인
- `requestAdmin(command, args)` - 관리자 권한으로 명령 실행
- `executeCommand(command, options)` - 명령 실행
- `readFile(filePath)` - 파일 읽기
- `readFiles(filePaths)` - 여러 파일 읽기
- `parseOutput(output, patterns)` - 출력 파싱
- `extractNumber(str, defaultValue)` - 숫자 추출
- `parseBytes(str)` - 바이트 단위 변환

**활용도**: ⭐⭐⭐⭐⭐ (매우 높음)
- 모든 서비스에서 플랫폼별 명령 실행 시 사용

**의존성**: `systeminformation`

---

### 26. 캐시 서비스 (`electron/services/cache.js`)

**기능**: 정적/동적 데이터 캐싱

**함수 목록**:
- `getStaticCache(key)` - 정적 데이터 캐시 조회 (TTL: 5분)
- `setStaticCache(key, value)` - 정적 데이터 캐시 저장
- `getDynamicCache(key)` - 동적 데이터 캐시 조회 (TTL: 1초)
- `setDynamicCache(key, value)` - 동적 데이터 캐시 저장
- `clearCache()` - 모든 캐시 초기화
- `clearCacheKey(key, type)` - 특정 키 캐시 초기화

**활용도**: ⭐⭐⭐⭐ (높음)
- systemStats에서 중복 연산 방지를 위해 사용

**의존성**: 없음

---

### 27. 계산 최적화 (`electron/services/computeOptimization.js`)

**기능**: OpenCL, CUDA, Intel oneAPI 최적화

**함수 목록**:
- `optimizeOpenCL(options)` - OpenCL 최적화
- `optimizeCUDA(options)` - CUDA 최적화
- `optimizeIntelOneAPI(options)` - Intel oneAPI 최적화
- `optimizeAll(options)` - 모든 계산 라이브러리 최적화
- `detectLibraries()` - 사용 가능한 라이브러리 감지

**활용도**: ⭐⭐ (낮음)
- CPUOptimizer 컴포넌트에서 계산 라이브러리 최적화 시 사용

**의존성**: `winreg`, `fs`, `path`, `os`

---

### 28. Fast Ping (`electron/services/fastPing.js`)

**기능**: 게임/작업 모드 최적화 및 배치 최적화

**함수 목록**:
- `optimizeGameMode(options)` - 게임 모드 최적화
- `optimizeWorkMode(options)` - 작업 모드 최적화
- `batchOptimize(options)` - 배치 최적화
- `batchAccelerate(options)` - 배치 가속화
- `pingOptimize(options)` - 핑 최적화

**활용도**: ⭐⭐⭐ (보통)
- SmartOptimization에서 통합 최적화 시 사용

**의존성**: `winreg`

---

### 29. CPU 안전 최적화 (`electron/services/cpuOptimize.js`)

**기능**: 시스템에 영향 없는 안전한 CPU 최적화

**함수 목록**:
- `optimize()` - 안전한 CPU 최적화 실행

**활용도**: ⭐ (매우 낮음)
- 사용되지 않음 (cpu.js의 optimize 함수 사용)

**의존성**: 없음

---

## 프론트엔드 컴포넌트

### 주요 컴포넌트

1. **SmartOptimization** - 통합 최적화 대시보드 (CPU, Memory, Disk, GPU, Network 실시간 모니터링)
2. **Dashboard** - 시스템 상태 대시보드
3. **CPUOptimizer** - CPU 최적화 전용 페이지
4. **MemoryOptimizer** - 메모리 최적화 전용 페이지
5. **NetworkOptimizer** - 네트워크 최적화 전용 페이지
6. **Cleaner** - 파일 정리 페이지
7. **GamingMode** - 게이밍 모드 페이지
8. **AudioAmplifier** - 오디오 증폭 페이지
9. **DriverUpdater** - 드라이버 업데이트 페이지
10. **SoftwareUpdater** - 소프트웨어 업데이트 페이지
11. **FileRecovery** - 파일 복구 페이지
12. **HistoryCleaner** - 기록 삭제 페이지

## 주요 특징

### 성능 최적화
- 병렬 처리 (Promise.all)
- 타임아웃 처리로 무한 대기 방지
- 배치 처리로 리소스 효율성 향상
- 캐싱을 통한 중복 연산 방지

### 에러 처리
- 중앙화된 에러 핸들링 (`src/utils/errorHandler.js`)
- IPC 에러 처리
- 파일 시스템 에러 처리
- 네트워크 에러 처리

### 인코딩 지원
- PowerShell 명령어 UTF-8 인코딩 지원
- 한글 출력 정상 처리

### 관리자 권한 처리
- 관리자 권한이 없는 경우 스킵 처리
- 에러 대신 "skipped" 메시지 반환
- 관리자 권한이 필요한 작업만 요청

## 코드 규칙

### 백엔드 (Electron Services)
- 헤더 주석 형식:
  ```
  // ---------
  // YYYY-MM-DD
  // 개발자 : KR_Tuki
  // 기능 : 설명
  // ---------
  ```
- 함수 내부 주석 제거 (헤더 주석만 유지)
- 클린 코드 원칙 준수
- PowerShell 명령어는 UTF-8 인코딩 필수

### 프론트엔드 (React)
- UI/UX는 수정하지 않음
- 미들웨어 및 훅만 클린 코드로 정리
- 헤더 주석 형식 동일하게 적용

## 주의사항

1. **관리자 권한**: 일부 최적화 기능은 관리자 권한이 필요합니다.
2. **시스템 변경**: 레지스트리 및 시스템 설정을 변경하므로 신중하게 사용하세요.
3. **백업**: 중요한 작업 전 백업을 권장합니다.
4. **호환성**: Windows 10 이상에서만 정상 작동합니다.

## 라이선스

MIT

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
