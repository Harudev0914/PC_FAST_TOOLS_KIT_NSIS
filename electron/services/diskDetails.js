// @diskDetails.js (1-10)
// 날짜: 2025-10-02
// Import 모듈 설명:
// - systeminformation (si): 시스템 정보 수집 라이브러리. 디스크 정보 조회에 사용
//   사용 예: si.fsSize() - 파일 시스템 크기 정보 조회, si.diskLayout() - 디스크 레이아웃 정보 조회
//   si.blockDevices() - 블록 장치 정보 조회, si.diskIO() - 디스크 I/O 통계 조회
// - child_process (exec): 시스템 명령어 실행. wmic, PowerShell 등으로 디스크 정보 조회에 사용
//   사용 예: execPromise('wmic diskdrive get Model,Size,InterfaceType,MediaType /format:list') - 디스크 모델, 크기, 인터페이스 타입 조회
// - util: 유틸리티 함수 제공. util.promisify()로 콜백 기반 함수를 Promise로 변환
// si 모듈 사용:
//   - fsSize: 파일 시스템 크기 정보 (fs, mount, size, used, available 등)
//   - diskLayout: 물리적 디스크 레이아웃 정보 (model, type, vendor, serialNum, interfaceType 등)
//   - blockDevices: 블록 장치 정보 (name, mount, serial 등)
//   - diskIO: 디스크 I/O 통계 (readIO, writeIO, readBytes, writeBytes 등)

const si = require('systeminformation');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function getDiskDetails(diskLetter = 'C:') {
  try {
    const [fsSize, diskLayout, blockDevices] = await Promise.all([
      si.fsSize().catch(() => []),
      si.diskLayout().catch(() => []),
      si.blockDevices().catch(() => []),
    ]);

    const fs = fsSize.find(f => f.fs === diskLetter || f.mount === diskLetter);
    if (!fs) {
      return getDefaultDetails();
    }

    const blockDevice = blockDevices.find(b => b.mount === diskLetter || b.name === diskLetter);
    
    let physicalDisk = null;
    if (blockDevice && blockDevice.serial) {
      physicalDisk = diskLayout.find(d => d.serialNum === blockDevice.serial);
    }
    if (!physicalDisk && diskLayout.length > 0) {
      physicalDisk = diskLayout[0];
    }

    let model = 'Unknown';
    let type = 'Unknown';
    let vendor = 'Unknown';
    let serialNum = 'Unknown';
    let firmwareRevision = 'Unknown';
    let interfaceType = 'Unknown';
    let smartStatus = 'Unknown';
    let size = 0;
    let bytesPerSector = 0;
    let totalCylinders = 0;
    let totalHeads = 0;
    let totalSectors = 0;
    let totalTracks = 0;
    let tracksPerCylinder = 0;
    let sectorsPerTrack = 0;
    let temperature = null;
    let interface = 'Unknown';

    if (physicalDisk) {
      model = physicalDisk.name || physicalDisk.vendor || 'Unknown';
      vendor = physicalDisk.vendor || 'Unknown';
      serialNum = physicalDisk.serialNum || 'Unknown';
      firmwareRevision = physicalDisk.firmwareRevision || 'Unknown';
      interfaceType = physicalDisk.interfaceType || 'Unknown';
      smartStatus = physicalDisk.smartStatus || 'Unknown';
      size = physicalDisk.size || 0;
      bytesPerSector = physicalDisk.bytesPerSector || 0;
      totalCylinders = physicalDisk.totalCylinders || 0;
      totalHeads = physicalDisk.totalHeads || 0;
      totalSectors = physicalDisk.totalSectors || 0;
      totalTracks = physicalDisk.totalTracks || 0;
      tracksPerCylinder = physicalDisk.tracksPerCylinder || 0;
      sectorsPerTrack = physicalDisk.sectorsPerTrack || 0;
      temperature = physicalDisk.temperature !== undefined ? physicalDisk.temperature : null;
      interface = physicalDisk.interface || physicalDisk.interfaceType || 'Unknown';
      
      if (physicalDisk.type) {
        type = physicalDisk.type;
      } else if (physicalDisk.interfaceType) {
        const interfaceTypeUpper = physicalDisk.interfaceType.toUpperCase();
        if (interfaceTypeUpper.includes('NVME') || interfaceTypeUpper.includes('NV-ME') || interfaceTypeUpper.includes('M.2')) {
          type = 'SSD(NVMe)';
        } else if (interfaceTypeUpper.includes('SATA') || interfaceTypeUpper.includes('ATA')) {
          type = type === 'SSD' ? 'SSD' : 'HDD';
        } else {
          type = 'HDD';
        }
      } else {
        const modelUpper = model.toUpperCase();
        if (modelUpper.includes('SSD') || modelUpper.includes('NVME') || modelUpper.includes('NV-ME') || modelUpper.includes('M.2')) {
          if (modelUpper.includes('NVME') || modelUpper.includes('NV-ME') || modelUpper.includes('M.2')) {
            type = 'SSD(NVMe)';
          } else {
            type = 'SSD';
          }
        } else {
          type = 'HDD';
        }
      }
    } else if (blockDevice) {
      model = blockDevice.model || 'Unknown';
      serialNum = blockDevice.serial || 'Unknown';
      if (blockDevice.physical) {
        type = blockDevice.physical.includes('SSD') ? 'SSD' : 'HDD';
      }
    }

    const fsType = fs.type || 'Unknown';
    const fsSizeBytes = fs.size || 0;
    const fsUsedBytes = fs.used || 0;
    const fsAvailableBytes = fs.available || 0;
    const fsUsePercent = fs.use || 0;
    const fsMount = fs.mount || diskLetter;
    const fsRw = fs.rw !== undefined ? fs.rw : true;

    const blockDeviceType = blockDevice?.type || 'Unknown';
    const blockDeviceFsType = blockDevice?.fsType || fsType;
    const blockDeviceLabel = blockDevice?.label || '';
    const blockDeviceUuid = blockDevice?.uuid || '';
    const blockDeviceRemovable = blockDevice?.removable || false;
    const blockDeviceProtocol = blockDevice?.protocol || '';

    let pageFile = false;
    if (process.platform === 'win32') {
      try {
        const driveLetter = diskLetter.replace(':', '');
        const { stdout } = await execPromise(
          `powershell -Command "Get-WmiObject Win32_PageFileUsage | Where-Object { $_.Name -like '*${driveLetter}*' } | Select-Object -First 1"`,
          { timeout: 5000 }
        );
        if (stdout && stdout.trim()) {
          pageFile = true;
        }
      } catch (error) {
        // Ignore errors
      }
    }

    let activeTime = 0;
    let readSpeed = 0;
    let writeSpeed = 0;
    let responseTime = 0;
    let transfersPerSec = 0;
    
    let rIO = 0;
    let wIO = 0;
    let tIO = 0;
    let rIO_sec = 0;
    let wIO_sec = 0;
    let tIO_sec = 0;
    let rWaitTime = 0;
    let wWaitTime = 0;
    let tWaitTime = 0;
    let rWaitPercent = 0;
    let wWaitPercent = 0;
    let tWaitPercent = 0;
    
    let rx = 0;
    let wx = 0;
    let tx = 0;
    let rx_sec = 0;
    let wx_sec = 0;
    let tx_sec = 0;
    let ms = 0;

    try {
      const [diskIO, fsStats] = await Promise.all([
        si.disksIO().catch(() => null),
        si.fsStats().catch(() => null)
      ]);
      
      if (diskIO) {
        rIO = diskIO.rIO || 0;
        wIO = diskIO.wIO || 0;
        tIO = diskIO.tIO || 0;
        rIO_sec = diskIO.rIO_sec || 0;
        wIO_sec = diskIO.wIO_sec || 0;
        tIO_sec = diskIO.tIO_sec || 0;
        rWaitTime = diskIO.rWaitTime !== undefined ? diskIO.rWaitTime : 0;
        wWaitTime = diskIO.wWaitTime !== undefined ? diskIO.wWaitTime : 0;
        tWaitTime = diskIO.tWaitTime !== undefined ? diskIO.tWaitTime : 0;
        rWaitPercent = diskIO.rWaitPercent || 0;
        wWaitPercent = diskIO.wWaitPercent || 0;
        tWaitPercent = diskIO.tWaitPercent || 0;
        
        if (rWaitTime !== undefined && wWaitTime !== undefined) {
          responseTime = Math.round(((rWaitTime + wWaitTime) / 2) * 1000);
        } else if (rWaitTime !== undefined) {
          responseTime = Math.round(rWaitTime * 1000);
        } else if (wWaitTime !== undefined) {
          responseTime = Math.round(wWaitTime * 1000);
        } else if (diskIO.rWait !== undefined && diskIO.wWait !== undefined) {
          responseTime = Math.round(((diskIO.rWait + diskIO.wWait) / 2) * 1000);
        }
        
        if (tWaitPercent !== undefined && tWaitPercent !== null) {
          activeTime = tWaitPercent;
        } else if (rWaitPercent !== undefined && wWaitPercent !== undefined) {
          activeTime = (rWaitPercent + wWaitPercent) / 2;
        } else if (rWaitPercent !== undefined) {
          activeTime = rWaitPercent;
        } else if (wWaitPercent !== undefined) {
          activeTime = wWaitPercent;
        }
        
        transfersPerSec = tIO_sec || (rIO_sec + wIO_sec);
      }
      
      if (fsStats) {
        rx = fsStats.rx || 0;
        wx = fsStats.wx || 0;
        tx = fsStats.tx || 0;
        rx_sec = fsStats.rx_sec || 0;
        wx_sec = fsStats.wx_sec || 0;
        tx_sec = fsStats.tx_sec || 0;
        ms = fsStats.ms || 0;
        
        if (rx_sec !== undefined || wx_sec !== undefined) {
          readSpeed = Math.round((rx_sec / 1024) * 100) / 100;
          writeSpeed = Math.round((wx_sec / 1024) * 100) / 100;
        }
      } else if (diskIO) {
        const avgBlockSize = 4096;
        readSpeed = Math.round((rIO_sec * avgBlockSize / 1024) * 100) / 100;
        writeSpeed = Math.round((wIO_sec * avgBlockSize / 1024) * 100) / 100;
      }
    } catch (error) {
      console.error('Error getting disk IO stats:', error);
    }

    return {
      model,
      type,
      vendor,
      serialNum,
      firmwareRevision,
      interfaceType,
      interface,
      smartStatus,
      size,
      bytesPerSector,
      totalCylinders,
      totalHeads,
      totalSectors,
      totalTracks,
      tracksPerCylinder,
      sectorsPerTrack,
      temperature,
      fsType,
      fsSizeBytes,
      fsUsedBytes,
      fsAvailableBytes,
      fsUsePercent,
      fsMount,
      fsRw,
      blockDeviceType,
      blockDeviceFsType,
      blockDeviceLabel,
      blockDeviceUuid,
      blockDeviceRemovable,
      blockDeviceProtocol,
      activeTime,
      readSpeed,
      writeSpeed,
      responseTime,
      transfersPerSec,
      pageFile,
      rIO,
      wIO,
      tIO,
      rIO_sec,
      wIO_sec,
      tIO_sec,
      rWaitTime,
      wWaitTime,
      tWaitTime,
      rWaitPercent,
      wWaitPercent,
      tWaitPercent,
      rx,
      wx,
      tx,
      rx_sec,
      wx_sec,
      tx_sec,
      ms,
    };
  } catch (error) {
    console.error('Error getting disk details:', error);
    return getDefaultDetails();
  }
}

function getDefaultDetails() {
  return {
    model: 'Unknown',
    type: 'Unknown',
    vendor: 'Unknown',
    serialNum: 'Unknown',
    firmwareRevision: 'Unknown',
    interfaceType: 'Unknown',
    interface: 'Unknown',
    smartStatus: 'Unknown',
    size: 0,
    bytesPerSector: 0,
    totalCylinders: 0,
    totalHeads: 0,
    totalSectors: 0,
    totalTracks: 0,
    tracksPerCylinder: 0,
    sectorsPerTrack: 0,
    temperature: null,
    fsType: 'Unknown',
    fsSizeBytes: 0,
    fsUsedBytes: 0,
    fsAvailableBytes: 0,
    fsUsePercent: 0,
    fsMount: '',
    fsRw: true,
    blockDeviceType: 'Unknown',
    blockDeviceFsType: 'Unknown',
    blockDeviceLabel: '',
    blockDeviceUuid: '',
    blockDeviceRemovable: false,
    blockDeviceProtocol: '',
    activeTime: 0,
    readSpeed: 0,
    writeSpeed: 0,
    responseTime: 0,
    transfersPerSec: 0,
    pageFile: false,
    rIO: 0,
    wIO: 0,
    tIO: 0,
    rIO_sec: 0,
    wIO_sec: 0,
    tIO_sec: 0,
    rWaitTime: 0,
    wWaitTime: 0,
    tWaitTime: 0,
    rWaitPercent: 0,
    wWaitPercent: 0,
    tWaitPercent: 0,
    rx: 0,
    wx: 0,
    tx: 0,
    rx_sec: 0,
    wx_sec: 0,
    tx_sec: 0,
    ms: 0,
  };
}

module.exports = {
  getDiskDetails,
};