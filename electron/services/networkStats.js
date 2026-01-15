// @networkStats.js (1-7)
// 날짜: 2025-10-20
// Import 모듈 설명:
// - systeminformation (si): 시스템 정보 수집 라이브러리. 네트워크 통계 조회에 사용
//   사용 예: si.networkInterfaces() - 네트워크 인터페이스 목록 조회 (iface, ifaceName, type, operstate, ip4, ip6 등)
//   si.networkStats('*') - 모든 네트워크 인터페이스의 통계 조회 (bytes_sent, bytes_recv, packets_sent, packets_recv 등)
//   si.wifiConnections() - WiFi 연결 정보 조회 (ssid, bssid, signal_level 등)
// 변수 설명:
//   - networkInterfaces: 네트워크 인터페이스 목록 (이더넷, WiFi 등)
//   - networkStats: 네트워크 통계 배열 (각 인터페이스별 송수신 바이트 수)
//   - wifiConnections: WiFi 연결 정보 배열
// 이 모듈은 systeminformation 라이브러리를 사용하여 네트워크 어댑터별 통계를 수집하고 이더넷/WiFi로 분류

const si = require('systeminformation');

async function getNetworkAdapterStats() {
  try {
    const [networkInterfaces, networkStats, wifiConnections] = await Promise.all([
      si.networkInterfaces().catch(() => []),
      si.networkStats('*').catch(() => []),
      si.wifiConnections().catch(() => []),
    ]);

    const adapters = {
      ethernet: { 
        sendMB: 0, 
        receiveMB: 0, 
        name: '이더넷',
        adapterName: 'Unknown',
        ipv4: '0.0.0.0',
        ipv6: '::',
      },
      wifi: { 
        sendMB: 0, 
        receiveMB: 0, 
        name: 'Wi-Fi',
        adapterName: 'Unknown',
        ipv4: '0.0.0.0',
        ipv6: '::',
      },
    };

    let ethernetInterface = null;
    let wifiInterface = null;

    for (const iface of networkInterfaces) {
      if (!iface || iface.internal || iface.virtual) continue;
      if (iface.operstate !== 'up') continue;

      const ifaceName = iface.ifaceName || iface.iface || '';
      const ifaceType = iface.type || '';
      
      if (ifaceType === 'wireless' || 
          ifaceName.toLowerCase().includes('wifi') || 
          ifaceName.toLowerCase().includes('wi-fi') || 
          ifaceName.toLowerCase().includes('wireless') || 
          ifaceName.toLowerCase().includes('wlan')) {
        if (!wifiInterface || iface.default) {
          wifiInterface = iface;
        }
      }
      else if (ifaceType === 'wired' || 
               ifaceName.toLowerCase().includes('ethernet') || 
               ifaceName.toLowerCase().includes('이더넷') ||
               ifaceName.toLowerCase().includes('lan')) {
        if (!ethernetInterface || iface.default) {
          ethernetInterface = iface;
        }
      }
    }

    const ethernetStats = networkStats.find(s => 
      s.iface === ethernetInterface?.iface || 
      s.iface === ethernetInterface?.ifaceName
    );
    const wifiStats = networkStats.find(s => 
      s.iface === wifiInterface?.iface || 
      s.iface === wifiInterface?.ifaceName ||
      (wifiInterface && (s.iface.toLowerCase().includes('wifi') || s.iface.toLowerCase().includes('wi-fi')))
    );

    if (ethernetInterface) {
      const txBytes = ethernetStats?.tx_bytes || 0;
      const rxBytes = ethernetStats?.rx_bytes || 0;
      
      adapters.ethernet = {
        sendMB: Math.round((txBytes / (1024 * 1024)) * 100) / 100,
        receiveMB: Math.round((rxBytes / (1024 * 1024)) * 100) / 100,
        name: '이더넷',
        adapterName: ethernetInterface.ifaceName || ethernetInterface.iface || 'Unknown',
        ipv4: ethernetInterface.ip4 || '0.0.0.0',
        ipv6: ethernetInterface.ip6 || '::',
        mac: ethernetInterface.mac || '',
        type: ethernetInterface.type || 'wired',
        speed: ethernetInterface.speed || null,
        mtu: ethernetInterface.mtu || null,
        dhcp: ethernetInterface.dhcp || false,
        dnsSuffix: ethernetInterface.dnsSuffix || '',
      };
    }

    if (wifiInterface) {
      const txBytes = wifiStats?.tx_bytes || 0;
      const rxBytes = wifiStats?.rx_bytes || 0;
      
      adapters.wifi = {
        sendMB: Math.round((txBytes / (1024 * 1024)) * 100) / 100,
        receiveMB: Math.round((rxBytes / (1024 * 1024)) * 100) / 100,
        name: 'Wi-Fi',
        adapterName: wifiInterface.ifaceName || wifiInterface.iface || 'Unknown',
        ipv4: wifiInterface.ip4 || '0.0.0.0',
        ipv6: wifiInterface.ip6 || '::',
        mac: wifiInterface.mac || '',
        type: wifiInterface.type || 'wireless',
        speed: wifiInterface.speed || null,
        mtu: wifiInterface.mtu || null,
        dhcp: wifiInterface.dhcp || false,
        dnsSuffix: wifiInterface.dnsSuffix || '',
      };
    }

    if (wifiConnections && wifiConnections.length > 0) {
      const wifiConnection = wifiConnections[0];
      if (adapters.wifi) {
        adapters.wifi.ssid = wifiConnection.ssid || 'Unknown';
        adapters.wifi.signalLevel = wifiConnection.signalLevel || 0;
        adapters.wifi.quality = wifiConnection.quality || 0;
        adapters.wifi.channel = wifiConnection.channel || null;
        adapters.wifi.frequency = wifiConnection.frequency || null;
        adapters.wifi.security = wifiConnection.security || [];
        adapters.wifi.txRate = wifiConnection.txRate || null;
      }
    }

    return adapters;
  } catch (error) {
    console.error('Error getting network adapter stats with systeminformation:', error);
    return {
      ethernet: { 
        sendMB: 0, 
        receiveMB: 0, 
        name: '이더넷',
        adapterName: 'Unknown',
        ipv4: '0.0.0.0',
        ipv6: '::',
      },
      wifi: { 
        sendMB: 0, 
        receiveMB: 0, 
        name: 'Wi-Fi',
        adapterName: 'Unknown',
        ipv4: '0.0.0.0',
        ipv6: '::',
      },
    };
  }
}

async function getWiFiInfo() {
  try {
    const wifiConnections = await si.wifiConnections().catch(() => []);
    
    if (wifiConnections && wifiConnections.length > 0) {
      const wifiConnection = wifiConnections[0];
      return {
        ssid: wifiConnection.ssid || 'Unknown',
        signalStrength: wifiConnection.quality || 0,
        signalLevel: wifiConnection.signalLevel || 0,
        quality: wifiConnection.quality || 0,
        channel: wifiConnection.channel || null,
        frequency: wifiConnection.frequency || null,
        security: wifiConnection.security || [],
        txRate: wifiConnection.txRate || null,
      };
    }
    
    return { 
      ssid: 'Unknown', 
      signalStrength: 0,
      signalLevel: 0,
      quality: 0,
      channel: null,
      frequency: null,
      security: [],
      txRate: null,
    };
  } catch (error) {
    console.error('Error getting WiFi info with systeminformation:', error);
    return { 
      ssid: 'Unknown', 
      signalStrength: 0,
      signalLevel: 0,
      quality: 0,
      channel: null,
      frequency: null,
      security: [],
      txRate: null,
    };
  }
}

module.exports = {
  getNetworkAdapterStats,
  getWiFiInfo,
};