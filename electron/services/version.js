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
