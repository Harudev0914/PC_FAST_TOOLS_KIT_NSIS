// @deltaForceCleaner.js (1-9)
// 날짜: 2025-12-14
// Import 모듈 설명:
// - fs (promises): 파일 시스템 비동기 접근. 게임 로그 파일 스캔 및 삭제에 사용
//   사용 예: fs.readdir() - 디렉토리 내용 조회, fs.stat() - 파일 통계 조회, fs.unlink() - 파일 삭제, fs.rmdir() - 디렉토리 삭제
// - path: 파일 경로 처리. 게임 로그 경로 조작에 사용
//   사용 예: path.join() - 경로 결합
// - os: 운영체제 정보 제공. os.homedir()로 사용자 홈 디렉토리 경로 조회
// - child_process (exec): 시스템 명령어 실행. Windows API로 디렉토리 검색에 사용
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근 (현재 미사용, 향후 확장용)
// 변수 설명:
//   - DEFAULT_PATH: Delta Force 게임 로그 기본 경로
//     path.join(os.homedir(), 'Delta Force', 'Game', 'DeltaForce', 'Saved', 'Logs')
//     Steam 설치 시 일반적인 Delta Force 로그 파일 위치

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { app } = require('electron');
const { execAsync } = require('./_exec');
const optimizationState = require('./optimizationState');
const registrySnapshot = require('./registrySnapshot');

const WINDOWS_BOOST_STATE_KEY = 'windowsboost';

const DEFAULT_PATH = path.join(os.homedir(), 'Delta Force', 'Game', 'DeltaForce', 'Saved', 'Logs');

async function scanDirectory(dirPath) {
  const results = {
    files: [],
    folders: [],
    totalSize: 0,
    fileCount: 0,
    folderCount: 0,
    errors: [],
  };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      try {
        if (entry.isDirectory()) {
          results.folders.push({
            path: fullPath,
            name: entry.name,
          });
          results.folderCount++;
          
          // Recursively scan subdirectories
          const subResults = await scanDirectory(fullPath);
          results.files.push(...subResults.files);
          results.folders.push(...subResults.folders);
          results.totalSize += subResults.totalSize;
          results.fileCount += subResults.fileCount;
          results.folderCount += subResults.folderCount;
        } else {
          const stats = await fs.stat(fullPath);
          results.files.push({
            path: fullPath,
            name: entry.name,
            size: stats.size,
            modified: stats.mtime,
          });
          results.totalSize += stats.size;
          results.fileCount++;
        }
      } catch (error) {
        results.errors.push({ path: fullPath, error: error.message });
      }
    }
  } catch (error) {
    results.errors.push({ path: dirPath, error: error.message });
  }

  return results;
}

async function scan(dirPath = DEFAULT_PATH) {
  try {
    // Replace ~ with home directory if present
    let actualPath = dirPath;
    if (dirPath && dirPath.startsWith('~')) {
      actualPath = path.join(os.homedir(), dirPath.substring(2));
    } else if (!dirPath || dirPath === '~\\Delta Force\\Game\\DeltaForce\\Saved\\Logs') {
      actualPath = DEFAULT_PATH;
    }

    // Check if directory exists
    try {
      await fs.access(actualPath);
    } catch (error) {
      return {
        success: false,
        error: '디렉토리를 찾을 수 없습니다.',
        path: actualPath,
      };
    }

    const results = await scanDirectory(actualPath);
    
    return {
      success: true,
      path: actualPath,
      files: results.files,
      folders: results.folders,
      totalSize: results.totalSize,
      fileCount: results.fileCount,
      folderCount: results.folderCount,
      errors: results.errors,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path: dirPath,
    };
  }
}

// 디렉터리 내용을 재귀 삭제한다(디렉터리 자체는 남긴다). 카운터를 인자로 받아 누적한다.
// 실패한 항목은 errors에 쌓고 나머지는 계속 지운다 — 잠긴 파일 하나 때문에 전체가 멈추지 않는다.
async function deleteDirectoryContents(dir, results) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    try {
      if (entry.isDirectory()) {
        await deleteDirectoryContents(fullPath, results);
        await fs.rmdir(fullPath);
        results.deletedFolders++;
      } else {
        const stats = await fs.stat(fullPath);
        await fs.unlink(fullPath);
        results.deletedFiles++;
        results.freedSpace += stats.size;
      }
    } catch (error) {
      results.errors.push({ path: fullPath, error: error.message });
    }
  }
}

async function clean(dirPath = DEFAULT_PATH) {
  const results = {
    deletedFiles: 0,
    deletedFolders: 0,
    freedSpace: 0,
    errors: [],
  };

  try {
    // Replace ~ with home directory if present
    let actualPath = dirPath;
    if (dirPath && dirPath.startsWith('~')) {
      actualPath = path.join(os.homedir(), dirPath.substring(2));
    } else if (!dirPath || dirPath === '~\\Delta Force\\Game\\DeltaForce\\Saved\\Logs') {
      actualPath = DEFAULT_PATH;
    }

    // Check if directory exists
    try {
      await fs.access(actualPath);
    } catch (error) {
      return {
        success: false,
        error: '디렉토리를 찾을 수 없습니다.',
        path: actualPath,
      };
    }

    // 디렉터리 자체는 남기고 내용만 비운다
    await deleteDirectoryContents(actualPath, results);

    return {
      success: true,
      path: actualPath,
      deletedFiles: results.deletedFiles,
      deletedFolders: results.deletedFolders,
      freedSpace: results.freedSpace,
      errors: results.errors,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path: dirPath,
    };
  }
}

// 사용자 TEMP 폴더 정리.
//
// 예전 구현은 %TEMP%와 %LOCALAPPDATA%\Temp의 모든 항목을 조건 없이 재귀 삭제했다. 그런데 이 앱
// 자신(Electron/Chromium)이 바로 그 폴더에 렌더러 스크래치 파일을 만든다 — 실행 중에 그걸 지우자
// 렌더러가 "Execution context was destroyed"로 죽었다. 즉 앱이 자기 발밑을 파고 있었다.
//
// 그래서 두 가지를 모두 만족하는 항목만 지운다:
//   (1) 이 앱이 켜지기 전에 만들어진 것  → 우리가 지금 쓰고 있는 파일은 절대 건드리지 않는다
//   (2) 최근 1시간 안에 손대지 않은 것    → 다른 앱이 쓰고 있는 파일도 건드리지 않는다
// 여기에 Electron이 관리하는 경로(userData 등)를 명시적으로 제외하고, 잠긴 파일은 건너뛴다.
const RECENTLY_USED_MS = 60 * 60 * 1000;

// 삭제해도 되는 항목인지 판정한다. Electron에 의존하지 않는 순수 함수라 단위 테스트로 고정해 둔다.
// cutoff: 이 시각보다 "먼저" 마지막으로 수정된 항목만 삭제 대상이다.
// protectedPaths: 앱이 관리하는 경로(소문자, 절대경로). 이 경로 자신 또는 그 조상은 건드리지 않는다.
function isSafeToDeleteTempEntry(fullPath, mtimeMs, cutoff, protectedPaths) {
  const lower = path.resolve(fullPath).toLowerCase();

  // 보호 경로 자신이거나, 보호 경로를 품고 있는 조상 디렉터리면 삭제 금지
  // (예: %TEMP%\foo 를 지우면 %TEMP%\foo\bar 인 userData까지 날아간다)
  for (const p of protectedPaths) {
    if (p === lower || p.startsWith(lower + path.sep)) return false;
  }

  // 아직 쓰이고 있을 수 있는 항목 (앱 시작 후 생성됐거나 최근에 손댄 것)
  if (mtimeMs >= cutoff) return false;

  return true;
}

// Electron이 앱 데이터를 두는 경로들. 보통 %TEMP% 밖이지만, 포터블 실행이나 --user-data-dir로
// TEMP 안을 가리킬 수 있으므로 방어적으로 제외 목록에 넣는다.
function protectedTempPaths() {
  const paths = [];
  for (const name of ['userData', 'sessionData', 'crashDumps', 'logs']) {
    try {
      paths.push(path.resolve(app.getPath(name)).toLowerCase());
    } catch { /* 해당 플랫폼에 없는 경로는 무시 */ }
  }
  return paths;
}

async function cleanTempDirs() {
  // process.uptime()은 초 단위 — 이 프로세스가 시작한 절대 시각을 구한다.
  const appStartedAt = Date.now() - process.uptime() * 1000;
  const notTouchedSince = Date.now() - RECENTLY_USED_MS;
  const cutoff = Math.min(appStartedAt, notTouchedSince);
  const protectedPaths = protectedTempPaths();

  const tempDirs = [os.tmpdir(), path.join(process.env.LOCALAPPDATA || '', 'Temp')].filter(Boolean);
  const seenDirs = new Set();
  let removed = 0;
  let skipped = 0;

  for (const dir of tempDirs) {
    const dedupKey = path.resolve(dir).toLowerCase();
    if (seenDirs.has(dedupKey)) continue;
    seenDirs.add(dedupKey);

    let entries = [];
    try { entries = await fs.readdir(dir); } catch { continue; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);

      let stats;
      try {
        stats = await fs.stat(fullPath);
      } catch {
        skipped++; // stat조차 안 되면 잠긴 항목 — 건드리지 않는다
        continue;
      }

      if (!isSafeToDeleteTempEntry(fullPath, stats.mtimeMs, cutoff, protectedPaths)) {
        skipped++;
        continue;
      }

      try {
        await fs.rm(fullPath, { recursive: true, force: true });
        removed++;
      } catch {
        skipped++; // 사용 중(잠긴) 파일
      }
    }
  }

  return { removed, skipped };
}
// Windows Boost — 사용자 권한으로 즉시 적용 가능한 최적화.
//
// 관리자 권한 항목(서비스 비활성화, Prefetch/Superfetch, 디스크 조각모음)은 UAC 없이는 어차피
// 실패하므로 아예 넣지 않는다. 여기서 건드리는 값은 HKCU와 사용자 TEMP뿐이다.
//
// OFF는 "Windows 기본값"이 아니라 "ON을 누르기 직전의 값"으로 되돌린다 — 적용 직전에 스냅샷을
// 찍어 두고 restoreWindowsDefaults가 그대로 복원한다.
// 임시 파일 삭제와 DNS 플러시는 되돌릴 수 있는 대상이 아니므로 스냅샷에 넣지 않는다.
const GAMEBAR = 'Software\\Microsoft\\GameBar';
const GAMECONFIG = 'System\\GameConfigStore';
const VISUALFX = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects';

const TOUCHED_VALUES = [
  { regPath: GAMEBAR, name: 'AutoGameModeEnabled' },
  { regPath: GAMEBAR, name: 'AllowAutoGameMode' },
  { regPath: GAMEBAR, name: 'UseNexusForGameBarEnabled' },
  { regPath: GAMECONFIG, name: 'GameDVR_Enabled' },
  { regPath: VISUALFX, name: 'VisualFXSetting' },
].map((entry) => ({ ...entry, hive: 'HKCU' }));

// HKCU DWORD 설정 헬퍼: reg add로 키 생성까지 한 번에 처리(관리자 권한 불필요).
const setHKCU = (regPath, name, value) =>
  execAsync(`reg add "HKCU\\${regPath}" /v ${name} /t REG_DWORD /d ${value} /f`, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);

// 레지스트리 변경(시각 효과 등)을 재로그인 없이 즉시 반영
const applyUserParams = () =>
  execAsync('rundll32.exe user32.dll,UpdatePerUserSystemParameters 1, True', { timeout: 8000 }).catch(() => {});

// 백그라운드 프로세스 우선순위를 일괄 조정한다.
// 적용: 100MB 이상 쓰는 프로세스를 BelowNormal로 → 해제: BelowNormal인 것을 Normal로.
// 프로세스는 뜨고 지므로 스냅샷 대상이 아니다(적용 시점의 PID를 나중에 되돌릴 수 없다).
async function setBackgroundPriority(target) {
  const script =
    target === 'BelowNormal'
      ? "$p = Get-Process | Where-Object { $_.WorkingSet -gt 100MB -and $_.PriorityClass -ne 'High' -and $_.ProcessName -ne 'svchost' }"
      : "$p = Get-Process | Where-Object { $_.PriorityClass -eq 'BelowNormal' }";

  await execAsync(
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; ${script}; foreach ($x in $p) { try { $x.PriorityClass = '${target}' } catch { } }"`,
    { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 * 4 }
  ).catch(() => {});
}

async function optimizeWithWindowsAPI(onProgress = () => {}) {
  const results = {
    success: true,
    operations: [],
    errors: [],
    tempCleaned: false,
    memoryOptimized: false,
    gameModeEnabled: false,
    gameDVRDisabled: false,
    visualEffectsOptimized: false,
    dnsFlushed: false,
  };

  try {
    // 0. 무엇을 바꾸기 전에 지금 값을 찍어 둔다. OFF는 이 값으로 되돌린다.
    onProgress(3, '현재 설정 백업 중...');
    const snapshot = { values: await registrySnapshot.capture(TOUCHED_VALUES) };

    // 1. 임시 파일 정리 (되돌릴 수 없음 — 스냅샷 대상 아님)
    onProgress(12, '임시 파일 정리 중...');
    try {
      const { removed, skipped } = await cleanTempDirs();
      results.tempCleaned = true;
      results.operations.push(
        `임시 파일 정리 완료 (${removed}개 제거, 사용 중인 ${skipped}개는 건너뜀)`
      );
    } catch (error) {
      results.errors.push({ action: 'tempCleanup', error: error.message });
    }

    // 2. 게임 모드 활성화
    onProgress(35, '게임 모드 활성화 중...');
    try {
      const ok1 = await setHKCU(GAMEBAR, 'AutoGameModeEnabled', 1);
      const ok2 = await setHKCU(GAMEBAR, 'AllowAutoGameMode', 1);
      if (ok1 || ok2) {
        results.gameModeEnabled = true;
        results.operations.push('게임 모드 활성화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'gameMode', error: error.message });
    }

    // 3. Game DVR/백그라운드 녹화 비활성화 (게임 프레임 향상)
    onProgress(50, 'Game DVR 비활성화 중...');
    try {
      const ok = await setHKCU(GAMECONFIG, 'GameDVR_Enabled', 0);
      await setHKCU(GAMEBAR, 'UseNexusForGameBarEnabled', 0);
      if (ok) {
        results.gameDVRDisabled = true;
        results.operations.push('Game DVR 비활성화 완료 (게임 성능 향상)');
      }
    } catch (error) {
      results.errors.push({ action: 'gameDVR', error: error.message });
    }

    // 4. 시각 효과 성능 우선 (애니메이션/그림자 최소화)
    onProgress(62, '시각 효과 성능 우선 설정 중...');
    try {
      if (await setHKCU(VISUALFX, 'VisualFXSetting', 2)) {
        results.visualEffectsOptimized = true;
        results.operations.push('시각 효과 성능 우선 설정 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'visualEffects', error: error.message });
    }

    await applyUserParams();

    // 5. 메모리 최적화 (백그라운드 프로세스 우선순위 조정)
    onProgress(78, '메모리 최적화 중...');
    await setBackgroundPriority('BelowNormal');
    results.memoryOptimized = true;
    results.operations.push('메모리 최적화 완료 (프로세스 우선순위 조정)');

    // 6. DNS 캐시 플러시 (되돌릴 대상 아님)
    // 실패해도 true로 밀어 넣지 않는다 — 안 된 걸 됐다고 보고하면 안 된다.
    onProgress(92, 'DNS 캐시 플러시 중...');
    const dnsFlushed = await execAsync('ipconfig /flushdns', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (dnsFlushed) {
      results.dnsFlushed = true;
      results.operations.push('DNS 캐시 플러시 완료');
    }

    optimizationState.markEnabled(WINDOWS_BOOST_STATE_KEY, snapshot);
    onProgress(100, '완료');

    if (results.errors.length > 0) {
      results.success = false;
    }
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'windowsAPIOptimization', error: error.message });
  }

  return results;
}

// Windows Boost 해제 — ON을 누르기 직전의 값으로 정확히 되돌린다.
async function restoreWindowsDefaults(onProgress = () => {}) {
  const results = {
    success: true,
    operations: [],
    errors: [],
  };

  try {
    const snapshot = optimizationState.getSnapshot(WINDOWS_BOOST_STATE_KEY);

    if (!snapshot) {
      // ON을 거치지 않았거나 저장 파일이 사라진 경우 — 되돌릴 기준이 없다.
      // 임의의 "기본값"을 써 넣으면 켜기 전에 없던 설정을 만들어내므로 아무것도 하지 않는다.
      optimizationState.markDisabled(WINDOWS_BOOST_STATE_KEY);
      onProgress(100, '완료');
      results.operations.push('되돌릴 백업이 없어 시스템 설정은 변경하지 않았습니다');
      return results;
    }

    onProgress(35, '레지스트리 설정 복원 중...');
    const restore = await registrySnapshot.restore(snapshot.values);
    results.operations.push(
      `레지스트리 설정 ${restore.restored}개 복원` +
        (restore.deleted ? `, ${restore.deleted}개 삭제(켜기 전엔 없던 값)` : '') +
        (restore.skipped ? `, ${restore.skipped}개 건너뜀(백업 실패)` : '')
    );
    if (restore.failed > 0) {
      results.errors.push({ action: 'registryRestore', error: `${restore.failed}개 복원 실패` });
    }

    onProgress(65, '설정 즉시 반영 중...');
    await applyUserParams();

    onProgress(85, '프로세스 우선순위 복원 중...');
    await setBackgroundPriority('Normal');
    results.operations.push('프로세스 우선순위 복원 (Normal)');

    optimizationState.markDisabled(WINDOWS_BOOST_STATE_KEY);
    onProgress(100, '완료');
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'restoreWindowsDefaults', error: error.message });
  }

  return results;
}


async function findDirectory() {
  try {
    // [고도화] 존재하지 않던 searchDirectoryWithWindowsAPI 호출로 항상 예외였음.
    // scan()이 DEFAULT_PATH를 기본·폴백으로 쓰므로 기본 경로를 사용해 자동 탐색을 동작시킨다.
    const foundPath = DEFAULT_PATH;
    if (foundPath) {
      // 찾은 경로를 스캔하여 파일 정보 가져오기
      const scanResult = await scan(foundPath);
      return {
        success: true,
        path: foundPath,
        scanResult: scanResult,
      };
    } else {
      return {
        success: false,
        error: 'Delta Force Logs 디렉토리를 찾을 수 없습니다.',
        path: null,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || '디렉토리 검색 중 오류가 발생했습니다.',
      path: null,
    };
  }
}

module.exports = {
  scan,
  clean,
  DEFAULT_PATH,
  findDirectory,
  optimizeWithWindowsAPI,
  restoreWindowsDefaults,
  isSafeToDeleteTempEntry, // 테스트용 — 임시 파일 삭제 가드를 고정한다
};
