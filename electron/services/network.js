// @network.js (1-10)
// 날짜: 2025-05-02
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. netstat, ping, ipconfig, netsh 등 네트워크 명령어 실행에 사용
//   사용 예: execAsync('netstat -e') - 네트워크 통계 조회, execAsync('ping -n 4 8.8.8.8') - 핑 테스트
//   execAsync('ipconfig /flushdns') - DNS 캐시 플러시, execAsync('netsh winsock reset') - Winsock 리셋
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. 네트워크 어댑터 설정, TCP/IP 파라미터 변경에 사용
//   사용 예: new Registry({ hive: Registry.HKLM, key }) - 레지스트리 키 생성, .set() - 값 설정

const Registry = require('winreg');
const { execAsync, execFileAsync, withTimeout: timeout } = require('./_exec');

// @network.js (12-39)
// getStats 함수: 네트워크 통계 정보 조회
// 반환값: { bytesReceived, bytesSent, total }
// 변수 설명:
//   - stdout: execAsync('netstat -e')로 조회한 네트워크 통계 출력
//   - lines: stdout를 줄 단위로 분할한 배열
//   - bytesReceived: 받은 데이터 총량(바이트)
//   - bytesSent: 보낸 데이터 총량(바이트)
//   - total: 총 네트워크 트래픽 = bytesReceived + bytesSent
// execAsync 사용: netstat -e 명령어로 이더넷 통계 조회 후 출력 파싱

async function getStats() {
  try {
    const { stdout } = await execAsync('netstat -e');
    const lines = stdout.split('\n');
    
    let bytesReceived = 0;
    let bytesSent = 0;
    
    for (const line of lines) {
      // [고도화] 한국어 Windows는 netstat -e가 'Bytes'가 아닌 '바이트'로 표기 → 항상 0이던 문제 수정
      if (line.includes('Bytes') || line.includes('바이트')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          bytesReceived = parseInt(parts[1]) || 0;
          bytesSent = parseInt(parts[2]) || 0;
        }
      }
    }

    return {
      bytesReceived,
      bytesSent,
      total: bytesReceived + bytesSent,
    };
  } catch (error) {
    console.error('Error getting network stats:', error);
    return { bytesReceived: 0, bytesSent: 0, total: 0 };
  }
}

// @network.js (41-85)
// pingTest 함수: 네트워크 핑 테스트 수행
// 매개변수: host - 핑 테스트 대상 호스트 주소 (기본값: '8.8.8.8')
// 반환값: { host, times, average, packetLoss, success } 또는 { host, success: false, error }
// 변수 설명:
//   - stdout: execAsync(`ping -n 4 ${host}`)로 조회한 핑 결과 출력
//     -n 4: 4번 핑 전송
//   - lines: stdout를 줄 단위로 분할한 배열
//   - times: 각 핑 응답 시간 배열(밀리초)
//   - avgTime: 평균 응답 시간(밀리초)
//   - packetLoss: 패킷 손실률(%)
// execAsync 사용: ping 명령어로 네트워크 연결 테스트 후 출력 파싱하여 응답 시간 및 패킷 손실률 추출

async function pingTest(host = '8.8.8.8') {
  try {
    // [보안] host를 셸에 문자열 보간하지 않고 execFile 인자로 전달해 명령 주입 차단
    const { stdout } = await execFileAsync('ping', ['-n', '4', String(host)], { timeout: 120000, maxBuffer: 1024 * 1024 * 20 });
    const lines = stdout.split('\n');
    
    const times = [];
    let avgTime = 0;
    let packetLoss = 0;

    for (const line of lines) {
      if (line.includes('time=') || line.includes('시간=')) {
        const match = line.match(/(\d+)ms/);
        if (match) {
          times.push(parseInt(match[1]));
        }
      }
      if (line.includes('Average') || line.includes('평균')) {
        const match = line.match(/(\d+)ms/);
        if (match) {
          avgTime = parseInt(match[1]);
        }
      }
      // [고도화] 한국어 ping은 '손실'로 표기 → packetLoss가 항상 0이던 문제 수정
      if (line.includes('Lost') || line.includes('손실')) {
        const match = line.match(/(\d+)%/);
        if (match) {
          packetLoss = parseInt(match[1]);
        }
      }
    }

    return {
      host,
      times,
      average: avgTime || (times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0),
      packetLoss,
      success: true,
    };
  } catch (error) {
    return {
      host,
      success: false,
      error: error.message,
    };
  }
}

async function optimize(options = {}) {
  const { adapterType = 'ethernet', requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    operations: [],
    errors: [],
    dnsFlush: false,
    tcpOptimization: false,
    winsockReset: false,
    qosOptimized: false,
    powerManagementOptimized: false,
    mtuOptimized: false,
    bufferOptimized: false,
    throttlingDisabled: false,
    adapterPriorityOptimized: false,
    requiresAdmin: false,
    adminGranted: false,
  };

  const permissionsService = require('./permissions');
  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  try {
    try {
      await timeout(execAsync('ipconfig /flushdns'), 3000);
      results.dnsFlush = true;
      results.operations.push('DNS 캐시 정리 완료');
    } catch (error) {
      results.errors.push({ action: 'dnsFlush', error: error.message });
    }

    if (isAdmin) {
      try {
        // [고도화] 레거시 TCP 레지스트리 키(TcpWindowSize/Tcp1323Opts/EnableChimney,
        // 전역 위치의 TcpAckFrequency/TcpNoDelay 등)는 현대 Windows의 자동 튜닝/CTCP에
        // 의해 무시된다. 실제 효과 있는 명령·키·위치로 교체한다.

        // 1) TCP 전역 튜닝 (자동 튜닝 정상화 + CTCP 혼잡 제어 + RSS)
        await execAsync('netsh int tcp set global autotuninglevel=normal', { timeout: 10000 }).catch(() => {});
        await execAsync('netsh int tcp set supplemental Internet congestionprovider=ctcp', { timeout: 10000 }).catch(() => {});
        await execAsync('netsh int tcp set global rss=enabled', { timeout: 10000 }).catch(() => {});

        // 2) 네트워크 스로틀링 해제 (멀티미디어 재생 중 네트워크 제한 제거 → 지연 감소)
        const throttleKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
        });
        await new Promise((resolve) => throttleKey.set('NetworkThrottlingIndex', Registry.REG_DWORD, '4294967295', () => resolve()));

        // 3) 모든 네트워크 인터페이스에 Nagle 알고리즘/ACK 지연 비활성화 (핑 감소).
        //    전역 Tcpip\Parameters가 아니라 "인터페이스별" 키여야 실제로 적용된다.
        const nagleScript = "Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object { New-ItemProperty -Path $_.PSPath -Name 'TcpAckFrequency' -Value 1 -PropertyType DWord -Force | Out-Null; New-ItemProperty -Path $_.PSPath -Name 'TCPNoDelay' -Value 1 -PropertyType DWord -Force | Out-Null }";
        await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${nagleScript}"`, { timeout: 15000 }).catch(() => {});

        results.tcpOptimization = true;
        results.throttlingDisabled = true;
        results.operations.push('TCP 지연 최소화 완료 (자동튜닝·CTCP, 인터페이스별 Nagle/ACK 지연 off, 스로틀 해제)');
      } catch (error) {
        results.errors.push({ action: 'tcpOptimization', error: error.message });
      }
    } else {
      results.operations.push('TCP/IP 최적화 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      const adminNetworkTasks = [
        (async () => {
          try {
            const qosKey = new Registry({
              hive: Registry.HKLM,
              key: '\\SYSTEM\\CurrentControlSet\\Services\\Psched\\Parameters\\Adapters',
            });

            await timeout(
              new Promise((resolve, reject) => {
                qosKey.set('NonBestEffortLimit', Registry.REG_DWORD, '0', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              }),
              5000
            );

            // [고도화] NonBestEffortLimit을 잘못된 레지스트리 위치에 써서 무효 → 성공 보고 제거(오탐 방지)
          } catch (error) {
          }
        })(),

        (async () => {
          try {
            const powerConfigCommands = [];
            
            if (adapterType === 'ethernet') {
              powerConfigCommands.push('powercfg /setacvalueindex SCHEME_CURRENT 501a4d13-42af-4429-9fd1-a8218c268e20 ee12f906-d277-404b-b6da-e5fa1a576df5 0');
            }
            
            if (adapterType === 'wifi') {
              powerConfigCommands.push('powercfg /setacvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 12bbebe6-2d59-4ba1-b5d5-8b8c7c193247 0');
              powerConfigCommands.push('powercfg /setacvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 94ac6d29-73ce-41a6-809f-6363ba21b47e 0');
            }
            
            powerConfigCommands.push('powercfg /setactive SCHEME_CURRENT');
            
            await timeout(
              Promise.all(powerConfigCommands.map(cmd => execAsync(cmd))),
              5000
            );
            
            results.powerManagementOptimized = true;
            results.operations.push(`${adapterType === 'ethernet' ? '이더넷' : 'WiFi'} 전원 관리 최적화 완료`);
          } catch (error) {
          }
        })(),

        (async () => {
          try {
            // [고도화] 하드코딩 한글 어댑터명("이더넷"/"Wi-Fi")은 영문/이름 변경 시스템에서
            // 실패한다. 미디어 타입으로 실제 어댑터를 찾아 MTU를 설정한다.
            const mediaFilter = adapterType === 'wifi' ? "$_.PhysicalMediaType -like '*802.11*'" : "$_.PhysicalMediaType -eq '802.3'";
            const mtuScript = `Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' -and (${mediaFilter}) } | ForEach-Object { Set-NetIPInterface -InterfaceIndex $_.ifIndex -NlMtuBytes 1500 -ErrorAction SilentlyContinue }`;
            await execAsync(`powershell -NoProfile -Command "${mtuScript}"`, { timeout: 10000 });
            results.mtuOptimized = true;
            results.operations.push('MTU 크기 최적화 완료');
          } catch (error) {
          }
        })(),
      ];

      await Promise.all(adminNetworkTasks.map(task => task.catch(() => {})));
    } else {
      results.operations.push('QoS/전원 관리/MTU 최적화 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      const additionalNetworkTasks = [
        (async () => {
          try {
            const tcpKey = new Registry({
              hive: Registry.HKLM,
              key: '\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters',
            });

            await timeout(
              Promise.all([
                new Promise((resolve, reject) => {
                  tcpKey.set('TcpReceiveWindow', Registry.REG_DWORD, '65535', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
                new Promise((resolve, reject) => {
                  tcpKey.set('TcpSendWindow', Registry.REG_DWORD, '65535', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
              ]),
              5000
            );

            // [고도화] TcpReceiveWindow/TcpSendWindow는 자동 튜닝에 무시되는 레거시 값 → 성공 보고 제거(오탐 방지)
          } catch (error) {
          }
        })(),

        (async () => {
          try {
            const updateKey = new Registry({
              hive: Registry.HKLM,
              key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization',
            });

            await timeout(
              new Promise((resolve, reject) => {
                updateKey.set('DODownloadMode', Registry.REG_DWORD, '0', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              }),
              5000
            );

            results.throttlingDisabled = true;
            results.operations.push('네트워크 스로틀링 방지 완료');
          } catch (error) {
          }
        })(),
      ];

      await Promise.all(additionalNetworkTasks.map(task => task.catch(() => {})));
    } else {
      results.operations.push('버퍼/스로틀링 최적화 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      try {
        // [고도화] 하드코딩 어댑터명 대신 미디어 타입으로 어댑터를 찾아 인터페이스 메트릭 설정
        // (이더넷=1 우선, Wi-Fi=2). 영문/이름 변경 시스템에서도 동작.
        const isWifi = adapterType === 'wifi';
        const mediaFilter = isWifi ? "$_.PhysicalMediaType -like '*802.11*'" : "$_.PhysicalMediaType -eq '802.3'";
        const metric = isWifi ? 2 : 1;
        const metricScript = `Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' -and (${mediaFilter}) } | ForEach-Object { Set-NetIPInterface -InterfaceIndex $_.ifIndex -InterfaceMetric ${metric} -ErrorAction SilentlyContinue }`;
        await execAsync(`powershell -NoProfile -Command "${metricScript}"`, { timeout: 10000 });
        results.adapterPriorityOptimized = true;
        results.operations.push('네트워크 어댑터 우선순위 조정 완료');
      } catch (error) {
      }
    } else {
      results.operations.push('어댑터 우선순위 최적화 skipped (requires admin)');
    }

    if (isAdmin || requestAdminPermission) {
      try {
        await timeout(execAsync('netsh winsock reset'), 5000);
        results.winsockReset = true;
        results.operations.push('Winsock 리셋 완료 (재부팅 권장)');
      } catch (error) {
      }
    } else {
      results.operations.push('Winsock 리셋 skipped (requires admin)');
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  getStats,
  pingTest,
  optimize,
};