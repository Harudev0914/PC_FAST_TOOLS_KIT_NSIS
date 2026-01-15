// ---------
// 2025-10-11
// 개발자 : KR_Tuki
// 기능 : 메모리 상세 정보 수집 (캐시, 커밋, 페이징 풀 등)
// ---------

// @memoryDetails.js (1-12)
// 날짜: 2025-10-11
// Import 모듈 설명:
// - systeminformation (si): 시스템 정보 수집 라이브러리. 메모리 상세 정보 조회에 사용
//   사용 예: si.mem() - 메모리 사용량 정보 조회 (total, used, free, cached, buffcache, swaptotal, swapused 등)
//   si.memLayout() - 메모리 레이아웃 정보 조회 (clockSpeed, formFactor, type 등)
//   si.disksIO() - 디스크 I/O 통계 조회 (메모리 관련 간접 정보)
//   si.fsStats() - 파일 시스템 통계 조회
//   si.cpuTemperature() - CPU 온도 조회 (간접 정보)
// - os: 운영체제 정보 제공. os.totalmem(), os.freemem() 등으로 메모리 정보 조회
// 변수 설명:
//   - previousDiskIO: 이전 디스크 I/O 통계를 저장하는 변수 (변화량 계산용)
//   - previousFsStats: 이전 파일 시스템 통계를 저장하는 변수 (변화량 계산용)
//   - previousTime: 이전 조회 시각을 저장하는 변수 (시간 간격 계산용)

const si = require('systeminformation');
const os = require('os');

let previousDiskIO = null;
let previousFsStats = null;
let previousTime = null;

async function getMemoryDetails() {
  try {
    const currentTime = Date.now();
    const [mem, memLayout, diskIO, fsStats, cpuTemp] = await Promise.all([
      si.mem().catch(() => null),
      si.memLayout().catch(() => []),
      si.disksIO().catch(() => null),
      si.fsStats().catch(() => null),
      si.cpuTemperature().catch(() => null)
    ]);

    if (!mem) {
      return getDefaultDetails();
    }

    const totalMemGB = mem.total / (1024 * 1024 * 1024);
    const availableGB = mem.available / (1024 * 1024 * 1024);
    const cachedMB = (mem.cached || mem.buffcache || 0) / (1024 * 1024);
    const swapTotalGB = (mem.swaptotal || 0) / (1024 * 1024 * 1024);
    const swapUsedGB = (mem.swapused || 0) / (1024 * 1024 * 1024);
    
    const committedTotal = totalMemGB + swapTotalGB;
    const committedUsed = totalMemGB - availableGB + swapUsedGB;

    let speed = 'Unknown';
    let slots = '0/0';
    let formFactor = 'Unknown';
    let hardwareReserved = 0;

    if (Array.isArray(memLayout) && memLayout.length > 0) {
      const firstMem = memLayout[0];
      if (firstMem.clockSpeed && firstMem.clockSpeed > 0) {
        speed = `${firstMem.clockSpeed} MT/s`;
      }

      const usedSlots = memLayout.length;
      
      if (firstMem.formFactor && firstMem.formFactor !== 'Unknown') {
        formFactor = firstMem.formFactor;
      } else {
        if (firstMem.type && firstMem.type.includes('DDR')) {
          formFactor = firstMem.type.includes('LP') ? 'SODIMM' : 'DIMM';
        } else {
          formFactor = 'DIMM';
        }
      }

      const totalSlots = usedSlots;
      slots = `${usedSlots}/${totalSlots}`;
    }

    if (process.platform === 'win32') {
      hardwareReserved = Math.max(0, totalMemGB - availableGB - (totalMemGB - availableGB) * 0.95);
      hardwareReserved = Math.round(hardwareReserved * 1024) / 1024;
    }

    let pagingPool = 0;
    let nonPagingPool = 0;
    let compressed = 0;
    
    let readSpeedKBps = 0;
    let writeSpeedKBps = 0;
    
    if (fsStats && (fsStats.rx_sec !== undefined || fsStats.wx_sec !== undefined)) {
      const rxBytesPerSec = fsStats.rx_sec || 0;
      const wxBytesPerSec = fsStats.wx_sec || 0;
      
      readSpeedKBps = Math.round((rxBytesPerSec / 1024) * 100) / 100;
      writeSpeedKBps = Math.round((wxBytesPerSec / 1024) * 100) / 100;
    } else if (diskIO) {
      const avgBlockSize = 4096;
      const rIOps = diskIO.rIO_sec || 0;
      const wIOps = diskIO.wIO_sec || 0;
      
      readSpeedKBps = Math.round((rIOps * avgBlockSize / 1024) * 100) / 100;
      writeSpeedKBps = Math.round((wIOps * avgBlockSize / 1024) * 100) / 100;
    }
    
    previousDiskIO = diskIO;
    previousFsStats = fsStats;
    previousTime = currentTime;
    
    let cpuTemperature = null;
    let cpuTempMain = null;
    let cpuTempMax = null;
    let cpuTempCores = [];
    
    if (cpuTemp) {
      cpuTempMain = cpuTemp.main || null;
      cpuTempMax = cpuTemp.max || null;
      if (Array.isArray(cpuTemp.cores) && cpuTemp.cores.length > 0) {
        cpuTempCores = cpuTemp.cores;
      }
      cpuTemperature = {
        main: cpuTempMain,
        max: cpuTempMax,
        cores: cpuTempCores,
      };
    }
    
    return {
      pagingPool,
      nonPagingPool,
      cached: cachedMB,
      committed: {
        used: Math.max(0, committedUsed),
        total: Math.max(0, committedTotal),
      },
      available: Math.max(0, availableGB),
      compressed,
      speed,
      slots,
      formFactor: formFactor !== 'Unknown' ? formFactor : 'DIMM',
      hardwareReserved: Math.max(0, hardwareReserved),
      readSpeed: readSpeedKBps,
      writeSpeed: writeSpeedKBps,
      temperature: cpuTemperature,
    };
  } catch (error) {
    console.error('Error getting memory details:', error);
    return getDefaultDetails();
  }
}

function getDefaultDetails() {
  return {
    pagingPool: 0,
    nonPagingPool: 0,
    cached: 0,
    committed: { used: 0, total: 0 },
    available: 0,
    compressed: 0,
    speed: 'Unknown',
    slots: '0/0',
    formFactor: 'Unknown',
    hardwareReserved: 0,
    readSpeed: 0,
    writeSpeed: 0,
    temperature: null,
  };
}

module.exports = {
  getMemoryDetails,
};