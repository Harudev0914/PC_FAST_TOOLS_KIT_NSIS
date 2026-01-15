// @gpuOptimize.js (1-16)
// 날짜: 2025-05-11
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. nvidia-smi, powercfg 등 GPU 관련 명령어 실행에 사용
//   사용 예: execAsync('nvidia-smi --query-gpu=power.limit --format=csv,noheader') - NVIDIA GPU 전력 제한 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. GPU 관련 설정 변경에 사용
//   사용 예: new Registry({ hive: Registry.HKLM, key }) - 레지스트리 키 생성, .set() - GPU 설정 변경
// - permissions (permissionsService): 관리자 권한 확인. isAdmin() 함수로 권한 확인
// 구현된 기능:
// 1. GPU 전원 관리 최적화
// 2. GPU 스케줄링 최적화
// 3. DirectX 최적화
// 4. GPU 메모리 관리
// 5. GPU 클럭/전압 최적화 (NVIDIA/AMD/Intel별)

const { exec } = require('child_process');
const { promisify } = require('util');
const Registry = require('winreg');
const execAsync = promisify(exec);
const permissionsService = require('./permissions');

async function optimize(options = {}) {
  const { requestAdminPermission = false, gpuType = 'auto' } = options;
  
  const results = {
    success: true,
    operations: [],
    errors: [],
    powerManagementOptimized: false,
    schedulingOptimized: false,
    directXOptimized: false,
    memoryOptimized: false,
    clockOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  // 타임아웃 헬퍼 함수
  const timeout = (promise, ms) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
  };

  // 관리자 권한 확인
  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    // GPU 타입 자동 감지 (타임아웃 5초)
    let detectedGpuType = gpuType;
    if (gpuType === 'auto') {
      try {
        const { stdout } = await timeout(execAsync('wmic path win32_videocontroller get name /format:list'), 5000);
        if (stdout.toLowerCase().includes('nvidia')) {
          detectedGpuType = 'nvidia';
        } else if (stdout.toLowerCase().includes('amd') || stdout.toLowerCase().includes('radeon')) {
          detectedGpuType = 'amd';
        } else if (stdout.toLowerCase().includes('intel')) {
          detectedGpuType = 'intel';
        } else {
          detectedGpuType = 'generic';
        }
      } catch (error) {
        detectedGpuType = 'generic';
      }
    }

    // 1, 2번 작업을 병렬로 실행 (관리자 권한 필요)
    if (isAdmin || requestAdminPermission) {
      const gpuOptimizationTasks = [
        // 1. GPU 전원 관리 최적화 (타임아웃 10초)
        timeout(
          (async () => {
            try {
              // Windows GPU 전원 관리 최적화와 레지스트리 작업을 병렬로 실행
              const gpuKey = new Registry({
                hive: Registry.HKLM,
                key: '\\SYSTEM\\CurrentControlSet\\Control\\Power',
              });

              await Promise.all([
                execAsync('powercfg /setacvalueindex SCHEME_CURRENT 501a4d13-42af-4429-9fd1-a8218c268e20 44eea1db-4c34-4c4d-9f88-9a6b6b8c4b4a 0'),
                execAsync('powercfg /setactive SCHEME_CURRENT'),
                new Promise((resolve, reject) => {
                  gpuKey.set('VideoPowerDown', Registry.REG_DWORD, '0', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
              ]);

              results.powerManagementOptimized = true;
              results.operations.push('GPU 전원 관리 최적화 완료');
            } catch (error) {
              // 에러는 무시
            }
          })(),
          10000
        ).catch(() => {}),

        // 2. GPU 스케줄링 최적화 (타임아웃 10초)
        timeout(
          (async () => {
            try {
              // 하드웨어 가속 GPU 스케줄링 활성화
              const graphicsKey = new Registry({
                hive: Registry.HKLM,
                key: '\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
              });

              // GPU 스케줄링과 우선순위 조정을 병렬로 실행
              await Promise.all([
                new Promise((resolve, reject) => {
                  graphicsKey.set('HwSchMode', Registry.REG_DWORD, '2', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
                new Promise((resolve, reject) => {
                  graphicsKey.set('TdrLevel', Registry.REG_DWORD, '0', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
              ]);

              results.schedulingOptimized = true;
              results.operations.push('GPU 스케줄링 최적화 완료');
            } catch (error) {
              // 에러는 무시
            }
          })(),
          10000
        ).catch(() => {}),
      ];

      await Promise.all(gpuOptimizationTasks);
    } else {
      // 관리자 권한이 없으면 스킵
      results.operations.push('GPU 전원 관리/스케줄링 최적화 skipped (requires admin)');
    }

    // 3, 4번 작업을 병렬로 실행 (관리자 권한 필요)
    if (isAdmin || requestAdminPermission) {
      const additionalGpuTasks = [
        // 3. DirectX 최적화 (타임아웃 10초)
        timeout(
          (async () => {
            try {
              // DirectX 최적화 레지스트리 설정
              const directXKey = new Registry({
                hive: Registry.HKLM,
                key: '\\SOFTWARE\\Microsoft\\DirectX',
              });

              const direct3DKey = new Registry({
                hive: Registry.HKLM,
                key: '\\SOFTWARE\\Microsoft\\Direct3D',
              });

              // 두 레지스트리 작업을 병렬로 실행
              await Promise.all([
                new Promise((resolve, reject) => {
                  directXKey.set('DisableHardwareAcceleration', Registry.REG_DWORD, '0', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
                new Promise((resolve, reject) => {
                  direct3DKey.set('DisableFrameBuffer', Registry.REG_DWORD, '0', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
              ]);

              results.directXOptimized = true;
              results.operations.push('DirectX 최적화 완료');
            } catch (error) {
              // 에러는 무시
            }
          })(),
          10000
        ).catch(() => {}),

        // 4. GPU 메모리 관리 최적화 (타임아웃 10초)
        timeout(
          (async () => {
            try {
              // GPU 메모리 관리 레지스트리 설정
              const graphicsKey = new Registry({
                hive: Registry.HKLM,
                key: '\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
              });

              // 두 레지스트리 작업을 병렬로 실행
              await Promise.all([
                new Promise((resolve, reject) => {
                  graphicsKey.set('TdrDelay', Registry.REG_DWORD, '60', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
                new Promise((resolve, reject) => {
                  graphicsKey.set('TdrDdiDelay', Registry.REG_DWORD, '60', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
              ]);

              results.memoryOptimized = true;
              results.operations.push('GPU 메모리 관리 최적화 완료');
            } catch (error) {
              // 에러는 무시
            }
          })(),
          10000
        ).catch(() => {}),
      ];

      await Promise.all(additionalGpuTasks);
    } else {
      results.requiresAdmin = true;
      results.errors.push({ operation: 'DirectX 최적화', error: '관리자 권한이 필요합니다', requiresAdmin: true });
      results.errors.push({ operation: 'GPU 메모리 관리', error: '관리자 권한이 필요합니다', requiresAdmin: true });
    }

    // 5. GPU 클럭/전압 최적화 (GPU 타입별, 관리자 권한 필요)
    if (isAdmin || requestAdminPermission) {
      try {
        if (detectedGpuType === 'nvidia') {
          // NVIDIA GPU 최적화
          try {
            // NVIDIA 제어판 설정 (nvidia-smi 사용)
            await execAsync('nvidia-smi -ac 4004,1593');
            results.clockOptimized = true;
            results.operations.push('NVIDIA GPU 클럭 최적화 완료');
          } catch (nvidiaError) {
            // nvidia-smi가 없거나 실패한 경우 레지스트리로 설정
            const nvidiaKey = new Registry({
              hive: Registry.HKLM,
              key: '\\SYSTEM\\CurrentControlSet\\Services\\nvlddmkm',
            });

            await new Promise((resolve, reject) => {
              nvidiaKey.set('PowerMizerEnable', Registry.REG_DWORD, '0', (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            results.clockOptimized = true;
            results.operations.push('NVIDIA GPU 전원 관리 최적화 완료');
          }
        } else if (detectedGpuType === 'amd') {
          // AMD GPU 최적화
          const amdKey = new Registry({
            hive: Registry.HKLM,
            key: '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}',
          });

          await new Promise((resolve, reject) => {
            amdKey.set('PP_PhmUseDummyBackEnd', Registry.REG_DWORD, '0', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          results.clockOptimized = true;
          results.operations.push('AMD GPU 클럭 최적화 완료');
        } else if (detectedGpuType === 'intel') {
          // Intel GPU 최적화
          const intelKey = new Registry({
            hive: Registry.HKLM,
            key: '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}',
          });

          await new Promise((resolve, reject) => {
            intelKey.set('PowerSavingMode', Registry.REG_DWORD, '0', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          results.clockOptimized = true;
          results.operations.push('Intel GPU 전원 관리 최적화 완료');
        } else {
          // 일반 GPU 최적화
          results.operations.push('GPU 타입 자동 감지 완료 (일반 GPU)');
        }
      } catch (error) {
        // 에러는 무시
      }
    } else {
      // 관리자 권한이 없으면 스킵
      results.operations.push('GPU 클럭 최적화 skipped (requires admin)');
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
};
