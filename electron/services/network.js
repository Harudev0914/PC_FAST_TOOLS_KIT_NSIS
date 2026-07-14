// @network.js (1-10)
// 날짜: 2025-05-02
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. netstat, ping, ipconfig, powercfg 등 네트워크 명령어 실행에 사용
//   사용 예: execAsync('netstat -e') - 네트워크 통계 조회, execAsync('ping -n 4 8.8.8.8') - 핑 테스트
//   execAsync('ipconfig /flushdns') - DNS 캐시 플러시
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// 이 서비스는 사용자 권한(user-level)에서만 동작한다. 관리자 권한이 필요한 작업
// (netsh int tcp set global / netsh winsock reset / Set-NetIPInterface / HKLM 레지스트리 기록)은 수행하지 않는다.

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

// optimize 함수: 사용자 권한으로 가능한 네트워크 최적화 수행
// 매개변수: options - { adapterType: 'ethernet' | 'wifi' }
// (DNS 캐시 정리 + powercfg 어댑터 전원 관리 최적화)

async function optimize(options = {}) {
  const { adapterType = 'ethernet' } = options;

  const results = {
    success: true,
    operations: [],
    errors: [],
    dnsFlush: false,
    powerManagementOptimized: false,
  };

  try {
    try {
      await timeout(execAsync('ipconfig /flushdns'), 3000);
      results.dnsFlush = true;
      results.operations.push('DNS 캐시 정리 완료');
    } catch (error) {
      results.errors.push({ action: 'dnsFlush', error: error.message });
    }

    // 네트워크 어댑터 전원 관리 최적화 — powercfg는 사용자 권한으로 동작한다.
    // 명령이 실제로 성공한 경우에만 완료로 보고한다(허위 성공 보고 방지).
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
      results.errors.push({ action: 'powerManagement', error: error.message });
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