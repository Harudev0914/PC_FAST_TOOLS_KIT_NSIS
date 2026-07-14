// @gpuOptimize.js (1-16)
// 날짜: 2025-05-11
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. powercfg 등 GPU 관련 명령어 실행에 사용
//   사용 예: execAsync('powercfg /setactive SCHEME_CURRENT') - 전원 계획 변경 적용
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// 이 서비스는 사용자 권한(user-level)에서만 동작한다.
// 구현된 기능:
// 1. GPU 전원 관리 최적화 (powercfg — 사용자 권한으로 동작)
// 제거된 기능(관리자 권한 필요):
// - GPU 스케줄링(HwSchMode) / DirectX / TDR delay 등 HKLM 레지스트리 기록
// - nvidia-smi 지속성 모드 및 클럭/전압 강제

const { execAsync, withTimeout: timeout } = require('./_exec');

async function optimize() {
  const results = {
    success: true,
    operations: [],
    errors: [],
    powerManagementOptimized: false,
  };

  try {
    // GPU 전원 관리 최적화 — powercfg는 사용자 권한으로 동작한다.
    // (기존의 HKLM\SYSTEM\...\Control\Power\VideoPowerDown 레지스트리 기록은 관리자 권한이 필요해 제거)
    // 명령이 실제로 성공한 경우에만 완료로 보고한다(허위 성공 보고 방지).
    try {
      await timeout(
        (async () => {
          await execAsync('powercfg /setacvalueindex SCHEME_CURRENT 501a4d13-42af-4429-9fd1-a8218c268e20 44eea1db-4c34-4c4d-9f88-9a6b6b8c4b4a 0');
          await execAsync('powercfg /setactive SCHEME_CURRENT');
        })(),
        10000
      );

      results.powerManagementOptimized = true;
      results.operations.push('GPU 전원 관리 최적화 완료');
    } catch (error) {
      results.errors.push({ operation: 'GPU 전원 관리 최적화', error: error.message });
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
