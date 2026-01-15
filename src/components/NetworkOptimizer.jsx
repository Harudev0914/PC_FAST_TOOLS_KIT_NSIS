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
