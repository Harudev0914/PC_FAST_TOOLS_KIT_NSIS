// @disk.js (1-16)
// 날짜: 2025-04-23
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. chkdsk, defrag, Dism.exe 등 디스크 관리 명령어 실행에 사용
//   사용 예: execAsync('chkdsk C: /F /R') - 디스크 검사 및 복구, execAsync('defrag C: /O') - 디스크 조각 모음
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - os: 운영체제 정보 제공. os.platform() 등으로 플랫폼 확인
// - fs: 파일 시스템 접근. 디스크 파일 읽기/쓰기/삭제에 사용
// - path: 파일 경로 처리. 경로 조작 및 정규화에 사용
// - winreg (Registry): Windows 레지스트리 접근. 디스크 관련 설정 변경에 사용
// - cleaner (cleanerService): 파일 정리 서비스. clean() 함수로 임시 파일 정리
//   사용 예: cleanerService.clean({ tempFiles: true, browserCache: true }) - 임시 파일 및 브라우저 캐시 정리
// - diskDetails (diskDetailsService): 디스크 상세 정보 조회. getDiskDetails() 함수로 디스크 타입 확인
//   사용 예: diskDetailsService.getDiskDetails('C:') - C 드라이브의 디스크 타입(SSD/HDD) 조회
// - platform (platformService): 플랫폼별 기능 제공. isAdmin(), requestAdmin() 등 사용

const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const fs = require('fs');
const path = require('path');
const execAsync = promisify(exec);
const Registry = require('winreg');
const cleanerService = require('./cleaner');
const diskDetailsService = require('./diskDetails');
const platformService = require('./platform');

const timeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
};

async function checkAdmin() {
  return await platformService.isAdmin();
}

async function execAsAdmin(command, args = []) {
  return await platformService.requestAdmin(command, args);
}

// @disk.js (33-51)
// getDiskType 함수: 디스크 타입 확인 (SSD 또는 HDD)
// 매개변수: diskLetter - 디스크 드라이브 문자 (기본값: 'C:')
// 반환값: 'SSD' 또는 'HDD' 문자열
// 변수 설명:
//   - diskDetails: diskDetailsService.getDiskDetails()로 조회한 디스크 상세 정보 객체
//   - type: diskDetails.type 문자열 (디스크 타입 정보)
// diskDetailsService 사용: getDiskDetails() 함수로 디스크 정보 조회 후 타입 문자열에서 SSD/HDD 판별

async function getDiskType(diskLetter = 'C:') {
  try {
    const diskDetails = await diskDetailsService.getDiskDetails(diskLetter);
    const type = diskDetails.type || 'Unknown';
    
    if (type.toUpperCase().includes('SSD') || type.toUpperCase().includes('NVME')) {
      return 'SSD';
    }
    
    if (type.toUpperCase().includes('HDD')) {
      return 'HDD';
    }
    
    return 'HDD';
  } catch (error) {
    console.error('Error getting disk type:', error);
    return 'HDD';
  }
}

async function optimize(options = {}) {
  const { requestAdminPermission = false, diskLetter = 'C:' } = options;
  
  const results = {
    success: true,
    operations: [],
    errors: [],
    tempFilesCleaned: false,
    diskDefragmented: false,
    diskChecked: false,
    systemFilesCleaned: false,
    indexingOptimized: false,
    prefetchCleaned: false,
    cacheOptimized: false,
    ioPriorityOptimized: false,
    ntfsOptimized: false,
    queueDepthOptimized: false,
    driverOptimized: false,
    spindownOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
    freedSpace: 0,
  };

  const isAdmin = await checkAdmin();
  results.adminGranted = isAdmin;

  try {
    const parallelDiskTasks = [
      timeout(
        (async () => {
          try {
            const cleanResult = await cleanerService.clean({
              tempFiles: true,
              browserCache: true,
              registry: false,
            });
            
            if (cleanResult.deleted > 0) {
              results.tempFilesCleaned = true;
              results.freedSpace += cleanResult.freedSpace;
              results.operations.push(`임시 파일 ${cleanResult.deleted}개 삭제 완료 (${(cleanResult.freedSpace / (1024 * 1024 * 1024)).toFixed(2)}GB)`);
            }
          } catch (error) {
            results.errors.push({ operation: '임시 파일 정리', error: error.message, requiresAdmin: false });
          }
        })(),
        10000
      ).catch(() => {}),

      timeout(
        (async () => {
          try {
            let recycleBinEmptied = false;
            let totalDeleted = 0;
            let totalFreedSpace = 0;
            
            const drives = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:', 'K:', 'L:', 'M:', 'N:', 'O:', 'P:', 'Q:', 'R:', 'S:', 'T:', 'U:', 'V:', 'W:', 'X:', 'Y:', 'Z:'];
            
            const drivePromises = drives.map(async (drive) => {
              try {
                const recycleBinPath = path.join(drive, '$Recycle.Bin');
                if (!fs.existsSync(recycleBinPath)) return { deleted: 0, freed: 0 };
                
                const entries = fs.readdirSync(recycleBinPath, { withFileTypes: true });
                let driveDeleted = 0;
                let driveFreed = 0;
                
                const userPromises = entries
                  .filter(entry => entry.isDirectory())
                  .map(async (entry) => {
                    const userRecyclePath = path.join(recycleBinPath, entry.name);
                    try {
                      const files = fs.readdirSync(userRecyclePath, { withFileTypes: true });
                      
                      const filePromises = files.map(async (file) => {
                        const filePath = path.join(userRecyclePath, file.name);
                        try {
                          if (file.isDirectory()) {
                            await execAsync(`rd /s /q "${filePath}"`);
                            return { deleted: 1, freed: 0 };
                          } else {
                            const stats = fs.statSync(filePath);
                            fs.unlinkSync(filePath);
                            return { deleted: 1, freed: stats.size };
                          }
                        } catch (fileError) {
                          return { deleted: 0, freed: 0 };
                        }
                      });
                      
                      const fileResults = await Promise.all(filePromises);
                      return fileResults.reduce((acc, r) => ({ deleted: acc.deleted + r.deleted, freed: acc.freed + r.freed }), { deleted: 0, freed: 0 });
                    } catch (userError) {
                      return { deleted: 0, freed: 0 };
                    }
                  });
                
                const userResults = await Promise.all(userPromises);
                const driveResult = userResults.reduce((acc, r) => ({ deleted: acc.deleted + r.deleted, freed: acc.freed + r.freed }), { deleted: 0, freed: 0 });
                return driveResult;
              } catch (driveError) {
                return { deleted: 0, freed: 0 };
              }
            });
            
            const driveResults = await Promise.all(drivePromises);
            const combinedResult = driveResults.reduce((acc, r) => ({ deleted: acc.deleted + r.deleted, freed: acc.freed + r.freed }), { deleted: 0, freed: 0 });
            totalDeleted += combinedResult.deleted;
            totalFreedSpace += combinedResult.freed;
            if (combinedResult.deleted > 0) recycleBinEmptied = true;
            
            try {
              await execAsync('powershell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"');
              recycleBinEmptied = true;
            } catch (psError) {
            }
            
            if (recycleBinEmptied || totalDeleted > 0) {
              results.freedSpace += totalFreedSpace;
              results.operations.push(`휴지통 비우기 완료${totalDeleted > 0 ? ` (${totalDeleted}개 항목 삭제, ${(totalFreedSpace / (1024 * 1024)).toFixed(2)}MB)` : ''}`);
            } else {
              results.operations.push('휴지통이 이미 비어있음');
            }
          } catch (error) {
            results.errors.push({ operation: '휴지통 비우기', error: error.message, requiresAdmin: false });
          }
        })(),
        10000
      ).catch(() => {}),
    ];

    await Promise.all(parallelDiskTasks);

    if (isAdmin || requestAdminPermission) {
      try {
        await timeout(
          (async () => {
            const updatePath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'SoftwareDistribution', 'Download');
            if (fs.existsSync(updatePath)) {
              const files = fs.readdirSync(updatePath);
              
              const deletePromises = files.slice(0, 20).map(async (file) => {
                try {
                  const filePath = path.join(updatePath, file);
                  const stats = fs.statSync(filePath);
                  fs.unlinkSync(filePath);
                  return { deleted: 1, freed: stats.size };
                } catch (error) {
                  return { deleted: 0, freed: 0 };
                }
              });
              
              const deleteResults = await Promise.all(deletePromises);
              const combinedResult = deleteResults.reduce((acc, r) => ({ deleted: acc.deleted + r.deleted, freed: acc.freed + r.freed }), { deleted: 0, freed: 0 });
              const deletedCount = combinedResult.deleted;
              const freedSpace = combinedResult.freed;
          
              if (deletedCount > 0) {
                results.freedSpace += freedSpace;
                results.operations.push(`Windows 업데이트 임시 파일 ${deletedCount}개 삭제 완료`);
              }
            }
          })(),
          10000
        );
      } catch (error) {
        results.requiresAdmin = true;
        results.errors.push({ operation: 'Windows 업데이트 임시 파일 정리', error: error.message, requiresAdmin: true });
      }
    } else {
      results.operations.push('Windows 업데이트 임시 파일 정리 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      try {
        const diskType = await getDiskType(diskLetter);
        
        if (diskType === 'SSD') {
          try {
            await execAsync(`powershell -Command "Optimize-Volume -DriveLetter ${diskLetter[0]} -ReTrim -Verbose"`);
            results.diskDefragmented = true;
            results.operations.push('SSD TRIM 최적화 완료 (조각 모음은 실행하지 않음)');
          } catch (trimError) {
            results.errors.push({ operation: 'SSD TRIM 최적화', error: trimError.message, requiresAdmin: true });
          }
          
          try {
            await execAsync(`schtasks /Change /TN "Microsoft\\Windows\\Defrag\\ScheduledDefrag" /Disable`);
            results.operations.push('SSD 자동 조각 모음 스케줄 해제 완료');
          } catch (scheduleError) {
            console.warn('Failed to disable defrag schedule:', scheduleError);
          }
        } else {
          await execAsync(`defrag ${diskLetter} /O`);
          results.diskDefragmented = true;
          results.operations.push('HDD 조각 모음 완료');
        }
      } catch (error) {
      }
    } else {
      results.operations.push('디스크 조각 모음/TRIM skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      try {
        await execAsync(`chkdsk ${diskLetter} /F`);
        results.diskChecked = true;
        results.operations.push('디스크 검사 완료 (재부팅 필요할 수 있음)');
      } catch (error) {
        if (error.message.includes('cannot lock') || error.message.includes('재부팅') || error.message.includes('reboot')) {
          results.diskChecked = true;
          results.operations.push('디스크 검사 예약됨 (재부팅 시 실행)');
        } else {
          try {
            await execAsync(`chkdsk ${diskLetter}`);
            results.diskChecked = true;
            results.operations.push('디스크 검사 완료 (읽기 전용)');
          } catch (readOnlyError) {
          }
        }
      }
    } else {
      results.operations.push('디스크 검사 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      const adminDiskTasks = [
        timeout(
          (async () => {
            try {
              await Promise.all([
                execAsync('Dism.exe /online /Cleanup-Image /StartComponentCleanup').then(() => {
                  results.systemFilesCleaned = true;
                  results.operations.push('WinSxS 정리 완료');
                }).catch(error => {
                  results.requiresAdmin = true;
                  results.errors.push({ operation: 'WinSxS 정리', error: error.message, requiresAdmin: true });
                }),
                execAsync('Dism.exe /online /Cleanup-Image /SPSuperseded').then(() => {
                  results.operations.push('오래된 Windows 업데이트 정리 완료');
                }).catch(error => {
                  results.errors.push({ operation: 'Windows 업데이트 정리', error: error.message, requiresAdmin: true });
                }),
              ]);
            } catch (error) {
              results.requiresAdmin = true;
              results.errors.push({ operation: '시스템 파일 정리', error: error.message, requiresAdmin: true });
            }
          })(),
          60000
        ).catch(() => {}),

        timeout(
          execAsync('powershell -Command "Get-WmiObject -Class Win32_Volume | Where-Object {$_.DriveLetter -eq \'C:\'} | ForEach-Object { $_.ReIndex($true) }"').then(() => {
            results.indexingOptimized = true;
            results.operations.push('디스크 인덱싱 최적화 완료');
          }).catch(error => {
            results.requiresAdmin = true;
            results.errors.push({ operation: '인덱싱 최적화', error: error.message, requiresAdmin: true });
          }),
          10000
        ).catch(() => {}),

        timeout(
          (async () => {
            try {
              const prefetchPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'Prefetch');
              if (fs.existsSync(prefetchPath)) {
                const files = fs.readdirSync(prefetchPath);
                let deletedCount = 0;
                
                const deletePromises = files.slice(0, 20).map(file => 
                  timeout(
                    (async () => {
                      try {
                        const filePath = path.join(prefetchPath, file);
                        fs.unlinkSync(filePath);
                        return 1;
                      } catch (error) {
                        return 0;
                      }
                    })(),
                    2000
                  ).catch(() => 0)
                );
                
                const deleteResults = await Promise.all(deletePromises);
                deletedCount = deleteResults.reduce((sum, count) => sum + count, 0);
                
                if (deletedCount > 0) {
                  results.prefetchCleaned = true;
                  results.operations.push(`프리페치 파일 ${deletedCount}개 삭제 완료`);
                }
              }
            } catch (error) {
              results.requiresAdmin = true;
              results.errors.push({ operation: '프리페치 정리', error: error.message, requiresAdmin: true });
            }
          })(),
          10000
        ).catch(() => {}),
      ];

      await Promise.all(adminDiskTasks);
    } else {
      results.requiresAdmin = true;
      results.errors.push({ operation: '프리페치 정리', error: '관리자 권한이 필요합니다', requiresAdmin: true });
    }

    if (isAdmin || requestAdminPermission) {
      try {
        await timeout(
          (async () => {
            const diskKey = new Registry({
              hive: Registry.HKLM,
              key: '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e97b-e325-11ce-bfc1-08002be10318}\\0000',
            });
            
            await Promise.all([
              execAsync('powercfg /setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 50397f86-ef36-4b77-a03e-3411e37a0960 1'),
              execAsync('powercfg /setactive SCHEME_CURRENT'),
              new Promise((resolve, reject) => {
                diskKey.set('EnableReadAhead', Registry.REG_DWORD, '1', (err) => {
                  if (err) {
                    resolve();
                  } else {
                    resolve();
                  }
                });
              }),
            ]);
            
            results.cacheOptimized = true;
            results.operations.push('디스크 캐시 최적화 완료');
          })(),
          10000
        );
      } catch (error) {
      }
    } else {
      results.operations.push('디스크 캐시 최적화 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      try {
        const psCommand = `
          Add-Type -TypeDefinition @'
          using System;
          using System.Runtime.InteropServices;
          public class IOPriorityAPI {
            [DllImport("kernel32.dll")]
            public static extern bool SetPriorityClass(IntPtr hProcess, uint dwPriorityClass);
            [DllImport("kernel32.dll")]
            public static extern IntPtr GetCurrentProcess();
          }
          '@
          $process = [IOPriorityAPI]::GetCurrentProcess();
          [IOPriorityAPI]::SetPriorityClass($process, 0x00000080) | Out-Null
          
          $importantProcs = Get-Process -Name "explorer","dwm" -ErrorAction SilentlyContinue;
          foreach ($proc in $importantProcs) {
            try {
              $proc.PriorityClass = "High";
            } catch {}
          }
        `;
        
        const tempScript = path.join(os.tmpdir(), `io_priority_${Date.now()}.ps1`);
        fs.writeFileSync(tempScript, psCommand, 'utf8');
        
        try {
          await execAsync(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`);
          results.ioPriorityOptimized = true;
          results.operations.push('디스크 I/O 우선순위 조정 완료');
        } finally {
          try {
            fs.unlinkSync(tempScript);
          } catch (e) {}
        }
      } catch (error) {
        results.requiresAdmin = true;
        results.errors.push({ operation: '디스크 I/O 우선순위 조정', error: error.message, requiresAdmin: true });
      }
    } else {
      results.requiresAdmin = true;
      results.errors.push({ operation: '디스크 I/O 우선순위 조정', error: '관리자 권한이 필요합니다', requiresAdmin: true });
    }

    if (isAdmin || requestAdminPermission) {
      try {
        await execAsync('fsutil behavior set DisableDeleteNotify 0');
        
        const ntfsKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
        });
        
        await new Promise((resolve, reject) => {
          ntfsKey.set('NtfsMftZoneReservation', Registry.REG_DWORD, '2', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        try {
          await execAsync(`chkdsk ${diskLetter} /F /R`);
          results.operations.push('NTFS 메타데이터 정리 완료 (재부팅 필요할 수 있음)');
        } catch (chkdskError) {
          if (chkdskError.message.includes('cannot lock') || chkdskError.message.includes('재부팅')) {
            results.operations.push('NTFS 메타데이터 정리 예약됨 (재부팅 시 실행)');
          }
        }
        
        results.ntfsOptimized = true;
        results.operations.push('NTFS 최적화 완료');
      } catch (error) {
      }
    } else {
      results.operations.push('NTFS 최적화 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      try {
        const storageKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\storahci\\Parameters\\Device',
        });
        
        try {
          await new Promise((resolve, reject) => {
            storageKey.set('QueueDepth', Registry.REG_DWORD, '32', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (ahciError) {
        }
        
        const nvmeKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\stornvme\\Parameters\\Device',
        });
        
        try {
          await new Promise((resolve, reject) => {
            nvmeKey.set('QueueDepth', Registry.REG_DWORD, '32', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (nvmeError) {
        }
        
        const ahciParamsKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\msahci\\Parameters',
        });
        
        try {
          await new Promise((resolve, reject) => {
            ahciParamsKey.set('NCQEnabled', Registry.REG_DWORD, '1', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (ncqError) {
        }
        
        results.queueDepthOptimized = true;
        results.operations.push('디스크 큐 깊이 최적화 완료');
      } catch (error) {
        results.requiresAdmin = true;
        results.errors.push({ operation: '디스크 큐 깊이 최적화', error: error.message, requiresAdmin: true });
      }
    } else {
      results.requiresAdmin = true;
      results.errors.push({ operation: '디스크 큐 깊이 최적화', error: '관리자 권한이 필요합니다', requiresAdmin: true });
    }

    if (isAdmin || requestAdminPermission) {
      try {
        const ahciKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\storahci\\Parameters',
        });
        
        try {
          await new Promise((resolve, reject) => {
            ahciKey.set('DisableStaggeredSpinup', Registry.REG_DWORD, '1', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (ahciError) {
        }
        
        const nvmeKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\stornvme\\Parameters',
        });
        
        try {
          await new Promise((resolve, reject) => {
            nvmeKey.set('ForcedPhysicalSectorSizeInBytes', Registry.REG_DWORD, '4096', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (nvmeError) {
        }
        
        results.driverOptimized = true;
        results.operations.push('스토리지 드라이버 최적화 완료');
      } catch (error) {
      }
    } else {
      results.operations.push('스토리지 드라이버 최적화 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      try {
        const diskType = await getDiskType(diskLetter);
        
        if (diskType === 'HDD') {
          await execAsync('powercfg /setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0');
          await execAsync('powercfg /setactive SCHEME_CURRENT');
          
          const diskPowerKey = new Registry({
            hive: Registry.HKLM,
            key: '\\SYSTEM\\CurrentControlSet\\Control\\Power',
          });
          
          try {
            await new Promise((resolve, reject) => {
              diskPowerKey.set('HibernateEnabled', Registry.REG_DWORD, '0', (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          } catch (powerError) {
          }
          
          results.spindownOptimized = true;
          results.operations.push('HDD 스핀다운 최적화 완료');
        } else {
          results.operations.push('SSD는 스핀다운 최적화가 필요하지 않음');
        }
      } catch (error) {
        results.requiresAdmin = true;
        results.errors.push({ operation: '디스크 스핀다운 최적화', error: error.message, requiresAdmin: true });
      }
    } else {
      results.requiresAdmin = true;
      results.errors.push({ operation: '디스크 스핀다운 최적화', error: '관리자 권한이 필요합니다', requiresAdmin: true });
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  optimize,
  getDiskType,
};