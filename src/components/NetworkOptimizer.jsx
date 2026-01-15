// ---------
// 2025-08-15
// 개발자 : KR_Tuki
// 기능 : 네트워크 최적화 컴포넌트
// ---------

// @NetworkOptimizer.jsx (1-300)
// 날짜: 2025-08-15
// Import 모듈 설명:
// - react (useState, useEffect): React 훅. 상태 관리 및 생명주기 처리에 사용
//   사용 예: useState() - 상태 변수 선언, useEffect() - 사이드 이펙트 처리 (통계 조회, API 감지 등)
// 변수 설명:
//   - stats: 네트워크 통계 정보 (송신/수신 바이트, 속도 등)
//   - optimizing: 네트워크 최적화 진행 상태 (boolean)
//   - pinging: Ping 테스트 진행 상태 (boolean)
//   - pingResult: Ping 테스트 결과 객체
//   - optimizeResult: 네트워크 최적화 결과 객체
//   - pingHost: Ping 테스트 대상 호스트 (기본값: '8.8.8.8')
//   - availableAPIs: 사용 가능한 네트워크 최적화 API (QUIC, ENet, IOCP)
//   - detectingAPIs: API 감지 진행 상태 (boolean)
//   - advancedOptimizing: 고급 최적화 진행 상태 (boolean)
//   - advancedResult: 고급 최적화 결과 객체
//   - selectedAPIs: 선택된 최적화 API ({ quic: boolean, enet: boolean, iocp: boolean })
// 기능 원리:
// 1. 네트워크 통계 조회: useEffect에서 3초마다 network.getStats() API로 네트워크 통계 조회
// 2. 네트워크 API 감지: 컴포넌트 마운트 시 networkOptimization.detectAPIs()로 QUIC, ENet, IOCP 감지
// 3. 기본 네트워크 최적화: network.optimize() API 호출
// 4. 고급 네트워크 최적화: networkOptimization API로 QUIC, ENet, IOCP 활성화
// 5. Ping 테스트: network.pingTest() API로 네트워크 지연 측정
// 6. 에러 처리: try-catch로 모든 API 호출 에러 처리
// 7. 메모리 관리: setInterval 정리 (cleanup 함수)로 메모리 누수 방지

import React, { useState, useEffect } from 'react';
import '../styles/NetworkOptimizer.css';

function NetworkOptimization() {
  const [stats, setStats] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [optimizeResult, setOptimizeResult] = useState(null);
  const [pingHost, setPingHost] = useState('8.8.8.8');
  
  const [availableAPIs, setAvailableAPIs] = useState(null);
  const [detectingAPIs, setDetectingAPIs] = useState(false);
  const [advancedOptimizing, setAdvancedOptimizing] = useState(false);
  const [advancedResult, setAdvancedResult] = useState(null);
  const [selectedAPIs, setSelectedAPIs] = useState({
    quic: true,
    enet: true,
    iocp: true,
  });

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const networkStats = await window.electronAPI.network.getStats();
        setStats(networkStats);
      } catch (error) {
        console.error('Error fetching network stats:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    detectAvailableAPIs();
  }, []);

  const detectAvailableAPIs = async () => {
    setDetectingAPIs(true);
    try {
      const apis = await window.electronAPI.networkOptimization.detectAPIs();
      setAvailableAPIs(apis);
    } catch (error) {
      console.error('Error detecting network APIs:', error);
    } finally {
      setDetectingAPIs(false);
    }
  };

  const handleAdvancedOptimize = async () => {
    setAdvancedOptimizing(true);
    setAdvancedResult(null);
    try {
      const result = await window.electronAPI.networkOptimization.optimizeAll({
        enableQUIC: selectedAPIs.quic,
        enableENet: selectedAPIs.enet,
        enableIOCP: selectedAPIs.iocp,
      });
      setAdvancedResult(result);
    } catch (error) {
      console.error('Advanced optimize error:', error);
      setAdvancedResult({ success: false, error: error.message });
    } finally {
      setAdvancedOptimizing(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeResult(null);
    try {
      const result = await window.electronAPI.network.optimize();
      setOptimizeResult(result);
    } catch (error) {
      console.error('Optimize error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const handlePingTest = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const result = await window.electronAPI.network.pingTest(pingHost);
      setPingResult(result);
    } catch (error) {
      console.error('Ping error:', error);
    } finally {
      setPinging(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">네트워크 최적화</h1>
        <p className="page-description">네트워크 설정을 최적화하고 핑을 테스트하세요</p>
      </div>

      {stats && (
        <div className="card">
          <h3>네트워크 통계</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{formatBytes(stats.bytesReceived)}</div>
              <div className="stat-label">받은 데이터</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatBytes(stats.bytesSent)}</div>
              <div className="stat-label">보낸 데이터</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatBytes(stats.total)}</div>
              <div className="stat-label">총 트래픽</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>네트워크 최적화</h3>
        <p>DNS 캐시 플러시, TCP/IP 설정 최적화, Winsock 리셋을 수행합니다.</p>
        <button
          className="button button-primary"
          onClick={handleOptimize}
          disabled={optimizing}
        >
          {optimizing ? '최적화 중...' : '네트워크 최적화'}
        </button>
        {optimizeResult && (
          <div className="optimize-results">
            {optimizeResult.dnsFlush && (
              <div className="success-message">✓ DNS 캐시 플러시 완료</div>
            )}
            {optimizeResult.tcpOptimization && (
              <div className="success-message">✓ TCP/IP 설정 최적화 완료</div>
            )}
            {optimizeResult.winsockReset && (
              <div className="success-message">✓ Winsock 리셋 완료</div>
            )}
            {optimizeResult.errors.length > 0 && (
              <div className="error-message">
                일부 작업 중 오류가 발생했습니다. 관리자 권한이 필요할 수 있습니다.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3>핑 테스트</h3>
        <div className="ping-controls">
          <input
            type="text"
            value={pingHost}
            onChange={(e) => setPingHost(e.target.value)}
            placeholder="호스트 주소 (예: 8.8.8.8)"
            className="input-field"
          />
          <button
            className="button button-primary"
            onClick={handlePingTest}
            disabled={pinging}
          >
            {pinging ? '테스트 중...' : '핑 테스트'}
          </button>
        </div>
        {pingResult && (
          <div className="ping-results">
            {pingResult.success ? (
              <>
                <div className="ping-stat">
                  <span>호스트:</span>
                  <strong>{pingResult.host}</strong>
                </div>
                <div className="ping-stat">
                  <span>평균 응답 시간:</span>
                  <strong>{pingResult.average.toFixed(2)}ms</strong>
                </div>
                {pingResult.packetLoss > 0 && (
                  <div className="ping-stat">
                    <span>패킷 손실:</span>
                    <strong>{pingResult.packetLoss}%</strong>
                  </div>
                )}
                {pingResult.times && pingResult.times.length > 0 && (
                  <div className="ping-times">
                    <div>응답 시간:</div>
                    <div>{pingResult.times.join('ms, ')}ms</div>
                  </div>
                )}
              </>
            ) : (
              <div className="error-message">핑 테스트 실패: {pingResult.error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default NetworkOptimizer;
