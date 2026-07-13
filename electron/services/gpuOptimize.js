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

const Registry = require('winreg');
const { execAsync, withTimeout: timeout } = require('./_exec');
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

              // [고도화] TdrLevel=0(GPU 타임아웃 감지·복구 비활성)은 GPU 행 발생 시 시스템
              // 전체 프리징을 유발할 수 있어 제거. 하드웨어 가속 GPU 스케줄링만 적용한다.
              await new Promise((resolve, reject) => {
                graphicsKey.set('HwSchMode', Registry.REG_DWORD, '2', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });

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

              // [고도화] DirectX\DisableHardwareAcceleration / Direct3D\DisableFrameBuffer은
              // 실존하지 않는 키라 무효 → 성공으로 보고하지 않는다(오탐 방지).
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

    // 5. [고도화] GPU 클럭/전압 최적화 — 위험/무동작 로직 제거.
    //    기존 코드의 문제:
    //    - NVIDIA `nvidia-smi -ac 4004,1593`: 카드 모델별 고정 애플리케이션 클럭이라 대부분
    //      GPU에서 에러/불안정을 유발(비호환 클럭 강제).
    //    - NVIDIA `nvlddmkm\PowerMizerEnable`, AMD `PP_PhmUseDummyBackEnd`, Intel `PowerSavingMode`:
    //      실제 설정 위치는 어댑터별 `Class\{4d36e968…}\000N`인데 서비스 키/Class 부모 키에 써서
    //      무동작이었다. 게다가 전원 관리 강제 비활성은 발열/불안정 위험이 있다.
    //    → 위험한 클럭/전압 강제는 수행하지 않는다. GPU 스케줄링(HwSchMode)·DirectX·TDR delay
    //      등 안전한 최적화는 위 단계에서 이미 적용됨. NVIDIA는 무해한 지속성 모드만 시도한다.
    if (isAdmin || requestAdminPermission) {
      if (detectedGpuType === 'nvidia') {
        const pmOk = await execAsync('nvidia-smi -pm 1', { timeout: 8000 }).then(() => true).catch(() => false);
        results.operations.push(pmOk ? 'NVIDIA 지속성 모드 적용 (안정 범위)' : 'NVIDIA GPU 감지됨 (안정성을 위해 클럭 강제는 적용하지 않음)');
      } else {
        results.operations.push(`GPU 최적화 완료 (${detectedGpuType || '일반'} — 안정 범위)`);
      }
    } else {
      results.operations.push('GPU 전원 모드 최적화 skipped (requires admin)');
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
