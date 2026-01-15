// ---------
// 2025-03-05
// 개발자 : KR_Tuki
// 기능 : Electron 메인 프로세스
// ---------

// @main.js (1-9)
// 날짜: 2025-03-05
// Import 모듈 설명:
// - electron (app, BrowserWindow, ipcMain, dialog): Electron 프레임워크 핵심 모듈
//   사용 예: app - 애플리케이션 생명주기 관리, BrowserWindow - 메인 윈도우 생성 및 관리, ipcMain - IPC 통신 처리, dialog - 파일/폴더 선택 다이얼로그
// - path: 파일 경로 처리. preload.js 경로, dist/index.html 경로 조작에 사용
//   사용 예: path.join(__dirname, 'preload.js') - preload 스크립트 경로 생성
// 변수 설명:
//   - isDev: 개발 모드 여부 확인. process.env.NODE_ENV === 'development' 또는 !app.isPackaged로 판단
//     개발 모드에서는 Vite 개발 서버(http://127.0.0.1:5173)에서 로드, 프로덕션 모드에서는 dist/index.html 로드
// 기능 원리:
// 1. Electron 애플리케이션의 메인 프로세스로, 브라우저 윈도우 생성 및 관리
// 2. IPC 핸들러를 통해 렌더러 프로세스와 통신 (cleaner, memory, network, audio, gaming 등)
// 3. 개발 모드에서는 Vite 개발 서버 연결, 프로덕션 모드에서는 빌드된 파일 로드
// 4. 보안 설정: nodeIntegration=false, contextIsolation=true, webSecurity=true, sandbox=true
// 5. 프로덕션 모드에서 DevTools 차단 및 보안 이벤트 처리

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  // 개발 모드인지 먼저 확인하여 URL 준비
  let startUrl = null;
  if (isDev) {
    // 명령줄 인자에서 URL 확인 (관리자 권한으로 재실행된 경우)
    const urlArg = process.argv.find(arg => arg.startsWith('--url='));
    startUrl = urlArg ? urlArg.split('=')[1] : 'http://127.0.0.1:5173';
    console.log('Development mode - will load React app from:', startUrl);
  }
  
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      devTools: isDev,
      sandbox: true,
    },
  });
  
  mainWindow.setMenuBarVisibility(false);
  
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
      if (mainWindow) {
        mainWindow.reload();
      }
    });
    
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const isDevToolsShortcut = 
        (input.type === 'keyDown') &&
        (
          (input.key === 'F12') ||
          (input.control && input.shift && (input.key === 'I' || input.key === 'J' || input.key === 'C' || input.key === 'K')) ||
          (input.control && input.shift && input.key === 'Delete') ||
          (input.control && input.key === 'U') ||
          (input.key === 'F11' && input.shift)
        );
      
      if (isDevToolsShortcut) {
        event.preventDefault();
        return false;
      }
    });
    
    mainWindow.webContents.on('context-menu', (event) => {
      event.preventDefault();
      return false;
    });
    
    mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
      event.preventDefault();
      callback('');
    });
    
    mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  }

  // Log all console messages
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[${level}] ${message}`);
  });

  if (isDev) {
    console.log('Development mode - loading React app from:', startUrl);
    
    // Set up event handlers
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      // ERR_ABORTED (-3)는 네비게이션 중단으로 정상적인 경우가 많음 (재시도 중일 때)
      if (errorCode === -3) {
        console.log('Navigation aborted (likely retry in progress):', validatedURL);
        return; // 무시하고 계속 진행
      }
      console.error('Failed to load:', errorCode, errorDescription, validatedURL);
      if (errorCode !== -3) { // -3 is ERR_ABORTED
        const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>로딩 오류</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      padding: 40px;
      text-align: center;
    }
    h1 { color: #e74c3c; }
    .error { background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; }
  </style>
</head>
<body>
  <h1>로딩 오류</h1>
  <div class="error">
    <p>Vite 개발 서버에 연결할 수 없습니다.</p>
    <p>오류 코드: ${errorCode}</p>
    <p>${errorDescription}</p>
    <p style="margin-top: 20px;"><strong>해결 방법:</strong></p>
    <p>1. 터미널에서 "npm run dev"를 실행하세요</p>
    <p>2. http://127.0.0.1:5173이 접근 가능한지 확인하세요</p>
  </div>
</body>
</html>`;
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
      }
    });
    
    mainWindow.webContents.on('dom-ready', () => {
      console.log('DOM ready');
      mainWindow.show();
    });
    
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Page finished loading');
      mainWindow.show();
    });
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
    
    // 창이 생성되자마자 즉시 URL 로드 (Electron welcome 화면 방지)
    // did-finish-load 이벤트 전에 URL을 로드하여 welcome 화면이 나타나지 않도록 함
    mainWindow.webContents.once('did-finish-load', () => {
      // 이미 로드된 경우 무시
      const currentUrl = mainWindow.webContents.getURL();
      if (currentUrl && currentUrl.includes('127.0.0.1:5173')) {
        console.log('React app already loaded');
        return;
      }
    });
    
    // 즉시 URL 로드 (관리자 권한으로 재실행된 경우에도 올바른 URL 로드)
    const loadApp = () => {
      console.log('Loading React app:', startUrl);
      mainWindow.loadURL(startUrl).catch((err) => {
        console.error('Failed to load React app:', err);
        // 실패 시 재시도
        setTimeout(() => {
          console.log('Retrying to load React app:', startUrl);
          mainWindow.loadURL(startUrl).catch((retryErr) => {
            console.error('Retry failed:', retryErr);
          });
        }, 2000);
      });
    };
    
    // 창이 준비되면 즉시 로드
    mainWindow.once('ready-to-show', () => {
      loadApp();
    });
    
    // 창 생성 직후 즉시 로드 시도 (관리자 권한으로 재실행된 경우에도 동일하게 처리)
    // 약간의 지연을 두어 창이 완전히 초기화된 후 로드
    setTimeout(loadApp, 100);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers - 앱 준비 전에 등록
const cleanerService = require('./services/cleaner');
const memoryService = require('./services/memory');
const networkService = require('./services/network');
const audioService = require('./services/audio');
const gamingService = require('./services/gaming');
const recoveryService = require('./services/recovery');
const updaterService = require('./services/updater');
const driverService = require('./services/driver');
const cpuService = require('./services/cpu');
const cpuOptimizeService = require('./services/cpuOptimize');
const historyService = require('./services/history');
const permissionsService = require('./services/permissions');
const systemStatsService = require('./services/systemStats');
const diskService = require('./services/disk');
const platformService = require('./services/platform');
const fastPingService = require('./services/fastPing');
const gpuOptimizeService = require('./services/gpuOptimize');
const computeOptimizationService = require('./services/computeOptimization');
const deltaForceCleanerService = require('./services/deltaForceCleaner');
const { getIPCAllocator } = require('./services/ipcAllocator');
const networkOptimizationService = require('./services/networkOptimization');

// IPC 가상 메모리 할당자 초기화 (메인 프로세스)
let ipcAllocator = null;

// 앱 종료 시 정리
app.on('before-quit', async () => {
  if (ipcAllocator) {
    try {
      await ipcAllocator.close();
      console.log('IPC Allocator closed');
    } catch (error) {
      console.error('Failed to close IPC Allocator:', error);
    }
  }
});

app.whenReady().then(async () => {
  try {
    ipcAllocator = getIPCAllocator('ElectronIPC', 128 * 1024 * 1024); // 128MB
    await ipcAllocator.init();
    console.log('✅ IPC Allocator initialized:', ipcAllocator.getStats());
  } catch (error) {
    console.error('❌ Failed to initialize IPC Allocator:', error);
    console.warn('⚠️  Continuing without IPC Allocator - will use standard IPC');
    // IPC 할당자 실패해도 앱은 계속 실행 (일반 IPC로 폴백)
    ipcAllocator = null;
  }
});

// Cleaner IPC
ipcMain.handle('cleaner:scan', async () => cleanerService.scan());
ipcMain.handle('cleaner:clean', async (event, options) => cleanerService.clean(options));

// Memory IPC
ipcMain.handle('memory:getStats', async () => memoryService.getStats());
ipcMain.handle('memory:optimize', async (event, options) => memoryService.optimize(options || {}));
ipcMain.handle('memory:getProcesses', async () => memoryService.getProcesses());
ipcMain.handle('memory:killProcess', async (event, pid) => memoryService.killProcess(pid));

// Audio IPC
ipcMain.handle('audio:getDevices', async () => audioService.getDevices());
ipcMain.handle('audio:setVolume', async (event, deviceId, volume) => audioService.setVolume(deviceId, volume));
ipcMain.handle('audio:boost', async (event, enabled) => audioService.boost(enabled));
ipcMain.handle('audio:getSettings', async () => audioService.getSettings());
ipcMain.handle('audio:applySoundBoost', async (event, settings) => audioService.applySoundBoost(settings));
ipcMain.handle('audio:getEQPresets', async () => audioService.getEQPresets());
ipcMain.handle('audio:detectModels', async () => audioService.detectModels());

// Gaming IPC
ipcMain.handle('gaming:enable', async () => gamingService.enable());
ipcMain.handle('gaming:disable', async () => gamingService.disable());
ipcMain.handle('gaming:getStatus', async () => gamingService.getStatus());
ipcMain.handle('gaming:enableGameMode', async (event, options) => gamingService.enableGameMode(options || {}));
ipcMain.handle('gaming:disableGameMode', async () => gamingService.disableGameMode());

// Recovery IPC
ipcMain.handle('recovery:scan', async (event, options) => recoveryService.scan(options));
ipcMain.handle('recovery:recover', async (event, filePath, destination) => recoveryService.recover(filePath, destination));

// Updater IPC
ipcMain.handle('updater:getInstalled', async () => updaterService.getInstalled());
ipcMain.handle('updater:checkUpdates', async (event, software) => updaterService.checkUpdates(software));
ipcMain.handle('updater:update', async (event, software) => updaterService.update(software));

// Driver IPC
ipcMain.handle('driver:getDrivers', async () => driverService.getDrivers());
ipcMain.handle('driver:checkUpdates', async () => driverService.checkUpdates());
ipcMain.handle('driver:update', async (event, driver) => driverService.update(driver));

// CPU IPC
ipcMain.handle('cpu:getStats', async () => cpuService.getStats());
ipcMain.handle('cpu:optimize', async () => cpuService.optimize());
ipcMain.handle('cpu:setPriority', async (event, pid, priority) => cpuService.setPriority(pid, priority));

// History IPC
ipcMain.handle('history:getTypes', async () => historyService.getTypes());
ipcMain.handle('history:clear', async (event, types) => historyService.clear(types));
ipcMain.handle('history:schedule', async (event, config) => historyService.schedule(config));

// System Stats IPC
ipcMain.handle('systemStats:getAll', async () => {
  const stats = await systemStatsService.getAllStats();
  
  // IPC 할당자를 사용하여 shared memory에 저장 (zero-copy)
  if (ipcAllocator && ipcAllocator.isInitialized) {
    try {
      const statsJson = JSON.stringify(stats);
      const statsBuffer = Buffer.from(statsJson, 'utf8');
      
      // 기존 할당이 있으면 재사용, 없으면 새로 할당
      let offset = null;
      const headerResult = await ipcAllocator.allocator.read(0, 1024);
      if (headerResult.success) {
        const header = JSON.parse(headerResult.data.toString('utf8'));
        const existingAlloc = header.allocations.find(a => a.type === 'systemStats');
        if (existingAlloc) {
          offset = existingAlloc.offset;
        }
      }
      
      if (!offset) {
        const allocResult = await ipcAllocator.malloc(statsBuffer.length, 'systemStats');
        offset = allocResult.offset;
      }
      
      await ipcAllocator.write(offset, statsBuffer);
      
      // offset을 반환하여 렌더러에서 직접 읽을 수 있도록
      return { ...stats, _sharedMemoryOffset: offset, _useSharedMemory: true };
    } catch (error) {
      console.error('Failed to store stats in shared memory:', error);
      // 실패 시 일반 IPC로 반환
    }
  }
  
  return stats;
});

// IPC Allocator IPC
ipcMain.handle('ipcAllocator:open', async () => {
  try {
    if (!ipcAllocator) {
      // IPC Allocator가 초기화되지 않았으면 null 반환 (일반 IPC로 폴백)
      return { success: false, error: 'IPC Allocator not initialized', fallback: true };
    }
    const result = await ipcAllocator.open();
    return { ...result, stats: ipcAllocator.getStats() };
  } catch (error) {
    console.error('Failed to open IPC Allocator:', error);
    return { success: false, error: error.message, fallback: true };
  }
});

ipcMain.handle('ipcAllocator:read', async (event, offset) => {
  try {
    if (!ipcAllocator || !ipcAllocator.isInitialized) {
      return { success: false, error: 'IPC Allocator not initialized' };
    }
    return await ipcAllocator.read(offset);
  } catch (error) {
    console.error('Failed to read from IPC Allocator:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ipcAllocator:malloc', async (event, size, type) => {
  try {
    if (!ipcAllocator || !ipcAllocator.isInitialized) {
      return { success: false, error: 'IPC Allocator not initialized' };
    }
    return await ipcAllocator.malloc(size, type || 'data');
  } catch (error) {
    console.error('Failed to allocate in IPC Allocator:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ipcAllocator:write', async (event, offset, data) => {
  try {
    if (!ipcAllocator || !ipcAllocator.isInitialized) {
      return { success: false, error: 'IPC Allocator not initialized' };
    }
    return await ipcAllocator.write(offset, data);
  } catch (error) {
    console.error('Failed to write to IPC Allocator:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ipcAllocator:getStats', async () => {
  try {
    if (!ipcAllocator || !ipcAllocator.isInitialized) {
      return { success: false, error: 'IPC Allocator not initialized' };
    }
    return { success: true, stats: ipcAllocator.getStats() };
  } catch (error) {
    console.error('Failed to get IPC Allocator stats:', error);
    return { success: false, error: error.message };
  }
});

// Disk IPC
ipcMain.handle('disk:optimize', async (event, options) => diskService.optimize(options || {}));

// Network IPC
ipcMain.handle('network:getStats', async () => networkService.getStats());
ipcMain.handle('network:optimize', async (event, options) => networkService.optimize(options || {}));
ipcMain.handle('network:pingTest', async (event, host) => networkService.pingTest(host));

// Network Optimization API IPC (QUIC, ENet, IOCP)
ipcMain.handle('networkOptimization:detectAPIs', async () => networkOptimizationService.detectAvailableAPIs());
ipcMain.handle('networkOptimization:enableQUIC', async (event, options) => networkOptimizationService.enableQUIC(options || {}));
ipcMain.handle('networkOptimization:optimizeENet', async (event, options) => networkOptimizationService.optimizeENet(options || {}));
ipcMain.handle('networkOptimization:optimizeIOCP', async (event, options) => networkOptimizationService.optimizeIOCP(options || {}));
ipcMain.handle('networkOptimization:optimizeAll', async (event, options) => networkOptimizationService.optimizeAll(options || {}));

// GPU Optimization IPC
ipcMain.handle('gpu:optimize', async (event, options) => gpuOptimizeService.optimize(options || {}));

// Compute Optimization IPC (OpenCL, CUDA, Intel oneAPI)
ipcMain.handle('computeOptimization:optimizeOpenCL', async (event, options) => computeOptimizationService.optimizeOpenCL(options || {}));
ipcMain.handle('computeOptimization:optimizeCUDA', async (event, options) => computeOptimizationService.optimizeCUDA(options || {}));
ipcMain.handle('computeOptimization:optimizeIntelOneAPI', async (event, options) => computeOptimizationService.optimizeIntelOneAPI(options || {}));
ipcMain.handle('computeOptimization:optimizeAll', async (event, options) => computeOptimizationService.optimizeAll(options || {}));
ipcMain.handle('computeOptimization:detectLibraries', async () => computeOptimizationService.detectLibraries());

// Fast Ping IPC
ipcMain.handle('fastPing:optimizeGameMode', async (event, options) => fastPingService.optimizeGameMode(options || {}));
ipcMain.handle('fastPing:optimizeWorkMode', async (event, options) => fastPingService.optimizeWorkMode(options || {}));
ipcMain.handle('fastPing:batchOptimize', async (event, options) => fastPingService.batchOptimize(options || {}));
ipcMain.handle('fastPing:batchAccelerate', async (event, options) => fastPingService.batchAccelerate(options || {}));
ipcMain.handle('fastPing:pingOptimize', async (event, options) => fastPingService.pingOptimize(options || {}));

// Delta Force Cleaner IPC
ipcMain.handle('deltaForceCleaner:scan', async (event, dirPath) => deltaForceCleanerService.scan(dirPath));
ipcMain.handle('deltaForceCleaner:clean', async (event, dirPath) => deltaForceCleanerService.clean(dirPath));
ipcMain.handle('deltaForceCleaner:findDirectory', async () => deltaForceCleanerService.findDirectory());
ipcMain.handle('deltaForceCleaner:getGameExplorerGames', async () => deltaForceCleanerService.getGameExplorerGames());
ipcMain.handle('deltaForceCleaner:installGameToExplorer', async (event, gamePath, gdfPath) => deltaForceCleanerService.installGameToExplorer(gamePath, gdfPath));
ipcMain.handle('deltaForceCleaner:uninstallGameFromExplorer', async (event, instanceID) => deltaForceCleanerService.uninstallGameFromExplorer(instanceID));
ipcMain.handle('deltaForceCleaner:optimizeWithWindowsAPI', async (event, options) => deltaForceCleanerService.optimizeWithWindowsAPI(options || {}));
ipcMain.handle('deltaForceCleaner:manageApplicationsAndServices', async (event, options) => deltaForceCleanerService.manageApplicationsAndServices(options || {}));

// Permissions IPC
ipcMain.handle('permissions:isAdmin', async () => platformService.isAdmin());
ipcMain.handle('platform:getOSInfo', async () => platformService.getOSInfo());
ipcMain.handle('permissions:requestAdmin', async () => {
  // 현재 관리자 권한 상태 확인
  const isAdmin = await platformService.isAdmin();
  
  if (isAdmin) {
    return {
      success: true,
      message: '관리자 권한이 활성화되어 있습니다.',
      isAdmin: true,
    };
  }
  
  // 관리자 권한이 없으면 상태만 반환 (앱 재시작 없이)
  // 실제 관리자 권한이 필요한 작업은 별도 프로세스로 실행
  return {
    success: false,
    message: '관리자 권한이 필요합니다. 관리자 권한이 필요한 작업은 별도로 실행됩니다.',
    isAdmin: false,
    requiresElevation: true,
  };
});
ipcMain.handle('permissions:confirmAction', async (event, action, details) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['취소', '확인'],
    defaultId: 1,
    title: '작업 확인',
    message: action,
    detail: details,
  });
  return { confirmed: result.response === 1 };
});

// Window controls IPC
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) mainWindow.maximize();
});

ipcMain.handle('window:toggleMaximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(async () => {
  // OS 체크 및 로깅
  const osInfo = platformService.getOSInfo();
  console.log(`OS Detected: ${osInfo.name} ${osInfo.version} (${osInfo.type})`);
  console.log(`Platform: ${osInfo.platform}, Arch: ${osInfo.arch}`);
  
  // OS별 초기화 프로세스
  if (osInfo.type === 'windows') {
    console.log('Windows-specific initialization...');
    // Windows 전용 초기화 로직
  } else if (osInfo.type === 'linux') {
    console.log('Linux-specific initialization...');
    // Linux 전용 초기화 로직
  } else if (osInfo.type === 'macos') {
    console.log('macOS-specific initialization...');
    // macOS 전용 초기화 로직
  } else {
    console.warn('Unknown OS, using default initialization...');
  }
  
  // 백그라운드에서 시스템 통계 미리 수집 (UI 블로킹 방지)
  setImmediate(() => {
    systemStatsService.getAllStats().catch(err => {
      console.error('Background stats preload error:', err);
    });
  });
  
  // 창을 먼저 생성하고 URL을 로드한 후 관리자 권한 요청
  createWindow();
  
  // 창이 완전히 로드된 후 관리자 권한 확인 및 요청
  if (mainWindow) {
    mainWindow.webContents.once('did-finish-load', async () => {
      // 약간의 지연을 두어 앱이 완전히 로드된 후 관리자 권한 요청
      setTimeout(async () => {
        const isAdmin = await platformService.isAdmin();
        if (!isAdmin) {
          // 관리자 권한이 없으면 사용자에게 물어보기
          const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['나중에', '관리자 권한 활성화'],
            defaultId: 1,
            title: '관리자 권한 요청',
            message: '관리자 권한을 활성화하시겠습니까?',
            detail: '일부 최적화 기능은 관리자 권한이 필요합니다. 관리자 권한을 활성화하면 더 많은 최적화 기능을 사용할 수 있습니다.',
          });
          
          if (result.response === 1) {
            // 사용자가 관리자 권한 활성화를 선택한 경우
            // PowerShell로 관리자 권한으로 앱 재실행
            try {
              const { exec } = require('child_process');
              const appPath = process.execPath;
              
              // 개발 모드인지 확인
              if (isDev) {
                // 개발 모드: 명령줄 인자로 URL 전달하여 재실행
                const startUrl = 'http://127.0.0.1:5173';
                // URL을 이스케이프하여 PowerShell 명령에 안전하게 전달
                const escapedUrl = startUrl.replace(/'/g, "''");
                exec(`powershell -Command "Start-Process -FilePath '${appPath}' -ArgumentList '--url=${escapedUrl}' -Verb RunAs"`, (error) => {
                  if (error) {
                    console.error('Failed to restart with admin privileges:', error);
                  } else {
                    // 현재 프로세스 종료
                    app.quit();
                    return;
                  }
                });
              } else {
                // 프로덕션 모드: 일반 재실행
                exec(`powershell -Command "Start-Process -FilePath '${appPath}' -Verb RunAs"`, (error) => {
                  if (error) {
                    console.error('Failed to restart with admin privileges:', error);
                  } else {
                    // 현재 프로세스 종료
                    app.quit();
                    return;
                  }
                });
              }
            } catch (error) {
              console.error('Error requesting admin privileges:', error);
            }
          }
        }
      }, 1000); // 앱이 완전히 로드된 후 1초 대기
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
