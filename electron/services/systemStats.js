// @systemStats.js (1-20)
// 날짜: 2025-06-16
// Import 모듈 설명:
// - os: 운영체제 정보 제공. os.cpus(), os.uptime() 등으로 시스템 정보 조회
//   사용 예: os.cpus() - CPU 정보 배열, os.uptime() - 시스템 가동 시간(초)
// - child_process (exec): 시스템 명령어 실행. 시스템 통계 조회 명령어 실행에 사용
// - util: 유틸리티 함수 제공. util.promisify()로 콜백 기반 함수를 Promise로 변환
// - networkStats (networkStatsService): 네트워크 통계 서비스. getNetworkAdapterStats() 등으로 네트워크 통계 조회
// - gpuStats (gpuStatsService): GPU 통계 서비스. getGPUStats() 등으로 GPU 통계 조회
// - memoryDetails (memoryDetailsService): 메모리 상세 정보 서비스. getMemoryDetails()로 메모리 상세 정보 조회
// - networkAdapterInfo (networkAdapterInfoService): 네트워크 어댑터 정보 서비스. 어댑터 정보 조회
// - diskDetails (diskDetailsService): 디스크 상세 정보 서비스. getDiskDetails()로 디스크 정보 조회
// - platform (platformService): 플랫폼별 기능 제공. 플랫폼 정보 조회 등
// - cache (cacheService): 캐시 서비스. getDynamicCache()로 동적 데이터 캐싱
// 변수 설명:
//   - previousCpuTimes: 이전 CPU 시간 정보를 저장하는 변수 (CPU 사용률 계산용)
//   - systemStartTime: 시스템 시작 시간을 저장하는 변수 (가동 시간 계산용)

const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const networkStatsService = require('./networkStats');
const gpuStatsService = require('./gpuStats');
const memoryDetailsService = require('./memoryDetails');
const networkAdapterInfoService = require('./networkAdapterInfo');
const diskDetailsService = require('./diskDetails');
const platformService = require('./platform');
const cacheService = require('./cache');

let previousCpuTimes = null;
let systemStartTime = null;

function getSystemUptime() {
  if (!systemStartTime) {
    systemStartTime = Date.now() - (os.uptime() * 1000);
  }
  const uptimeMs = Date.now() - systemStartTime;
  const days = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((uptimeMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((uptimeMs % (60 * 1000)) / 1000);
  return `${days}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

async function getCPUUsage() {
  return new Promise((resolve) => {
    // 동적 데이터 캐시 확인 (매우 짧은 시간 내 재요청 방지)
    const cached = cacheService.getDynamicCache('cpuUsage');
    if (cached !== null) {
      resolve(cached);
      return;
    }
    
    const cpus = os.cpus();
    
    if (!previousCpuTimes) {
      previousCpuTimes = cpus.map(cpu => ({
        user: cpu.times.user,
        nice: cpu.times.nice,
        sys: cpu.times.sys,
        idle: cpu.times.idle,
        irq: cpu.times.irq,
      }));
      setTimeout(() => getCPUUsage().then(resolve), 1000);
      return;
    }

    const currentTimes = cpus.map(cpu => ({
      user: cpu.times.user,
      nice: cpu.times.nice,
      sys: cpu.times.sys,
      idle: cpu.times.idle,
      irq: cpu.times.irq,
    }));

    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < cpus.length; i++) {
      const prev = previousCpuTimes[i];
      const curr = currentTimes[i];

      const prevIdle = prev.idle + prev.irq;
      const currIdle = curr.idle + curr.irq;

      const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
      const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;

      const idleDiff = currIdle - prevIdle;
      const totalDiff = currTotal - prevTotal;

      totalIdle += idleDiff;
      totalTick += totalDiff;
    }

    let usage = 0;
    if (totalTick > 0) {
      const idlePercent = (totalIdle / totalTick) * 100;
      usage = 100 - idlePercent;
    }

    previousCpuTimes = currentTimes;
    const usageValue = Math.min(100, Math.max(0, Math.round(usage)));
    
    // 동적 데이터 캐시 저장
    cacheService.setDynamicCache('cpuUsage', usageValue);
    
    resolve(usageValue);
  });
}

async function getCPUDetails() {
  return new Promise((resolve) => {
    // 정적 데이터 캐시 확인 (CPU 모델, 코어 수 등은 자주 변하지 않음)
    const cached = cacheService.getStaticCache('cpu');
    if (cached) {
      // 동적 데이터만 업데이트 (uptime)
      resolve({
        ...cached,
        uptime: getSystemUptime(),
      });
      return;
    }
    
    if (process.platform === 'win32') {
      // Get basic CPU info (사용자 제공 명령어 기반)
      exec('wmic cpu get name,numberofcores,numberoflogicalprocessors,currentclockspeed,maxclockspeed,addresswidth /format:list', { encoding: 'utf8' }, (error, stdout) => {
        if (error) {
          const cpus = os.cpus();
          resolve({
            model: cpus[0]?.model || 'Unknown CPU',
            speed: `${(cpus[0]?.speed || 0) / 1000} GHz`,
            baseSpeed: `${(cpus[0]?.speed || 0) / 1000} GHz`,
            cores: cpus.length || 0,
            threads: cpus.length || 0,
            sockets: 1,
            virtualization: false,
            l1Cache: '0KB',
            l2Cache: '0MB',
            l3Cache: '0MB',
            processes: 0,
            handles: 0,
            uptime: getSystemUptime(),
          });
          return;
        }

        const lines = stdout.split('\n');
        const data = {};
        lines.forEach(line => {
          const match = line.match(/(\w+)=(.+)/);
          if (match) {
            data[match[1].toLowerCase()] = match[2].trim();
          }
        });

        const cpus = os.cpus();
        const currentSpeed = cpus[0]?.speed || 0;
        const baseSpeed = parseInt(data.maxclockspeed || currentSpeed);
        
        // Get additional CPU info (cache, sockets, virtualization)
        exec('wmic cpu get l2cachesize,l3cachesize,numberofprocessors /format:list', { encoding: 'utf8' }, (err, out) => {
          let l2Cache = '0MB';
          let l3Cache = '0MB';
          let sockets = 1;
          
          if (!err && out) {
            const cacheLines = out.split('\n');
            cacheLines.forEach(line => {
              const match = line.match(/(\w+)=(.+)/);
              if (match) {
                const key = match[1].toLowerCase();
                const value = match[2].trim();
                if (key === 'l2cachesize' && value) {
                  const kb = parseInt(value);
                  if (kb > 0) l2Cache = `${(kb / 1024).toFixed(1)}MB`;
                }
                if (key === 'l3cachesize' && value) {
                  const kb = parseInt(value);
                  if (kb > 0) l3Cache = `${(kb / 1024).toFixed(1)}MB`;
                }
                if (key === 'numberofprocessors' && value) {
                  sockets = parseInt(value) || 1;
                }
              }
            });
          }
          
          // Estimate L1 cache (typically 32KB per core for instruction + 32KB for data)
          const cores = parseInt(data.numberofcores) || cpus.length || 0;
          const l1CacheSize = cores * 64; // Approximate
          const l1Cache = l1CacheSize >= 1024 ? `${(l1CacheSize / 1024).toFixed(1)}MB` : `${l1CacheSize}KB`;
          
          // Check virtualization support
          exec('wmic cpu get virtualizationfirmwareenabled /format:list', { encoding: 'utf8' }, (vErr, vOut) => {
            let virtualization = false;
            if (!vErr && vOut) {
              const vMatch = vOut.match(/VirtualizationFirmwareEnabled=(.+)/i);
              if (vMatch && vMatch[1].trim().toLowerCase() === 'true') {
                virtualization = true;
              }
            }
            
            resolve({
              model: data.name || cpus[0]?.model || 'Unknown CPU',
              speed: `${(currentSpeed / 1000).toFixed(2)} GHz`,
              baseSpeed: `${(baseSpeed / 1000).toFixed(2)} GHz`,
              cores: cores,
              threads: parseInt(data.numberoflogicalprocessors) || cpus.length || 0,
              sockets: sockets,
              virtualization: virtualization,
              l1Cache: l1Cache,
              l2Cache: l2Cache,
              l3Cache: l3Cache,
              processes: 0,
              handles: 0,
              uptime: getSystemUptime(),
            });
          });
        });
      });
    } else if (process.platform === 'linux') {
      // Linux: /proc/cpuinfo와 lscpu 사용
      Promise.all([
        fs.readFile('/proc/cpuinfo', 'utf8').catch(() => ''),
        platformService.executeCommand('lscpu', { timeout: 5000 }).catch(() => ({ success: false, stdout: '' })),
      ]).then(([cpuinfo, lscpuResult]) => {
        const cpus = os.cpus();
        let model = cpus[0]?.model || 'Unknown CPU';
        let cores = cpus.length || 0;
        let threads = cpus.length || 0;
        let sockets = 1;
        let speed = cpus[0]?.speed || 0;
        let l1Cache = '0KB';
        let l2Cache = '0MB';
        let l3Cache = '0MB';
        let virtualization = false;
        
        // /proc/cpuinfo 파싱
        if (cpuinfo) {
          const modelMatch = cpuinfo.match(/model name\s*:\s*(.+)/i);
          if (modelMatch) {
            model = modelMatch[1].trim();
          }
          const physicalCores = (cpuinfo.match(/^processor\s*:/gm) || []).length;
          if (physicalCores > 0) {
            cores = physicalCores;
          }
        }
        
        // lscpu 파싱
        if (lscpuResult.success && lscpuResult.stdout) {
          const lscpu = lscpuResult.stdout;
          const coresMatch = lscpu.match(/^CPU\(s\):\s*(\d+)/im);
          const threadsMatch = lscpu.match(/^Thread\(s\) per core:\s*(\d+)/im);
          const socketsMatch = lscpu.match(/^Socket\(s\):\s*(\d+)/im);
          const mhzMatch = lscpu.match(/^CPU MHz:\s*([\d.]+)/im);
          const l1dMatch = lscpu.match(/^L1d cache:\s*(\d+)\s*([KMGT]?B)/im);
          const l1iMatch = lscpu.match(/^L1i cache:\s*(\d+)\s*([KMGT]?B)/im);
          const l2Match = lscpu.match(/^L2 cache:\s*(\d+)\s*([KMGT]?B)/im);
          const l3Match = lscpu.match(/^L3 cache:\s*(\d+)\s*([KMGT]?B)/im);
          const virtMatch = lscpu.match(/^Virtualization:\s*(\w+)/im);
          
          if (coresMatch) cores = parseInt(coresMatch[1]) || cores;
          if (threadsMatch && socketsMatch) {
            threads = parseInt(coresMatch[1]) * parseInt(threadsMatch[1]) || threads;
            sockets = parseInt(socketsMatch[1]) || sockets;
          }
          if (mhzMatch) speed = parseFloat(mhzMatch[1]) * 1000; // MHz to Hz
          if (l1dMatch && l1iMatch) {
            const l1d = platformService.parseBytes(l1dMatch[1] + l1dMatch[2]);
            const l1i = platformService.parseBytes(l1iMatch[1] + l1iMatch[2]);
            const l1Total = (l1d + l1i) / 1024; // Bytes to KB
            l1Cache = l1Total >= 1024 ? `${(l1Total / 1024).toFixed(1)}MB` : `${l1Total.toFixed(0)}KB`;
          }
          if (l2Match) {
            const l2 = platformService.parseBytes(l2Match[1] + l2Match[2]) / (1024 * 1024);
            l2Cache = `${l2.toFixed(1)}MB`;
          }
          if (l3Match) {
            const l3 = platformService.parseBytes(l3Match[1] + l3Match[2]) / (1024 * 1024);
            l3Cache = `${l3.toFixed(1)}MB`;
          }
          if (virtMatch && virtMatch[1].toLowerCase() !== 'none') {
            virtualization = true;
          }
        }
        
        resolve({
          model: model,
          speed: `${(speed / 1000).toFixed(2)} GHz`,
          baseSpeed: `${(speed / 1000).toFixed(2)} GHz`,
          cores: cores,
          threads: threads,
          sockets: sockets,
          virtualization: virtualization,
          l1Cache: l1Cache,
          l2Cache: l2Cache,
          l3Cache: l3Cache,
          processes: 0,
          handles: 0,
          uptime: getSystemUptime(),
        });
      }).catch(() => {
        const cpus = os.cpus();
        resolve({
          model: cpus[0]?.model || 'Unknown CPU',
          speed: `${(cpus[0]?.speed || 0) / 1000} GHz`,
          baseSpeed: `${(cpus[0]?.speed || 0) / 1000} GHz`,
          cores: cpus.length || 0,
          threads: cpus.length || 0,
          sockets: 1,
          virtualization: false,
          l1Cache: '0KB',
          l2Cache: '0MB',
          l3Cache: '0MB',
          processes: 0,
          handles: 0,
          uptime: getSystemUptime(),
        });
      });
    } else if (process.platform === 'darwin') {
      // macOS: sysctl 사용
      Promise.all([
        platformService.executeCommand('sysctl -n machdep.cpu.brand_string', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n hw.physicalcpu', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n hw.logicalcpu', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n hw.cpufrequency', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n machdep.cpu.core_count', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n machdep.cpu.thread_count', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n machdep.cpu.cache.l1i.size', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n machdep.cpu.cache.l1d.size', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n machdep.cpu.cache.l2.size', { timeout: 5000 }),
        platformService.executeCommand('sysctl -n machdep.cpu.cache.l3.size', { timeout: 5000 }),
      ]).then(([brand, physical, logical, freq, coreCount, threadCount, l1i, l1d, l2, l3]) => {
        const cpus = os.cpus();
        let model = cpus[0]?.model || 'Unknown CPU';
        let cores = cpus.length || 0;
        let threads = cpus.length || 0;
        let speed = cpus[0]?.speed || 0;
        let l1Cache = '0KB';
        let l2Cache = '0MB';
        let l3Cache = '0MB';
        
        if (brand.success && brand.stdout) model = brand.stdout.trim();
        if (physical.success && physical.stdout) cores = parseInt(physical.stdout.trim()) || cores;
        if (logical.success && logical.stdout) threads = parseInt(logical.stdout.trim()) || threads;
        if (freq.success && freq.stdout) speed = parseInt(freq.stdout.trim()) || speed;
        
        if (l1i.success && l1d.success && l1i.stdout && l1d.stdout) {
          const l1iSize = parseInt(l1i.stdout.trim()) || 0;
          const l1dSize = parseInt(l1d.stdout.trim()) || 0;
          const l1Total = (l1iSize + l1dSize) / 1024; // Bytes to KB
          l1Cache = l1Total >= 1024 ? `${(l1Total / 1024).toFixed(1)}MB` : `${l1Total.toFixed(0)}KB`;
        }
        if (l2.success && l2.stdout) {
          const l2Size = parseInt(l2.stdout.trim()) || 0;
          l2Cache = `${(l2Size / (1024 * 1024)).toFixed(1)}MB`;
        }
        if (l3.success && l3.stdout) {
          const l3Size = parseInt(l3.stdout.trim()) || 0;
          l3Cache = `${(l3Size / (1024 * 1024)).toFixed(1)}MB`;
        }
        
        resolve({
          model: model,
          speed: `${(speed / 1000000000).toFixed(2)} GHz`,
          baseSpeed: `${(speed / 1000000000).toFixed(2)} GHz`,
          cores: cores,
          threads: threads,
          sockets: 1,
          virtualization: false,
          l1Cache: l1Cache,
          l2Cache: l2Cache,
          l3Cache: l3Cache,
          processes: 0,
          handles: 0,
          uptime: getSystemUptime(),
        });
      }).catch(() => {
        const cpus = os.cpus();
        resolve({
          model: cpus[0]?.model || 'Unknown CPU',
          speed: `${(cpus[0]?.speed || 0) / 1000} GHz`,
          baseSpeed: `${(cpus[0]?.speed || 0) / 1000} GHz`,
          cores: cpus.length || 0,
          threads: cpus.length || 0,
          sockets: 1,
          virtualization: false,
          l1Cache: '0KB',
          l2Cache: '0MB',
          l3Cache: '0MB',
          processes: 0,
          handles: 0,
          uptime: getSystemUptime(),
        });
      });
    } else {
      const cpus = os.cpus();
      resolve({
        model: cpus[0]?.model || 'Unknown CPU',
        speed: `${(cpus[0]?.speed || 0) / 1000} GHz`,
        baseSpeed: `${(cpus[0]?.speed || 0) / 1000} GHz`,
        cores: cpus.length || 0,
        threads: cpus.length || 0,
        sockets: 1,
        virtualization: false,
        l1Cache: '0KB',
        l2Cache: '0MB',
        l3Cache: '0MB',
        processes: 0,
        handles: 0,
        uptime: getSystemUptime(),
      });
    }
  });
}

async function getProcessCount() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('tasklist /FO CSV /NH', { encoding: 'utf8' }, (error, stdout) => {
        if (error) {
          resolve({ processes: 0, threads: 0, handles: 0 });
          return;
        }
        const lines = stdout.split('\n').filter(line => line.trim());
        exec('wmic process get processid,threadcount,handlecount /format:list', { encoding: 'utf8' }, (err, out) => {
          let threads = 0;
          let handles = 0;
          if (!err) {
            const processLines = out.split(/\n\s*\n/);
            processLines.forEach(proc => {
              const threadMatch = proc.match(/ThreadCount=(\d+)/i);
              const handleMatch = proc.match(/HandleCount=(\d+)/i);
              if (threadMatch) threads += parseInt(threadMatch[1]);
              if (handleMatch) handles += parseInt(handleMatch[1]);
            });
          }
          resolve({
            processes: lines.length,
            threads: threads || lines.length * 10,
            handles: handles || lines.length * 100,
          });
        });
      });
    } else if (process.platform === 'linux') {
      // Linux: /proc/stat과 /proc/[pid]/stat 사용
      Promise.all([
        fs.readFile('/proc/stat', 'utf8').catch(() => ''),
        platformService.executeCommand('ps aux | wc -l', { timeout: 5000 }),
        platformService.executeCommand('ps -eLf | wc -l', { timeout: 5000 }),
      ]).then(([stat, psResult, threadResult]) => {
        let processes = 0;
        let threads = 0;
        
        if (psResult.success && psResult.stdout) {
          processes = parseInt(psResult.stdout.trim()) - 1 || 0; // wc -l includes header
        }
        if (threadResult.success && threadResult.stdout) {
          threads = parseInt(threadResult.stdout.trim()) - 1 || 0;
        }
        
        resolve({
          processes: processes,
          threads: threads,
          handles: 0, // Linux doesn't have handles concept
        });
      }).catch(() => {
        resolve({ processes: 0, threads: 0, handles: 0 });
      });
    } else if (process.platform === 'darwin') {
      // macOS: ps와 top 사용
      Promise.all([
        platformService.executeCommand('ps aux | wc -l', { timeout: 5000 }),
        platformService.executeCommand('ps -M | wc -l', { timeout: 5000 }),
      ]).then(([psResult, threadResult]) => {
        let processes = 0;
        let threads = 0;
        
        if (psResult.success && psResult.stdout) {
          processes = parseInt(psResult.stdout.trim()) - 1 || 0;
        }
        if (threadResult.success && threadResult.stdout) {
          threads = parseInt(threadResult.stdout.trim()) - 1 || 0;
        }
        
        resolve({
          processes: processes,
          threads: threads,
          handles: 0, // macOS doesn't have handles concept
        });
      }).catch(() => {
        resolve({ processes: 0, threads: 0, handles: 0 });
      });
    } else {
      resolve({ processes: 0, threads: 0, handles: 0 });
    }
  });
}

async function getMemoryUsage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = Math.floor((usedMemory / totalMemory) * 100);

  const details = await memoryDetailsService.getMemoryDetails();

  return {
    usage: usagePercent,
    total: Math.floor(totalMemory / (1024 * 1024 * 1024) * 10) / 10,
    used: Math.floor(usedMemory / (1024 * 1024 * 1024) * 10) / 10,
    free: Math.floor(freeMemory / (1024 * 1024 * 1024) * 10) / 10,
    available: details.available,
    cached: details.cached / 1024, // MB to GB
    committed: details.committed,
    pagingPool: details.pagingPool,
    nonPagingPool: details.nonPagingPool,
    compressed: details.compressed, // Keep in MB
    speed: details.speed,
    slots: details.slots,
    formFactor: details.formFactor,
    hardwareReserved: details.hardwareReserved,
    unit: 'GB',
  };
}

async function getDiskUsage() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('wmic logicaldisk get size,freespace,caption,volumename,filesystem,description /format:list', { encoding: 'utf8' }, (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }

        const disks = [];
        const sections = stdout.split(/\n\s*\n/).filter(s => s.trim());
        
        // 비동기로 각 디스크의 상세 정보 가져오기
        const processDisks = async () => {
          for (const section of sections) {
            const lines = section.split('\n');
            const data = {};
            lines.forEach(line => {
              const match = line.match(/(\w+)=(.+)/);
              if (match) {
                data[match[1].toLowerCase()] = match[2].trim();
              }
            });

            if (data.caption) {
              const totalSpace = parseInt(data.size) || 0;
              const freeSpace = parseInt(data.freespace) || 0;
              const usedSpace = totalSpace - freeSpace;
              const usagePercent = totalSpace > 0 ? Math.floor((usedSpace / totalSpace) * 100) : 0;
              
              // 디스크 상세 정보 가져오기 (타입 포함)
              const diskDetails = await diskDetailsService.getDiskDetails(data.caption);
              
              disks.push({
                letter: data.caption,
                usage: usagePercent,
                total: Math.floor(totalSpace / (1024 * 1024 * 1024)),
                used: Math.floor(usedSpace / (1024 * 1024 * 1024)),
                free: Math.floor(freeSpace / (1024 * 1024 * 1024)),
                type: diskDetails.type || 'Unknown',
                name: `디스크 ${disks.length} (${data.caption})`,
                formatted: Math.floor(totalSpace / (1024 * 1024 * 1024)),
                systemDisk: data.caption === 'C:',
                // diskDetails의 모든 값 포함
                ...diskDetails,
              });
            }
          }
          
          // 모든 디스크 처리 완료 후 resolve
          resolve(disks.length > 0 ? disks : [{
            letter: 'C:',
            usage: 0,
            total: 0,
            used: 0,
            free: 0,
            type: 'Unknown',
            name: '디스크 0 (C:)',
            formatted: 0,
            systemDisk: true,
            model: 'Unknown',
            activeTime: 0,
            readSpeed: 0,
            writeSpeed: 0,
            responseTime: 0,
            pageFile: false,
          }]);
        };
        
        // 비동기 처리 시작
        processDisks().catch((error) => {
          console.error('Error processing disks:', error);
          resolve([{
            letter: 'C:',
            usage: 0,
            total: 0,
            used: 0,
            free: 0,
            type: 'Unknown',
            name: '디스크 0 (C:)',
            formatted: 0,
            systemDisk: true,
            model: 'Unknown',
            activeTime: 0,
            readSpeed: 0,
            writeSpeed: 0,
            responseTime: 0,
            pageFile: false,
          }]);
        });
      });
    } else {
      resolve([{
        letter: '/',
        usage: 0,
        total: 0,
        used: 0,
        free: 0,
        type: 'Unknown',
        name: 'Root',
      }]);
    }
  });
}

async function getGPUUsage() {
  try {
    const gpus = await gpuStatsService.getDetailedGPUInfo();
    return gpus;
  } catch (error) {
    console.error('Error getting GPU info:', error);
    return [{ usage: 0, model: 'Unknown GPU', name: 'GPU 0' }];
  }
}

async function getNetworkStats() {
  return new Promise(async (resolve) => {
    try {
      const adapterStats = await networkStatsService.getNetworkAdapterStats();
      const wifiInfo = await networkStatsService.getWiFiInfo();
      
      const ethernet = adapterStats.ethernet || { 
        sendMB: 0, 
        receiveMB: 0, 
        name: '이더넷',
        adapterName: 'Unknown',
        ipv4: '0.0.0.0',
        ipv6: '::',
      };
      
      const wifi = adapterStats.wifi || { 
        sendMB: 0, 
        receiveMB: 0, 
        name: 'Wi-Fi',
        adapterName: 'Unknown',
        ipv4: '0.0.0.0',
        ipv6: '::',
      };
      
      // WiFi 정보 추가
      if (wifiInfo) {
        wifi.ssid = wifiInfo.ssid || 'Unknown';
        wifi.signalStrength = wifiInfo.signalStrength || 0;
      }
      
      resolve({ ethernet, wifi });
    } catch (error) {
      console.error('Error getting network stats:', error);
      resolve({
        ethernet: { sendMB: 0, receiveMB: 0, name: '이더넷', adapterName: 'Unknown', ipv4: '0.0.0.0', ipv6: '::' },
        wifi: { sendMB: 0, receiveMB: 0, name: 'Wi-Fi', adapterName: 'Unknown', ipv4: '0.0.0.0', ipv6: '::', ssid: 'Unknown', signalStrength: 0 },
      });
    }
  });
}

async function getAllStats(options = {}) {
  try {
    const { skipStatic = false } = options;
    
    // 정적 데이터는 캐시에서 가져오기 (skipStatic이 false일 때만)
    let cachedCPUDetails = null;
    let cachedMemory = null;
    let cachedDisk = null;
    let cachedGPU = null;
    let cachedNetwork = null;
    
    if (!skipStatic) {
      cachedCPUDetails = cacheService.getStaticCache('cpu');
      cachedMemory = cacheService.getStaticCache('memory');
      cachedDisk = cacheService.getStaticCache('disk');
      cachedGPU = cacheService.getStaticCache('gpu');
      cachedNetwork = cacheService.getStaticCache('network');
    }
    
    // 병렬로 모든 데이터 수집 (타임아웃 방지를 위해 각각 최대 15초 대기, 에러 시 기본값 반환)
    const timeout = 15000;
    const defaultCPUDetails = { model: 'Unknown CPU', speed: '0 GHz', baseSpeed: '0 GHz', cores: 0, threads: 0, sockets: 1, virtualization: false, l1Cache: '0KB', l2Cache: '0MB', l3Cache: '0MB', processes: 0, handles: 0, uptime: '0:0:0:0' };
    const defaultProcessInfo = { processes: 0, threads: 0, handles: 0 };
    const defaultMemory = { usage: 0, total: 0, used: 0, free: 0, available: 0, cached: 0, committed: { used: 0, total: 0 }, pagingPool: 0, nonPagingPool: 0, compressed: 0, speed: 'Unknown', slots: '0/0', formFactor: 'Unknown', hardwareReserved: 0, unit: 'GB' };
    const defaultDisk = process.platform === 'win32' 
      ? [{ letter: 'C:', usage: 0, total: 0, used: 0, free: 0, type: 'Unknown', name: '디스크 0 (C:)', formatted: 0, systemDisk: true, model: 'Unknown', activeTime: 0, readSpeed: 0, writeSpeed: 0, responseTime: 0, pageFile: false }]
      : [{ letter: '/', usage: 0, total: 0, used: 0, free: 0, type: 'Unknown', name: 'Root', formatted: 0, systemDisk: true, model: 'Unknown', activeTime: 0, readSpeed: 0, writeSpeed: 0, responseTime: 0, pageFile: false }];
    const defaultGPU = [{ usage: 0, model: 'Unknown GPU', name: 'GPU 0', gpuMemory: '0/0GB', sharedGpuMemory: '0/0GB', driverVersion: 'Unknown', driverDate: 'Unknown', directXVersion: 'Unknown', physicalLocation: 'Unknown' }];
    const defaultNetwork = { ethernet: { send: 0, receive: 0, unit: 'KB', name: '이더넷', adapterName: 'Unknown', connectionType: 'Ethernet', ipv4: '0.0.0.0', ipv6: '::' }, wifi: { send: 0, receive: 0, unit: 'KB', name: 'Wi-Fi', adapterName: 'Unknown', connectionType: '802.11', ipv4: '0.0.0.0', ipv6: '::', ssid: 'Unknown', signalStrength: 0 } };
    
    // 정적 데이터가 캐시에 있으면 그것을 사용하고, 동적 데이터만 업데이트
    const [cpuUsage, cpuDetails, processInfo, memory, disk, gpu, network] = await Promise.all([
      // 동적 데이터: 항상 업데이트
      Promise.race([getCPUUsage(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))]).catch((err) => { 
        if (err.message !== 'Timeout') console.error('CPU Usage error:', err.message); 
        return 0; 
      }),
      // 정적 데이터: 캐시가 있으면 사용, 없으면 가져오기
      cachedCPUDetails ? Promise.resolve(cachedCPUDetails) : Promise.race([getCPUDetails(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))]).catch((err) => { 
        if (err.message !== 'Timeout') console.error('CPU Details error:', err.message); 
        return defaultCPUDetails; 
      }),
      // 동적 데이터: 항상 업데이트
      Promise.race([getProcessCount(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))]).catch((err) => { 
        if (err.message !== 'Timeout') console.error('Process Count error:', err.message); 
        return defaultProcessInfo; 
      }),
      // 메모리: 정적 데이터(speed, slots, formFactor)는 캐시에서, 동적 데이터는 새로 가져오기
      Promise.race([getMemoryUsage(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))]).then((mem) => {
        if (cachedMemory) {
          // 정적 데이터는 캐시에서, 동적 데이터는 새로 가져온 것 사용
          return { ...cachedMemory, ...mem, speed: cachedMemory.speed, slots: cachedMemory.slots, formFactor: cachedMemory.formFactor };
        }
        return mem;
      }).catch((err) => { 
        if (err.message !== 'Timeout') console.error('Memory Usage error:', err.message); 
        return cachedMemory || defaultMemory; 
      }),
      // 디스크: 정적 데이터(model, type)는 캐시에서, 동적 데이터(activeTime, readSpeed, writeSpeed)는 항상 새로 가져오기
      Promise.race([getDiskUsage(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout + 5000))]).then((dsk) => {
        if (cachedDisk && Array.isArray(dsk) && Array.isArray(cachedDisk)) {
          // 각 디스크별로 정적 데이터는 캐시에서, 동적 데이터는 새로 가져온 것 사용
          return dsk.map((d, i) => {
            const cached = cachedDisk.find(c => c.letter === d.letter);
            if (cached) {
              return { 
                ...cached, 
                ...d, 
                model: cached.model, 
                type: cached.type, 
                name: cached.name,
                usage: d.usage !== undefined ? d.usage : cached.usage,
                total: d.total !== undefined ? d.total : cached.total,
                used: d.used !== undefined ? d.used : cached.used,
                free: d.free !== undefined ? d.free : cached.free,
                activeTime: d.activeTime !== undefined && d.activeTime !== null ? d.activeTime : 0,
                readSpeed: d.readSpeed !== undefined && d.readSpeed !== null ? d.readSpeed : 0,
                writeSpeed: d.writeSpeed !== undefined && d.writeSpeed !== null ? d.writeSpeed : 0,
                responseTime: d.responseTime !== undefined && d.responseTime !== null ? d.responseTime : 0,
              };
            }
            return d;
          });
        }
        return dsk;
      }).catch((err) => { 
        if (err.message !== 'Timeout') console.error('Disk Usage error:', err.message); 
        return cachedDisk || defaultDisk; 
      }),
      // GPU: 정적 데이터(model, driverVersion 등)는 캐시에서, 동적 데이터는 새로 가져오기
      Promise.race([getGPUUsage(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))]).then((gpuData) => {
        if (cachedGPU && Array.isArray(gpuData) && Array.isArray(cachedGPU)) {
          return gpuData.map((g, i) => {
            const cached = cachedGPU[i];
            if (cached) {
              return { ...cached, ...g, model: cached.model, driverVersion: cached.driverVersion, driverDate: cached.driverDate, directXVersion: cached.directXVersion, physicalLocation: cached.physicalLocation };
            }
            return g;
          });
        }
        return gpuData;
      }).catch((err) => { 
        if (err.message !== 'Timeout') console.error('GPU Usage error:', err.message); 
        return cachedGPU || defaultGPU; 
      }),
      // 네트워크: 정적 데이터(adapterName, connectionType 등)는 캐시에서, 동적 데이터는 새로 가져오기
      Promise.race([getNetworkStats(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))]).then((net) => {
        if (cachedNetwork) {
          return {
            ethernet: { ...cachedNetwork.ethernet, ...net.ethernet, adapterName: cachedNetwork.ethernet?.adapterName, ipv4: cachedNetwork.ethernet?.ipv4, ipv6: cachedNetwork.ethernet?.ipv6 },
            wifi: { ...cachedNetwork.wifi, ...net.wifi, adapterName: cachedNetwork.wifi?.adapterName, ipv4: cachedNetwork.wifi?.ipv4, ipv6: cachedNetwork.wifi?.ipv6, ssid: cachedNetwork.wifi?.ssid, signalStrength: cachedNetwork.wifi?.signalStrength },
          };
        }
        return net;
      }).catch((err) => { 
        if (err.message !== 'Timeout') console.error('Network Stats error:', err.message); 
        return cachedNetwork || defaultNetwork; 
      }),
    ]);

    const result = {
      cpu: {
        usage: cpuUsage || 0,
        name: 'CPU',
        speed: cpuDetails?.speed || '0 GHz',
        baseSpeed: cpuDetails?.baseSpeed || '0 GHz',
        model: cpuDetails?.model || 'Unknown CPU',
        cores: cpuDetails?.cores || 0,
        threads: cpuDetails?.threads || 0,
        sockets: cpuDetails?.sockets || 1,
        virtualization: cpuDetails?.virtualization || false,
        l1Cache: cpuDetails?.l1Cache || '0KB',
        l2Cache: cpuDetails?.l2Cache || '0MB',
        l3Cache: cpuDetails?.l3Cache || '0MB',
        processes: processInfo?.processes || 0,
        handles: processInfo?.handles || 0,
        uptime: cpuDetails?.uptime || '0:0:0:0',
      },
      memory: {
        usage: memory?.usage || 0,
        name: '메모리',
        total: memory?.total || 0,
        used: memory?.used || 0,
        free: memory?.free || 0,
        available: memory?.available || 0,
        cached: memory?.cached || 0,
        committed: memory?.committed || { used: 0, total: 0 },
        pagingPool: memory?.pagingPool || 0,
        nonPagingPool: memory?.nonPagingPool || 0,
        compressed: memory?.compressed || 0,
        speed: memory?.speed || 'Unknown',
        slots: memory?.slots || '0/0',
        formFactor: memory?.formFactor || 'Unknown',
        hardwareReserved: memory?.hardwareReserved || 0,
        unit: 'GB',
      },
      disk: Array.isArray(disk) ? disk : (disk ? [disk] : []),
      gpu: Array.isArray(gpu) ? gpu.map(g => {
        // sharedGpuMemory 문자열 파싱 (예: "1.5/7.8GB")
        const sharedMemMatch = (g.sharedGpuMemory || '0/0GB').match(/([\d.]+)\/([\d.]+)GB/);
        const sharedMemoryUsed = sharedMemMatch ? parseFloat(sharedMemMatch[1]) : 0;
        const sharedMemoryTotal = sharedMemMatch ? parseFloat(sharedMemMatch[2]) : 0;
        
        return {
          ...g,
          usage3D: g.usage3D || 0,
          usageCopy: g.usageCopy || 0,
          usageVideoDecode: g.usageVideoDecode || 0,
          usageVideoProcessing: g.usageVideoProcessing || 0,
          sharedGpuMemory: g.sharedGpuMemory || '0/0GB',
          sharedMemoryUsed: g.sharedMemoryUsed !== undefined ? g.sharedMemoryUsed : sharedMemoryUsed,
          sharedMemoryTotal: g.sharedMemoryTotal !== undefined ? g.sharedMemoryTotal : sharedMemoryTotal,
          directXVersion: g.directXVersion || 'Unknown',
          physicalLocation: g.physicalLocation || 'Unknown',
          vramUsed: g.vramUsed || 0,
          vramUsedPercent: g.vramUsedPercent || 0,
        };
      }) : (gpu ? (() => {
        const sharedMemMatch = (gpu.sharedGpuMemory || '0/0GB').match(/([\d.]+)\/([\d.]+)GB/);
        const sharedMemoryUsed = sharedMemMatch ? parseFloat(sharedMemMatch[1]) : 0;
        const sharedMemoryTotal = sharedMemMatch ? parseFloat(sharedMemMatch[2]) : 0;
        
        return [{
          ...gpu,
          usage3D: gpu.usage3D || 0,
          usageCopy: gpu.usageCopy || 0,
          usageVideoDecode: gpu.usageVideoDecode || 0,
          usageVideoProcessing: gpu.usageVideoProcessing || 0,
          sharedGpuMemory: gpu.sharedGpuMemory || '0/0GB',
          sharedMemoryUsed: gpu.sharedMemoryUsed !== undefined ? gpu.sharedMemoryUsed : sharedMemoryUsed,
          sharedMemoryTotal: gpu.sharedMemoryTotal !== undefined ? gpu.sharedMemoryTotal : sharedMemoryTotal,
          directXVersion: gpu.directXVersion || 'Unknown',
          physicalLocation: gpu.physicalLocation || 'Unknown',
          vramUsed: gpu.vramUsed || 0,
          vramUsedPercent: gpu.vramUsedPercent || 0,
        }];
      })() : []),
      ethernet: network?.ethernet || { sendMB: 0, receiveMB: 0, name: '이더넷', adapterName: 'Unknown', ipv4: '0.0.0.0', ipv6: '::' },
      wifi: network?.wifi || { sendMB: 0, receiveMB: 0, name: 'Wi-Fi', adapterName: 'Unknown', ipv4: '0.0.0.0', ipv6: '::' },
    };
    
    // 정적 데이터를 캐시에 저장 (첫 호출이거나 캐시가 없을 때만)
    if (!cachedCPUDetails) {
      cacheService.setStaticCache('cpu', cpuDetails);
    }
    if (!cachedMemory) {
      const staticMemory = { speed: memory?.speed, slots: memory?.slots, formFactor: memory?.formFactor };
      cacheService.setStaticCache('memory', staticMemory);
    }
    if (!cachedDisk) {
      const staticDisk = Array.isArray(disk) ? disk.map(d => ({ 
        letter: d.letter, 
        model: d.model, 
        type: d.type, 
        name: d.name 
      })) : [];
      cacheService.setStaticCache('disk', staticDisk);
    }
    if (!cachedGPU) {
      const staticGPU = Array.isArray(gpu) ? gpu.map(g => ({ model: g.model, driverVersion: g.driverVersion, driverDate: g.driverDate, directXVersion: g.directXVersion, physicalLocation: g.physicalLocation })) : [];
      cacheService.setStaticCache('gpu', staticGPU);
    }
    if (!cachedNetwork) {
      const staticNetwork = {
        ethernet: { adapterName: network?.ethernet?.adapterName, ipv4: network?.ethernet?.ipv4, ipv6: network?.ethernet?.ipv6 },
        wifi: { adapterName: network?.wifi?.adapterName, ipv4: network?.wifi?.ipv4, ipv6: network?.wifi?.ipv6, ssid: network?.wifi?.ssid, signalStrength: network?.wifi?.signalStrength },
      };
      cacheService.setStaticCache('network', staticNetwork);
    }
    
    return result;
  } catch (error) {
    console.error('Error getting system stats:', error);
    return {
      cpu: { usage: 0, name: 'CPU', speed: '0 GHz', model: 'Unknown CPU', cores: 0, threads: 0, processes: 0, handles: 0, uptime: '0:0:0:0' },
      memory: { usage: 0, name: '메모리', total: 0, used: 0, free: 0, available: 0, cached: 0, committed: { used: 0, total: 0 }, pagingPool: 0, nonPagingPool: 0, compressed: 0, speed: 'Unknown', slots: '0/0', formFactor: 'Unknown', hardwareReserved: 0, unit: 'GB' },
      disk: [{ letter: 'C:', usage: 0, total: 0, used: 0, free: 0, type: 'Unknown', name: '디스크 0 (C:)', formatted: 0, systemDisk: true, model: 'Unknown', activeTime: 0, readSpeed: 0, writeSpeed: 0, responseTime: 0, pageFile: false }],
      gpu: [{ usage: 0, model: 'Unknown GPU', name: 'GPU 0' }],
      ethernet: { sendMB: 0, receiveMB: 0, name: '이더넷', adapterName: 'Unknown', ipv4: '0.0.0.0', ipv6: '::' },
      wifi: { sendMB: 0, receiveMB: 0, name: 'Wi-Fi', adapterName: 'Unknown', ipv4: '0.0.0.0', ipv6: '::' },
    };
  }
}

module.exports = {
  getAllStats,
  getCPUUsage,
  getMemoryUsage,
  getDiskUsage,
  getGPUUsage,
  getNetworkStats,
};
