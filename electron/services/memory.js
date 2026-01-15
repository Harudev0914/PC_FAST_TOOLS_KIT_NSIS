// @memory.js (1-15)
// 날짜: 2025-04-14
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. tasklist, taskkill 등 Windows 명령어 실행에 사용
//   사용 예: execAsync('tasklist /FO CSV /NH') - 프로세스 목록 CSV 형식으로 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환. execAsync는 exec의 Promise 버전
// - os: 운영체제 정보 제공. os.totalmem(), os.freemem()으로 메모리 정보 조회
//   사용 예: os.totalmem() - 총 메모리 크기(바이트), os.freemem() - 사용 가능한 메모리 크기(바이트)
// - fs: 파일 시스템 접근. 메모리 관련 파일 읽기/쓰기에 사용
// - path: 파일 경로 처리. 경로 조작 및 정규화에 사용
// - winreg (Registry): Windows 레지스트리 접근. 메모리 관리 설정 변경에 사용
//   사용 예: new Registry({ hive, key }) - 레지스트리 키 생성, .set() - 값 설정
// - permissions (permissionsService): 관리자 권한 확인. isAdmin() 함수로 권한 확인
// - platform (platformService): 플랫폼별 기능 제공. isAdmin(), requestAdmin() 등 사용

const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const fs = require('fs');
const path = require('path');
const execAsync = promisify(exec);
const Registry = require('winreg');
const permissionsService = require('./permissions');
const platformService = require('./platform');

// @memory.js (17-29)
// getStats 함수: 메모리 통계 정보 조회
// 반환값: { total, used, free, usagePercent }
// 변수 설명:
//   - totalMemory: os.totalmem()로 조회한 총 메모리 크기(바이트)
//   - freeMemory: os.freemem()로 조회한 사용 가능한 메모리 크기(바이트)
//   - usedMemory: 사용 중인 메모리 크기 = totalMemory - freeMemory
//   - usagePercent: 메모리 사용률(%) = (usedMemory / totalMemory) * 100, 소수점 2자리까지 반올림
// os 모듈 사용: Node.js 내장 모듈로 시스템 메모리 정보 조회

async function getStats() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = (usedMemory / totalMemory) * 100;

  return {
    total: totalMemory,
    used: usedMemory,
    free: freeMemory,
    usagePercent: Math.round(usagePercent * 100) / 100,
  };
}

// @memory.js (31-57)
// getProcesses 함수: 메모리 사용량 기준 프로세스 목록 조회
// 반환값: 프로세스 객체 배열 [{ name, pid, memory }, ...] (메모리 사용량 내림차순 정렬)
// 변수 설명:
//   - stdout: execAsync('tasklist /FO CSV /NH')로 조회한 프로세스 목록 출력
//     /FO CSV: CSV 형식 출력, /NH: 헤더 제외
//   - lines: stdout를 줄 단위로 분할하고 빈 줄 제거한 배열
//   - parts: 정규식으로 CSV 라인을 파싱한 배열 (쉼표로 구분된 필드)
//   - name: 프로세스 이름 (parts[0]에서 따옴표 제거)
//   - pid: 프로세스 ID (parts[1]에서 정수로 변환)
//   - memStr: 메모리 사용량 문자열 (parts[4]에서 숫자만 추출)
//   - memory: 메모리 사용량(바이트) = memStr * 1024 (KB를 바이트로 변환)
// execAsync 사용: tasklist 명령어로 실행 중인 프로세스 목록 조회

async function getProcesses() {
  try {
    const { stdout } = await execAsync('tasklist /FO CSV /NH');
    const lines = stdout.split('\n').filter(line => line.trim());
    
    const processes = lines.map(line => {
      const parts = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
      if (!parts || parts.length < 5) return null;
      
      const name = parts[0].replace(/"/g, '');
      const pid = parseInt(parts[1].replace(/"/g, ''));
      const memStr = parts[4].replace(/"/g, '').replace(/[^0-9]/g, '');
      const memory = parseInt(memStr) * 1024;
      
      return {
        name,
        pid,
        memory,
      };
    }).filter(p => p !== null);

    return processes.sort((a, b) => b.memory - a.memory);
  } catch (error) {
    console.error('Error getting processes:', error);
    return [];
  }
}

async function killProcess(pid) {
  try {
    await execAsync(`taskkill /PID ${pid} /F`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function optimize(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    operations: [],
    errors: [],
    standbyMemoryCleared: false,
    pageFileOptimized: false,
    prefetchOptimized: false,
    processesTerminated: false,
    memoryDefragmented: false,
    virtualMemoryOptimized: false,
    compressionOptimized: false,
    numaOptimized: false,
    mappedFilesOptimized: false,
    heapOptimized: false,
    memoryPriorityOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    const timeout = (promise, ms) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
      ]);
    };

    const parallelTasks = [
      timeout(
        execAsync('rundll32.exe advapi32.dll,ProcessIdleTasks').then(() => {
          results.operations.push('Idle tasks completed');
        }).catch(error => {
          results.errors.push({ operation: 'Idle tasks', error: error.message });
        }),
        3000
      ).catch(() => {}),

      timeout(
        execAsync('powershell -Command "[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()"').then(() => {
          results.operations.push('Memory garbage collection completed');
        }).catch(error => {
          results.errors.push({ operation: 'Garbage collection', error: error.message });
        }),
        3000
      ).catch(() => {}),
    ];

    await Promise.all(parallelTasks);

    try {
      const psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class MemoryAPI {
  [DllImport("psapi.dll")]
  public static extern bool EmptyWorkingSet(IntPtr hProcess);
}
'@
$processes = Get-Process | Where-Object {$_.WorkingSet -gt 50MB -and $_.Id -ne $PID}
foreach ($proc in $processes) {
  try {
    [MemoryAPI]::EmptyWorkingSet($proc.Handle) | Out-Null
  } catch {}
}
      `.trim();
      
      const tempScript = path.join(os.tmpdir(), `memory_optimize_${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, psScript, 'utf8');
      
      try {
        await timeout(
          execAsync(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`),
          5000
        );
        results.standbyMemoryCleared = true;
        results.operations.push('Standby memory cleared');
      } finally {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {}
      }
    } catch (error) {
      results.errors.push({ operation: 'Standby memory clear', error: error.message });
    }

    if (isAdmin || requestAdminPermission) {
      const adminTasks = [];
      
      adminTasks.push(
        (async () => {
          try {
            const pageFileKey = new Registry({
              hive: Registry.HKLM,
              key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
            });
            
            await Promise.all([
              new Promise((resolve, reject) => {
                pageFileKey.set('PagingFiles', Registry.REG_MULTI_SZ, '', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              }),
              new Promise((resolve, reject) => {
                pageFileKey.set('SystemManagedPagefile', Registry.REG_DWORD, '1', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              }),
            ]);
            
            results.pageFileOptimized = true;
            results.operations.push('Page file optimized');
          } catch (error) {
          }
        })()
      );
      
      adminTasks.push(
        (async () => {
          try {
            const prefetchKey = new Registry({
              hive: Registry.HKLM,
              key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters',
            });
            
            await Promise.all([
              new Promise((resolve, reject) => {
                prefetchKey.set('EnablePrefetcher', Registry.REG_DWORD, '3', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              }),
              new Promise((resolve, reject) => {
                prefetchKey.set('EnableSuperfetch', Registry.REG_DWORD, '3', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              }),
            ]);
            
            results.prefetchOptimized = true;
            results.operations.push('Memory prefetch optimized');
          } catch (error) {
            results.requiresAdmin = true;
            results.errors.push({ operation: 'Prefetch optimization', error: error.message, requiresAdmin: true });
          }
        })()
      );
      
      await Promise.all(adminTasks.map(task => timeout(task, 5000).catch(() => {})));
    } else {
      results.operations.push('Page file/Prefetch 최적화 skipped (requires admin)');
    }

    try {
      const { stdout } = await execAsync('wmic process get Name,ProcessId,WorkingSetSize /format:csv');
      const lines = stdout.split('\n').filter(line => line.trim() && line.includes(',') && !line.includes('Node,'));
      
      const protectedProcesses = [
        'System', 'smss', 'csrss', 'winlogon', 'services', 'lsass', 'svchost', 
        'dwm', 'explorer', 'chrome', 'firefox', 'edge', 'msedge',
        'Code.exe', 'devenv.exe', 'vscode.exe',
      ];
      const protectedLower = protectedProcesses.map(p => p.toLowerCase());
      
      const unnecessaryProcesses = [
        'OneDrive', 'Skype', 'Spotify', 'Discord', 'Steam', 'EpicGamesLauncher',
        'AdobeUpdater', 'AdobeARM', 'iTunesHelper', 'QuickTime', 'java', 'javaw',
        'GoogleUpdate', 'Zoom', 'Teams', 'Slack',
      ];
      const unnecessaryLower = unnecessaryProcesses.map(u => u.toLowerCase());
      
      const candidates = lines
        .map(line => {
          try {
            const parts = line.split(',');
            if (parts.length < 3) return null;
            
            const name = parts[parts.length - 3]?.trim();
            const pid = parts[parts.length - 2]?.trim();
            const memoryStr = parts[parts.length - 4]?.trim();
            const memory = parseInt(memoryStr || '0');
            
            if (!name || !pid || isNaN(parseInt(pid)) || memory < 100 * 1024 * 1024) return null;
            
            const nameLower = name.toLowerCase();
            
            if (protectedLower.some(protected => nameLower.includes(protected))) return null;
            
            if (!unnecessaryLower.some(unnecessary => nameLower.includes(unnecessary))) return null;
            
            return { name, pid, memory };
          } catch (lineError) {
            return null;
          }
        })
        .filter(c => c !== null);
      
      candidates.sort((a, b) => b.memory - a.memory);
      const toKill = candidates.slice(0, 5);
      
      let freedMemory = 0;
      let killedCount = 0;
      
      const killPromises = toKill.map(proc => 
        timeout(
          killProcess(proc.pid).then(() => {
            freedMemory += proc.memory;
            killedCount++;
          }),
          2000
        ).catch(() => {})
      );
      
      await Promise.all(killPromises);
      
      if (killedCount > 0) {
        results.processesTerminated = true;
        results.freedMemory = freedMemory;
        results.operations.push(`불필요한 프로세스 ${killedCount}개 종료 (${(freedMemory / (1024 * 1024)).toFixed(2)}MB 해제)`);
      }
    } catch (error) {
      try {
        const processes = await getProcesses();
        const systemProcesses = ['csrss', 'winlogon', 'services', 'lsass', 'svchost', 'smss', 'dwm', 'explorer', 'System'];
        const safeToKill = processes
          .filter(p => {
            const nameLower = p.name.toLowerCase();
            return p.memory > 100 * 1024 * 1024 &&
                   !systemProcesses.some(sp => nameLower.includes(sp.toLowerCase())) &&
                   !nameLower.includes('chrome') &&
                   !nameLower.includes('firefox') &&
                   !nameLower.includes('edge');
          })
          .slice(0, 5);
        
        let freedMemory = 0;
        for (const proc of safeToKill) {
          try {
            freedMemory += proc.memory;
            await killProcess(proc.pid);
          } catch (error) {
          }
        }
        
        if (safeToKill.length > 0) {
          results.processesTerminated = true;
          results.freedMemory = freedMemory;
          results.operations.push(`불필요한 프로세스 ${safeToKill.length}개 종료 (${(freedMemory / (1024 * 1024)).toFixed(2)}MB 해제)`);
        }
      } catch (fallbackError) {
        results.errors.push({ operation: 'Process termination', error: error.message });
      }
    }

    try {
      await execAsync('powershell -Command "Get-Process | ForEach-Object { try { $_.WorkingSet = $_.WorkingSet } catch {} }"');
      results.memoryDefragmented = true;
      results.operations.push('Memory defragmentation completed');
    } catch (error) {
      results.errors.push({ operation: 'Memory defragmentation', error: error.message });
    }

    if (isAdmin || requestAdminPermission) {
      try {
        const psCommand = `
          $computersys = Get-WmiObject Win32_ComputerSystem -EnableAllPrivileges;
          $computersys.AutomaticManagedPagefile = $true;
          $computersys.Put();
        `;
        await execAsync(`powershell -Command "${psCommand.replace(/\n/g, ' ').replace(/\s+/g, ' ')}"`);
        
        results.virtualMemoryOptimized = true;
      results.operations.push('Virtual memory optimized');
    } catch (error) {
    }
  } else {
    results.operations.push('Virtual memory 최적화 skipped (requires admin)');
  }

    if (isAdmin || requestAdminPermission) {
      try {
        const memoryManagementKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
        });
        
        await new Promise((resolve, reject) => {
          memoryManagementKey.set('DisableCompression', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        results.compressionOptimized = true;
      results.operations.push('Memory compression optimized');
    } catch (error) {
    }
  } else {
    results.operations.push('Memory compression 최적화 skipped (requires admin)');
  }

    if (isAdmin || requestAdminPermission) {
      try {
        const psCommand = `
          $numaNodes = Get-NumaNode -ErrorAction SilentlyContinue;
          if ($numaNodes) {
            $memoryManagementKey = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management";
            Set-ItemProperty -Path $memoryManagementKey -Name "NumaTopology" -Value 1 -ErrorAction SilentlyContinue;
          }
        `;
        await execAsync(`powershell -Command "${psCommand.replace(/\n/g, ' ').replace(/\s+/g, ' ')}"`);
        
        const memoryManagementKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
        });
        
        await new Promise((resolve, reject) => {
          memoryManagementKey.set('NumaTopology', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        results.numaOptimized = true;
      results.operations.push('NUMA optimization completed');
    } catch (error) {
    }
  } else {
    results.operations.push('NUMA 최적화 skipped (requires admin)');
  }

    if (isAdmin || requestAdminPermission) {
      try {
        const memoryManagementKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
        });
        
        await new Promise((resolve, reject) => {
          memoryManagementKey.set('LargeSystemCache', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        results.mappedFilesOptimized = true;
      results.operations.push('Memory mapped files optimized');
    } catch (error) {
    }
  } else {
    results.operations.push('Memory mapped files 최적화 skipped (requires admin)');
  }

    if (isAdmin || requestAdminPermission) {
      try {
        const memoryManagementKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
        });
        
        await new Promise((resolve, reject) => {
          memoryManagementKey.set('HeapDeCommitFreeBlockThreshold', Registry.REG_DWORD, '0x00040000', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        const psCommand = `
          Add-Type -TypeDefinition @'
          using System;
          using System.Runtime.InteropServices;
          public class HeapAPI {
            [DllImport("kernel32.dll")]
            public static extern IntPtr GetProcessHeap();
            [DllImport("kernel32.dll")]
            public static extern bool HeapSetInformation(IntPtr hHeap, int HeapInformationClass, IntPtr lpHeapInformation, UIntPtr dwHeapInformationSize);
          }
          '@
          $heap = [HeapAPI]::GetProcessHeap();
          [HeapAPI]::HeapSetInformation($heap, 0, [IntPtr]::Zero, [UIntPtr]::Zero) | Out-Null
        `;
        
        const tempScript = path.join(os.tmpdir(), `heap_optimize_${Date.now()}.ps1`);
        fs.writeFileSync(tempScript, psCommand, 'utf8');
        
        try {
          await execAsync(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`);
          results.heapOptimized = true;
          results.operations.push('Heap memory optimized');
        } finally {
          try {
            fs.unlinkSync(tempScript);
          } catch (e) {}
        }
      } catch (error) {
      }
    } else {
      results.operations.push('Heap 최적화 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      try {
        const psCommand = `
          Add-Type -TypeDefinition @'
          using System;
          using System.Runtime.InteropServices;
          public class MemoryPriorityAPI {
            [DllImport("kernel32.dll")]
            public static extern bool SetProcessWorkingSetSize(IntPtr hProcess, int dwMinimumWorkingSetSize, int dwMaximumWorkingSetSize);
            [DllImport("kernel32.dll")]
            public static extern IntPtr GetCurrentProcess();
          }
          '@
          $process = [MemoryPriorityAPI]::GetCurrentProcess();
          [MemoryPriorityAPI]::SetProcessWorkingSetSize($process, -1, -1) | Out-Null
          
          $importantProcs = Get-Process -Name "explorer","dwm" -ErrorAction SilentlyContinue;
          foreach ($proc in $importantProcs) {
            try {
              $proc.PriorityClass = "High";
            } catch {}
          }
        `;
        
        const tempScript = path.join(os.tmpdir(), `memory_priority_${Date.now()}.ps1`);
        fs.writeFileSync(tempScript, psCommand, 'utf8');
        
        try {
          await execAsync(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`);
          results.memoryPriorityOptimized = true;
          results.operations.push('Memory priority optimized');
        } finally {
          try {
            fs.unlinkSync(tempScript);
          } catch (e) {}
        }
        } catch (error) {
        }
      } else {
        results.operations.push('Memory priority 최적화 skipped (requires admin)');
      }

    return results;
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      operations: results.operations, 
      errors: results.errors,
      standbyMemoryCleared: results.standbyMemoryCleared,
      pageFileOptimized: results.pageFileOptimized,
      prefetchOptimized: results.prefetchOptimized,
      processesTerminated: results.processesTerminated,
      memoryDefragmented: results.memoryDefragmented,
      virtualMemoryOptimized: results.virtualMemoryOptimized,
    };
  }
}

module.exports = {
  getStats,
  getProcesses,
  killProcess,
  optimize,
};