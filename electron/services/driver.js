// ---------
// 2025-07-31
// 개발자 : KR_Tuki
// 기능 : 드라이버 목록 조회 및 업데이트
// ---------

// @driver.js (1-9)
// 날짜: 2025-07-31
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. PowerShell 및 driverquery 명령어로 드라이버 목록 조회에 사용
//   사용 예: execAsync('powershell -Command "Get-WmiObject Win32_PnPEntity..."') - WMI로 드라이버 목록 조회
//   execAsync('driverquery /FO CSV /NH') - driverquery 명령어로 드라이버 목록 CSV 형식 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// PowerShell 사용: Get-WmiObject Win32_PnPEntity로 PnP 장치(드라이버) 목록 조회
// driverquery 사용: Windows 내장 명령어로 드라이버 목록 조회 (PowerShell 실패 시 폴백)

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function getDrivers() {
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-WmiObject Win32_PnPEntity | Where-Object {$_.Class -eq \'Driver\'} | Select-Object Name, DeviceID, Status | ConvertTo-Json"',
      { encoding: 'utf8' }
    );
    
    const drivers = JSON.parse(stdout);
    const driverList = Array.isArray(drivers) ? drivers : [drivers];
    
    return driverList.map((driver, index) => ({
      id: driver.DeviceID || `driver_${index}`,
      name: driver.Name || 'Unknown Driver',
      status: driver.Status || 'Unknown',
      version: 'Unknown',
    }));
  } catch (error) {
    console.error('Error getting drivers:', error);
    
    try {
      const { stdout } = await execAsync('driverquery /FO CSV /NH');
      const lines = stdout.split('\n').filter(line => line.trim());
      
      return lines.map((line, index) => {
        const parts = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 4) return null;
        
        return {
          id: `driver_${index}`,
          name: parts[0].replace(/"/g, ''),
          version: parts[2].replace(/"/g, ''),
          status: parts[3].replace(/"/g, ''),
        };
      }).filter(d => d !== null);
    } catch (error) {
      return [];
    }
  }
}

async function checkUpdates() {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "Get-WindowsUpdate -MicrosoftUpdate | Select-Object Title, Status | ConvertTo-Json"'
    );
    
    const updates = JSON.parse(stdout);
    return Array.isArray(updates) ? updates : [updates];
  } catch (error) {
    try {
      await execAsync('powershell -Command "Get-WUList"');
      return [];
    } catch (error) {
      return [];
    }
  }
}

async function update(driver) {
  try {
    const { stdout } = await execAsync(
      `pnputil /update-driver "${driver.id}" /install`
    );
    
    return {
      success: true,
      message: `Driver update initiated for ${driver.name}`,
    };
  } catch (error) {
    try {
      await execAsync(
        `powershell -Command "Update-Driver -HardwareId '${driver.id}'"`
      );
      return {
        success: true,
        message: `Driver update initiated for ${driver.name}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Please update drivers manually through Device Manager',
      };
    }
  }
}

module.exports = {
  getDrivers,
  checkUpdates,
  update,
};