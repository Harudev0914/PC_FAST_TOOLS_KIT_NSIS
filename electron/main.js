// ---------
// 2025-03-05
// 개발자 : KR_Tuki
// 기능 : Electron 메인 프로세스
// ---------

// @main.js (1-30)
// 날짜: 2025-03-05
// Import 모듈 설명:
// - electron (app, BrowserWindow, ipcMain, dialog): Electron 프레임워크 핵심 모듈
//   사용 예: app - 애플리케이션 생명주기 관리, BrowserWindow - 메인 윈도우 생성 및 관리, ipcMain - IPC 통신 처리, dialog - 파일/폴더 선택 다이얼로그
// - path: 파일 경로 처리. preload.js 경로, dist/index.html 경로 조작에 사용
//   사용 예: path.join(__dirname, 'preload.js') - preload 스크립트 경로 생성
// 변수 설명:
//   - isDev: 개발 모드 여부 확인. process.env.NODE_ENV === 'development' 또는 !app.isPackaged로 판단
//     개발 모드에서는 Vite 개발 서버(http://127.0.0.1:5173)에서 로드, 프로덕션 모드에서는 dist/index.html 로드
//   - mainWindow: 메인 브라우저 윈도우 인스턴스. 앱의 UI 창을 나타냄
//   - ipcAllocator: IPC 가상 메모리 할당자. 대용량 데이터 전송 시 zero-copy 공유 메모리 사용
// 기능 원리:
// 1. Electron 애플리케이션의 메인 프로세스로, 브라우저 윈도우 생성 및 관리
// 2. IPC 핸들러를 통해 렌더러 프로세스와 통신 (cleaner, memory, network, audio, gaming 등)
// 3. 개발 모드에서는 Vite 개발 서버 연결, 프로덕션 모드에서는 빌드된 파일 로드
// 4. 보안 설정:
//    - nodeIntegration=false: 렌더러 프로세스에서 Node.js API 직접 접근 차단
//    - contextIsolation=true: 메인과 렌더러 프로세스 간 격리, 보안 강화
//    - webSecurity=true: 웹 보안 기능 활성화 (CORS, CSP 등)
//    - sandbox=true: 렌더러 프로세스 샌드박스 모드, 권한 최소화
//    - enableRemoteModule=false: 원격 모듈 비활성화 (보안 취약점 방지)
// 5. 프로덕션 모드에서 DevTools 차단:
//    - before-input-event로 F12, Ctrl+Shift+I 등 단축키 차단
//    - devtools-opened 이벤트로 DevTools 열림 감지 및 자동 닫기
//    - context-menu 이벤트로 우클릭 메뉴 차단
//    - windowOpenHandler로 새 창 열기 차단
// 6. 버전 체크 시스템: 앱 시작 시 버전 정보 확인 및 추적 (무단 사용 방지)
// 7. 에러 핸들링: 모든 IPC 핸들러에 try-catch 적용하여 안정성 확보

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
    
    // 개발 모드에서도 DevTools 자동 열기 비활성화
    // 필요시 수동으로 F12 또는 Ctrl+Shift+I로 열 수 있음
    // if (isDev) {
    //   mainWindow.webContents.openDevTools();
    // }
    
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
const versionService = require('./services/version');

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

// Version IPC
ipcMain.handle('version:getCurrentVersion', async () => {
  try {
    return { success: true, version: versionService.getCurrentVersion() };
  } catch (error) {
    console.error('Error getting current version:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('version:checkVersion', async (event, options) => {
  try {
    return await versionService.checkVersion(options || {});
  } catch (error) {
    console.error('Error checking version:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('version:getTrackingInfo', async () => {
  try {
    return { success: true, trackingInfo: versionService.getTrackingInfo() };
  } catch (error) {
    console.error('Error getting tracking info:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('version:validateLicense', async () => {
  try {
    return { success: true, license: versionService.validateLicense() };
  } catch (error) {
    console.error('Error validating license:', error);
    return { success: false, error: error.message };
  }
});

// Cleaner IPC
ipcMain.handle('cleaner:scan', async () => {
  try {
    return await cleanerService.scan();
  } catch (error) {
    console.error('Error in cleaner:scan:', error);
    return { success: false, error: error.message, files: [], totalSize: 0, errors: [] };
  }
});

ipcMain.handle('cleaner:clean', async (event, options) => {
  try {
    return await cleanerService.clean(options || {});
  } catch (error) {
    console.error('Error in cleaner:clean:', error);
    return { success: false, error: error.message, cleaned: 0, freed: 0, errors: [] };
  }
});

// Memory IPC
ipcMain.handle('memory:getStats', async () => {
  try {
    return await memoryService.getStats();
  } catch (error) {
    console.error('Error in memory:getStats:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('memory:optimize', async (event, options) => {
  try {
    return await memoryService.optimize(options || {});
  } catch (error) {
    console.error('Error in memory:optimize:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('memory:getProcesses', async () => {
  try {
    return await memoryService.getProcesses();
  } catch (error) {
    console.error('Error in memory:getProcesses:', error);
    return { success: false, error: error.message, processes: [] };
  }
});

ipcMain.handle('memory:killProcess', async (event, pid) => {
  try {
    if (!pid || typeof pid !== 'number') {
      return { success: false, error: 'Invalid process ID' };
    }
    return await memoryService.killProcess(pid);
  } catch (error) {
    console.error('Error in memory:killProcess:', error);
    return { success: false, error: error.message };
  }
});

// Audio IPC
ipcMain.handle('audio:getDevices', async () => {
  try {
    return await audioService.getDevices();
  } catch (error) {
    console.error('Error in audio:getDevices:', error);
    return { success: false, error: error.message, devices: [] };
  }
});

ipcMain.handle('audio:setVolume', async (event, deviceId, volume) => {
  try {
    if (!deviceId || typeof volume !== 'number' || volume < 0 || volume > 100) {
      return { success: false, error: 'Invalid parameters' };
    }
    return await audioService.setVolume(deviceId, volume);
  } catch (error) {
    console.error('Error in audio:setVolume:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio:boost', async (event, enabled) => {
  try {
    return await audioService.boost(enabled === true);
  } catch (error) {
    console.error('Error in audio:boost:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio:getSettings', async () => {
  try {
    return await audioService.getSettings();
  } catch (error) {
    console.error('Error in audio:getSettings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio:applySoundBoost', async (event, settings) => {
  try {
    if (!settings || typeof settings !== 'object') {
      return { success: false, error: 'Invalid settings object' };
    }
    return await audioService.applySoundBoost(settings);
  } catch (error) {
    console.error('Error in audio:applySoundBoost:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio:getEQPresets', async () => {
  try {
    return await audioService.getEQPresets();
  } catch (error) {
    console.error('Error in audio:getEQPresets:', error);
    return { success: false, error: error.message, presets: [] };
  }
});

ipcMain.handle('audio:detectModels', async () => {
  try {
    return await audioService.detectModels();
  } catch (error) {
    console.error('Error in audio:detectModels:', error);
    return { success: false, error: error.message, models: [] };
  }
});

// Gaming IPC
ipcMain.handle('gaming:enable', async () => {
  try {
    return await gamingService.enable();
  } catch (error) {
    console.error('Error in gaming:enable:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('gaming:disable', async () => {
  try {
    return await gamingService.disable();
  } catch (error) {
    console.error('Error in gaming:disable:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('gaming:getStatus', async () => {
  try {
    return await gamingService.getStatus();
  } catch (error) {
    console.error('Error in gaming:getStatus:', error);
    return { success: false, error: error.message, enabled: false };
  }
});

ipcMain.handle('gaming:enableGameMode', async (event, options) => {
  try {
    return await gamingService.enableGameMode(options || {});
  } catch (error) {
    console.error('Error in gaming:enableGameMode:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('gaming:disableGameMode', async () => {
  try {
    return await gamingService.disableGameMode();
  } catch (error) {
    console.error('Error in gaming:disableGameMode:', error);
    return { success: false, error: error.message };
  }
});

// Recovery IPC
ipcMain.handle('recovery:scan', async (event, options) => {
  try {
    return await recoveryService.scan(options || {});
  } catch (error) {
    console.error('Error in recovery:scan:', error);
    return { success: false, error: error.message, files: [] };
  }
});

ipcMain.handle('recovery:recover', async (event, filePath, destination) => {
  try {
    if (!filePath || !destination) {
      return { success: false, error: 'Invalid file path or destination' };
    }
    return await recoveryService.recover(filePath, destination);
  } catch (error) {
    console.error('Error in recovery:recover:', error);
    return { success: false, error: error.message };
  }
});

// Updater IPC
ipcMain.handle('updater:getInstalled', async () => {
  try {
    return await updaterService.getInstalled();
  } catch (error) {
    console.error('Error in updater:getInstalled:', error);
    return { success: false, error: error.message, software: [] };
  }
});

ipcMain.handle('updater:checkUpdates', async (event, software) => {
  try {
    if (!software || typeof software !== 'object') {
      return { success: false, error: 'Invalid software object' };
    }
    return await updaterService.checkUpdates(software);
  } catch (error) {
    console.error('Error in updater:checkUpdates:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('updater:update', async (event, software) => {
  try {
    if (!software || typeof software !== 'object') {
      return { success: false, error: 'Invalid software object' };
    }
    return await updaterService.update(software);
  } catch (error) {
    console.error('Error in updater:update:', error);
    return { success: false, error: error.message };
  }
});

// Driver IPC
ipcMain.handle('driver:getDrivers', async () => {
  try {
    return await driverService.getDrivers();
  } catch (error) {
    console.error('Error in driver:getDrivers:', error);
    return { success: false, error: error.message, drivers: [] };
  }
});

ipcMain.handle('driver:checkUpdates', async () => {
  try {
    return await driverService.checkUpdates();
  } catch (error) {
    console.error('Error in driver:checkUpdates:', error);
    return { success: false, error: error.message, updates: [] };
  }
});

ipcMain.handle('driver:update', async (event, driver) => {
  try {
    if (!driver || typeof driver !== 'object') {
      return { success: false, error: 'Invalid driver object' };
    }
    return await driverService.update(driver);
  } catch (error) {
    console.error('Error in driver:update:', error);
    return { success: false, error: error.message };
  }
});

// CPU IPC
ipcMain.handle('cpu:getStats', async () => {
  try {
    return await cpuService.getStats();
  } catch (error) {
    console.error('Error in cpu:getStats:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cpu:optimize', async () => {
  try {
    return await cpuService.optimize();
  } catch (error) {
    console.error('Error in cpu:optimize:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cpu:optimizeSafe', async () => {
  try {
    return await cpuOptimizeService.optimizeSafe();
  } catch (error) {
    console.error('Error in cpu:optimizeSafe:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cpu:setPriority', async (event, pid, priority) => {
  try {
    if (!pid || typeof pid !== 'number' || !priority || typeof priority !== 'string') {
      return { success: false, error: 'Invalid process ID or priority' };
    }
    return await cpuService.setPriority(pid, priority);
  } catch (error) {
    console.error('Error in cpu:setPriority:', error);
    return { success: false, error: error.message };
  }
});

// History IPC
ipcMain.handle('history:getTypes', async () => {
  try {
    return await historyService.getTypes();
  } catch (error) {
    console.error('Error in history:getTypes:', error);
    return { success: false, error: error.message, types: [] };
  }
});

ipcMain.handle('history:clear', async (event, types) => {
  try {
    if (!Array.isArray(types)) {
      return { success: false, error: 'Invalid types array' };
    }
    return await historyService.clear(types);
  } catch (error) {
    console.error('Error in history:clear:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('history:schedule', async (event, config) => {
  try {
    if (!config || typeof config !== 'object') {
      return { success: false, error: 'Invalid config object' };
    }
    return await historyService.schedule(config);
  } catch (error) {
    console.error('Error in history:schedule:', error);
    return { success: false, error: error.message };
  }
});

// System Stats IPC
ipcMain.handle('systemStats:getAll', async () => {
  try {
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
  } catch (error) {
    console.error('Error in systemStats:getAll:', error);
    return { success: false, error: error.message };
  }
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
ipcMain.handle('disk:optimize', async (event, options) => {
  try {
    return await diskService.optimize(options || {});
  } catch (error) {
    console.error('Error in disk:optimize:', error);
    return { success: false, error: error.message };
  }
});

// Network IPC
ipcMain.handle('network:getStats', async () => {
  try {
    return await networkService.getStats();
  } catch (error) {
    console.error('Error in network:getStats:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('network:optimize', async (event, options) => {
  try {
    return await networkService.optimize(options || {});
  } catch (error) {
    console.error('Error in network:optimize:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('network:pingTest', async (event, host) => {
  try {
    if (!host || typeof host !== 'string') {
      return { success: false, error: 'Invalid host' };
    }
    return await networkService.pingTest(host);
  } catch (error) {
    console.error('Error in network:pingTest:', error);
    return { success: false, error: error.message };
  }
});

// Network Optimization API IPC (QUIC, ENet, IOCP)
ipcMain.handle('networkOptimization:detectAPIs', async () => {
  try {
    return await networkOptimizationService.detectAvailableAPIs();
  } catch (error) {
    console.error('Error in networkOptimization:detectAPIs:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('networkOptimization:enableQUIC', async (event, options) => {
  try {
    return await networkOptimizationService.enableQUIC(options || {});
  } catch (error) {
    console.error('Error in networkOptimization:enableQUIC:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('networkOptimization:optimizeENet', async (event, options) => {
  try {
    return await networkOptimizationService.optimizeENet(options || {});
  } catch (error) {
    console.error('Error in networkOptimization:optimizeENet:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('networkOptimization:optimizeIOCP', async (event, options) => {
  try {
    return await networkOptimizationService.optimizeIOCP(options || {});
  } catch (error) {
    console.error('Error in networkOptimization:optimizeIOCP:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('networkOptimization:optimizeAll', async (event, options) => {
  try {
    return await networkOptimizationService.optimizeAll(options || {});
  } catch (error) {
    console.error('Error in networkOptimization:optimizeAll:', error);
    return { success: false, error: error.message };
  }
});

// GPU Optimization IPC
ipcMain.handle('gpu:optimize', async (event, options) => {
  try {
    return await gpuOptimizeService.optimize(options || {});
  } catch (error) {
    console.error('Error in gpu:optimize:', error);
    return { success: false, error: error.message };
  }
});

// Compute Optimization IPC (OpenCL, CUDA, Intel oneAPI)
ipcMain.handle('computeOptimization:optimizeOpenCL', async (event, options) => {
  try {
    return await computeOptimizationService.optimizeOpenCL(options || {});
  } catch (error) {
    console.error('Error in computeOptimization:optimizeOpenCL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('computeOptimization:optimizeCUDA', async (event, options) => {
  try {
    return await computeOptimizationService.optimizeCUDA(options || {});
  } catch (error) {
    console.error('Error in computeOptimization:optimizeCUDA:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('computeOptimization:optimizeIntelOneAPI', async (event, options) => {
  try {
    return await computeOptimizationService.optimizeIntelOneAPI(options || {});
  } catch (error) {
    console.error('Error in computeOptimization:optimizeIntelOneAPI:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('computeOptimization:optimizeAll', async (event, options) => {
  try {
    return await computeOptimizationService.optimizeAll(options || {});
  } catch (error) {
    console.error('Error in computeOptimization:optimizeAll:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('computeOptimization:detectLibraries', async () => {
  try {
    return await computeOptimizationService.detectLibraries();
  } catch (error) {
    console.error('Error in computeOptimization:detectLibraries:', error);
    return { success: false, error: error.message, libraries: {} };
  }
});

// Fast Ping IPC
ipcMain.handle('fastPing:optimizeGameMode', async (event, options) => {
  try {
    return await fastPingService.optimizeGameMode(options || {});
  } catch (error) {
    console.error('Error in fastPing:optimizeGameMode:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fastPing:optimizeWorkMode', async (event, options) => {
  try {
    return await fastPingService.optimizeWorkMode(options || {});
  } catch (error) {
    console.error('Error in fastPing:optimizeWorkMode:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fastPing:batchOptimize', async (event, options) => {
  try {
    return await fastPingService.batchOptimize(options || {});
  } catch (error) {
    console.error('Error in fastPing:batchOptimize:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fastPing:batchAccelerate', async (event, options) => {
  try {
    return await fastPingService.batchAccelerate(options || {});
  } catch (error) {
    console.error('Error in fastPing:batchAccelerate:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fastPing:pingOptimize', async (event, options) => {
  try {
    return await fastPingService.pingOptimize(options || {});
  } catch (error) {
    console.error('Error in fastPing:pingOptimize:', error);
    return { success: false, error: error.message };
  }
});

// Delta Force Cleaner IPC
ipcMain.handle('deltaForceCleaner:scan', async (event, dirPath) => {
  try {
    if (!dirPath || typeof dirPath !== 'string') {
      return { success: false, error: 'Invalid directory path' };
    }
    return await deltaForceCleanerService.scan(dirPath);
  } catch (error) {
    console.error('Error in deltaForceCleaner:scan:', error);
    return { success: false, error: error.message, files: [] };
  }
});

ipcMain.handle('deltaForceCleaner:clean', async (event, dirPath) => {
  try {
    if (!dirPath || typeof dirPath !== 'string') {
      return { success: false, error: 'Invalid directory path' };
    }
    return await deltaForceCleanerService.clean(dirPath);
  } catch (error) {
    console.error('Error in deltaForceCleaner:clean:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deltaForceCleaner:findDirectory', async () => {
  try {
    return await deltaForceCleanerService.findDirectory();
  } catch (error) {
    console.error('Error in deltaForceCleaner:findDirectory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deltaForceCleaner:getGameExplorerGames', async () => {
  try {
    return await deltaForceCleanerService.getGameExplorerGames();
  } catch (error) {
    console.error('Error in deltaForceCleaner:getGameExplorerGames:', error);
    return { success: false, error: error.message, games: [] };
  }
});

ipcMain.handle('deltaForceCleaner:installGameToExplorer', async (event, gamePath, gdfPath) => {
  try {
    if (!gamePath || !gdfPath) {
      return { success: false, error: 'Invalid game path or GDF path' };
    }
    return await deltaForceCleanerService.installGameToExplorer(gamePath, gdfPath);
  } catch (error) {
    console.error('Error in deltaForceCleaner:installGameToExplorer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deltaForceCleaner:uninstallGameFromExplorer', async (event, instanceID) => {
  try {
    if (!instanceID || typeof instanceID !== 'string') {
      return { success: false, error: 'Invalid instance ID' };
    }
    return await deltaForceCleanerService.uninstallGameFromExplorer(instanceID);
  } catch (error) {
    console.error('Error in deltaForceCleaner:uninstallGameFromExplorer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deltaForceCleaner:optimizeWithWindowsAPI', async (event, options) => {
  try {
    return await deltaForceCleanerService.optimizeWithWindowsAPI(options || {});
  } catch (error) {
    console.error('Error in deltaForceCleaner:optimizeWithWindowsAPI:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deltaForceCleaner:manageApplicationsAndServices', async (event, options) => {
  try {
    return await deltaForceCleanerService.manageApplicationsAndServices(options || {});
  } catch (error) {
    console.error('Error in deltaForceCleaner:manageApplicationsAndServices:', error);
    return { success: false, error: error.message };
  }
});

// Permissions IPC
ipcMain.handle('permissions:isAdmin', async () => {
  try {
    return { success: true, isAdmin: await platformService.isAdmin() };
  } catch (error) {
    console.error('Error in permissions:isAdmin:', error);
    return { success: false, error: error.message, isAdmin: false };
  }
});

ipcMain.handle('platform:getOSInfo', async () => {
  try {
    return { success: true, osInfo: platformService.getOSInfo() };
  } catch (error) {
    console.error('Error in platform:getOSInfo:', error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle('permissions:requestAdmin', async () => {
  try {
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
  } catch (error) {
    console.error('Error in permissions:requestAdmin:', error);
    return { success: false, error: error.message, isAdmin: false };
  }
});

ipcMain.handle('permissions:confirmAction', async (event, action, details) => {
  try {
    if (!mainWindow) {
      return { confirmed: false, error: 'Main window not available' };
    }
    if (!action || typeof action !== 'string') {
      return { confirmed: false, error: 'Invalid action' };
    }
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['취소', '확인'],
      defaultId: 1,
      title: '작업 확인',
      message: action,
      detail: details || '',
    });
    return { confirmed: result.response === 1 };
  } catch (error) {
    console.error('Error in permissions:confirmAction:', error);
    return { confirmed: false, error: error.message };
  }
});

// Window controls IPC
ipcMain.handle('window:minimize', () => {
  try {
    if (mainWindow) mainWindow.minimize();
  } catch (error) {
    console.error('Error in window:minimize:', error);
  }
});

ipcMain.handle('window:maximize', () => {
  try {
    if (mainWindow) mainWindow.maximize();
  } catch (error) {
    console.error('Error in window:maximize:', error);
  }
});

ipcMain.handle('window:toggleMaximize', () => {
  try {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  } catch (error) {
    console.error('Error in window:toggleMaximize:', error);
  }
});

ipcMain.handle('window:close', () => {
  try {
    if (mainWindow) mainWindow.close();
  } catch (error) {
    console.error('Error in window:close:', error);
  }
});

app.whenReady().then(async () => {
  // 버전 체크 및 추적 정보 로깅 (무단 사용 방지)
  try {
    const currentVersion = versionService.getCurrentVersion();
    const trackingInfo = versionService.getTrackingInfo();
    console.log(`App Version: ${currentVersion.version} (Build: ${currentVersion.build})`);
    console.log(`System ID: ${trackingInfo.systemId} | Platform: ${trackingInfo.platform} | Hostname: ${trackingInfo.hostname}`);
  } catch (error) {
    console.error('Error checking version:', error);
  }

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
