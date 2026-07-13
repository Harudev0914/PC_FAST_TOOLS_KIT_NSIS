// @updater.js (1-10)
// 날짜: 2025-07-22
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. PowerShell로 설치된 소프트웨어 목록 조회에 사용
//   사용 예: execAsync('powershell -Command "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*..."') - 레지스트리에서 설치된 프로그램 목록 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. 설치된 소프트웨어 정보 조회에 사용
//   사용 예: new Registry({ hive: Registry.HKLM, key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' }) - 설치된 프로그램 레지스트리 키 접근
//   .keys() - 하위 키 목록 조회, .get() - 값 조회

const Registry = require('winreg');
const { execAsync, execFileAsync } = require('./_exec');

async function getInstalled() {
  const software = [];

  try {
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, InstallLocation | ConvertTo-Json"',
        { encoding: 'utf8' }
      );
      
      const products = JSON.parse(stdout);
      const productArray = Array.isArray(products) ? products : [products];
      
      return productArray
        .filter(p => p && p.DisplayName)
        .map(p => ({
          name: p.DisplayName,
          version: p.DisplayVersion || 'Unknown',
          publisher: p.Publisher || 'Unknown',
          installDate: p.InstallDate || null,
          installLocation: p.InstallLocation || null,
        }));
    } catch (error) {
      console.log('PowerShell method failed, trying registry method:', error.message);
    }

    return new Promise((resolve) => {
      const allSoftware = [];
      let completed = 0;
      const totalKeys = 2;

      function checkComplete() {
        completed++;
        if (completed === totalKeys) {
          resolve(allSoftware);
        }
      }

      const regKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      });

      regKey.keys((err, items) => {
        if (err || !items) {
          checkComplete();
          return;
        }

        let processed = 0;
        const total = items.length;

        if (total === 0) {
          checkComplete();
          return;
        }

        items.forEach((item) => {
          const itemKey = new Registry({
            hive: Registry.HKLM,
            key: `\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${item.key.split('\\').pop()}`,
          });

          itemKey.values((err, values) => {
            processed++;
            if (!err && values) {
              const softwareInfo = {};
              values.forEach((value) => {
                softwareInfo[value.name] = value.value;
              });

              if (softwareInfo.DisplayName) {
                allSoftware.push({
                  name: softwareInfo.DisplayName,
                  version: softwareInfo.DisplayVersion || 'Unknown',
                  publisher: softwareInfo.Publisher || 'Unknown',
                  installDate: softwareInfo.InstallDate || null,
                  installLocation: softwareInfo.InstallLocation || null,
                });
              }
            }

            if (processed === total) {
              checkComplete();
            }
          });
        });
      });

      const regKey32 = new Registry({
        hive: Registry.HKLM,
        key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      });

      regKey32.keys((err, items) => {
        if (err || !items) {
          checkComplete();
          return;
        }

        let processed = 0;
        const total = items.length;

        if (total === 0) {
          checkComplete();
          return;
        }

        items.forEach((item) => {
          const itemKey = new Registry({
            hive: Registry.HKLM,
            key: `\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${item.key.split('\\').pop()}`,
          });

          itemKey.values((err, values) => {
            processed++;
            if (!err && values) {
              const softwareInfo = {};
              values.forEach((value) => {
                softwareInfo[value.name] = value.value;
              });

              if (softwareInfo.DisplayName) {
                allSoftware.push({
                  name: softwareInfo.DisplayName,
                  version: softwareInfo.DisplayVersion || 'Unknown',
                  publisher: softwareInfo.Publisher || 'Unknown',
                  installDate: softwareInfo.InstallDate || null,
                  installLocation: softwareInfo.InstallLocation || null,
                });
              }
            }

            if (processed === total) {
              checkComplete();
            }
          });
        });
      });
    });
  } catch (error) {
    console.error('Error getting installed software:', error);
    return [];
  }
}

// [고도화] winget(Windows Package Manager)을 실제로 호출해 업그레이드 가능한 패키지를 조회한다.
// 기존 checkUpdates는 항상 updateAvailable:false를 반환하는 껍데기(stub)였음.
// winget의 `upgrade` 출력은 고정폭 표(table)이고 헤더가 OS 언어에 따라 달라지므로,
// 언어에 의존하지 않도록 구분선(---) 아래 각 행을 2칸 이상 공백으로 분할해 파싱한다.
// 열 순서는 [Name, Id, Version, Available, Source] — 이름에 공백이 있을 수 있어
// 뒤에서부터(Source/Available/Version/Id) 고정 열을 떼고 나머지를 Name으로 합친다.
let _upgradeCache = { at: 0, list: null };
const UPGRADE_CACHE_MS = 60 * 1000;

function parseWingetUpgradeTable(stdout) {
  const lines = String(stdout).split(/\r?\n/);
  const sepIndex = lines.findIndex((l) => /^-{5,}/.test(l.trim()));
  if (sepIndex < 0) return [];
  const rows = [];
  for (let i = sepIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    // 진행률/요약 꼬리 줄(예: "N upgrades available.") 제외
    if (/available|upgrad|business|package/i.test(line) && !/\S\s{2,}\S/.test(line)) continue;
    const cols = line.trim().split(/\s{2,}/);
    if (cols.length < 4) continue;
    const source = cols[cols.length - 1];
    const available = cols[cols.length - 2];
    const version = cols[cols.length - 3];
    const id = cols[cols.length - 4];
    const name = cols.slice(0, cols.length - 4).join(' ') || id;
    // 버전 칸이 실제 버전처럼 보이는지 최소 검증(숫자 포함)
    if (!/\d/.test(version) || !/\d|unknown/i.test(available)) continue;
    rows.push({ name, id, currentVersion: version, latestVersion: available, source });
  }
  return rows;
}

async function checkAllUpdates(force = false) {
  const now = Date.now();
  if (!force && _upgradeCache.list && now - _upgradeCache.at < UPGRADE_CACHE_MS) {
    return _upgradeCache.list;
  }
  try {
    // 셸 없이 인자 배열로 실행(주입 불가). --include-unknown: 버전 미상 항목도 포함.
    const { stdout } = await execFileAsync(
      'winget',
      ['upgrade', '--include-unknown', '--accept-source-agreements'],
      { timeout: 60000, maxBuffer: 1024 * 1024 * 20, encoding: 'utf8' }
    );
    const list = parseWingetUpgradeTable(stdout);
    _upgradeCache = { at: now, list };
    return list;
  } catch (error) {
    console.error('winget upgrade query failed:', error.message);
    return [];
  }
}

async function checkUpdates(software) {
  const name = String((software && software.name) || '').trim();
  const base = {
    name: software && software.name,
    currentVersion: software && software.version,
    latestVersion: null,
    updateAvailable: false,
    updateUrl: null,
    source: null,
  };
  if (!name) return base;

  const upgradable = await checkAllUpdates();
  const needle = name.toLowerCase();
  const match = upgradable.find((u) => {
    const un = u.name.toLowerCase();
    return un === needle || un.includes(needle) || needle.includes(un);
  });

  if (!match) return base;
  return {
    ...base,
    currentVersion: match.currentVersion || base.currentVersion,
    latestVersion: match.latestVersion,
    updateAvailable: true,
    id: match.id,
    source: match.source,
  };
}

async function update(software) {
  // [보안] software.name(레지스트리 유래)을 셸에 보간하지 않고 execFile 인자로 전달 → 명령 주입 차단.
  const name = String(software && software.name ? software.name : '');
  if (!name) {
    return { success: false, error: 'Invalid software name', message: 'Please update manually through the software\'s built-in updater' };
  }
  try {
    // 실제 업그레이드는 수 분 걸릴 수 있어 타임아웃 5분 + 비대화형 플래그로 프롬프트 대기 방지
    await execFileAsync('winget', ['upgrade', '--name', name, '--silent', '--accept-package-agreements', '--accept-source-agreements'], { timeout: 300000, maxBuffer: 1024 * 1024 * 20 });

    return {
      success: true,
      message: `Update initiated for ${software.name}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Please update manually through the software\'s built-in updater',
    };
  }
}

module.exports = {
  getInstalled,
  checkUpdates,
  checkAllUpdates,
  update,
};