// @gpuStats.js (1-12)
// 날짜: 2025-09-05
// Import 모듈 설명:
// - systeminformation (si): 시스템 정보 수집 라이브러리. GPU 기본 정보 조회에 사용
//   사용 예: si.graphics() - GPU 하드웨어 정보 조회
// - gpuUsage (gpuUsageService): GPU 사용률 서비스. getIntelGPUUsage() 등으로 GPU 사용률 조회
// - gpuDetails (gpuDetailsService): GPU 상세 정보 서비스. getGPUDetails()로 GPU 엔진별 사용률, 메모리 등 조회
// - child_process (exec): 시스템 명령어 실행. PowerShell, typeperf 등으로 GPU 정보 조회에 사용
//   사용 예: execAsync('powershell -Command "Get-CimInstance Win32_VideoController..."') - WMI로 GPU 메모리 정보 조회
//   execAsync('typeperf "\\GPU Process Memory(*)\\Dedicated Usage" -sc 1 -si 1') - GPU 전용 메모리 사용량 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// 이 모듈은 여러 GPU 관련 서비스를 통합하여 GPU 통계를 제공

const si = require('systeminformation');
const gpuUsageService = require('./gpuUsage');
const gpuDetailsService = require('./gpuDetails');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function getGPUMemoryFromWMI(gpuIndex = 0) {
  try {
    const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance -ClassName Win32_VideoController | Select-Object -Index ${gpuIndex} | Select-Object AdapterRAM, SharedSystemMemory, DedicatedVideoMemory | ConvertTo-Json`;
    const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; ${psCommand}"`, { 
      timeout: 10000,
      encoding: 'utf8'
    });
    
    if (!stdout || !stdout.trim()) {
      throw new Error('Empty response from PowerShell');
    }
    
    const gpuInfo = JSON.parse(stdout);
    
    const adapterRAM = parseInt(gpuInfo.AdapterRAM || 0);
    const sharedSystemMemory = parseInt(gpuInfo.SharedSystemMemory || 0);
    const dedicatedVideoMemory = parseInt(gpuInfo.DedicatedVideoMemory || 0);
    
    const adapterRAMMB = adapterRAM > 0 ? Math.round(adapterRAM / (1024 * 1024)) : 0;
    const sharedSystemMemoryMB = sharedSystemMemory > 0 ? Math.round(sharedSystemMemory / (1024 * 1024)) : 0;
    const dedicatedVideoMemoryMB = dedicatedVideoMemory > 0 ? Math.round(dedicatedVideoMemory / (1024 * 1024)) : 0;
    
    const totalMemoryMB = dedicatedVideoMemoryMB > 0 ? dedicatedVideoMemoryMB : (adapterRAMMB > 0 ? adapterRAMMB : sharedSystemMemoryMB);
    
    let usedMemoryMB = 0;
    try {
      const { stdout: memStdout } = await execAsync('typeperf "\\GPU Process Memory(*)\\Dedicated Usage" -sc 1 -si 1', { timeout: 5000, encoding: 'utf8' });
      const memLines = memStdout.split('\n').filter(l => l.trim() && l.includes(',') && !l.includes('"\\') && !l.includes('"Date"'));
      if (memLines.length > 1) {
        let totalUsed = 0;
        for (const line of memLines) {
          const match = line.match(/,\s*"([0-9.]+)"/);
          if (match) {
            totalUsed += parseFloat(match[1]) || 0;
          }
        }
        usedMemoryMB = Math.round(totalUsed / (1024 * 1024));
      }
    } catch (error) {
    }
    
    return {
      used: usedMemoryMB,
      total: totalMemoryMB,
    };
  } catch (error) {
    return null;
  }
}

async function getDetailedGPUInfo() {
  try {
    const graphics = await si.graphics().catch(() => null);
    
    if (!graphics || !graphics.controllers || graphics.controllers.length === 0) {
      return [{
        name: 'GPU 0',
        model: 'Unknown GPU',
        usage: 0,
        gpuMemory: '0/0MB',
        sharedGpuMemory: '0/0MB',
        driverVersion: 'Unknown',
        driverDate: 'Unknown',
        directXVersion: 'Unknown',
        physicalLocation: 'Unknown',
      }];
    }

    const gpus = [];

    for (let i = 0; i < graphics.controllers.length; i++) {
      const controller = graphics.controllers[i];
      
      const vram = controller.vram || 0;
      const vramMB = vram;
      const vramGB = (vramMB / 1024).toFixed(1);

      const gpu = {
        name: `GPU ${i}`,
        model: controller.model || controller.vendor || 'Unknown GPU',
        vendor: controller.vendor || 'Unknown',
        subVendor: controller.subVendor || 'Unknown',
        vendorId: controller.vendorId || 'Unknown',
        deviceId: controller.deviceId || 'Unknown',
        bus: controller.bus || 'Unknown',
        vram: vramMB,
        vramGB: vramGB,
        vramDynamic: controller.vramDynamic || false,
        external: controller.external || false,
        cores: controller.cores || 0,
        metalVersion: controller.metalVersion || 'Unknown',
        usage: 0,
        gpuMemory: `0/${vramMB}MB`,
        sharedGpuMemory: '0/0MB',
        driverVersion: 'Unknown',
        driverDate: 'Unknown',
        directXVersion: 'Unknown',
        physicalLocation: controller.bus || 'Unknown',
        displays: [],
        vramUsed: 0,
        vramUsedPercent: 0,
      };

      if (process.platform === 'win32') {
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          try {
            const { stdout } = await execAsync(
              'nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total,driver_version,temperature.gpu,power.draw,clocks.current.graphics,clocks.current.memory --format=csv,noheader,nounits 2>nul'
            );
            
            if (stdout && stdout.trim()) {
              const lines = stdout.trim().split('\n').filter(l => l.trim());
              if (lines[i]) {
                const parts = lines[i].split(',').map(p => p.trim());
                if (parts.length >= 9) {
                  gpu.usage = parseInt(parts[0] || 0);
                  gpu.memoryUtilization = parseInt(parts[1] || 0);
                  const memUsed = parseFloat(parts[2] || 0);
                  const memTotal = parseFloat(parts[3] || 0);
                  gpu.gpuMemory = `${Math.round(memUsed)}/${Math.round(memTotal)}MB`;
                  gpu.driverVersion = parts[4] || 'Unknown';
                  gpu.temperature = parseFloat(parts[5] || 0);
                  gpu.powerDraw = parseFloat(parts[6] || 0);
                  gpu.graphicsClock = parseInt(parts[7] || 0);
                  gpu.memoryClock = parseInt(parts[8] || 0);
                  gpu.vramUsed = memUsed;
                  gpu.vramUsedPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
                } else if (parts.length >= 4) {
                  gpu.usage = parseInt(parts[0] || 0);
                  const memUsed = parseFloat(parts[1] || 0);
                  const memTotal = parseFloat(parts[2] || 0);
                  gpu.gpuMemory = `${Math.round(memUsed)}/${Math.round(memTotal)}MB`;
                  gpu.driverVersion = parts[3] || 'Unknown';
                  gpu.vramUsed = memUsed;
                  gpu.vramUsedPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
                }
              }
            }
          } catch (nvidiaError) {
            try {
              const [usage, details, gpuMemoryInfo] = await Promise.all([
                gpuUsageService.getIntelGPUUsage().catch(() => 0),
                gpuDetailsService.getGPUDetails().catch(() => null),
                getGPUMemoryFromWMI(i).catch(() => null),
              ]);

              if (usage > 0) {
                gpu.usage = Math.round(usage);
              } else if (details && details.usage3D > 0) {
                gpu.usage = Math.round(details.usage3D);
              }

              if (details) {
                gpu.usage3D = details.usage3D;
                gpu.usageCopy = details.usageCopy;
                gpu.usageVideoDecode = details.usageVideoDecode;
                gpu.usageVideoProcessing = details.usageVideoProcessing;
                gpu.sharedGpuMemory = `${details.sharedMemoryUsed.toFixed(1)}/${details.sharedMemoryTotal.toFixed(1)}GB`;
                gpu.sharedMemoryUsed = details.sharedMemoryUsed;
                gpu.sharedMemoryTotal = details.sharedMemoryTotal;
                gpu.directXVersion = details.directXVersion;
                gpu.physicalLocation = details.physicalLocation || controller.bus || 'Unknown';
              }

              if (gpuMemoryInfo) {
                const memUsedMB = gpuMemoryInfo.used || 0;
                const memTotalMB = gpuMemoryInfo.total || vramMB;
                
                if (memTotalMB > 0) {
                  gpu.gpuMemory = `${Math.round(memUsedMB)}/${Math.round(memTotalMB)}MB`;
                  gpu.vramUsed = memUsedMB;
                  gpu.vramUsedPercent = (memUsedMB / memTotalMB) * 100;
                } else if (details && details.sharedMemoryTotal > 0) {
                  const gpuMemoryGB = vramGB !== '0.0' ? vramGB : details.sharedMemoryTotal.toFixed(1);
                  const sharedMemoryUsedMB = (details.sharedMemoryUsed || 0) * 1024;
                  const sharedMemoryTotalMB = (details.sharedMemoryTotal || 0) * 1024;
                  gpu.gpuMemory = `${Math.round(sharedMemoryUsedMB)}/${Math.round(sharedMemoryTotalMB)}MB`;
                  gpu.vramUsed = sharedMemoryUsedMB;
                  gpu.vramUsedPercent = sharedMemoryTotalMB > 0 ? (sharedMemoryUsedMB / sharedMemoryTotalMB) * 100 : 0;
                }
              } else if (details && details.sharedMemoryTotal > 0) {
                const gpuMemoryGB = vramGB !== '0.0' ? vramGB : details.sharedMemoryTotal.toFixed(1);
                const sharedMemoryUsedMB = (details.sharedMemoryUsed || 0) * 1024;
                const sharedMemoryTotalMB = (details.sharedMemoryTotal || 0) * 1024;
                gpu.gpuMemory = `${Math.round(sharedMemoryUsedMB)}/${Math.round(sharedMemoryTotalMB)}MB`;
                gpu.vramUsed = sharedMemoryUsedMB;
                gpu.vramUsedPercent = sharedMemoryTotalMB > 0 ? (sharedMemoryUsedMB / sharedMemoryTotalMB) * 100 : 0;
              } else if (vramMB > 0) {
                gpu.gpuMemory = `0/${vramMB}MB`;
                gpu.vramUsed = 0;
                gpu.vramUsedPercent = 0;
              }
            } catch (intelError) {
              console.error('Error getting Intel/AMD GPU info:', intelError);
            }
          }
        } catch (error) {
        }
      }

      if (graphics.displays && Array.isArray(graphics.displays)) {
        gpu.displays = graphics.displays.map((display, idx) => {
          let model = display.model || 'Unknown';
          
          const hasBrokenChars = (str) => {
            if (!str || typeof str !== 'string') return true;
            try {
              const validPattern = /^[\x00-\x7F\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\s\-_\.a-zA-Z0-9]*$/;
              if (!validPattern.test(str)) return true;
              if (str.trim().length < 2) return true;
              if (/[^\x00-\x7F\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]{3,}/.test(str)) return true;
              return false;
            } catch (e) {
              return true;
            }
          };
          
          if (process.platform === 'win32' && model && typeof model === 'string') {
            const isEmptyOrGeneric = model.trim() === '' || 
                                     model === 'Unknown' ||
                                     model === 'Generic PnP Monitor' || 
                                     model.toLowerCase().includes('generic') ||
                                     model.toLowerCase().includes('pnp');
            
            if (hasBrokenChars(model) || isEmptyOrGeneric) {
              if (display.deviceName && !hasBrokenChars(display.deviceName) && display.deviceName !== 'Unknown' && !display.deviceName.includes('\\') && display.deviceName.length > 2) {
                model = display.deviceName;
              } else if (display.vendor && !hasBrokenChars(display.vendor) && display.vendor !== 'Unknown' && display.vendor.length > 2) {
                model = display.vendor;
              } else {
                model = `일반 PnP 모니터 ${idx + 1}`;
              }
            }
            
            if (hasBrokenChars(model)) {
              model = `일반 PnP 모니터 ${idx + 1}`;
            }
          }
          
          return {
            index: idx,
            vendor: display.vendor || 'Unknown',
            vendorId: display.vendorId || 'Unknown',
            deviceName: display.deviceName || 'Unknown',
            model: model,
            productionYear: display.productionYear || 0,
            serial: display.serial || 'Unknown',
            displayId: display.displayId || 'Unknown',
            main: display.main || false,
            builtin: display.builtin || false,
            connection: display.connection || 'Unknown',
            sizeX: display.sizeX || 0,
            sizeY: display.sizeY || 0,
            pixelDepth: display.pixelDepth || 0,
            resolutionX: display.resolutionX || 0,
            resolutionY: display.resolutionY || 0,
            currentResX: display.currentResX || 0,
            currentResY: display.currentResY || 0,
            positionX: display.positionX || 0,
            positionY: display.positionY || 0,
            currentRefreshRate: display.currentRefreshRate || 0,
          };
        });
      }

      gpus.push(gpu);
    }

    return gpus.length > 0 ? gpus : [{
      name: 'GPU 0',
      model: 'Unknown GPU',
      vendor: 'Unknown',
      subVendor: 'Unknown',
      vendorId: 'Unknown',
      deviceId: 'Unknown',
      bus: 'Unknown',
      vram: 0,
      vramGB: '0.0',
      vramDynamic: false,
      external: false,
      cores: 0,
      metalVersion: 'Unknown',
      usage: 0,
      gpuMemory: '0/0MB',
      sharedGpuMemory: '0/0MB',
      driverVersion: 'Unknown',
      driverDate: 'Unknown',
      directXVersion: 'Unknown',
      physicalLocation: 'Unknown',
      displays: [],
    }];
  } catch (error) {
    console.error('Error getting GPU info with systeminformation:', error);
    return [{
      name: 'GPU 0',
      model: 'Unknown GPU',
      vendor: 'Unknown',
      subVendor: 'Unknown',
      vendorId: 'Unknown',
      deviceId: 'Unknown',
      bus: 'Unknown',
      vram: 0,
      vramGB: '0.0',
      vramDynamic: false,
      external: false,
      cores: 0,
      metalVersion: 'Unknown',
      usage: 0,
      gpuMemory: '0/0MB',
      sharedGpuMemory: '0/0MB',
      driverVersion: 'Unknown',
      driverDate: 'Unknown',
      directXVersion: 'Unknown',
      physicalLocation: 'Unknown',
      displays: [],
    }];
  }
}

module.exports = {
  getDetailedGPUInfo,
};