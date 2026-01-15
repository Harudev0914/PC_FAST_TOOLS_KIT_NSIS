// @platform.js (1-10)
// 날짜: 2025-07-04
// Import 모듈 설명:
// - systeminformation (si): 시스템 정보 수집 라이브러리. OS 정보 조회에 사용
//   사용 예: si.osInfo() - 운영체제 정보 조회 (platform, distro, release, arch, build, kernel 등 포함)
// - child_process (exec): 시스템 명령어 실행. 플랫폼별 명령어 실행에 사용
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// 이 모듈은 플랫폼별(Windows/Linux/macOS) 기능을 통합하여 제공하는 플랫폼 추상화 레이어

const si = require('systeminformation');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function getOSInfo() {
  try {
    const osInfo = await si.osInfo().catch(() => null);
    if (osInfo) {
      return {
        type: osInfo.platform === 'Windows' ? 'windows' : osInfo.platform.toLowerCase(),
        platform: osInfo.platform === 'Windows' ? 'win32' : process.platform,
        name: osInfo.distro || osInfo.platform || 'Unknown',
        version: osInfo.release || 'Unknown',
        arch: osInfo.arch || 'Unknown',
        build: osInfo.build || '',
        kernel: osInfo.kernel || '',
      };
    }
    const platform = process.platform;
    return {
      type: platform === 'win32' ? 'windows' : platform,
      platform: platform,
      name: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux',
      version: 'Unknown',
      arch: process.arch,
      build: '',
      kernel: '',
    };
  } catch (error) {
    console.error('Error getting OS info:', error);
    const platform = process.platform;
    return {
      type: platform === 'win32' ? 'windows' : platform,
      platform: platform,
      name: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux',
      version: 'Unknown',
      arch: process.arch,
      build: '',
      kernel: '',
    };
  }
}

async function isAdmin() {
  const platform = process.platform;
  if (platform === 'win32') {
    try {
      await execAsync('net session');
      return true;
    } catch (error) {
      return false;
    }
  } else if (platform === 'linux' || platform === 'darwin') {
    return process.getuid && process.getuid() === 0;
  }
  return false;
}

async function requestAdmin(command, args = []) {
  const platform = process.platform;
  if (platform === 'win32') {
    const commandStr = command + (args.length > 0 ? ' ' + args.join(' ') : '');
    const psCommand = `Start-Process -FilePath "${command}" -ArgumentList "${args.join('" "')}" -Verb RunAs -Wait -NoNewWindow`;
    try {
      const { stdout, stderr } = await execAsync(`powershell -Command "${psCommand}"`);
      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  } else if (platform === 'linux') {
    const commandStr = command + (args.length > 0 ? ' ' + args.join(' ') : '');
    try {
      const { stdout, stderr } = await execAsync(`sudo ${commandStr}`);
      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  } else if (platform === 'darwin') {
    const commandStr = command + (args.length > 0 ? ' ' + args.join(' ') : '');
    const osaCommand = `osascript -e "do shell script \\"${commandStr}\\" with administrator privileges"`;
    try {
      const { stdout, stderr } = await execAsync(osaCommand);
      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  return {
    success: false,
    error: 'Unsupported platform',
  };
}

async function executeCommand(command, options = {}) {
  const { timeout = 10000, encoding = 'utf8' } = options;
  const { promisify } = require('util');
  const { exec } = require('child_process');
  const execAsync = promisify(exec);
  try {
    const { stdout, stderr } = await Promise.race([
      execAsync(command, { encoding, maxBuffer: 10 * 1024 * 1024 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
    ]);
    return { success: true, stdout, stderr };
  } catch (error) {
    return { success: false, error: error.message, stdout: '', stderr: '' };
  }
}

async function readFile(filePath) {
  const fs = require('fs').promises;
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message, content: '' };
  }
}

async function readFiles(filePaths) {
  const results = {};
  for (const path of filePaths) {
    const result = await readFile(path);
    results[path] = result;
  }
  return results;
}

function parseOutput(output, patterns) {
  const result = {};
  if (!output) return result;
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = output.match(pattern);
    if (match) {
      result[key] = match[1] || match[0];
    }
  }
  return result;
}

function extractNumber(str, defaultValue = 0) {
  if (!str) return defaultValue;
  const match = str.toString().match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : defaultValue;
}

function parseBytes(str) {
  if (!str) return 0;
  const num = extractNumber(str);
  const upper = str.toUpperCase();
  if (upper.includes('KB')) return num * 1024;
  if (upper.includes('MB')) return num * 1024 * 1024;
  if (upper.includes('GB')) return num * 1024 * 1024 * 1024;
  if (upper.includes('TB')) return num * 1024 * 1024 * 1024 * 1024;
  return num;
}

module.exports = {
  getOSInfo,
  isAdmin,
  requestAdmin,
  executeCommand,
  readFile,
  readFiles,
  parseOutput,
  extractNumber,
  parseBytes,
};