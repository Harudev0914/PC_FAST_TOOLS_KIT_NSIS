const { contextBridge, ipcRenderer } = require('electron');

if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
  Object.defineProperty(window, 'devtools', {
    get: () => undefined,
    set: () => {}
  });

  window.addEventListener('devtools-opened', () => {
    window.location.reload();
  });
}

contextBridge.exposeInMainWorld('electronAPI', {
  optimization: {
    // 토글(Game Mode / Windows Boost)이 적용된 상태인지 조회한다. 패널은 메뉴를 옮길 때마다
    // 언마운트되므로, 마운트 시 이걸로 ON/OFF를 복원한다.
    getStatus: (key) => ipcRenderer.invoke('optimization:getStatus', key),

    // 오래 걸리는 작업이 단계마다 보내는 진행 상황 이벤트를 구독한다.
    // 구독 해제 함수를 반환하므로 호출 측(useEffect)에서 정리할 수 있다.
    onProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('optimization:progress', listener);
      return () => ipcRenderer.removeListener('optimization:progress', listener);
    },
  },

  // Audio
  audio: {
    getDevices: () => ipcRenderer.invoke('audio:getDevices'),
    getSettings: () => ipcRenderer.invoke('audio:getSettings'),
    applySoundBoost: (settings) => ipcRenderer.invoke('audio:applySoundBoost', settings),
    getEQPresets: () => ipcRenderer.invoke('audio:getEQPresets'),
    isEqualizerApoInstalled: () => ipcRenderer.invoke('audio:isEqualizerApoInstalled'),
    installEqualizerApo: () => ipcRenderer.invoke('audio:installEqualizerApo'),
  },

  // Gaming
  gaming: {
    enableGameMode: () => ipcRenderer.invoke('gaming:enableGameMode'),
    disableGameMode: () => ipcRenderer.invoke('gaming:disableGameMode'),
  },

  // Delta Force Cleaner / Windows Boost
  deltaForceCleaner: {
    scan: (dirPath) => ipcRenderer.invoke('deltaForceCleaner:scan', dirPath),
    clean: (dirPath) => ipcRenderer.invoke('deltaForceCleaner:clean', dirPath),
    findDirectory: () => ipcRenderer.invoke('deltaForceCleaner:findDirectory'),
    optimizeWithWindowsAPI: () => ipcRenderer.invoke('deltaForceCleaner:optimizeWithWindowsAPI'),
    restoreWindowsDefaults: () => ipcRenderer.invoke('deltaForceCleaner:restoreWindowsDefaults'),
  },

  // Fast Ping
  fastPing: {
    batchOptimize: (options) => ipcRenderer.invoke('fastPing:batchOptimize', options),
    batchAccelerate: (options) => ipcRenderer.invoke('fastPing:batchAccelerate', options),
    pingOptimize: (options) => ipcRenderer.invoke('fastPing:pingOptimize', options),
  },

  // 단일 컴포넌트 최적화 (Smart Optimization 패널)
  cpu: {
    optimize: () => ipcRenderer.invoke('cpu:optimize'),
  },
  memory: {
    optimize: (options) => ipcRenderer.invoke('memory:optimize', options),
  },
  disk: {
    optimize: (options) => ipcRenderer.invoke('disk:optimize', options),
  },
  network: {
    optimize: (options) => ipcRenderer.invoke('network:optimize', options),
  },
  gpu: {
    optimize: (options) => ipcRenderer.invoke('gpu:optimize', options),
  },

  // System Stats
  systemStats: {
    getAll: () => ipcRenderer.invoke('systemStats:getAll'),
  },

  // Updater
  updater: {
    checkAllUpdates: () => ipcRenderer.invoke('updater:checkAllUpdates'),
    update: (software) => ipcRenderer.invoke('updater:update', software),
  },

  // Driver
  driver: {
    getDrivers: () => ipcRenderer.invoke('driver:getDrivers'),
    update: (driver) => ipcRenderer.invoke('driver:update', driver),
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
});
