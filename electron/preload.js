// ---------
// 2025-03-10
// 개발자 : KR_Tuki
// 기능 : Electron 프리로드 스크립트 (보안 격리)
// ---------

// @preload.js (1-7)
// 날짜: 2025-03-10
// Import 모듈 설명:
// - electron (contextBridge, ipcRenderer): Electron 보안 격리 및 IPC 통신 모듈
//   사용 예: contextBridge.exposeInMainWorld() - 렌더러 프로세스에 안전한 API 노출, ipcRenderer.invoke() - 메인 프로세스에 IPC 요청 전송
// 변수 설명:
//   - electronAPI: window.electronAPI로 렌더러 프로세스에 노출되는 API 객체
//     각 서비스별 메서드 제공 (cleaner, memory, network, audio, gaming, recovery, updater, driver, cpu 등)
// 기능 원리:
// 1. Context Isolation을 통한 보안 격리: 메인 프로세스와 렌더러 프로세스 간 안전한 통신 브릿지 제공
// 2. contextBridge.exposeInMainWorld()로 window.electronAPI에 API 노출
// 3. 각 API는 ipcRenderer.invoke()를 통해 메인 프로세스의 IPC 핸들러와 통신
// 4. 프로덕션 모드에서 DevTools 접근 차단 (window.devtools 속성 제거, devtools-opened 이벤트 리스너)

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
  // Cleaner
  cleaner: {
    scan: () => ipcRenderer.invoke('cleaner:scan'),
    clean: (options) => ipcRenderer.invoke('cleaner:clean', options),
  },

  // Memory
  memory: {
    getStats: () => ipcRenderer.invoke('memory:getStats'),
    optimize: (options) => ipcRenderer.invoke('memory:optimize', options),
    getProcesses: () => ipcRenderer.invoke('memory:getProcesses'),
    killProcess: (pid) => ipcRenderer.invoke('memory:killProcess', pid),
  },

  // Network
  network: {
    getStats: () => ipcRenderer.invoke('network:getStats'),
    optimize: (options) => ipcRenderer.invoke('network:optimize', options),
    pingTest: (host) => ipcRenderer.invoke('network:pingTest', host),
  },

  // Network Optimization API (QUIC, ENet, IOCP)
  networkOptimization: {
    detectAPIs: () => ipcRenderer.invoke('networkOptimization:detectAPIs'),
    enableQUIC: (options) => ipcRenderer.invoke('networkOptimization:enableQUIC', options),
    optimizeENet: (options) => ipcRenderer.invoke('networkOptimization:optimizeENet', options),
    optimizeIOCP: (options) => ipcRenderer.invoke('networkOptimization:optimizeIOCP', options),
    optimizeAll: (options) => ipcRenderer.invoke('networkOptimization:optimizeAll', options),
  },

  // Audio
  audio: {
    getDevices: () => ipcRenderer.invoke('audio:getDevices'),
    setVolume: (deviceId, volume) => ipcRenderer.invoke('audio:setVolume', deviceId, volume),
    boost: (enabled) => ipcRenderer.invoke('audio:boost', enabled),
    getSettings: () => ipcRenderer.invoke('audio:getSettings'),
    applySoundBoost: (settings) => ipcRenderer.invoke('audio:applySoundBoost', settings),
    getEQPresets: () => ipcRenderer.invoke('audio:getEQPresets'),
    detectModels: () => ipcRenderer.invoke('audio:detectModels'),
  },

  // Gaming
  gaming: {
    enable: () => ipcRenderer.invoke('gaming:enable'),
    disable: () => ipcRenderer.invoke('gaming:disable'),
    getStatus: () => ipcRenderer.invoke('gaming:getStatus'),
    enableGameMode: (options) => ipcRenderer.invoke('gaming:enableGameMode', options),
    disableGameMode: () => ipcRenderer.invoke('gaming:disableGameMode'),
  },

  // Recovery
  recovery: {
    scan: (options) => ipcRenderer.invoke('recovery:scan', options),
    recover: (filePath, destination) => ipcRenderer.invoke('recovery:recover', filePath, destination),
  },

  // Updater
  updater: {
    getInstalled: () => ipcRenderer.invoke('updater:getInstalled'),
    checkUpdates: (software) => ipcRenderer.invoke('updater:checkUpdates', software),
    update: (software) => ipcRenderer.invoke('updater:update', software),
  },

  // Driver
  driver: {
    getDrivers: () => ipcRenderer.invoke('driver:getDrivers'),
    checkUpdates: () => ipcRenderer.invoke('driver:checkUpdates'),
    update: (driver) => ipcRenderer.invoke('driver:update', driver),
  },

  // CPU
    cpu: {
      getStats: () => ipcRenderer.invoke('cpu:getStats'),
      optimize: () => ipcRenderer.invoke('cpu:optimize'),
      optimizeSafe: () => ipcRenderer.invoke('cpu:optimizeSafe'),
      setPriority: (pid, priority) => ipcRenderer.invoke('cpu:setPriority', pid, priority),
    },

  // Compute Optimization (OpenCL, CUDA, Intel oneAPI)
  computeOptimization: {
    optimizeOpenCL: (options) => ipcRenderer.invoke('computeOptimization:optimizeOpenCL', options),
    optimizeCUDA: (options) => ipcRenderer.invoke('computeOptimization:optimizeCUDA', options),
    optimizeIntelOneAPI: (options) => ipcRenderer.invoke('computeOptimization:optimizeIntelOneAPI', options),
    optimizeAll: (options) => ipcRenderer.invoke('computeOptimization:optimizeAll', options),
    detectLibraries: () => ipcRenderer.invoke('computeOptimization:detectLibraries'),
  },

  // IPC Allocator (Shared Memory)
  ipcAllocator: {
    open: () => ipcRenderer.invoke('ipcAllocator:open'),
    read: (offset) => ipcRenderer.invoke('ipcAllocator:read', offset),
    malloc: (size, type) => ipcRenderer.invoke('ipcAllocator:malloc', size, type),
    write: (offset, data) => ipcRenderer.invoke('ipcAllocator:write', offset, data),
    getStats: () => ipcRenderer.invoke('ipcAllocator:getStats'),
  },

  // System Stats
  systemStats: {
    getAll: () => ipcRenderer.invoke('systemStats:getAll'),
  },

  // History
  history: {
    getTypes: () => ipcRenderer.invoke('history:getTypes'),
    clear: (types) => ipcRenderer.invoke('history:clear', types),
    schedule: (config) => ipcRenderer.invoke('history:schedule', config),
  },

  // Permissions
  permissions: {
    isAdmin: () => ipcRenderer.invoke('permissions:isAdmin'),
    requestAdmin: () => ipcRenderer.invoke('permissions:requestAdmin'),
    confirmAction: (action, details) => ipcRenderer.invoke('permissions:confirmAction', action, details),
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // System Stats
  systemStats: {
    getAll: () => ipcRenderer.invoke('systemStats:getAll'),
  },

  // Platform
  platform: {
    getOSInfo: () => ipcRenderer.invoke('platform:getOSInfo'),
  },

  // Disk
  disk: {
    optimize: (options) => ipcRenderer.invoke('disk:optimize', options),
  },

  // GPU Optimization
  gpu: {
    optimize: (options) => ipcRenderer.invoke('gpu:optimize', options),
  },

  // Fast Ping
  fastPing: {
    optimizeGameMode: (options) => ipcRenderer.invoke('fastPing:optimizeGameMode', options),
    optimizeWorkMode: (options) => ipcRenderer.invoke('fastPing:optimizeWorkMode', options),
    batchOptimize: (options) => ipcRenderer.invoke('fastPing:batchOptimize', options),
    batchAccelerate: (options) => ipcRenderer.invoke('fastPing:batchAccelerate', options),
    pingOptimize: (options) => ipcRenderer.invoke('fastPing:pingOptimize', options),
  },

  // Delta Force Cleaner
  deltaForceCleaner: {
    scan: (dirPath) => ipcRenderer.invoke('deltaForceCleaner:scan', dirPath),
    clean: (dirPath) => ipcRenderer.invoke('deltaForceCleaner:clean', dirPath),
    findDirectory: () => ipcRenderer.invoke('deltaForceCleaner:findDirectory'),
    getGameExplorerGames: () => ipcRenderer.invoke('deltaForceCleaner:getGameExplorerGames'),
    installGameToExplorer: (gamePath, gdfPath) => ipcRenderer.invoke('deltaForceCleaner:installGameToExplorer', gamePath, gdfPath),
    uninstallGameFromExplorer: (instanceID) => ipcRenderer.invoke('deltaForceCleaner:uninstallGameFromExplorer', instanceID),
    optimizeWithWindowsAPI: (options) => ipcRenderer.invoke('deltaForceCleaner:optimizeWithWindowsAPI', options),
    manageApplicationsAndServices: (options) => ipcRenderer.invoke('deltaForceCleaner:manageApplicationsAndServices', options),
  },
});
