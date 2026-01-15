// @history.js (1-29)
// 날짜: 2025-08-09
// Import 모듈 설명:
// - fs (promises): 파일 시스템 비동기 접근. 브라우저 기록 파일 삭제, 디렉토리 정리에 사용
//   사용 예: fs.unlink() - 파일 삭제, fs.readdir() - 디렉토리 내용 조회, fs.rmdir() - 디렉토리 삭제
// - path: 파일 경로 처리. 브라우저 데이터 경로 조작에 사용
//   사용 예: path.join() - 경로 결합
// - os: 운영체제 정보 제공. os.homedir()로 사용자 홈 디렉토리 경로 조회
// - child_process (exec): 시스템 명령어 실행. Windows 활동 기록 삭제, 레지스트리 삭제에 사용
//   사용 예: execAsync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ActivityHistory" /f') - 활동 기록 레지스트리 삭제
//   execAsync('powershell -Command "Clear-EventLog..."') - 이벤트 로그 삭제
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// 변수 설명:
//   - BROWSER_PATHS: 브라우저별 데이터 파일 경로 객체
//     * chrome: Chrome 브라우저의 history, cache, cookies 파일 경로
//     * edge: Microsoft Edge 브라우저의 history, cache, cookies 파일 경로
//     * firefox: Firefox 브라우저의 Profiles 디렉토리 경로 (history, cache 포함)
// path.join() 사용: os.homedir()와 브라우저별 상대 경로를 결합하여 전체 경로 생성

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const BROWSER_PATHS = {
  chrome: {
    history: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'History'),
    cache: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
    cookies: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cookies'),
  },
  edge: {
    history: path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'History'),
    cache: path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
    cookies: path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cookies'),
  },
  firefox: {
    history: path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles'),
    cache: path.join(os.homedir(), 'AppData', 'Local', 'Mozilla', 'Firefox', 'Profiles'),
  },
};

async function getTypes() {
  return [
    { id: 'browser_history', name: '브라우저 기록', browsers: ['chrome', 'edge', 'firefox'] },
    { id: 'browser_cache', name: '브라우저 캐시', browsers: ['chrome', 'edge', 'firefox'] },
    { id: 'browser_cookies', name: '브라우저 쿠키', browsers: ['chrome', 'edge'] },
    { id: 'windows_activity', name: 'Windows 활동 기록', system: true },
    { id: 'recent_files', name: '최근 파일 목록', system: true },
    { id: 'run_history', name: '실행 기록', system: true },
  ];
}

async function clear(types) {
  const results = {
    cleared: [],
    errors: [],
  };

  for (const type of types) {
    try {
      switch (type) {
        case 'browser_history':
          await clearBrowserHistory();
          results.cleared.push(type);
          break;
        case 'browser_cache':
          await clearBrowserCache();
          results.cleared.push(type);
          break;
        case 'browser_cookies':
          await clearBrowserCookies();
          results.cleared.push(type);
          break;
        case 'windows_activity':
          await clearWindowsActivity();
          results.cleared.push(type);
          break;
        case 'recent_files':
          await clearRecentFiles();
          results.cleared.push(type);
          break;
        case 'run_history':
          await clearRunHistory();
          results.cleared.push(type);
          break;
        default:
          results.errors.push({ type, error: 'Unknown type' });
      }
    } catch (error) {
      results.errors.push({ type, error: error.message });
    }
  }

  return results;
}

async function clearBrowserHistory() {
  try {
    await execAsync('taskkill /F /IM chrome.exe /T');
  } catch (error) {
  }

  try {
    await execAsync('taskkill /F /IM msedge.exe /T');
  } catch (error) {
  }

  for (const [browser, paths] of Object.entries(BROWSER_PATHS)) {
    if (paths.history) {
      try {
        await fs.unlink(paths.history);
      } catch (error) {
        console.error(`Error clearing ${browser} history:`, error.message);
      }
    }
  }
}

async function clearBrowserCache() {
  for (const [browser, paths] of Object.entries(BROWSER_PATHS)) {
    if (paths.cache) {
      try {
        const cacheDir = paths.cache;
        const entries = await fs.readdir(cacheDir);
        for (const entry of entries) {
          try {
            const entryPath = path.join(cacheDir, entry);
            const stats = await fs.stat(entryPath);
            if (stats.isDirectory()) {
              await fs.rmdir(entryPath, { recursive: true });
            } else {
              await fs.unlink(entryPath);
            }
          } catch (error) {
          }
        }
      } catch (error) {
        console.error(`Error clearing ${browser} cache:`, error.message);
      }
    }
  }
}

async function clearBrowserCookies() {
  for (const [browser, paths] of Object.entries(BROWSER_PATHS)) {
    if (paths.cookies) {
      try {
        await fs.unlink(paths.cookies);
      } catch (error) {
        console.error(`Error clearing ${browser} cookies:`, error.message);
      }
    }
  }
}

async function clearWindowsActivity() {
  try {
    await execAsync('powershell -Command "Clear-EventLog -LogName \'Microsoft-Windows-UserDataAccess-UserDataAccess\'"');
    
    await execAsync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ActivityHistory" /f');
  } catch (error) {
    console.error('Error clearing Windows activity:', error.message);
  }
}

async function clearRecentFiles() {
  try {
    await execAsync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RecentDocs" /f');
    await execAsync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RunMRU" /f');
  } catch (error) {
    console.error('Error clearing recent files:', error.message);
  }
}

async function clearRunHistory() {
  try {
    await execAsync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RunMRU" /f');
  } catch (error) {
    console.error('Error clearing run history:', error.message);
  }
}

async function schedule(config) {
  const scheduleFile = path.join(os.homedir(), '.pc-optimizer-schedule.json');
  
  try {
    await fs.writeFile(scheduleFile, JSON.stringify(config, null, 2));
    return { success: true, message: 'Schedule saved' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  getTypes,
  clear,
  schedule,
};