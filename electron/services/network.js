// ---------
// 2025-05-02
// 개발자 : KR_Tuki
// 기능 : 네트워크 설정 최적화
// ---------

// @network.js (1-10)
// 날짜: 2025-05-02
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. netstat, ping, ipconfig, netsh 등 네트워크 명령어 실행에 사용
//   사용 예: execAsync('netstat -e') - 네트워크 통계 조회, execAsync('ping -n 4 8.8.8.8') - 핑 테스트
//   execAsync('ipconfig /flushdns') - DNS 캐시 플러시, execAsync('netsh winsock reset') - Winsock 리셋
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. 네트워크 어댑터 설정, TCP/IP 파라미터 변경에 사용
//   사용 예: new Registry({ hive: Registry.HKLM, key }) - 레지스트리 키 생성, .set() - 값 설정

const { exec } = require('child_process');
const { promisify } = require('util');
const Registry = require('winreg');
const execAsync = promisify(exec);

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
      if (line.includes('Bytes')) {
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
    const { stdout } = await execAsync(`ping -n 4 ${host}`);
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
      if (line.includes('Lost')) {
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

  const timeout = (promise, ms) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
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

    if (isAdmin || requestAdminPermission) {
      try {
        const tcpKey = new Registry({
          hive: Registry.HKLM,
          key: '\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters',
        });

        await timeout(
          Promise.all([
            new Promise((resolve, reject) => {
              tcpKey.set('TcpWindowSize', Registry.REG_SZ, '65535', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('Tcp1323Opts', Registry.REG_DWORD, '3', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('EnableChimney', Registry.REG_DWORD, '1', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('TcpAckFrequency', Registry.REG_DWORD, '1', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('TcpNoDelay', Registry.REG_DWORD, '1', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              tcpKey.set('KeepAliveTime', Registry.REG_DWORD, '300000', (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
          ]),
          5000
        );

        results.tcpOptimization = true;
        results.operations.push('TCP/IP 고급 최적화 완료');
      } catch (error) {
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

            results.qosOptimized = true;
            results.operations.push('QoS 패킷 스케줄러 최적화 완료');
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
            const mtuCommands = [];
            
            if (adapterType === 'ethernet') {
              mtuCommands.push(execAsync('netsh interface ipv4 set subinterface "이더넷" mtu=1500 store=persistent'));
            }
            
            if (adapterType === 'wifi') {
              mtuCommands.push(execAsync('netsh interface ipv4 set subinterface "Wi-Fi" mtu=1500 store=persistent'));
            }
            
            if (mtuCommands.length > 0) {
              await timeout(Promise.all(mtuCommands), 5000);
              results.mtuOptimized = true;
              results.operations.push('MTU 크기 최적화 완료');
            }
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

            results.bufferOptimized = true;
            results.operations.push('네트워크 버퍼 크기 조정 완료');
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
        const adapterCommands = [];
        
        if (adapterType === 'ethernet') {
          adapterCommands.push(execAsync('netsh interface ipv4 set interface "이더넷" metric=1'));
        }
        
        if (adapterType === 'wifi') {
          adapterCommands.push(execAsync('netsh interface ipv4 set interface "Wi-Fi" metric=2'));
        }
        
        if (adapterCommands.length > 0) {
          await timeout(Promise.all(adapterCommands), 5000);
          results.adapterPriorityOptimized = true;
          results.operations.push('네트워크 어댑터 우선순위 조정 완료');
        }
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