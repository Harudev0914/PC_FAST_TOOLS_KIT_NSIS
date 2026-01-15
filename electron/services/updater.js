// @updater.js (1-10)
// 날짜: 2025-07-22
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. PowerShell로 설치된 소프트웨어 목록 조회에 사용
//   사용 예: execAsync('powershell -Command "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*..."') - 레지스트리에서 설치된 프로그램 목록 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. 설치된 소프트웨어 정보 조회에 사용
//   사용 예: new Registry({ hive: Registry.HKLM, key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' }) - 설치된 프로그램 레지스트리 키 접근
//   .keys() - 하위 키 목록 조회, .get() - 값 조회

const { exec } = require('child_process');
const { promisify } = require('util');
const Registry = require('winreg');
const execAsync = promisify(exec);

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

async function checkUpdates(software) {
  return {
    name: software.name,
    currentVersion: software.version,
    latestVersion: 'Unknown',
    updateAvailable: false,
    updateUrl: null,
  };
}

async function update(software) {
  try {
    const { stdout } = await execAsync(`winget upgrade "${software.name}"`);
    
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
  update,
};