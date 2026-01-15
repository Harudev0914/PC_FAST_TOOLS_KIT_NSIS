// ---------
// 2025-06-07
// 개발자 : KR_Tuki
// 기능 : 불필요한 파일 및 캐시 정리
// ---------

// @cleaner.js (1-28)
// 날짜: 2025-06-07
// Import 모듈 설명:
// - fs (promises): 파일 시스템 비동기 접근. 파일/디렉토리 읽기, 삭제, 통계 조회에 사용
//   사용 예: fs.readdir() - 디렉토리 내용 조회, fs.stat() - 파일 통계 조회, fs.unlink() - 파일 삭제, fs.rmdir() - 디렉토리 삭제
// - path: 파일 경로 처리. 경로 조작, 결합, 정규화에 사용
//   사용 예: path.join() - 경로 결합, path.dirname() - 디렉토리 경로 추출
// - os: 운영체제 정보 제공. os.tmpdir(), os.homedir()로 임시 파일 및 사용자 홈 디렉토리 경로 조회
//   사용 예: os.tmpdir() - 시스템 임시 디렉토리 경로, os.homedir() - 사용자 홈 디렉토리 경로
// - child_process (exec): 시스템 명령어 실행. 파일 정리 관련 명령어 실행에 사용
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. 레지스트리 정리 등에 사용
// 변수 설명:
//   - TEMP_PATHS: 정리할 임시 파일 경로 배열
//     * os.tmpdir(): 시스템 임시 디렉토리
//     * AppData\\Local\\Temp: 사용자 임시 디렉토리
//     * Windows\\Temp: 시스템 Windows 임시 디렉토리
//     * INetCache: 인터넷 캐시 디렉토리
//     * History: 인터넷 기록 디렉토리
//   - BROWSER_CACHE_PATHS: 브라우저별 캐시 디렉토리 경로 객체
//     * chrome: Chrome 브라우저 캐시 경로
//     * edge: Microsoft Edge 브라우저 캐시 경로
//     * firefox: Firefox 브라우저 캐시 경로

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const Registry = require('winreg');

const TEMP_PATHS = [
  os.tmpdir(),
  path.join(os.homedir(), 'AppData', 'Local', 'Temp'),
  path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'Temp'),
  path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'INetCache'),
  path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'History'),
];

const BROWSER_CACHE_PATHS = {
  chrome: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
  edge: path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
  firefox: path.join(os.homedir(), 'AppData', 'Local', 'Mozilla', 'Firefox', 'Profiles'),
};

async function scanDirectory(dirPath) {
  const results = {
    files: [],
    totalSize: 0,
    errors: [],
  };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      try {
        if (entry.isDirectory()) {
          const subResults = await scanDirectory(fullPath);
          results.files.push(...subResults.files);
          results.totalSize += subResults.totalSize;
        } else {
          const stats = await fs.stat(fullPath);
          results.files.push({
            path: fullPath,
            size: stats.size,
            modified: stats.mtime,
          });
          results.totalSize += stats.size;
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

async function scan() {
  const scanResults = {
    tempFiles: { files: [], totalSize: 0 },
    browserCache: { files: [], totalSize: 0 },
    registry: { entries: 0 },
    totalSize: 0,
  };

  for (const tempPath of TEMP_PATHS) {
    try {
      const result = await scanDirectory(tempPath);
      scanResults.tempFiles.files.push(...result.files);
      scanResults.tempFiles.totalSize += result.totalSize;
    } catch (error) {
      console.error(`Error scanning ${tempPath}:`, error);
    }
  }

  for (const [browser, cachePath] of Object.entries(BROWSER_CACHE_PATHS)) {
    try {
      const result = await scanDirectory(cachePath);
      scanResults.browserCache.files.push(...result.files);
      scanResults.browserCache.totalSize += result.totalSize;
    } catch (error) {
      console.error(`Error scanning ${browser} cache:`, error);
    }
  }

  try {
    const regKey = new Registry({
      hive: Registry.HKCU,
      key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RecentDocs',
    });

    regKey.keys((err, items) => {
      if (!err && items) {
        scanResults.registry.entries = items.length;
      }
    });
  } catch (error) {
    console.error('Error scanning registry:', error);
  }

  scanResults.totalSize = scanResults.tempFiles.totalSize + scanResults.browserCache.totalSize;

  return scanResults;
}

async function clean(options = {}) {
  const {
    tempFiles = true,
    browserCache = true,
    registry = false,
    safeDelete = true,
  } = options;

  const results = {
    deleted: 0,
    freedSpace: 0,
    errors: [],
  };

  if (tempFiles) {
    for (const tempPath of TEMP_PATHS) {
      try {
        const result = await scanDirectory(tempPath);
        for (const file of result.files) {
          try {
            await fs.unlink(file.path);
            results.deleted++;
            results.freedSpace += file.size;
          } catch (error) {
            results.errors.push({ path: file.path, error: error.message });
          }
        }
      } catch (error) {
        results.errors.push({ path: tempPath, error: error.message });
      }
    }
  }

  if (browserCache) {
    for (const [browser, cachePath] of Object.entries(BROWSER_CACHE_PATHS)) {
      try {
        const result = await scanDirectory(cachePath);
        for (const file of result.files) {
          try {
            await fs.unlink(file.path);
            results.deleted++;
            results.freedSpace += file.size;
          } catch (error) {
            results.errors.push({ path: file.path, error: error.message });
          }
        }
      } catch (error) {
        results.errors.push({ path: cachePath, error: error.message });
      }
    }
  }

  if (registry) {
    try {
      await execAsync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RecentDocs" /f');
    } catch (error) {
      results.errors.push({ path: 'registry', error: error.message });
    }
  }

  return results;
}

module.exports = {
  scan,
  clean,
};