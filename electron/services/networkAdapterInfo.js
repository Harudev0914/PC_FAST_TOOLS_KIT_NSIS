// @networkAdapterInfo.js (1-10)
// 날짜: 2025-09-23
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. PowerShell로 네트워크 어댑터 정보 조회에 사용
//   사용 예: exec('powershell -Command "Get-NetAdapter..."') - PowerShell로 네트워크 어댑터 목록 조회
//   Get-NetIPAddress로 IPv4/IPv6 주소 조회
// - util: 유틸리티 함수 제공. util.promisify()로 콜백 기반 함수를 Promise로 변환
// - platform (platformService): 플랫폼별 기능 제공. executeCommand() 함수로 Linux 명령어 실행 (ip, ifconfig 등)
// PowerShell 사용:
//   - Get-NetAdapter: 네트워크 어댑터 목록 조회
//   - Get-NetIPAddress: IP 주소 정보 조회 (IPv4, IPv6)
//   - InterfaceDescription으로 연결 타입 판별 (Wireless/Wi-Fi = 802.11, 그 외 = Ethernet)

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const platformService = require('./platform');

async function getAdapterInfo(adapterName) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const psCommand = `
        $adapter = Get-NetAdapter | Where-Object {$_.Name -like '*${adapterName.replace(/'/g, "''")}*'} | Select-Object -First 1;
        if ($adapter) {
          $ip4 = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1;
          $ip6 = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv6 -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress -notlike '*::1*' -and $_.IPAddress -notlike '*fe80::*' -or $_.IPAddress -like '*fe80::*'} | Select-Object -First 1;
          [PSCustomObject]@{
            AdapterName = $adapter.Name;
            IPv4 = if ($ip4) { $ip4.IPAddress } else { '' };
            IPv6 = if ($ip6) { $ip6.IPAddress } else { '' };
            ConnectionType = if ($adapter.InterfaceDescription -like '*Wireless*' -or $adapter.InterfaceDescription -like '*Wi-Fi*') { '802.11' } else { 'Ethernet' };
          } | ConvertTo-Json
        } else {
          '{}' | ConvertTo-Json
        }
      `;
      exec(`powershell -Command "${psCommand.replace(/\n/g, ' ').replace(/\s+/g, ' ')}"`, (error, stdout) => {
        if (!error && stdout) {
          try {
            const info = JSON.parse(stdout.trim());
            resolve({
              adapterName: info.AdapterName || adapterName,
              ipv4: info.IPv4 || '0.0.0.0',
              ipv6: info.IPv6 || '::',
              connectionType: info.ConnectionType || 'Ethernet',
            });
          } catch (parseError) {
            resolve({
              adapterName: adapterName,
              ipv4: '0.0.0.0',
              ipv6: '::',
              connectionType: 'Ethernet',
            });
          }
        } else {
          resolve({
            adapterName: adapterName,
            ipv4: '0.0.0.0',
            ipv6: '::',
            connectionType: 'Ethernet',
          });
        }
      });
    } else if (process.platform === 'linux') {
      Promise.all([
        platformService.executeCommand(`ip addr show ${adapterName}`, { timeout: 5000 }),
        platformService.executeCommand(`ip link show ${adapterName}`, { timeout: 5000 }),
      ]).then(([addrResult, linkResult]) => {
        let ipv4 = '0.0.0.0';
        let ipv6 = '::';
        let connectionType = 'Ethernet';
        if (addrResult.success && addrResult.stdout) {
          const addr = addrResult.stdout;
          const ipv4Match = addr.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
          const ipv6Match = addr.match(/inet6\s+([0-9a-f:]+)/i);
          if (ipv4Match) {
            ipv4 = ipv4Match[1].trim();
          }
          if (ipv6Match && !ipv6Match[1].includes('::1') && !ipv6Match[1].startsWith('fe80::')) {
            ipv6 = ipv6Match[1].trim();
          }
        }
        if (linkResult.success && linkResult.stdout) {
          const link = linkResult.stdout;
          if (link.includes('wlan') || link.includes('wifi') || link.includes('wireless')) {
            connectionType = '802.11';
          }
        }
        resolve({
          adapterName: adapterName,
          ipv4: ipv4,
          ipv6: ipv6,
          connectionType: connectionType,
        });
      }).catch(() => {
        resolve({
          adapterName: adapterName,
          ipv4: '0.0.0.0',
          ipv6: '::',
          connectionType: 'Ethernet',
        });
      });
    } else if (process.platform === 'darwin') {
      Promise.all([
        platformService.executeCommand(`ifconfig ${adapterName}`, { timeout: 5000 }),
        platformService.executeCommand(`networksetup -getinfo "${adapterName}"`, { timeout: 5000 }),
      ]).then(([ifconfigResult, networksetupResult]) => {
        let ipv4 = '0.0.0.0';
        let ipv6 = '::';
        let connectionType = 'Ethernet';
        if (ifconfigResult.success && ifconfigResult.stdout) {
          const ifconfig = ifconfigResult.stdout;
          const ipv4Match = ifconfig.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
          const ipv6Match = ifconfig.match(/inet6\s+([0-9a-f:]+)/i);
          if (ipv4Match) {
            ipv4 = ipv4Match[1].trim();
          }
          if (ipv6Match && !ipv6Match[1].includes('::1') && !ipv6Match[1].startsWith('fe80::')) {
            ipv6 = ipv6Match[1].trim();
          }
        }
        if (networksetupResult.success && networksetupResult.stdout) {
          const networksetup = networksetupResult.stdout;
          if (networksetup.includes('Wi-Fi') || networksetup.includes('AirPort')) {
            connectionType = '802.11';
          }
        }
        resolve({
          adapterName: adapterName,
          ipv4: ipv4,
          ipv6: ipv6,
          connectionType: connectionType,
        });
      }).catch(() => {
        resolve({
          adapterName: adapterName,
          ipv4: '0.0.0.0',
          ipv6: '::',
          connectionType: 'Ethernet',
        });
      });
    } else {
      resolve({
        adapterName: adapterName,
        ipv4: '0.0.0.0',
        ipv6: '::',
        connectionType: 'Ethernet',
      });
    }
  });
}

module.exports = {
  getAdapterInfo,
};