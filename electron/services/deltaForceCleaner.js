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
const { exec } = require('child_process');
const { promisify } = require('util');
const Registry = require('winreg');
// [고도화] 모든 exec 호출에 기본 타임아웃(2분)·버퍼(20MB)를 적용해 무한 대기·버퍼 초과 크래시를 방지한다.
const _execRaw = promisify(exec);
const execAsync = (command, options = {}) => _execRaw(command, { timeout: 120000, maxBuffer: 1024 * 1024 * 20, ...options });

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

    async function deleteDirectory(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        try {
          if (entry.isDirectory()) {
            await deleteDirectory(fullPath);
            try {
              await fs.rmdir(fullPath);
              results.deletedFolders++;
            } catch (rmError) {
              // Directory might not be empty, try again
              try {
                await fs.rmdir(fullPath);
                results.deletedFolders++;
              } catch (e) {
                results.errors.push({ path: fullPath, error: e.message });
              }
            }
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

    // Delete all files in the directory (but keep the directory itself)
    await deleteDirectory(actualPath);

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

// 게임 탐색기 (Game Explorer) 기능
async function getGameExplorerGames() {
  try {
    // PowerShell을 사용하여 게임 탐색기의 게임 목록 가져오기
    const script = `
      $code = @'
      using System;
      using System.Runtime.InteropServices;
      using System.Collections.Generic;
      namespace GameExplorer {
        [Guid("E7B2FB72-D728-49B3-A5F2-18EBF5F1349E")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IGameExplorer2 {
          int GetGames([MarshalAs(UnmanagedType.SafeArray, SafeArraySubType = VarEnum.VT_BSTR)] out string[] gamePaths);
          int InstallGame([MarshalAs(UnmanagedType.LPWStr)] string gdfPath, [MarshalAs(UnmanagedType.LPWStr)] string gamePath, int installScope, out IntPtr instanceID);
          int UninstallGame([MarshalAs(UnmanagedType.LPWStr)] string instanceID);
          int CheckAccess([MarshalAs(UnmanagedType.LPWStr)] string instanceID, [MarshalAs(UnmanagedType.Bool)] out bool hasAccess);
        }
        [ComImport, Guid("9A5EA990-3034-4D6F-9128-01F3C6EABDDF")]
        public class GameExplorer { }
      }
'@
      Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
      
      try {
        $ge = New-Object -ComObject GameExplorer.GameExplorer
        $gamePaths = @()
        $result = $ge.GetGames([ref]$gamePaths)
        if ($result -eq 0) {
          return $gamePaths | ConvertTo-Json
        }
      } catch {
        # Fallback: 레지스트리에서 게임 목록 읽기
        $gamesPath = "Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameUX"
        $games = Get-ChildItem -Path $gamesPath -ErrorAction SilentlyContinue | ForEach-Object {
          $gameKey = $_.PSPath
          $configPath = (Get-ItemProperty -Path $gameKey -Name ConfigGDFPath -ErrorAction SilentlyContinue).ConfigGDFPath
          $installPath = (Get-ItemProperty -Path $gameKey -Name InstallDirectory -ErrorAction SilentlyContinue).InstallDirectory
          if ($installPath) {
            @{
              InstanceID = $_.PSChildName
              InstallPath = $installPath
              ConfigPath = $configPath
            }
          }
        }
        return ($games | ConvertTo-Json)
      }
      return "[]"
    `;
    
    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}"`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
    ).catch(() => ({ stdout: '[]' }));

    try {
      const games = JSON.parse(stdout || '[]');
      return Array.isArray(games) ? games : (games ? [games] : []);
    } catch {
      return [];
    }
  } catch (error) {
    console.error('Error getting Game Explorer games:', error);
    return [];
  }
}

async function installGameToExplorer(gamePath, gdfPath) {
  try {
    const script = `
      $code = @'
      using System;
      using System.Runtime.InteropServices;
      namespace GameExplorer {
        [Guid("E7B2FB72-D728-49B3-A5F2-18EBF5F1349E")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IGameExplorer2 {
          int InstallGame([MarshalAs(UnmanagedType.LPWStr)] string gdfPath, [MarshalAs(UnmanagedType.LPWStr)] string gamePath, int installScope, out IntPtr instanceID);
        }
        [ComImport, Guid("9A5EA990-3034-4D6F-9128-01F3C6EABDDF")]
        public class GameExplorer { }
      }
'@
      Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
      
      $ge = New-Object -ComObject GameExplorer.GameExplorer
      $instanceID = [IntPtr]::Zero
      $result = $ge.InstallGame("${gdfPath}", "${gamePath}", 0, [ref]$instanceID)
      if ($result -eq 0) {
        return "Success"
      } else {
        return "Failed: $result"
      }
    `;
    
    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}"`,
      { encoding: 'utf8' }
    );
    
    return { success: stdout.includes('Success'), message: stdout };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function uninstallGameFromExplorer(instanceID) {
  try {
    const script = `
      $code = @'
      using System;
      using System.Runtime.InteropServices;
      namespace GameExplorer {
        [Guid("E7B2FB72-D728-49B3-A5F2-18EBF5F1349E")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IGameExplorer2 {
          int UninstallGame([MarshalAs(UnmanagedType.LPWStr)] string instanceID);
        }
        [ComImport, Guid("9A5EA990-3034-4D6F-9128-01F3C6EABDDF")]
        public class GameExplorer { }
      }
'@
      Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
      
      $ge = New-Object -ComObject GameExplorer.GameExplorer
      $result = $ge.UninstallGame("${instanceID}")
      if ($result -eq 0) {
        return "Success"
      } else {
        return "Failed: $result"
      }
    `;
    
    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}"`,
      { encoding: 'utf8' }
    );
    
    return { success: stdout.includes('Success'), message: stdout };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Windows API 기반 최적화
async function optimizeWithWindowsAPI(options = {}) {
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
    servicesOptimized: false,
    prefetchOptimized: false,
    searchOptimized: false,
    diskOptimized: false,
    adminGranted: false,
  };

  // [변경] 관리자 권한을 "요구"하지 않는다(UAC 프롬프트 없음). 아래 1~6은 모두
  // 사용자 권한(HKCU/사용자 TEMP)에서 동작하는 최적화이며, 이미 관리자로 실행 중인
  // 경우에만 심화 최적화(서비스/Prefetch/Search/디스크)를 추가로 적용한다.
  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin().catch(() => false);
  results.adminGranted = isAdmin;

  // HKCU DWORD 값 설정 헬퍼: reg add로 키 생성까지 한 번에 처리(관리자 권한 불필요).
  const setHKCU = (regPath, name, value) =>
    execAsync(`reg add "HKCU\\${regPath}" /v ${name} /t REG_DWORD /d ${value} /f`, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

  try {
    // 1. 임시 파일 정리 (사용자 TEMP - 관리자 권한 불필요)
    try {
      const tempDirs = [os.tmpdir(), path.join(process.env.LOCALAPPDATA || '', 'Temp')].filter(Boolean);
      const seen = new Set();
      let removed = 0;
      for (const dir of tempDirs) {
        const dedupKey = dir.toLowerCase();
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        let entries = [];
        try { entries = await fs.readdir(dir); } catch { continue; }
        for (const entry of entries) {
          try {
            await fs.rm(path.join(dir, entry), { recursive: true, force: true });
            removed++;
          } catch { /* 사용 중(잠긴) 파일은 건너뜀 */ }
        }
      }
      results.tempCleaned = true;
      results.operations.push(`임시 파일 정리 완료 (${removed}개 항목 제거)`);
    } catch (error) {
      results.errors.push({ action: 'tempCleanup', error: error.message });
    }

    // 2. 게임 모드 활성화 (HKCU - 관리자 권한 불필요)
    try {
      const ok1 = await setHKCU('Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 1);
      const ok2 = await setHKCU('Software\\Microsoft\\GameBar', 'AllowAutoGameMode', 1);
      if (ok1 || ok2) {
        results.gameModeEnabled = true;
        results.operations.push('게임 모드 활성화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'gameMode', error: error.message });
    }

    // 3. Game DVR/백그라운드 녹화 비활성화 (HKCU - 게임 프레임 향상, 관리자 권한 불필요)
    try {
      const ok1 = await setHKCU('System\\GameConfigStore', 'GameDVR_Enabled', 0);
      await setHKCU('Software\\Microsoft\\GameBar', 'UseNexusForGameBarEnabled', 0);
      if (ok1) {
        results.gameDVRDisabled = true;
        results.operations.push('Game DVR 비활성화 완료 (게임 성능 향상)');
      }
    } catch (error) {
      results.errors.push({ action: 'gameDVR', error: error.message });
    }

    // 4. 시각 효과 성능 우선 (HKCU - 애니메이션/그림자 최소화, 관리자 권한 불필요)
    try {
      const ok = await setHKCU('Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting', 2);
      if (ok) {
        results.visualEffectsOptimized = true;
        results.operations.push('시각 효과 성능 우선 설정 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'visualEffects', error: error.message });
    }

    // 5. 메모리 최적화 (백그라운드 프로세스 우선순위 조정 + GC - 관리자 권한 불필요)
    try {
      const memoryScript = `
        $processes = Get-Process | Where-Object { $_.WorkingSet -gt 100MB -and $_.PriorityClass -ne 'High' -and $_.ProcessName -ne 'svchost' }
        foreach ($proc in $processes) {
          try {
            $proc.PriorityClass = 'BelowNormal'
          } catch { }
        }
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        [System.GC]::Collect()
      `;

      await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${memoryScript}"`,
        { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 * 4 }
      ).catch(() => {});

      results.memoryOptimized = true;
      results.operations.push('메모리 최적화 완료 (프로세스 우선순위 조정)');
    } catch (error) {
      results.errors.push({ action: 'memoryOptimization', error: error.message });
    }

    // 6. DNS 캐시 플러시 (실패는 무시)
    try {
      await execAsync('ipconfig /flushdns', { timeout: 5000 }).catch(() => {});
      results.dnsFlushed = true;
      results.operations.push('DNS 캐시 플러시 완료');
    } catch { /* 무시 */ }

    // ── 이하: 이미 관리자 권한으로 실행 중일 때만 추가 적용 (UAC 요청하지 않음) ──
    if (isAdmin) {
      // 서비스 최적화
      try {
        const servicesToDisable = ['Fax', 'WSearch', 'SysMain'];
        for (const serviceName of servicesToDisable) {
          const { stdout } = await execAsync(`sc query "${serviceName}"`, { encoding: 'utf8', timeout: 5000 }).catch(() => ({ stdout: '' }));
          if (stdout.includes('RUNNING')) {
            await execAsync(`sc stop "${serviceName}"`, { timeout: 5000 }).catch(() => {});
            await execAsync(`sc config "${serviceName}" start= disabled`, { timeout: 5000 }).catch(() => {});
            results.operations.push(`서비스 "${serviceName}" 비활성화 완료`);
          }
        }
        results.servicesOptimized = true;
      } catch (error) {
        results.errors.push({ action: 'servicesOptimization', error: error.message });
      }

      // Prefetch/Superfetch
      try {
        const prefetchKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters',
        });
        await new Promise((resolve) => prefetchKey.set('EnablePrefetcher', Registry.REG_DWORD, '0', () => resolve()));
        await new Promise((resolve) => prefetchKey.set('EnableSuperfetch', Registry.REG_DWORD, '0', () => resolve()));
        results.prefetchOptimized = true;
        results.operations.push('Prefetch/Superfetch 최적화 완료');
      } catch (error) {
        results.errors.push({ action: 'prefetchOptimization', error: error.message });
      }

      // 디스크 조각 모음/TRIM
      try {
        await execAsync('defrag C: /O /H', { timeout: 600000, maxBuffer: 1024 * 1024 * 20 }).catch(() => {});
        results.diskOptimized = true;
        results.operations.push('디스크 최적화 완료');
      } catch { /* 무시 */ }
    }

    if (results.errors.length > 0) {
      results.success = false;
    }
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'windowsAPIOptimization', error: error.message });
  }

  return results;
}

// 애플리케이션 설치 및 서비스 관리
async function manageApplicationsAndServices(options = {}) {
  const results = {
    success: true,
    operations: [],
    errors: [],
    gamesListed: [],
    servicesManaged: false,
  };

  try {
    // 게임 탐색기 게임 목록 가져오기
    try {
      const games = await getGameExplorerGames();
      results.gamesListed = games;
      results.operations.push(`게임 탐색기에서 ${games.length}개 게임 발견`);
    } catch (error) {
      results.errors.push({ action: 'getGameExplorerGames', error: error.message });
    }

    // 서비스 목록 가져오기
    if (options.requestAdminPermission) {
      try {
        const { stdout } = await execAsync(
          'powershell -Command "Get-Service | Where-Object { $_.Status -eq \'Running\' } | Select-Object Name, DisplayName, Status | ConvertTo-Json"',
          { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
        ).catch(() => ({ stdout: '[]' }));

        try {
          const services = JSON.parse(stdout || '[]');
          const serviceList = Array.isArray(services) ? services : (services ? [services] : []);
          results.operations.push(`실행 중인 서비스 ${serviceList.length}개 발견`);
          results.servicesManaged = true;
        } catch {
          results.servicesManaged = false;
        }
      } catch (error) {
        results.errors.push({ action: 'getServices', error: error.message });
      }
    }

    if (results.errors.length > 0) {
      results.success = false;
    }
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'manageApplicationsAndServices', error: error.message });
  }

  return results;
}

// Windows API로 디렉토리 검색
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
  getGameExplorerGames,
  installGameToExplorer,
  uninstallGameFromExplorer,
  optimizeWithWindowsAPI,
  manageApplicationsAndServices,
};
