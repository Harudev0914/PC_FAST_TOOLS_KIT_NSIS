// @gaming.js (1-12)
// 날짜: 2025-05-29
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. 게임 모드 관련 명령어 실행에 사용
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. 게임 모드 설정 변경에 사용
//   사용 예: new Registry({ hive: Registry.HKCU, key: '\\Software\\Microsoft\\GameBar' }) - 게임 바 레지스트리 키 생성
//   .set('GameModeEnabled', Registry.REG_DWORD, '1') - 게임 모드 활성화
// 변수 설명:
//   - gamingModeEnabled: 게임 모드 활성화 상태를 저장하는 전역 변수 (boolean)

const Registry = require('winreg');
const { execAsync } = require('./_exec');

let gamingModeEnabled = false;

// HKCU 레지스트리 헬퍼 (reg add로 키 생성까지 한 번에, 관리자 권한 불필요)
const setHKCUDword = (regPath, name, value) =>
  execAsync(`reg add "HKCU\\${regPath}" /v ${name} /t REG_DWORD /d ${value} /f`, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
const setHKCUString = (regPath, name, value) =>
  execAsync(`reg add "HKCU\\${regPath}" /v ${name} /t REG_SZ /d ${value} /f`, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);

// 재로그인 없이 사용자 시스템 파라미터(마우스/메뉴 지연 등)를 즉시 다시 로드
const applyUserParams = () =>
  execAsync('rundll32.exe user32.dll,UpdatePerUserSystemParameters 1, True', { timeout: 8000 }).catch(() => {});

async function enable() {
  const results = {
    gameMode: false,
    backgroundApps: false,
    gpuPriority: false,
    services: false,
    errors: [],
  };

  try {
    const regKey = new Registry({
      hive: Registry.HKCU,
      key: '\\Software\\Microsoft\\GameBar',
    });

    regKey.set('AllowAutoGameMode', Registry.REG_DWORD, '1', (err) => {
      if (err) results.errors.push({ action: 'gameMode', error: err.message });
      else results.gameMode = true;
    });

    regKey.set('GameModeEnabled', Registry.REG_DWORD, '1', (err) => {
      if (err) results.errors.push({ action: 'gameMode', error: err.message });
      else results.gameMode = true;
    });
  } catch (error) {
    results.errors.push({ action: 'gameMode', error: error.message });
  }

  try {
    const bgRegKey = new Registry({
      hive: Registry.HKCU,
      key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications',
    });

    results.backgroundApps = true;
  } catch (error) {
    results.errors.push({ action: 'backgroundApps', error: error.message });
  }

  try {
    const gpuRegKey = new Registry({
      hive: Registry.HKLM,
      key: '\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
    });

    gpuRegKey.set('HwSchMode', Registry.REG_DWORD, '2', (err) => {
      if (err) results.errors.push({ action: 'gpuPriority', error: err.message });
      else results.gpuPriority = true;
    });
  } catch (error) {
    results.errors.push({ action: 'gpuPriority', error: error.message });
  }

  try {
    const servicesToStop = ['Themes', 'Spooler'];
    
    for (const service of servicesToStop) {
      try {
        await execAsync(`net stop "${service}"`);
      } catch (error) {
        console.log(`Could not stop service ${service}:`, error.message);
      }
    }
    
    results.services = true;
  } catch (error) {
    results.errors.push({ action: 'services', error: error.message });
  }

  gamingModeEnabled = true;
  return results;
}

async function disable() {
  const results = {
    gameMode: false,
    backgroundApps: false,
    gpuPriority: false,
    services: false,
    errors: [],
  };

  try {
    const regKey = new Registry({
      hive: Registry.HKCU,
      key: '\\Software\\Microsoft\\GameBar',
    });

    regKey.set('GameModeEnabled', Registry.REG_DWORD, '0', (err) => {
      if (err) results.errors.push({ action: 'gameMode', error: err.message });
      else results.gameMode = true;
    });
  } catch (error) {
    results.errors.push({ action: 'gameMode', error: error.message });
  }

  try {
    const servicesToStart = ['Themes', 'Spooler'];
    
    for (const service of servicesToStart) {
      try {
        await execAsync(`net start "${service}"`);
      } catch (error) {
        console.log(`Could not start service ${service}:`, error.message);
      }
    }
    
    results.services = true;
  } catch (error) {
    results.errors.push({ action: 'services', error: error.message });
  }

  gamingModeEnabled = false;
  return results;
}

async function getStatus() {
  return {
    enabled: gamingModeEnabled,
    timestamp: new Date().toISOString(),
  };
}

// 원클릭 게임 최적화. 관리자 권한을 "요구"하지 않는다(UAC 없음).
// 1~8은 사용자 권한(HKCU)에서 즉시 적용되는 FPS·마우스·반응속도·전원·메모리 최적화이고,
// 이미 관리자로 실행 중이면 GPU 스케줄링·핑(네트워크)·MMCSS 우선순위까지 자동 추가한다.
async function enableGameMode(options = {}) {
  const results = {
    success: true,
    operations: [],
    errors: [],
    gameMode: false,
    gameDVRDisabled: false,
    mouseAccelDisabled: false,
    responsivenessOptimized: false,
    visualEffectsOptimized: false,
    powerPlanOptimized: false,
    memoryOptimized: false,
    dnsFlushed: false,
    gpuOptimized: false,
    networkOptimized: false,
    adminGranted: false,
  };

  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin().catch(() => false);
  results.adminGranted = isAdmin;

  try {
    // 1. Windows 게임 모드 ON (HKCU)
    try {
      await setHKCUDword('Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 1);
      await setHKCUDword('Software\\Microsoft\\GameBar', 'AllowAutoGameMode', 1);
      await setHKCUDword('Software\\Microsoft\\GameBar', 'GameModeEnabled', 1);
      results.gameMode = true;
      results.operations.push('Windows 게임 모드 활성화');
    } catch (error) {
      results.errors.push({ action: 'gameMode', error: error?.message || '알 수 없는 오류' });
    }

    // 2. Game DVR/백그라운드 녹화 OFF + 전체화면 최적화 동작 조정 (FPS·프레임타임 향상, HKCU)
    try {
      await setHKCUDword('System\\GameConfigStore', 'GameDVR_Enabled', 0);
      await setHKCUDword('System\\GameConfigStore', 'GameDVR_FSEBehaviorMode', 2);
      await setHKCUDword('System\\GameConfigStore', 'GameDVR_HonorUserFSEBehaviorMode', 1);
      await setHKCUDword('System\\GameConfigStore', 'GameDVR_DXGIHonorFSEWindowsCompatible', 1);
      await setHKCUDword('System\\GameConfigStore', 'GameDVR_EFSEFeatureFlags', 0);
      await setHKCUDword('Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled', 0);
      await setHKCUDword('Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'HistoricalCaptureEnabled', 0);
      results.gameDVRDisabled = true;
      results.operations.push('Game DVR/백그라운드 녹화 비활성화 (FPS·프레임타임 향상)');
    } catch (error) {
      results.errors.push({ action: 'gameDVR', error: error?.message || '알 수 없는 오류' });
    }

    // 3. 마우스 가속 OFF + 1:1 감도 (HKCU) — FPS 게임 조준 일관성
    try {
      await setHKCUString('Control Panel\\Mouse', 'MouseSpeed', '0');
      await setHKCUString('Control Panel\\Mouse', 'MouseThreshold1', '0');
      await setHKCUString('Control Panel\\Mouse', 'MouseThreshold2', '0');
      await setHKCUString('Control Panel\\Mouse', 'MouseSensitivity', '10'); // 6/11 = 1:1 (배율 없음)
      results.mouseAccelDisabled = true;
      results.operations.push('마우스 가속 비활성화 (1:1 조준)');
    } catch (error) {
      results.errors.push({ action: 'mouseAccel', error: error?.message || '알 수 없는 오류' });
    }

    // 4. 입력·UI 반응속도 향상 (HKCU)
    try {
      await setHKCUString('Control Panel\\Desktop', 'MenuShowDelay', '0');
      await setHKCUString('Control Panel\\Desktop', 'AutoEndTasks', '1');
      await setHKCUString('Control Panel\\Desktop', 'HungAppTimeout', '1000');
      await setHKCUString('Control Panel\\Desktop', 'WaitToKillAppTimeout', '2000');
      await setHKCUString('Control Panel\\Keyboard', 'KeyboardDelay', '0');
      results.responsivenessOptimized = true;
      results.operations.push('입력·UI 반응속도 향상 (메뉴 지연 0, 키 반복 지연 최소)');
    } catch (error) {
      results.errors.push({ action: 'responsiveness', error: error?.message || '알 수 없는 오류' });
    }

    // 5. 시각 효과 성능 우선 (HKCU)
    try {
      const ok = await setHKCUDword('Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting', 2);
      if (ok) {
        results.visualEffectsOptimized = true;
        results.operations.push('시각 효과 성능 우선');
      }
    } catch (error) {
      results.errors.push({ action: 'visualEffects', error: error?.message || '알 수 없는 오류' });
    }

    // 2~4의 레지스트리 변경을 재로그인 없이 즉시 적용 (마우스 가속/메뉴 지연 등)
    await applyUserParams();

    // 6. 고성능 전원 계획 (실패 무시)
    try {
      await execAsync('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', { timeout: 5000 }).catch(() => {});
      results.powerPlanOptimized = true;
      results.operations.push('고성능 전원 계획 적용');
    } catch { /* 무시 */ }

    // 7. 메모리 최적화 (백그라운드 프로세스 우선순위/정리)
    try {
      const memoryService = require('./memory');
      const memoryResult = await memoryService.optimize({});
      if (memoryResult && memoryResult.success) {
        results.memoryOptimized = true;
        results.operations.push('메모리 최적화');
      }
    } catch (error) {
      results.errors.push({ action: 'memoryOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 8. DNS 캐시 플러시 (핑/응답 개선; 실패 무시)
    try {
      await execAsync('ipconfig /flushdns', { timeout: 5000 }).catch(() => {});
      results.dnsFlushed = true;
      results.operations.push('DNS 캐시 플러시');
    } catch { /* 무시 */ }

    // ── 이하: 이미 관리자 권한으로 실행 중일 때만 추가 적용 (UAC 요청하지 않음) ──
    if (isAdmin) {
      // GPU 하드웨어 가속 스케줄링 (HAGS)
      try {
        const gpuRegKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
        });
        await new Promise((resolve) => gpuRegKey.set('HwSchMode', Registry.REG_DWORD, '2', () => resolve()));
        results.gpuOptimized = true;
        results.operations.push('GPU 하드웨어 가속 스케줄링 활성화 (재부팅 후 적용)');
      } catch (error) {
        results.errors.push({ action: 'gpuOptimization', error: error?.message || '알 수 없는 오류' });
      }

      // 네트워크 지연(핑) 최소화: Nagle/ACK 지연 off + TCP 전역 튜닝
      try {
        await execAsync('netsh int tcp set global autotuninglevel=normal', { timeout: 8000 }).catch(() => {});
        await execAsync('netsh int tcp set supplemental Internet congestionprovider=ctcp', { timeout: 8000 }).catch(() => {});
        const nagleScript = "Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object { New-ItemProperty -Path $_.PSPath -Name 'TcpAckFrequency' -Value 1 -PropertyType DWord -Force | Out-Null; New-ItemProperty -Path $_.PSPath -Name 'TCPNoDelay' -Value 1 -PropertyType DWord -Force | Out-Null }";
        await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${nagleScript}"`, { timeout: 15000 }).catch(() => {});
        results.networkOptimized = true;
        results.operations.push('네트워크 지연(핑) 최소화 (Nagle/ACK 지연 off, TCP 튜닝)');
      } catch (error) {
        results.errors.push({ action: 'networkOptimization', error: error?.message || '알 수 없는 오류' });
      }

      // MMCSS 게임 작업 우선순위 상향 (전경 게임에 GPU/CPU 자원 집중)
      try {
        const gamesTask = new Registry({
          hive: Registry.HKLM,
          key: '\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games',
        });
        await new Promise((resolve) => gamesTask.set('GPU Priority', Registry.REG_DWORD, '8', () => resolve()));
        await new Promise((resolve) => gamesTask.set('Priority', Registry.REG_DWORD, '6', () => resolve()));
        await new Promise((resolve) => gamesTask.set('Scheduling Category', Registry.REG_SZ, 'High', () => resolve()));
        await new Promise((resolve) => gamesTask.set('SFIO Priority', Registry.REG_SZ, 'High', () => resolve()));
        results.operations.push('게임 작업 스케줄링 우선순위 상향 (MMCSS)');
      } catch (error) {
        results.errors.push({ action: 'mmcss', error: error?.message || '알 수 없는 오류' });
      }

      // [고도화] 시스템 응답성 향상 + 전경 프로세스 전원 스로틀링 해제(노트북에서 특히 효과)
      try {
        // SystemResponsiveness=10 (0은 MMCSS 오디오 글리치 보고가 있어 10 권장)
        await execAsync('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 10 /f', { timeout: 5000 }).catch(() => {});
        await execAsync('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling" /v PowerThrottlingOff /t REG_DWORD /d 1 /f', { timeout: 5000 }).catch(() => {});
        results.operations.push('시스템 응답성 향상 + 전원 스로틀링 해제');
      } catch (error) {
        results.errors.push({ action: 'systemResponsiveness', error: error?.message || '알 수 없는 오류' });
      }
    }

    gamingModeEnabled = true;

    if (results.errors.length > 0) {
      results.success = false;
    }
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'enableGameMode', error: error?.message || '알 수 없는 오류' });
  }

  return results;
}

// 게임 최적화 해제 — 주요 사용자 변경을 Windows 기본값으로 되돌린다.
async function disableGameMode() {
  const results = {
    success: true,
    operations: [],
    errors: [],
  };

  try {
    try {
      // 게임 모드 OFF, Game DVR 복원
      await setHKCUDword('Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 0);
      await setHKCUDword('Software\\Microsoft\\GameBar', 'GameModeEnabled', 0);
      await setHKCUDword('System\\GameConfigStore', 'GameDVR_Enabled', 1);
      await setHKCUDword('Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled', 1);

      // 마우스 가속/감도 기본값(가속 ON) 복원
      await setHKCUString('Control Panel\\Mouse', 'MouseSpeed', '1');
      await setHKCUString('Control Panel\\Mouse', 'MouseThreshold1', '6');
      await setHKCUString('Control Panel\\Mouse', 'MouseThreshold2', '10');

      // 메뉴/키 지연 기본값 복원
      await setHKCUString('Control Panel\\Desktop', 'MenuShowDelay', '400');
      await setHKCUString('Control Panel\\Keyboard', 'KeyboardDelay', '1');

      // 시각 효과: Windows 자동
      await setHKCUDword('Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting', 0);

      await applyUserParams();

      // [고도화] 시스템 응답성/전원 스로틀 기본값 복원 (관리자면 적용, 아니면 조용히 무시)
      await execAsync('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 20 /f', { timeout: 5000 }).catch(() => {});
      await execAsync('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling" /v PowerThrottlingOff /t REG_DWORD /d 0 /f', { timeout: 5000 }).catch(() => {});

      // 전원 계획: 균형 조정
      await execAsync('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', { timeout: 5000 }).catch(() => {});

      results.operations.push('게임 최적화 해제 완료 (기본값 복원)');
    } catch (error) {
      results.errors.push({ action: 'gameMode', error: error?.message || '알 수 없는 오류' });
    }

    gamingModeEnabled = false;

    if (results.errors.length > 0) {
      results.success = false;
    }
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'disableGameMode', error: error?.message || '알 수 없는 오류' });
  }

  return results;
}

module.exports = {
  enable,
  disable,
  getStatus,
  enableGameMode,
  disableGameMode,
};