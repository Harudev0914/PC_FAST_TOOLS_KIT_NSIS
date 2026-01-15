// @gpuDetails.js (1-11)
// 날짜: 2025-09-14
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. typeperf, wmic, reg query 등으로 GPU 정보 조회에 사용
//   사용 예: execAsync('typeperf "\\GPU Engine(*_engtype_3D)\\Utilization Percentage" -sc 1 -si 1') - 3D 엔진 사용률 조회
//   execAsync('wmic path win32_VideoController get AdapterRAM,SharedSystemMemory /format:list') - GPU 메모리 정보 조회
//   execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\DirectX" /v Version') - DirectX 버전 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - fs (promises): 파일 시스템 비동기 접근 (현재 미사용, 향후 확장용)
// - platform (platformService): 플랫폼별 기능 제공. executeCommand() 함수로 Linux 명령어 실행 (nvidia-smi, lspci 등)
//   사용 예: platformService.executeCommand('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits') - NVIDIA GPU 사용률 조회
//   platformService.executeCommand('lspci | grep -i vga') - Linux에서 GPU PCI 정보 조회

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const platformService = require('./platform');

async function getGPUDetails() {
  try {
    if (process.platform === 'win32') {
      const [usage3D, usageCopy, usageVideoDecode, usageVideoProcessing, sharedMemory, directX, physicalLocation] = await Promise.all([
        getGPUUsageByType('3D'),
        getGPUUsageByType('Copy'),
        getGPUUsageByType('Video_Decode'),
        getGPUUsageByType('Video_Processing'),
        getSharedGPUMemory(),
        getDirectXVersion(),
        getPhysicalLocation(),
      ]);

      return {
        usage3D: Math.round(usage3D),
        usageCopy: Math.round(usageCopy),
        usageVideoDecode: Math.round(usageVideoDecode),
        usageVideoProcessing: Math.round(usageVideoProcessing),
        sharedMemoryUsed: sharedMemory.used,
        sharedMemoryTotal: sharedMemory.total,
        directXVersion: directX,
        physicalLocation: physicalLocation,
      };
    } else {
      const [usage3D, sharedMemory, physicalLocation] = await Promise.all([
        getGPUUsageByTypeLinux('3D'),
        getSharedGPUMemoryLinux(),
        getPhysicalLocationLinux(),
      ]);

      return {
        usage3D: Math.round(usage3D),
        usageCopy: 0,
        usageVideoDecode: 0,
        usageVideoProcessing: 0,
        sharedMemoryUsed: sharedMemory.used,
        sharedMemoryTotal: sharedMemory.total,
        directXVersion: 'N/A',
        physicalLocation: physicalLocation,
      };
    }
  } catch (error) {
    console.error('Error getting GPU details:', error);
    return {
      usage3D: 0,
      usageCopy: 0,
      usageVideoDecode: 0,
      usageVideoProcessing: 0,
      sharedMemoryUsed: 0,
      sharedMemoryTotal: 0,
      directXVersion: 'Unknown',
      physicalLocation: 'Unknown',
    };
  }
}

async function getGPUUsageByType(engType) {
  try {
    let counterType = engType;
    if (engType === 'Video_Decode') {
      counterType = 'Video_Decode';
    } else if (engType === 'Video_Processing') {
      counterType = 'Video_Processing';
    }
    
    const counter = `\\GPU Engine(*_engtype_${counterType})\\Utilization Percentage`;
    const { stdout } = await execAsync(`typeperf "${counter}" -sc 1 -si 1`, { timeout: 5000, encoding: 'utf8' });
    
    const lines = stdout.split('\n').filter(l => l.trim() && l.includes(',') && !l.includes('"\\') && !l.includes('"Date"'));
    if (lines.length > 1) {
      let totalUsage = 0;
      let count = 0;
      for (const line of lines) {
        const match = line.match(/,\s*"([0-9.]+)"/);
        if (match) {
          totalUsage += parseFloat(match[1]) || 0;
          count++;
        }
      }
      return count > 0 ? totalUsage : 0;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

async function getSharedGPUMemory() {
  try {
    const { stdout } = await execAsync('wmic path win32_VideoController get AdapterRAM,SharedSystemMemory /format:list', { encoding: 'utf8' });
    
    let adapterRAM = 0;
    let sharedSystemMemory = 0;
    
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('AdapterRAM=')) {
        adapterRAM = parseInt(line.split('=')[1]?.trim() || '0');
      }
      if (line.includes('SharedSystemMemory=')) {
        sharedSystemMemory = parseInt(line.split('=')[1]?.trim() || '0');
      }
    }
    
    let sharedMemoryUsed = 0;
    try {
      const { stdout: memStdout } = await execAsync('typeperf "\\GPU Process Memory(*)\\Shared Usage" -sc 1 -si 1', { encoding: 'utf8' });
      const memLines = memStdout.split('\n').filter(l => l.trim() && l.includes(',') && !l.includes('"\\'));
      if (memLines.length > 1) {
        const lastLine = memLines[memLines.length - 1];
        const match = lastLine.match(/,\s*"([0-9.]+)"/);
        if (match) {
          sharedMemoryUsed = parseFloat(match[1]) || 0;
        }
      }
    } catch (error) {
    }
    
    const totalMemory = adapterRAM > 0 ? adapterRAM : sharedSystemMemory;
    
    return {
      used: Math.round((sharedMemoryUsed / (1024 * 1024 * 1024)) * 100) / 100,
      total: Math.round((totalMemory / (1024 * 1024 * 1024)) * 100) / 100,
    };
  } catch (error) {
    return { used: 0, total: 0 };
  }
}

async function getDirectXVersion() {
  try {
    const { stdout } = await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\DirectX" /v Version');
    const match = stdout.match(/Version\s+REG_SZ\s+(\d+\.\d+)/);
    if (match) {
      return match[1];
    }
    
    const { stdout: wmiStdout } = await execAsync('wmic path win32_VideoController get DriverVersion /format:list');
    return '12 (FL 12.1)';
  } catch (error) {
    return 'Unknown';
  }
}

async function getPhysicalLocation() {
  try {
    const { stdout } = await execAsync('wmic path win32_VideoController get PNPDeviceID /format:list');
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('PNPDeviceID=')) {
        const pnpId = line.split('=')[1]?.trim() || '';
        const busMatch = pnpId.match(/PCI\\VEN_[0-9A-F]{4}&DEV_[0-9A-F]{4}&SUBSYS_[0-9A-F]{8}&REV_[0-9A-F]{2}\\([0-9A-F]+)/);
        if (busMatch) {
          const busHex = busMatch[1];
          const bus = parseInt(busHex, 16);
          return `PCI Bus ${bus}, Device 2, Function 0`;
        }
      }
    }
    return 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

async function getGPUUsageByTypeLinux(engType) {
  try {
    const nvidiaResult = await platformService.executeCommand('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null', { timeout: 5000 });
    if (nvidiaResult.success && nvidiaResult.stdout) {
      const usage = parseInt(nvidiaResult.stdout.trim()) || 0;
      return usage;
    }
    
    return 0;
  } catch (error) {
    return 0;
  }
}

async function getSharedGPUMemoryLinux() {
  try {
    const nvidiaResult = await platformService.executeCommand('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null', { timeout: 5000 });
    if (nvidiaResult.success && nvidiaResult.stdout) {
      const parts = nvidiaResult.stdout.trim().split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const used = parseFloat(parts[0]) || 0;
        const total = parseFloat(parts[1]) || 0;
        return { used: used, total: total };
      }
    }
    
    return { used: 0, total: 0 };
  } catch (error) {
    return { used: 0, total: 0 };
  }
}

async function getPhysicalLocationLinux() {
  try {
    const lspciResult = await platformService.executeCommand('lspci | grep -i vga', { timeout: 5000 });
    if (lspciResult.success && lspciResult.stdout) {
      const match = lspciResult.stdout.match(/^(\d+:\d+\.\d+)/);
      if (match) {
        return `PCI Bus ${match[1]}`;
      }
    }
    return 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

module.exports = {
  getGPUDetails,
};