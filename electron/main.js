const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');

// [실제 구현] 리다이렉트를 따라가며 파일 다운로드 (Equalizer APO 설치 프로그램 등)
function downloadTo(url, dest, redirectsLeft = 6) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft < 0) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('http:') ? require('http') : https;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        try { return resolve(downloadTo(new URL(res.headers.location, url).toString(), dest, redirectsLeft - 1)); }
        catch (e) { return reject(e); }
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const fsm = require('fs');
      const out = fsm.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(dest)));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('Download timeout')));
  });
}
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

// [고도화] 전역 안전망: 다수의 async IPC 핸들러/파이어앤포겟 호출에서 발생할 수 있는
// 미처리 예외·Promise rejection이 앱을 조용히 죽이지 않도록 로깅하고 살아남게 한다.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

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
    
    // 개발 모드에서 DevTools 자동 열기 (디버깅용)
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
const networkOptimizationService = require('./services/networkOptimization');
const versionService = require('./services/version');

// [정리] PowerShell 기반 공유 메모리 IPC 할당자(ipcAllocator/sharedMemory)는 제거됨.
// read/write/malloc 마다 Add-Type(csc.exe) C# 컴파일을 하는 PowerShell 프로세스를
// 새로 띄워 2초 폴링마다 프로세스가 쌓여 CPU 100%/멈춤을 유발했고, MapViewOfFile
// 주소가 단명 프로세스에서만 유효해 실제 공유도 되지 않았다. Electron 표준 IPC를 사용한다.

// [클린코드] IPC 핸들러 공용 래퍼. 78개 핸들러에 복붙돼 있던 동일한
// try/catch → console.error → { success:false, error } 패턴을 한 곳으로 모은다.
// errorExtra: 에러 시 반환 객체에 병합할 추가 필드(예: { files: [] })로 기존 폴백 형태를 보존한다.
function handle(channel, fn, errorExtra = { success: false }) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...args);
    } catch (error) {
      console.error(`Error in ${channel}:`, error);
      return { ...errorExtra, error: error.message };
    }
  });
}

// Version IPC
handle('version:getCurrentVersion', async () => {
  return { success: true, version: versionService.getCurrentVersion() };
});

handle('version:checkVersion', async (event, options) => {
  return await versionService.checkVersion(options || {});
});

handle('version:getTrackingInfo', async () => {
  return { success: true, trackingInfo: versionService.getTrackingInfo() };
});

handle('version:validateLicense', async () => {
  return { success: true, license: versionService.validateLicense() };
});

// Cleaner IPC
handle('cleaner:scan', async () => {
  return await cleanerService.scan();
}, { success: false, files: [], totalSize: 0, errors: [] });

handle('cleaner:clean', async (event, options) => {
  return await cleanerService.clean(options || {});
}, { success: false, cleaned: 0, freed: 0, errors: [] });

// Memory IPC
handle('memory:getStats', async () => {
  return await memoryService.getStats();
});

handle('memory:optimize', async (event, options) => {
  return await memoryService.optimize(options || {});
});

handle('memory:getProcesses', async () => {
  return await memoryService.getProcesses();
}, { success: false, processes: [] });

handle('memory:killProcess', async (event, pid) => {
  if (!pid || typeof pid !== 'number') {
    return { success: false, error: 'Invalid process ID' };
  }
  return await memoryService.killProcess(pid);
});

// Audio IPC
handle('audio:getDevices', async () => {
  return await audioService.getDevices();
}, { success: false, devices: [] });

handle('audio:setVolume', async (event, deviceId, volume) => {
  if (!deviceId || typeof volume !== 'number' || volume < 0 || volume > 100) {
    return { success: false, error: 'Invalid parameters' };
  }
  return await audioService.setVolume(deviceId, volume);
});

handle('audio:boost', async (event, enabled) => {
  return await audioService.boost(enabled === true);
});

handle('audio:getSettings', async () => {
  return await audioService.getSettings();
});

handle('audio:applySoundBoost', async (event, settings) => {
  if (!settings || typeof settings !== 'object') {
    return { success: false, error: 'Invalid settings object' };
  }
  return await audioService.applySoundBoost(settings);
});

handle('audio:getEQPresets', async () => {
  return await audioService.getEQPresets();
}, { success: false, presets: [] });

handle('audio:detectModels', async () => {
  return await audioService.detectModels();
}, { success: false, models: [] });

// 실제 EQ/베이스를 시스템 전역에 적용하는 Equalizer APO 설치 여부 확인
handle('audio:isEqualizerApoInstalled', async () => {
  return { installed: await audioService.detectEqualizerAPO() };
}, { installed: false });

// Equalizer APO 공식 다운로드 페이지를 기본 브라우저로 연다 (URL은 고정 — 렌더러 입력 아님)
handle('audio:openEqualizerApoDownload', async () => {
  await shell.openExternal('https://sourceforge.net/projects/equalizerapo/');
  return { success: true };
});

// [실제 동작] 공식 Equalizer APO 설치 프로그램을 직접 다운로드해 실행한다. 사용자는 표준 설치
// UI(장치 선택)와 재부팅만 진행하면 이후 EQ/베이스가 시스템 전역에 실제 적용된다. URL은 고정.
ipcMain.handle('audio:installEqualizerApo', async () => {
  const os = require('os');
  const fsm = require('fs');
  const dest = path.join(os.tmpdir(), 'EqualizerAPO-setup.exe');
  const readSig = () => {
    const fd = fsm.openSync(dest, 'r');
    const s = Buffer.alloc(2);
    fsm.readSync(fd, s, 0, 2, 0);
    fsm.closeSync(fd);
    return s.toString('latin1');
  };
  try {
    // 1) SourceForge 최신 다운로드 (실행파일 또는 인터스티셜 HTML)
    await downloadTo('https://sourceforge.net/projects/equalizerapo/files/latest/download', dest);
    // 2) HTML 인터스티셜이면 meta-refresh의 실제 미러 URL(시간제한 토큰 포함)을 파싱해 재다운로드
    if (readSig() !== 'MZ') {
      const html = fsm.readFileSync(dest, 'utf8');
      const m = html.match(/content="[0-9]+;\s*url=(https?:\/\/[^"]+\.exe[^"]*)"/i);
      if (m) {
        const mirror = m[1].replace(/&amp;/g, '&');
        await downloadTo(mirror, dest);
      }
    }
    if (readSig() !== 'MZ') throw new Error('설치 파일 다운로드 실패(형식 불일치)');
    const err = await shell.openPath(dest); // 설치 프로그램 실행(UAC) — 사용자가 진행
    if (err) throw new Error(err);
    return { success: true, launched: true };
  } catch (error) {
    // 실패 시 공식 페이지를 열어 수동 다운로드 유도
    try { await shell.openExternal('https://sourceforge.net/projects/equalizerapo/'); } catch (e) {}
    return { success: false, error: error.message, openedPage: true };
  }
});

// Gaming IPC
handle('gaming:enable', async () => {
  return await gamingService.enable();
});

handle('gaming:disable', async () => {
  return await gamingService.disable();
});

handle('gaming:getStatus', async () => {
  return await gamingService.getStatus();
}, { success: false, enabled: false });

handle('gaming:enableGameMode', async (event, options) => {
  return await gamingService.enableGameMode(options || {});
});

handle('gaming:disableGameMode', async () => {
  return await gamingService.disableGameMode();
});

// Recovery IPC
handle('recovery:scan', async (event, options) => {
  return await recoveryService.scan(options || {});
}, { success: false, files: [] });

handle('recovery:recover', async (event, filePath, destination) => {
  if (!filePath || !destination) {
    return { success: false, error: 'Invalid file path or destination' };
  }
  return await recoveryService.recover(filePath, destination);
});

// Updater IPC
handle('updater:getInstalled', async () => {
  return await updaterService.getInstalled();
}, { success: false, software: [] });

handle('updater:checkUpdates', async (event, software) => {
  if (!software || typeof software !== 'object') {
    return { success: false, error: 'Invalid software object' };
  }
  return await updaterService.checkUpdates(software);
});

handle('updater:checkAllUpdates', async () => {
  return await updaterService.checkAllUpdates();
});

handle('updater:update', async (event, software) => {
  if (!software || typeof software !== 'object') {
    return { success: false, error: 'Invalid software object' };
  }
  return await updaterService.update(software);
});

// Driver IPC
handle('driver:getDrivers', async () => {
  return await driverService.getDrivers();
}, { success: false, drivers: [] });

handle('driver:checkUpdates', async () => {
  return await driverService.checkUpdates();
}, { success: false, updates: [] });

handle('driver:update', async (event, driver) => {
  if (!driver || typeof driver !== 'object') {
    return { success: false, error: 'Invalid driver object' };
  }
  return await driverService.update(driver);
});

// CPU IPC
handle('cpu:getStats', async () => {
  return await cpuService.getStats();
});

handle('cpu:optimize', async () => {
  return await cpuService.optimize();
});

handle('cpu:optimizeSafe', async () => {
  return await cpuOptimizeService.optimize();
});

handle('cpu:setPriority', async (event, pid, priority) => {
  if (!pid || typeof pid !== 'number' || !priority || typeof priority !== 'string') {
    return { success: false, error: 'Invalid process ID or priority' };
  }
  return await cpuService.setPriority(pid, priority);
});

// History IPC
handle('history:getTypes', async () => {
  return await historyService.getTypes();
}, { success: false, types: [] });

handle('history:clear', async (event, types) => {
  if (!Array.isArray(types)) {
    return { success: false, error: 'Invalid types array' };
  }
  return await historyService.clear(types);
});

handle('history:schedule', async (event, config) => {
  if (!config || typeof config !== 'object') {
    return { success: false, error: 'Invalid config object' };
  }
  return await historyService.schedule(config);
});

// System Stats IPC
handle('systemStats:getAll', async () => {
  // Electron 표준 IPC(structured clone)로 통계 반환.
  // 과거 PowerShell 공유 메모리 경로는 CPU 폭주/화면 멈춤을 유발해 제거됨.
  return await systemStatsService.getAllStats();
});

// Disk IPC
handle('disk:optimize', async (event, options) => {
  return await diskService.optimize(options || {});
});

// Network IPC
handle('network:getStats', async () => {
  return await networkService.getStats();
});

handle('network:optimize', async (event, options) => {
  return await networkService.optimize(options || {});
});

handle('network:pingTest', async (event, host) => {
  if (!host || typeof host !== 'string') {
    return { success: false, error: 'Invalid host' };
  }
  return await networkService.pingTest(host);
});

// Network Optimization API IPC (QUIC, ENet, IOCP)
handle('networkOptimization:detectAPIs', async () => {
  return await networkOptimizationService.detectAvailableAPIs();
});

handle('networkOptimization:enableQUIC', async (event, options) => {
  return await networkOptimizationService.enableQUIC(options || {});
});

handle('networkOptimization:optimizeENet', async (event, options) => {
  return await networkOptimizationService.optimizeENet(options || {});
});

handle('networkOptimization:optimizeIOCP', async (event, options) => {
  return await networkOptimizationService.optimizeIOCP(options || {});
});

handle('networkOptimization:optimizeAll', async (event, options) => {
  return await networkOptimizationService.optimizeAll(options || {});
});

// GPU Optimization IPC
handle('gpu:optimize', async (event, options) => {
  return await gpuOptimizeService.optimize(options || {});
});

// Compute Optimization IPC (OpenCL, CUDA, Intel oneAPI)
handle('computeOptimization:optimizeOpenCL', async (event, options) => {
  return await computeOptimizationService.optimizeOpenCL(options || {});
});

handle('computeOptimization:optimizeCUDA', async (event, options) => {
  return await computeOptimizationService.optimizeCUDA(options || {});
});

handle('computeOptimization:optimizeIntelOneAPI', async (event, options) => {
  return await computeOptimizationService.optimizeIntelOneAPI(options || {});
});

handle('computeOptimization:optimizeAll', async (event, options) => {
  return await computeOptimizationService.optimizeAll(options || {});
});

handle('computeOptimization:detectLibraries', async () => {
  return await computeOptimizationService.detectLibraries();
}, { success: false, libraries: {} });

// Fast Ping IPC
handle('fastPing:optimizeGameMode', async (event, options) => {
  return await fastPingService.optimizeGameMode(options || {});
});

handle('fastPing:optimizeWorkMode', async (event, options) => {
  return await fastPingService.optimizeWorkMode(options || {});
});

handle('fastPing:batchOptimize', async (event, options) => {
  return await fastPingService.batchOptimize(options || {});
});

handle('fastPing:batchAccelerate', async (event, options) => {
  return await fastPingService.batchAccelerate(options || {});
});

handle('fastPing:pingOptimize', async (event, options) => {
  return await fastPingService.pingOptimize(options || {});
});

// Delta Force Cleaner IPC
handle('deltaForceCleaner:scan', async (event, dirPath) => {
  if (!dirPath || typeof dirPath !== 'string') {
    return { success: false, error: 'Invalid directory path' };
  }
  return await deltaForceCleanerService.scan(dirPath);
}, { success: false, files: [] });

handle('deltaForceCleaner:clean', async (event, dirPath) => {
  if (!dirPath || typeof dirPath !== 'string') {
    return { success: false, error: 'Invalid directory path' };
  }
  return await deltaForceCleanerService.clean(dirPath);
});

handle('deltaForceCleaner:findDirectory', async () => {
  return await deltaForceCleanerService.findDirectory();
});

handle('deltaForceCleaner:getGameExplorerGames', async () => {
  return await deltaForceCleanerService.getGameExplorerGames();
}, { success: false, games: [] });

handle('deltaForceCleaner:installGameToExplorer', async (event, gamePath, gdfPath) => {
  if (!gamePath || !gdfPath) {
    return { success: false, error: 'Invalid game path or GDF path' };
  }
  return await deltaForceCleanerService.installGameToExplorer(gamePath, gdfPath);
});

handle('deltaForceCleaner:uninstallGameFromExplorer', async (event, instanceID) => {
  if (!instanceID || typeof instanceID !== 'string') {
    return { success: false, error: 'Invalid instance ID' };
  }
  return await deltaForceCleanerService.uninstallGameFromExplorer(instanceID);
});

handle('deltaForceCleaner:optimizeWithWindowsAPI', async (event, options) => {
  return await deltaForceCleanerService.optimizeWithWindowsAPI(options || {});
});

handle('deltaForceCleaner:manageApplicationsAndServices', async (event, options) => {
  return await deltaForceCleanerService.manageApplicationsAndServices(options || {});
});

// Permissions IPC
handle('permissions:isAdmin', async () => {
  return { success: true, isAdmin: await platformService.isAdmin() };
}, { success: false, isAdmin: false });

handle('platform:getOSInfo', async () => {
  return { success: true, osInfo: platformService.getOSInfo() };
});
handle('permissions:requestAdmin', async () => {
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
}, { success: false, isAdmin: false });

handle('permissions:confirmAction', async (event, action, details) => {
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
}, { confirmed: false });

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
  
  // 창 생성 (관리자 권한 요청 프롬프트는 제거됨 - 시작 시 UAC 재실행 안 함)
  createWindow();

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
