// ---------
// 2025-12-20
// 개발자 : KR_Tuki
// 기능 : 애플리케이션 버전 체크 및 라이선스 검증
// ---------

// @version.js (1-30)
// 날짜: 2025-12-20
// Import 모듈 설명:
// - fs: 파일 시스템 동기 접근. package.json, version.json 파일 읽기에 사용
//   사용 예: fs.readFileSync() - 파일 내용 동기 읽기, fs.existsSync() - 파일 존재 여부 확인
// - path: 파일 경로 처리. 버전 정보 파일 경로 조작에 사용
//   사용 예: path.join(__dirname, ...) - 상대 경로 결합
// - https: HTTPS 요청. 서버에서 최신 버전 정보 조회에 사용 (유료화 대비)
//   사용 예: https.get() - HTTPS GET 요청
// - crypto: 암호화 모듈. 버전 정보 해시 검증, 라이선스 키 검증에 사용
//   사용 예: crypto.createHash() - 해시 생성, crypto.createHmac() - HMAC 서명 검증
// - os: 운영체제 정보 제공. 시스템 정보 수집에 사용
//   사용 예: os.platform() - 운영체제 플랫폼, os.hostname() - 호스트명
// 변수 설명:
//   - VERSION_FILE: 버전 정보 파일 경로 (package.json 또는 별도 version.json)
//   - VERSION_CHECK_URL: 서버 버전 체크 URL (유료화 시 사용)
//   - LICENSE_FILE: 라이선스 파일 경로 (유료화 시 사용)
// 기능 원리:
// 1. 로컬 버전 정보 읽기: package.json 또는 version.json에서 현재 버전 확인
// 2. 서버 버전 체크 (선택적): HTTPS로 최신 버전 정보 조회 (유료화 대비)
// 3. 버전 비교: 현재 버전과 최신 버전 비교하여 업데이트 필요 여부 확인
// 4. 라이선스 검증 (유료화 대비): 라이선스 키 검증, 만료일 확인, 사용자 제한 확인
// 5. 버전 추적: 사용자 시스템 정보와 버전 정보를 조합하여 고유 ID 생성 (무단 사용 방지)

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const os = require('os');

const VERSION_FILE = path.join(__dirname, '../../package.json');
const VERSION_CHECK_URL = process.env.VERSION_CHECK_URL || 'https://api.example.com/version'; // 유료화 시 실제 URL로 변경
const LICENSE_FILE = path.join(__dirname, '../../license.json');

let cachedVersion = null;
let cachedLicense = null;

/**
 * 현재 애플리케이션 버전 가져오기
 */
function getCurrentVersion() {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    if (fs.existsSync(VERSION_FILE)) {
      const packageJson = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
      cachedVersion = {
        version: packageJson.version || '1.0.0',
        build: packageJson.build || Date.now(),
        name: packageJson.name || 'pc-optimizer',
      };
      return cachedVersion;
    }
  } catch (error) {
    console.error('Failed to read version file:', error);
  }

  cachedVersion = {
    version: '1.0.0',
    build: Date.now(),
    name: 'pc-optimizer',
  };
  return cachedVersion;
}

/**
 * 시스템 고유 ID 생성 (버전 추적용)
 */
function getSystemId() {
  const systemInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
  };

  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(systemInfo));
  return hash.digest('hex').substring(0, 16);
}

/**
 * 서버에서 최신 버전 정보 조회 (유료화 대비)
 */
async function checkServerVersion() {
  return new Promise((resolve, reject) => {
    const url = new URL(VERSION_CHECK_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      method: 'GET',
      headers: {
        'User-Agent': `PC-Optimizer/${getCurrentVersion().version}`,
        'X-System-ID': getSystemId(),
      },
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const serverInfo = JSON.parse(data);
            resolve({
              success: true,
              latestVersion: serverInfo.version,
              currentVersion: getCurrentVersion().version,
              updateAvailable: compareVersions(getCurrentVersion().version, serverInfo.version) < 0,
              downloadUrl: serverInfo.downloadUrl,
              changelog: serverInfo.changelog,
              requiresUpdate: serverInfo.requiresUpdate || false,
            });
          } else {
            resolve({
              success: false,
              error: `Server returned status ${res.statusCode}`,
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        offline: true,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout',
        offline: true,
      });
    });

    req.end();
  });
}

/**
 * 버전 비교 (semver 형식)
 * @param {string} v1 - 현재 버전
 * @param {string} v2 - 비교할 버전
 * @returns {number} - v1 < v2: -1, v1 === v2: 0, v1 > v2: 1
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}

/**
 * 라이선스 파일 읽기 (유료화 대비)
 */
function getLicense() {
  if (cachedLicense) {
    return cachedLicense;
  }

  try {
    if (fs.existsSync(LICENSE_FILE)) {
      const licenseData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
      cachedLicense = licenseData;
      return cachedLicense;
    }
  } catch (error) {
    console.error('Failed to read license file:', error);
  }

  cachedLicense = null;
  return null;
}

/**
 * 라이선스 검증 (유료화 대비)
 */
function validateLicense() {
  const license = getLicense();

  if (!license) {
    return {
      valid: false,
      reason: 'No license file found',
      type: 'trial',
      daysRemaining: 30, // 기본 체험 기간
    };
  }

  const now = Date.now();
  const expiresAt = license.expiresAt || 0;

  if (expiresAt > 0 && now > expiresAt) {
    return {
      valid: false,
      reason: 'License expired',
      type: license.type || 'trial',
      expiredAt: new Date(expiresAt).toISOString(),
    };
  }

  const systemId = getSystemId();
  if (license.systemId && license.systemId !== systemId) {
    return {
      valid: false,
      reason: 'License bound to different system',
      type: license.type || 'trial',
    };
  }

  return {
    valid: true,
    type: license.type || 'trial',
    expiresAt: expiresAt > 0 ? new Date(expiresAt).toISOString() : null,
    daysRemaining: expiresAt > 0 ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null,
    features: license.features || [],
  };
}

/**
 * 버전 체크 (로컬 + 서버)
 */
async function checkVersion(options = {}) {
  const { checkServer = false, validateLicense = false } = options;

  const result = {
    currentVersion: getCurrentVersion(),
    systemId: getSystemId(),
    timestamp: new Date().toISOString(),
  };

  if (checkServer) {
    const serverCheck = await checkServerVersion();
    result.serverCheck = serverCheck;
  }

  if (validateLicense) {
    const licenseValidation = validateLicense();
    result.license = licenseValidation;
  }

  return result;
}

/**
 * 버전 추적 정보 생성 (무단 사용 방지)
 */
function getTrackingInfo() {
  return {
    version: getCurrentVersion().version,
    build: getCurrentVersion().build,
    systemId: getSystemId(),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    timestamp: Date.now(),
  };
}

module.exports = {
  getCurrentVersion,
  getSystemId,
  checkServerVersion,
  compareVersions,
  getLicense,
  validateLicense,
  checkVersion,
  getTrackingInfo,
};
