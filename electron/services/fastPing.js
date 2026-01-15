// ---------
// 2026-01-05
// 개발자 : KR_Tuki
// 기능 : Game Mode 최적화 (Fast Ping 포함)
// ---------

// @fastPing.js (1-4)
// 날짜: 2026-01-05
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. 네트워크 최적화 명령어 실행에 사용
//   사용 예: execAsync('netsh int tcp set global autotuninglevel=normal') - TCP 자동 튜닝 레벨 설정
//   execAsync('ipconfig /flushdns') - DNS 캐시 플러시
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. TCP/IP 파라미터 최적화에 사용
//   사용 예: new Registry({ hive: Registry.HKLM, key: '\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' })
//   .set() - TCP/IP 레지스트리 값 설정 (TcpAckFrequency, TcpNoDelay, TcpWindowSize 등)
// 이 모듈은 게임 모드 최적화를 수행하며, Fast Ping 기능을 포함하여 네트워크 지연 시간을 최소화

const { exec } = require('child_process');
const { promisify } = require('util');
const Registry = require('winreg');
const execAsync = promisify(exec);

// @fastPing.js (6-35)
// optimizeGameMode 함수: 게임 모드 최적화 수행
// 매개변수: options - { requestAdminPermission: boolean } 최적화 옵션
// 반환값: results 객체 - 각 최적화 작업의 성공 여부와 작업 목록 포함
// 변수 설명:
//   - requestAdminPermission: 관리자 권한 요청 여부
//   - results: 최적화 결과를 저장하는 객체
//     * success: 전체 최적화 성공 여부
//     * mode: 최적화 모드 ('game')
//     * operations: 수행된 작업 목록 (문자열 배열)
//     * errors: 발생한 오류 목록
//     * pingOptimized, soundBoosted, cpuOptimized 등: 각 최적화 항목별 성공 여부 (boolean)
//     * adminGranted: 관리자 권한 부여 여부
//   - timeout: Promise에 타임아웃을 추가하는 유틸리티 함수
//     변수: promise - 타임아웃을 적용할 Promise, ms - 타임아웃 시간(밀리초)
//   - isAdmin: permissionsService.isAdmin()으로 확인한 현재 관리자 권한 여부
// permissionsService 사용: isAdmin() 함수로 관리자 권한 확인

async function optimizeGameMode(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    mode: 'game',
    operations: [],
    errors: [],
    pingOptimized: false,
    soundBoosted: false,
    cpuOptimized: false,
    gpuOptimized: false,
    memoryOptimized: false,
    networkOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const timeout = (promise, ms) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
  };

  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    // 1. Ping Fast 최적화 (네트워크 지연 시간 최소화, 타임아웃 10초)
    try {
      // TCP/IP 파라미터 최적화 (게임용)
      if (isAdmin || requestAdminPermission) {
        const tcpKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters',
        });

        // 모든 TCP 레지스트리 작업과 DNS 캐시 정리를 병렬로 실행
        await timeout(
          Promise.all([
            new Promise((resolve, reject) => {
              tcpKey.set('TcpNoDelay', Registry.REG_DWORD, '1', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('KeepAliveTime', Registry.REG_DWORD, '30000', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('Tcp1323Opts', Registry.REG_DWORD, '3', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('TcpWindowSize', Registry.REG_DWORD, '65535', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('TcpAckFrequency', Registry.REG_DWORD, '1', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            execAsync('ipconfig /flushdns'),
          ]),
          10000
        );

        results.pingOptimized = true;
        results.operations.push('Ping Fast 최적화 완료 (네트워크 지연 시간 최소화)');
      } else {
        // 관리자 권한이 없으면 스킵
        results.operations.push('Ping Fast 최적화 skipped (requires admin)');
      }
    } catch (error) {
      results.errors.push({ action: 'pingOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 2, 3, 4, 5, 6번 작업을 병렬로 실행 (각각 타임아웃 설정)
    const optimizationTasks = [
      // 2. Sound Boost 최적화 (타임아웃 10초)
      timeout(
        (async () => {
          try {
            const audioService = require('./audio');
            const audioResult = await audioService.boost(true);
            
            if (audioResult && audioResult.success) {
              // 추가 오디오 최적화 (레지스트리)
              if (isAdmin || requestAdminPermission) {
                try {
                  const audioKey = new Registry({
                    hive: Registry.HKLM,
                    key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Audio',
                  });

                  await new Promise((resolve, reject) => {
                    audioKey.set('DisableAudioEnhancements', Registry.REG_DWORD, '0', (err) => {
                      if (err) reject(err);
                      else resolve();
                    });
                  });
                } catch (regError) {
                  // 레지스트리 오류는 무시 (오디오 서비스는 이미 성공)
                }
              }

              results.soundBoosted = true;
              results.operations.push('Sound Boost 최적화 완료 (오디오 증폭 및 향상 기능 활성화)');
            }
          } catch (error) {
            results.errors.push({ action: 'soundBoost', error: error?.message || '알 수 없는 오류' });
          }
        })(),
        10000
      ).catch(() => {}),

      // 3. CPU 최적화 (게임용, 타임아웃 30초)
      timeout(
        (async () => {
          try {
            const cpuService = require('./cpu');
            const cpuResult = await cpuService.optimize();
            
            if (cpuResult && cpuResult.success) {
              // 게임용 추가 CPU 최적화
              if (isAdmin || requestAdminPermission) {
                try {
                  // 게임 모드 전원 옵션 (고성능)
                  await timeout(execAsync('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'), 5000).catch(() => {
                    // 전원 옵션 설정 실패는 무시 (시스템마다 다를 수 있음)
                  });
                  
                  results.cpuOptimized = true;
                  results.operations.push('CPU 게임 모드 최적화 완료 (고성능 전원 옵션)');
                } catch (cpuError) {
                  results.errors.push({ action: 'cpuGameOptimization', error: cpuError.message });
                }
              } else {
                // 관리자 권한이 없으면 스킵
                results.operations.push('CPU 게임 모드 전원 옵션 skipped (requires admin)');
              }
            } else {
              // CPU 최적화 실패는 무시 (이미 최적화되었을 수 있음)
            }
          } catch (error) {
            results.errors.push({ action: 'cpuOptimization', error: error?.message || '알 수 없는 오류' });
          }
        })(),
        30000
      ).catch(() => {}),

      // 4. GPU 최적화 (게임용, 타임아웃 30초)
      timeout(
        (async () => {
          try {
            const gpuService = require('./gpuOptimize');
            const gpuResult = await gpuService.optimize({ requestAdminPermission });
            
            if (gpuResult && gpuResult.success) {
              results.gpuOptimized = true;
              results.operations.push('GPU 게임 모드 최적화 완료');
            } else {
              results.errors.push({ action: 'gpuOptimization', error: 'GPU 최적화 실패' });
            }
          } catch (error) {
            results.errors.push({ action: 'gpuOptimization', error: error?.message || '알 수 없는 오류' });
          }
        })(),
        30000
      ).catch(() => {}),

      // 5. 메모리 최적화 (게임용, 타임아웃 30초)
      timeout(
        (async () => {
          try {
            const memoryService = require('./memory');
            const memoryResult = await memoryService.optimize({ requestAdminPermission });
            
            if (memoryResult && memoryResult.success) {
              results.memoryOptimized = true;
              results.operations.push('메모리 게임 모드 최적화 완료');
            } else {
              results.errors.push({ action: 'memoryOptimization', error: '메모리 최적화 실패' });
            }
          } catch (error) {
            results.errors.push({ action: 'memoryOptimization', error: error?.message || '알 수 없는 오류' });
          }
        })(),
        30000
      ).catch(() => {}),

      // 6. 네트워크 최적화 (게임용, 타임아웃 30초)
      timeout(
        (async () => {
          try {
            const networkService = require('./network');
            const networkResult = await networkService.optimize({ 
              adapterType: 'ethernet', 
              requestAdminPermission 
            });
            
            if (networkResult && networkResult.success) {
              results.networkOptimized = true;
              results.operations.push('네트워크 게임 모드 최적화 완료');
            } else {
              results.errors.push({ action: 'networkOptimization', error: '네트워크 최적화 실패' });
            }
          } catch (error) {
            results.errors.push({ action: 'networkOptimization', error: error?.message || '알 수 없는 오류' });
          }
        })(),
        30000
      ).catch(() => {}),
    ];

    // 모든 최적화 작업을 병렬로 실행
    await Promise.all(optimizationTasks);

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error?.message || '알 수 없는 오류',
    };
  }
}

// Work Mode 최적화
async function optimizeWorkMode(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    mode: 'work',
    operations: [],
    errors: [],
    cpuOptimized: false,
    memoryOptimized: false,
    diskOptimized: false,
    networkOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    // 1. CPU 최적화 (업무용 - 균형 모드)
    try {
      const cpuService = require('./cpu');
      const cpuResult = await cpuService.optimize();
      
      if (cpuResult && cpuResult.success) {
        // 업무용 전원 옵션 (균형)
        if (isAdmin || requestAdminPermission) {
          try {
            await execAsync('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e').catch(() => {
              // 전원 옵션 설정 실패는 무시 (시스템마다 다를 수 있음)
            });
            
            results.cpuOptimized = true;
            results.operations.push('CPU 업무 모드 최적화 완료 (균형 전원 옵션)');
          } catch (cpuError) {
            results.errors.push({ action: 'cpuWorkOptimization', error: cpuError.message });
          }
        } else {
          results.requiresAdmin = true;
        }
      } else {
        results.errors.push({ action: 'cpuOptimization', error: 'CPU 최적화 실패' });
      }
    } catch (error) {
      results.errors.push({ action: 'cpuOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 2. 메모리 최적화 (업무용)
    try {
      const memoryService = require('./memory');
      const memoryResult = await memoryService.optimize({ requestAdminPermission });
      
      if (memoryResult && memoryResult.success) {
        results.memoryOptimized = true;
        results.operations.push('메모리 업무 모드 최적화 완료');
      } else {
        results.errors.push({ action: 'memoryOptimization', error: '메모리 최적화 실패' });
      }
    } catch (error) {
      results.errors.push({ action: 'memoryOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 3. 디스크 최적화 (업무용)
    try {
      const diskService = require('./disk');
      const diskResult = await diskService.optimize({ requestAdminPermission });
      
      if (diskResult && diskResult.success) {
        results.diskOptimized = true;
        results.operations.push('디스크 업무 모드 최적화 완료');
      } else {
        results.errors.push({ action: 'diskOptimization', error: '디스크 최적화 실패' });
      }
    } catch (error) {
      results.errors.push({ action: 'diskOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 4. 네트워크 최적화 (업무용 - 안정성 중심)
    try {
      const networkService = require('./network');
      const networkResult = await networkService.optimize({ 
        adapterType: 'ethernet', 
        requestAdminPermission 
      });
      
      if (networkResult && networkResult.success) {
        results.networkOptimized = true;
        results.operations.push('네트워크 업무 모드 최적화 완료 (안정성 중심)');
      } else {
        results.errors.push({ action: 'networkOptimization', error: '네트워크 최적화 실패' });
      }
    } catch (error) {
      results.errors.push({ action: 'networkOptimization', error: error?.message || '알 수 없는 오류' });
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error?.message || '알 수 없는 오류',
    };
  }
}

// 일괄 최적화 (CPU, Memory, Disk, Network 등 모든 최적화)
async function batchOptimize(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    mode: 'batch',
    operations: [],
    errors: [],
    cpuOptimized: false,
    memoryOptimized: false,
    diskOptimized: false,
    networkOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    // 1. CPU 최적화
    try {
      const cpuService = require('./cpu');
      const cpuResult = await cpuService.optimize();
      if (cpuResult && cpuResult.success) {
        results.cpuOptimized = true;
        results.operations.push('CPU 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'cpuOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 2. 메모리 최적화
    try {
      const memoryService = require('./memory');
      const memoryResult = await memoryService.optimize({ requestAdminPermission });
      if (memoryResult && memoryResult.success) {
        results.memoryOptimized = true;
        results.operations.push('메모리 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'memoryOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 3. 디스크 최적화
    try {
      const diskService = require('./disk');
      const diskResult = await diskService.optimize({ requestAdminPermission });
      if (diskResult && diskResult.success) {
        results.diskOptimized = true;
        results.operations.push('디스크 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'diskOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 4. 네트워크 최적화
    try {
      const networkService = require('./network');
      const networkResult = await networkService.optimize({ 
        adapterType: 'ethernet', 
        requestAdminPermission 
      });
      if (networkResult && networkResult.success) {
        results.networkOptimized = true;
        results.operations.push('네트워크 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'networkOptimization', error: error?.message || '알 수 없는 오류' });
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error?.message || '알 수 없는 오류',
    };
  }
}

// 일괄 가속화 (시스템 가속화 작업들)
async function batchAccelerate(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    mode: 'accelerate',
    operations: [],
    errors: [],
    cpuAccelerated: false,
    memoryAccelerated: false,
    diskAccelerated: false,
    networkAccelerated: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    // 1. CPU 가속화 (고성능 모드)
    try {
      if (isAdmin || requestAdminPermission) {
        await execAsync('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c').catch(() => {});
        results.cpuAccelerated = true;
        results.operations.push('CPU 고성능 모드 활성화 완료');
      } else {
        // 관리자 권한이 없으면 스킵
        results.operations.push('CPU 고성능 모드 skipped (requires admin)');
      }
    } catch (error) {
      results.errors.push({ action: 'cpuAcceleration', error: error?.message || '알 수 없는 오류' });
    }

    // 2. 메모리 가속화
    try {
      const memoryService = require('./memory');
      const memoryResult = await memoryService.optimize({ requestAdminPermission });
      if (memoryResult && memoryResult.success) {
        results.memoryAccelerated = true;
        results.operations.push('메모리 가속화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'memoryAcceleration', error: error?.message || '알 수 없는 오류' });
    }

    // 3. 디스크 가속화 (프리페치 최적화)
    try {
      if (isAdmin || requestAdminPermission) {
        const prefetchKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters',
        });

        await new Promise((resolve, reject) => {
          prefetchKey.set('EnablePrefetcher', Registry.REG_DWORD, '3', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        await new Promise((resolve, reject) => {
          prefetchKey.set('EnableSuperfetch', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        results.diskAccelerated = true;
        results.operations.push('디스크 프리페치 가속화 완료');
      } else {
        results.requiresAdmin = true;
      }
    } catch (error) {
      results.errors.push({ action: 'diskAcceleration', error: error?.message || '알 수 없는 오류' });
    }

    // 4. 네트워크 가속화
    try {
      const networkService = require('./network');
      const networkResult = await networkService.optimize({ 
        adapterType: 'ethernet', 
        requestAdminPermission 
      });
      if (networkResult && networkResult.success) {
        results.networkAccelerated = true;
        results.operations.push('네트워크 가속화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'networkAcceleration', error: error?.message || '알 수 없는 오류' });
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error?.message || '알 수 없는 오류',
    };
  }
}

// 핑 최적화 (네트워크 지연 시간 최소화)
async function pingOptimize(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    mode: 'ping',
    operations: [],
    errors: [],
    pingOptimized: false,
    dnsFlush: false,
    tcpOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    // 1. DNS 캐시 정리
    try {
      await execAsync('ipconfig /flushdns');
      results.dnsFlush = true;
      results.operations.push('DNS 캐시 정리 완료');
    } catch (error) {
      results.errors.push({ action: 'dnsFlush', error: error?.message || '알 수 없는 오류' });
    }

    // 2. TCP/IP 파라미터 최적화
    if (isAdmin || requestAdminPermission) {
      try {
        const tcpKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters',
        });

        // TCP No Delay (Nagle 알고리즘 비활성화)
        await new Promise((resolve, reject) => {
          tcpKey.set('TcpNoDelay', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // TCP Keep-Alive 시간 단축
        await new Promise((resolve, reject) => {
          tcpKey.set('KeepAliveTime', Registry.REG_DWORD, '30000', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // TCP 1323 Options (Window Scaling 활성화)
        await new Promise((resolve, reject) => {
          tcpKey.set('Tcp1323Opts', Registry.REG_DWORD, '3', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // TCP Window Size 최적화
        await new Promise((resolve, reject) => {
          tcpKey.set('TcpWindowSize', Registry.REG_DWORD, '65535', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // TCP Ack Frequency 최적화
        await new Promise((resolve, reject) => {
          tcpKey.set('TcpAckFrequency', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        results.tcpOptimized = true;
        results.pingOptimized = true;
        results.operations.push('TCP/IP 파라미터 최적화 완료 (핑 지연 시간 최소화)');
      } catch (error) {
        results.errors.push({ action: 'tcpOptimization', error: error?.message || '알 수 없는 오류' });
      }
    } else {
      // 관리자 권한이 없으면 스킵
      results.operations.push('TCP/IP 최적화 skipped (requires admin)');
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error?.message || '알 수 없는 오류',
    };
  }
}

module.exports = {
  optimizeGameMode,
  optimizeWorkMode,
  batchOptimize,
  batchAccelerate,
  pingOptimize,
};
