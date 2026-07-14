// @disk.js (1-16)
// 날짜: 2025-04-23
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. 휴지통 비우기, powercfg, Storage Sense 설정 등에 사용
//   사용 예: execAsync('rd /s /q "..."') - 폴더 삭제, execAsync('powercfg /setactive SCHEME_CURRENT') - 전원 계획 적용
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - os: 운영체제 정보 제공. os.tmpdir()로 임시 스크립트 경로 생성
// - fs: 파일 시스템 접근. 디스크 파일 읽기/쓰기/삭제에 사용
// - path: 파일 경로 처리. 경로 조작 및 정규화에 사용
// - cleaner (cleanerService): 파일 정리 서비스. clean() 함수로 임시 파일 정리
//   사용 예: cleanerService.clean({ tempFiles: true, browserCache: true }) - 임시 파일 및 브라우저 캐시 정리
// - diskDetails (diskDetailsService): 디스크 상세 정보 조회. getDiskDetails() 함수로 디스크 타입 확인
//   사용 예: diskDetailsService.getDiskDetails('C:') - C 드라이브의 디스크 타입(SSD/HDD) 조회
// 이 서비스는 사용자 권한(user-level)에서만 동작한다. 관리자 권한이 필요한 작업(defrag/chkdsk/DISM,
// fsutil, HKLM 레지스트리 기록, 시스템 폴더 삭제 등)은 수행하지 않는다.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execAsync, withTimeout: timeout } = require('./_exec');
const cleanerService = require('./cleaner');
const diskDetailsService = require('./diskDetails');

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

// optimize 함수: 사용자 권한으로 가능한 디스크 최적화 수행
// 매개변수: options - { diskLetter: string } 최적화 대상 드라이브
// (임시 파일/휴지통/캐시 정리, Storage Sense, powercfg 디스크 전원 설정, I/O 우선순위 조정)

async function optimize(options = {}) {
  // [보안] diskLetter를 단일 드라이브 문자로 검증·정규화한다.
  const _dl = /^([A-Za-z]):?$/.exec(String(options.diskLetter ?? 'C'));
  const diskLetter = (_dl ? _dl[1].toUpperCase() : 'C') + ':';

  const results = {
    success: true,
    operations: [],
    errors: [],
    tempFilesCleaned: false,
    cacheOptimized: false,
    ioPriorityOptimized: false,
    spindownOptimized: false,
    freedSpace: 0,
  };

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
            results.errors.push({ operation: '임시 파일 정리', error: error.message });
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
            results.errors.push({ operation: '휴지통 비우기', error: error.message });
          }
        })(),
        10000
      ).catch(() => {}),
    ];

    await Promise.all(parallelDiskTasks);

    // [고도화] 사용자 권한으로 가능한 추가 정리 — Storage Sense 자동 정리 활성화 + 캐시 정리
    try {
      // Storage Sense 켜기(임시/휴지통 자동 정리) — 전부 HKCU라 사용자 권한으로 충분
      const ssBase = 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy';
      const ssCommands = [
        `reg add "${ssBase}" /v 01 /t REG_DWORD /d 1 /f`,
        `reg add "${ssBase}" /v 08 /t REG_DWORD /d 1 /f`,
        `reg add "${ssBase}" /v 256 /t REG_DWORD /d 1 /f`,
        `reg add "${ssBase}" /v 2048 /t REG_DWORD /d 30 /f`,
      ];
      // 실제로 모두 성공한 경우에만 완료로 보고한다(허위 성공 보고 방지).
      const ssResults = await Promise.all(
        ssCommands.map(cmd => execAsync(cmd, { timeout: 5000 }).then(() => true).catch(() => false))
      );
      if (ssResults.every(Boolean)) {
        results.operations.push('Storage Sense 자동 정리 활성화');
      } else {
        results.errors.push({ operation: 'Storage Sense', error: 'Storage Sense 설정 적용 실패' });
      }
    } catch (error) {
      results.errors.push({ operation: 'Storage Sense', error: error.message });
    }

    try {
      // 썸네일/아이콘 캐시 정리 (사용 중이지 않은 .db 파일만 삭제, 잠긴 파일은 건너뜀)
      const explorerCache = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Explorer');
      let cacheDeleted = 0;
      if (fs.existsSync(explorerCache)) {
        for (const f of fs.readdirSync(explorerCache)) {
          if (/^(thumbcache|iconcache)_.*\.db$/i.test(f)) {
            try { fs.unlinkSync(path.join(explorerCache, f)); cacheDeleted++; } catch (e) {}
          }
        }
      }
      if (cacheDeleted > 0) results.operations.push(`썸네일/아이콘 캐시 ${cacheDeleted}개 정리`);
    } catch (error) {
      results.errors.push({ operation: '캐시 정리', error: error.message });
    }

    // 디스크 캐시(쓰기 캐시 버퍼 플러시 정책) 최적화 — powercfg는 사용자 권한으로 동작한다.
    // (기존의 HKLM Class\{4d36e97b...}\EnableReadAhead 레지스트리 기록은 관리자 권한이 필요해 제거)
    try {
      await timeout(
        (async () => {
          await execAsync('powercfg /setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 50397f86-ef36-4b77-a03e-3411e37a0960 1');
          await execAsync('powercfg /setactive SCHEME_CURRENT');
        })(),
        10000
      );

      results.cacheOptimized = true;
      results.operations.push('디스크 캐시 최적화 완료');
    } catch (error) {
      results.errors.push({ operation: '디스크 캐시 최적화', error: error.message });
    }

    // 디스크 I/O 우선순위 조정 — 사용자 소유 프로세스의 우선순위 조정이라 사용자 권한으로 동작한다.
    // 실제로 우선순위가 변경된 프로세스 수를 세어, 0개면 성공으로 보고하지 않는다(허위 성공 보고 방지).
    try {
      const psCommand = `
$ok = 0
$importantProcs = Get-Process -Name "explorer","dwm" -ErrorAction SilentlyContinue
foreach ($proc in $importantProcs) {
  try {
    $proc.PriorityClass = "High"
    $ok++
  } catch {}
}
Write-Output $ok
      `.trim();

      const tempScript = path.join(os.tmpdir(), `io_priority_${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, psCommand, 'utf8');

      try {
        const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`, { timeout: 10000 });
        const adjusted = parseInt(String(stdout).trim(), 10) || 0;
        if (adjusted > 0) {
          results.ioPriorityOptimized = true;
          results.operations.push(`디스크 I/O 우선순위 조정 완료 (${adjusted}개 프로세스)`);
        } else {
          results.errors.push({ operation: '디스크 I/O 우선순위 조정', error: '우선순위를 조정할 수 있는 프로세스가 없음' });
        }
      } finally {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {}
      }
    } catch (error) {
      results.errors.push({ operation: '디스크 I/O 우선순위 조정', error: error.message });
    }

    // HDD 스핀다운(디스크 절전 해제) 최적화 — powercfg는 사용자 권한으로 동작한다.
    // (기존의 HKLM Control\Power\HibernateEnabled 레지스트리 기록은 관리자 권한이 필요해 제거)
    try {
      const diskType = await getDiskType(diskLetter);

      if (diskType === 'HDD') {
        await execAsync('powercfg /setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0');
        await execAsync('powercfg /setactive SCHEME_CURRENT');

        results.spindownOptimized = true;
        results.operations.push('HDD 스핀다운 최적화 완료');
      } else {
        results.operations.push('SSD는 스핀다운 최적화가 필요하지 않음');
      }
    } catch (error) {
      results.errors.push({ operation: '디스크 스핀다운 최적화', error: error.message });
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
