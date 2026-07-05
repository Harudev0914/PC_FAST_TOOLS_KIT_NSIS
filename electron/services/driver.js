// @driver.js (1-9)
// 날짜: 2025-07-31
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. PowerShell 및 driverquery 명령어로 드라이버 목록 조회에 사용
//   사용 예: execAsync('powershell -Command "Get-WmiObject Win32_PnPEntity..."') - WMI로 드라이버 목록 조회
//   execAsync('driverquery /FO CSV /NH') - driverquery 명령어로 드라이버 목록 CSV 형식 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// PowerShell 사용: Get-WmiObject Win32_PnPEntity로 PnP 장치(드라이버) 목록 조회
// driverquery 사용: Windows 내장 명령어로 드라이버 목록 조회 (PowerShell 실패 시 폴백)

const { exec, execFile } = require('child_process');
const { promisify } = require('util');
// [고도화] exec 기본 타임아웃/버퍼 래퍼 + 셸 없는 execFile
const _execRaw = promisify(exec);
const execAsync = (command, options = {}) => _execRaw(command, { timeout: 120000, maxBuffer: 1024 * 1024 * 20, ...options });
const execFileAsync = promisify(execFile);

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
  // [보안] driver.id(WMI/IPC 유래)를 셸에 보간하지 않고 execFile 인자로 전달 → 명령 주입 차단.
  const id = String(driver && driver.id ? driver.id : '');
  if (!id) {
    return { success: false, error: 'Invalid driver id', message: 'Please update drivers manually through Device Manager' };
  }
  try {
    // 드라이버 설치는 오래 걸릴 수 있어 타임아웃 5분
    await execFileAsync('pnputil', ['/update-driver', id, '/install'], { timeout: 300000, maxBuffer: 1024 * 1024 * 20 });
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

module.exports = {
  getDrivers,
  checkUpdates,
  update,
};