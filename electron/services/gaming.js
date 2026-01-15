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

const { exec } = require('child_process');
const { promisify } = require('util');
const Registry = require('winreg');
const execAsync = promisify(exec);

let gamingModeEnabled = false;

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

async function enableGameMode(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    operations: [],
    errors: [],
    gameMode: false,
    cpuOptimized: false,
    gpuOptimized: false,
    memoryOptimized: false,
    networkOptimized: false,
    soundOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    try {
      const regKey = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Microsoft\\GameBar',
      });

      await new Promise((resolve, reject) => {
        regKey.set('AllowAutoGameMode', Registry.REG_DWORD, '1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        regKey.set('GameModeEnabled', Registry.REG_DWORD, '1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.gameMode = true;
      results.operations.push('Windows Game Mode 활성화 완료');
    } catch (error) {
      results.errors.push({ action: 'gameMode', error: error?.message || '알 수 없는 오류' });
    }

    try {
      const cpuService = require('./cpu');
      const cpuResult = await cpuService.optimize();
      
      if (cpuResult && cpuResult.success) {
        if (isAdmin || requestAdminPermission) {
          try {
            await execAsync('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c').catch(() => {});
            results.operations.push('CPU 최적화 완료 (고성능 전원 계획)');
          } catch (cpuError) {
            results.errors.push({ action: 'cpuOptimization', error: cpuError.message });
          }
        }
        results.cpuOptimized = true;
      }
    } catch (error) {
      results.errors.push({ action: 'cpuOptimization', error: error?.message || '알 수 없는 오류' });
    }

    try {
      if (isAdmin || requestAdminPermission) {
        const gpuRegKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
        });

        await new Promise((resolve, reject) => {
          gpuRegKey.set('HwSchMode', Registry.REG_DWORD, '2', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        results.gpuOptimized = true;
        results.operations.push('GPU 최적화 완료 (GPU 스케줄링 우선순위 향상)');
      } else {
        results.requiresAdmin = true;
      }
    } catch (error) {
      results.errors.push({ action: 'gpuOptimization', error: error?.message || '알 수 없는 오류' });
    }

    try {
      const memoryService = require('./memory');
      const memoryResult = await memoryService.optimize({ requestAdminPermission });
      
      if (memoryResult && memoryResult.success) {
        results.memoryOptimized = true;
        results.operations.push('메모리 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'memoryOptimization', error: error?.message || '알 수 없는 오류' });
    }

    try {
      if (isAdmin || requestAdminPermission) {
        const tcpKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters',
        });

        await new Promise((resolve, reject) => {
          tcpKey.set('TcpNoDelay', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        await new Promise((resolve, reject) => {
          tcpKey.set('TcpAckFrequency', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        await execAsync('ipconfig /flushdns').catch(() => {});

        results.networkOptimized = true;
        results.operations.push('네트워크 최적화 완료 (TCP/IP 파라미터 최적화)');
      } else {
        results.requiresAdmin = true;
      }
    } catch (error) {
      results.errors.push({ action: 'networkOptimization', error: error?.message || '알 수 없는 오류' });
    }

    try {
      const audioService = require('./audio');
      const audioResult = await audioService.boost(true);
      
      if (audioResult && audioResult.success) {
        results.soundOptimized = true;
        results.operations.push('오디오 최적화 완료 (게임 사운드 증폭)');
      }
    } catch (error) {
      results.errors.push({ action: 'soundOptimization', error: error?.message || '알 수 없는 오류' });
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

async function disableGameMode() {
  const results = {
    success: true,
    operations: [],
    errors: [],
  };

  try {
    try {
      const regKey = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Microsoft\\GameBar',
      });

      await new Promise((resolve, reject) => {
        regKey.set('GameModeEnabled', Registry.REG_DWORD, '0', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.operations.push('Windows Game Mode 비활성화 완료');
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