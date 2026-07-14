// @gaming.js
// 원클릭 게임 최적화 / 해제.
//
// 이 앱은 사용자 권한으로만 동작한다 — 관리자 권한이 필요한 항목(GPU 스케줄링, TCP 튜닝, MMCSS,
// HKLM 전역 설정)은 UAC 없이는 어차피 실패하므로 아예 넣지 않는다. 여기서 건드리는 값은 전부
// HKCU와 전원 계획뿐이다.
//
// OFF는 "Windows 기본값"이 아니라 "ON을 누르기 직전의 값"으로 되돌린다. 기본값을 써 넣으면,
// 원래 고성능 전원 계획을 쓰던 사용자가 ON→OFF 했을 때 균형 조정으로 바뀌어 버린다.
// enableGameMode가 적용 직전 스냅샷을 찍어 두고, disableGameMode가 그대로 복원한다.

const { execAsync } = require('./_exec');
const optimizationState = require('./optimizationState');
const registrySnapshot = require('./registrySnapshot');

const STATE_KEY = 'gamemode';

// enableGameMode가 쓰는 모든 HKCU 값. 스냅샷 대상이자 적용 대상이다 —
// 이 목록 하나만 보면 "무엇을 바꾸는지"와 "무엇을 되돌리는지"가 항상 일치한다.
const MOUSE = 'Control Panel\\Mouse';
const DESKTOP = 'Control Panel\\Desktop';
const KEYBOARD = 'Control Panel\\Keyboard';
const GAMEBAR = 'Software\\Microsoft\\GameBar';
const GAMECONFIG = 'System\\GameConfigStore';
const GAMEDVR = 'Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR';
const VISUALFX = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects';

const TOUCHED_VALUES = [
  { regPath: GAMEBAR, name: 'AutoGameModeEnabled' },
  { regPath: GAMEBAR, name: 'AllowAutoGameMode' },
  { regPath: GAMEBAR, name: 'GameModeEnabled' },
  { regPath: GAMECONFIG, name: 'GameDVR_Enabled' },
  { regPath: GAMECONFIG, name: 'GameDVR_FSEBehaviorMode' },
  { regPath: GAMECONFIG, name: 'GameDVR_HonorUserFSEBehaviorMode' },
  { regPath: GAMECONFIG, name: 'GameDVR_DXGIHonorFSEWindowsCompatible' },
  { regPath: GAMECONFIG, name: 'GameDVR_EFSEFeatureFlags' },
  { regPath: GAMEDVR, name: 'AppCaptureEnabled' },
  { regPath: GAMEDVR, name: 'HistoricalCaptureEnabled' },
  { regPath: MOUSE, name: 'MouseSpeed' },
  { regPath: MOUSE, name: 'MouseThreshold1' },
  { regPath: MOUSE, name: 'MouseThreshold2' },
  { regPath: MOUSE, name: 'MouseSensitivity' },
  { regPath: DESKTOP, name: 'MenuShowDelay' },
  { regPath: DESKTOP, name: 'AutoEndTasks' },
  { regPath: DESKTOP, name: 'HungAppTimeout' },
  { regPath: DESKTOP, name: 'WaitToKillAppTimeout' },
  { regPath: KEYBOARD, name: 'KeyboardDelay' },
  { regPath: VISUALFX, name: 'VisualFXSetting' },
].map((entry) => ({ ...entry, hive: 'HKCU' }));

const HIGH_PERFORMANCE_PLAN = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';

// HKCU 레지스트리 헬퍼 (reg add로 키 생성까지 한 번에, 관리자 권한 불필요)
const setHKCUDword = (regPath, name, value) =>
  execAsync(`reg add "HKCU\\${regPath}" /v ${name} /t REG_DWORD /d ${value} /f`, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
const setHKCUString = (regPath, name, value) =>
  execAsync(`reg add "HKCU\\${regPath}" /v ${name} /t REG_SZ /d ${value} /f`, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);

// 재로그인 없이 사용자 시스템 파라미터(마우스/메뉴 지연 등)를 즉시 다시 로드
const applyUserParams = () =>
  execAsync('rundll32.exe user32.dll,UpdatePerUserSystemParameters 1, True', { timeout: 8000 }).catch(() => {});

// 원클릭 게임 최적화. FPS·마우스 가속·반응속도·전원·메모리를 사용자 권한으로 즉시 적용한다.
async function enableGameMode(onProgress = () => {}) {
  const results = {
    success: true,
    operations: [],
    errors: [],
    gameMode: false,
    gameDVRDisabled: false,
    mouseAccelDisabled: false,
    responsivenessOptimized: false,
    visualEffectsOptimized: false,
    powerPlanOptimized: false,
    memoryOptimized: false,
    dnsFlushed: false,
  };

  try {
    // 0. 무엇을 바꾸기 전에, 지금 값을 먼저 찍어 둔다. OFF는 이 값으로 되돌린다.
    onProgress(3, '현재 설정 백업 중...');
    const snapshot = {
      values: await registrySnapshot.capture(TOUCHED_VALUES),
      powerPlan: await registrySnapshot.capturePowerPlan(),
    };

    // 1. Windows 게임 모드 ON
    onProgress(10, 'Windows 게임 모드 활성화 중...');
    try {
      await setHKCUDword(GAMEBAR, 'AutoGameModeEnabled', 1);
      await setHKCUDword(GAMEBAR, 'AllowAutoGameMode', 1);
      await setHKCUDword(GAMEBAR, 'GameModeEnabled', 1);
      results.gameMode = true;
      results.operations.push('Windows 게임 모드 활성화');
    } catch (error) {
      results.errors.push({ action: 'gameMode', error: error?.message || '알 수 없는 오류' });
    }

    // 2. Game DVR/백그라운드 녹화 OFF (FPS·프레임타임 향상)
    onProgress(22, 'Game DVR·백그라운드 녹화 비활성화 중...');
    try {
      await setHKCUDword(GAMECONFIG, 'GameDVR_Enabled', 0);
      await setHKCUDword(GAMECONFIG, 'GameDVR_FSEBehaviorMode', 2);
      await setHKCUDword(GAMECONFIG, 'GameDVR_HonorUserFSEBehaviorMode', 1);
      await setHKCUDword(GAMECONFIG, 'GameDVR_DXGIHonorFSEWindowsCompatible', 1);
      await setHKCUDword(GAMECONFIG, 'GameDVR_EFSEFeatureFlags', 0);
      await setHKCUDword(GAMEDVR, 'AppCaptureEnabled', 0);
      await setHKCUDword(GAMEDVR, 'HistoricalCaptureEnabled', 0);
      results.gameDVRDisabled = true;
      results.operations.push('Game DVR/백그라운드 녹화 비활성화 (FPS·프레임타임 향상)');
    } catch (error) {
      results.errors.push({ action: 'gameDVR', error: error?.message || '알 수 없는 오류' });
    }

    // 3. 마우스 가속 OFF + 1:1 감도 — FPS 게임 조준 일관성
    onProgress(35, '마우스 가속 비활성화 중...');
    try {
      await setHKCUString(MOUSE, 'MouseSpeed', '0');
      await setHKCUString(MOUSE, 'MouseThreshold1', '0');
      await setHKCUString(MOUSE, 'MouseThreshold2', '0');
      await setHKCUString(MOUSE, 'MouseSensitivity', '10'); // 6/11 = 1:1 (배율 없음)
      results.mouseAccelDisabled = true;
      results.operations.push('마우스 가속 비활성화 (1:1 조준)');
    } catch (error) {
      results.errors.push({ action: 'mouseAccel', error: error?.message || '알 수 없는 오류' });
    }

    // 4. 입력·UI 반응속도 향상
    onProgress(48, '입력·UI 반응속도 향상 중...');
    try {
      await setHKCUString(DESKTOP, 'MenuShowDelay', '0');
      await setHKCUString(DESKTOP, 'AutoEndTasks', '1');
      await setHKCUString(DESKTOP, 'HungAppTimeout', '1000');
      await setHKCUString(DESKTOP, 'WaitToKillAppTimeout', '2000');
      await setHKCUString(KEYBOARD, 'KeyboardDelay', '0');
      results.responsivenessOptimized = true;
      results.operations.push('입력·UI 반응속도 향상 (메뉴 지연 0, 키 반복 지연 최소)');
    } catch (error) {
      results.errors.push({ action: 'responsiveness', error: error?.message || '알 수 없는 오류' });
    }

    // 5. 시각 효과 성능 우선
    onProgress(60, '시각 효과 성능 우선 설정 중...');
    try {
      if (await setHKCUDword(VISUALFX, 'VisualFXSetting', 2)) {
        results.visualEffectsOptimized = true;
        results.operations.push('시각 효과 성능 우선');
      }
    } catch (error) {
      results.errors.push({ action: 'visualEffects', error: error?.message || '알 수 없는 오류' });
    }

    // 2~5의 레지스트리 변경을 재로그인 없이 즉시 적용 (마우스 가속/메뉴 지연 등)
    await applyUserParams();

    // 6. 고성능 전원 계획
    onProgress(72, '고성능 전원 계획 적용 중...');
    if (await registrySnapshot.restorePowerPlan(HIGH_PERFORMANCE_PLAN)) {
      results.powerPlanOptimized = true;
      results.operations.push('고성능 전원 계획 적용');
    }

    // 7. 메모리 최적화 (백그라운드 프로세스 우선순위/정리)
    onProgress(85, '메모리 최적화 중...');
    try {
      const memoryService = require('./memory');
      const memoryResult = await memoryService.optimize({});
      if (memoryResult && memoryResult.success) {
        results.memoryOptimized = true;
        results.operations.push('메모리 최적화');
      }
    } catch (error) {
      results.errors.push({ action: 'memoryOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 8. DNS 캐시 플러시 (핑/응답 개선)
    // 실패해도 결과를 true로 밀어 넣지 않는다 — 안 된 걸 됐다고 보고하면 안 된다.
    onProgress(95, 'DNS 캐시 플러시 중...');
    const dnsFlushed = await execAsync('ipconfig /flushdns', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (dnsFlushed) {
      results.dnsFlushed = true;
      results.operations.push('DNS 캐시 플러시');
    }

    optimizationState.markEnabled(STATE_KEY, snapshot);
    onProgress(100, '완료');

    if (results.errors.length > 0) {
      results.success = false;
    }
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'enableGameMode', error: error?.message || '알 수 없는 오류' });
  }

  return results;
}

// 게임 최적화 해제 — ON을 누르기 직전의 값으로 정확히 되돌린다.
async function disableGameMode(onProgress = () => {}) {
  const results = {
    success: true,
    operations: [],
    errors: [],
  };

  try {
    const snapshot = optimizationState.getSnapshot(STATE_KEY);

    if (!snapshot) {
      // ON을 거치지 않았거나 저장 파일이 사라진 경우 — 되돌릴 기준이 없다.
      // 임의의 "기본값"을 써 넣으면 켜기 전에 없던 설정을 만들어내므로, 아무것도 하지 않는다.
      optimizationState.markDisabled(STATE_KEY);
      onProgress(100, '완료');
      results.operations.push('되돌릴 백업이 없어 시스템 설정은 변경하지 않았습니다');
      return results;
    }

    onProgress(30, '레지스트리 설정 복원 중...');
    const restore = await registrySnapshot.restore(snapshot.values);
    results.operations.push(
      `레지스트리 설정 ${restore.restored}개 복원` +
        (restore.deleted ? `, ${restore.deleted}개 삭제(켜기 전엔 없던 값)` : '') +
        (restore.skipped ? `, ${restore.skipped}개 건너뜀(백업 실패)` : '')
    );
    if (restore.failed > 0) {
      results.errors.push({ action: 'registryRestore', error: `${restore.failed}개 복원 실패` });
    }

    onProgress(70, '설정 즉시 반영 중...');
    await applyUserParams();

    onProgress(88, '전원 계획 복원 중...');
    if (await registrySnapshot.restorePowerPlan(snapshot.powerPlan)) {
      results.operations.push('전원 계획 복원');
    }

    optimizationState.markDisabled(STATE_KEY);
    onProgress(100, '완료');
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'disableGameMode', error: error?.message || '알 수 없는 오류' });
  }

  return results;
}

module.exports = {
  enableGameMode,
  disableGameMode,
};
