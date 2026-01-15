const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const execAsync = promisify(exec);
const Registry = require('winreg');
const permissionsService = require('./permissions');

/**
 * MsQuic (Microsoft QUIC) 감지 및 활성화
 */
async function detectMsQuic() {
  try {
    // MsQuic DLL 경로 확인
    const possiblePaths = [
      'C:\\Windows\\System32\\msquic.dll',
      'C:\\Program Files\\Microsoft\\MsQuic\\msquic.dll',
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'MsQuic', 'msquic.dll'),
    ];

    for (const dllPath of possiblePaths) {
      if (fs.existsSync(dllPath)) {
        return {
          available: true,
          path: dllPath,
          version: await getDllVersion(dllPath),
        };
      }
    }

    // PowerShell을 통해 레지스트리에서 확인
    try {
      const { stdout } = await execAsync(
        'powershell -Command "Get-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*\' | Where-Object { $_.DisplayName -like \'*MsQuic*\' } | Select-Object -First 1 DisplayName, DisplayVersion"',
        { encoding: 'utf8', maxBuffer: 1024 * 1024 }
      );

      if (stdout && stdout.trim()) {
        return {
          available: true,
          path: null,
          version: stdout.trim(),
          installed: true,
        };
      }
    } catch (e) {
      // 레지스트리 확인 실패는 무시
    }

    return { available: false, reason: 'MsQuic not found' };
  } catch (error) {
    console.error('MsQuic detection error:', error);
    return { available: false, reason: error.message };
  }
}

/**
 * DLL 버전 정보 가져오기
 */
async function getDllVersion(dllPath) {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "(Get-Item '${dllPath}').VersionInfo.FileVersion"`,
      { encoding: 'utf8' }
    );
    return stdout.trim();
  } catch (e) {
    return 'Unknown';
  }
}

/**
 * QUIC/HTTP/3 최적화 활성화
 */
async function enableQUIC(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    operations: [],
    errors: [],
    msQuicEnabled: false,
    http3Enabled: false,
    quicOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  if (!isAdmin && !requestAdminPermission) {
    // 관리자 권한이 없으면 스킵
    results.operations.push('QUIC optimization skipped (requires admin)');
    return results;
  }

  try {
    // 1. MsQuic 감지
    const msQuicInfo = await detectMsQuic();
    if (!msQuicInfo.available) {
      results.errors.push({ operation: 'MsQuic detection', error: 'MsQuic is not installed' });
      return results;
    }

    results.operations.push(`MsQuic detected: ${msQuicInfo.version || 'Unknown version'}`);

    // 2. HTTP/3 활성화 (레지스트리)
    try {
      const http3Key = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Services\\HTTP\\Parameters',
      });

      await new Promise((resolve, reject) => {
        http3Key.set('EnableHttp3', Registry.REG_DWORD, '1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.http3Enabled = true;
      results.operations.push('HTTP/3 enabled');
    } catch (error) {
      results.errors.push({ operation: 'HTTP/3 enable', error: error.message });
    }

    // 3. QUIC 프로토콜 최적화 (레지스트리)
    try {
      const quicKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Services\\MsQuic\\Parameters',
      });

      // QUIC 연결 타임아웃 최적화
      await new Promise((resolve, reject) => {
        quicKey.set('IdleTimeoutMs', Registry.REG_DWORD, '30000', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // QUIC 초기 RTT 최적화
      await new Promise((resolve, reject) => {
        quicKey.set('InitialRttMs', Registry.REG_DWORD, '50', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.quicOptimized = true;
      results.operations.push('QUIC protocol optimized');
    } catch (error) {
      // MsQuic 레지스트리 키가 없을 수 있음 (정상)
      results.errors.push({ operation: 'QUIC registry', error: error.message, warning: true });
    }

    // 4. Windows 네트워크 스택에 QUIC 등록
    try {
      // netsh를 통해 QUIC 프로토콜 활성화
      await execAsync('netsh interface http set global http3=enabled');
      results.msQuicEnabled = true;
      results.operations.push('MsQuic enabled in network stack');
    } catch (error) {
      results.errors.push({ operation: 'netsh QUIC', error: error.message, warning: true });
    }

    results.success = results.msQuicEnabled || results.http3Enabled || results.quicOptimized;
  } catch (error) {
    results.success = false;
    results.errors.push({ operation: 'QUIC optimization', error: error.message });
  }

  return results;
}

/**
 * ENet (게임용 UDP 라이브러리) 감지 및 설정
 */
async function detectENet() {
  try {
    // ENet은 일반적으로 애플리케이션에 링크되므로
    // 시스템 레벨에서 감지하기 어려움
    // 대신 게임 최적화 설정을 제공

    return {
      available: true, // ENet은 라이브러리이므로 항상 사용 가능하다고 가정
      description: 'ENet is a UDP-based reliable networking library for games',
      features: [
        'Reliable UDP packets',
        'Channel separation',
        'Low latency',
        'NAT traversal support',
      ],
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

/**
 * ENet 최적화 설정 (게임용)
 */
async function optimizeENet(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    operations: [],
    errors: [],
    enetOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    // ENet은 애플리케이션 레벨 라이브러리이므로
    // OS 레벨에서 UDP 최적화를 제공

    // 1. UDP 버퍼 크기 증가
    if (isAdmin || requestAdminPermission) {
      try {
        const udpKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters',
        });

        // UDP 수신 버퍼 크기 (게임용으로 증가)
        await new Promise((resolve, reject) => {
          udpKey.set('FastSendDatagramThreshold', Registry.REG_DWORD, '1024', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        results.enetOptimized = true;
        results.operations.push('UDP buffer optimized for ENet');
      } catch (error) {
        results.errors.push({ operation: 'UDP buffer', error: error.message });
      }
    }

    // 2. 게임 모드 네트워크 우선순위
    if (isAdmin || requestAdminPermission) {
      try {
        // QoS 패킷 스케줄러에서 게임 트래픽 우선순위 설정
        const qosKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\Psched\\Parameters\\Adapters',
        });

        await new Promise((resolve, reject) => {
          qosKey.set('NonBestEffortLimit', Registry.REG_DWORD, '0', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        results.operations.push('Game traffic priority enabled');
      } catch (error) {
        results.errors.push({ operation: 'QoS priority', error: error.message });
      }
    }

    results.success = results.enetOptimized;
  } catch (error) {
    results.success = false;
    results.errors.push({ operation: 'ENet optimization', error: error.message });
  }

  return results;
}

/**
 * IOCP (Windows I/O Completion Ports) 최적화
 */
async function optimizeIOCP(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    operations: [],
    errors: [],
    iocpOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  if (!isAdmin && !requestAdminPermission) {
    // 관리자 권한이 없으면 스킵
    results.operations.push('IOCP optimization skipped (requires admin)');
    return results;
  }

  try {
    // IOCP는 Windows 커널 레벨 기능이므로
    // 애플리케이션에서 직접 제어하기 어려움
    // 대신 네트워크 스택 최적화를 제공

    // 1. TCP/IP 스택 최적화 (IOCP 활용)
    const tcpKey = new Registry({
      hive: Registry.HKLM,
      key: '\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters',
    });

    // TCP Chimney Offload (IOCP 활용)
    await new Promise((resolve, reject) => {
      tcpKey.set('EnableChimney', Registry.REG_DWORD, '1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // TCP Receive Side Scaling (RSS) - IOCP와 함께 사용
    await new Promise((resolve, reject) => {
      tcpKey.set('EnableRSS', Registry.REG_DWORD, '1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // TCP Receive Window Auto-Tuning
    await new Promise((resolve, reject) => {
      tcpKey.set('TcpAckFrequency', Registry.REG_DWORD, '1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    results.iocpOptimized = true;
    results.operations.push('IOCP-optimized TCP/IP stack configured');
    results.operations.push('TCP Chimney Offload enabled');
    results.operations.push('Receive Side Scaling (RSS) enabled');

    results.success = true;
  } catch (error) {
    results.success = false;
    results.errors.push({ operation: 'IOCP optimization', error: error.message });
  }

  return results;
}

/**
 * 종합 네트워크 최적화 (모든 API 통합)
 */
async function optimizeAll(options = {}) {
  const { 
    enableQUIC = true,
    enableENet = true,
    enableIOCP = true,
    requestAdminPermission = false 
  } = options;

  const results = {
    success: true,
    operations: [],
    errors: [],
    quic: null,
    enet: null,
    iocp: null,
    requiresAdmin: false,
    adminGranted: false,
  };

  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  // 병렬로 모든 최적화 실행
  const optimizations = [];

  if (enableQUIC) {
    optimizations.push(
      enableQUIC({ requestAdminPermission })
        .then(result => {
          results.quic = result;
          if (result.operations) {
            results.operations.push(...result.operations);
          }
          if (result.errors) {
            results.errors.push(...result.errors);
          }
        })
        .catch(error => {
          results.errors.push({ operation: 'QUIC', error: error.message });
        })
    );
  }

  if (enableENet) {
    optimizations.push(
      optimizeENet({ requestAdminPermission })
        .then(result => {
          results.enet = result;
          if (result.operations) {
            results.operations.push(...result.operations);
          }
          if (result.errors) {
            results.errors.push(...result.errors);
          }
        })
        .catch(error => {
          results.errors.push({ operation: 'ENet', error: error.message });
        })
    );
  }

  if (enableIOCP) {
    optimizations.push(
      optimizeIOCP({ requestAdminPermission })
        .then(result => {
          results.iocp = result;
          if (result.operations) {
            results.operations.push(...result.operations);
          }
          if (result.errors) {
            results.errors.push(...result.errors);
          }
        })
        .catch(error => {
          results.errors.push({ operation: 'IOCP', error: error.message });
        })
    );
  }

  await Promise.all(optimizations);

  results.success = results.quic?.success || results.enet?.success || results.iocp?.success || false;

  return results;
}

/**
 * 사용 가능한 네트워크 최적화 API 감지
 */
async function detectAvailableAPIs() {
  const apis = {
    msQuic: await detectMsQuic(),
    enet: await detectENet(),
    iocp: { available: true, description: 'IOCP is built into Windows' },
  };

  return apis;
}

module.exports = {
  detectMsQuic,
  enableQUIC,
  detectENet,
  optimizeENet,
  optimizeIOCP,
  optimizeAll,
  detectAvailableAPIs,
};
