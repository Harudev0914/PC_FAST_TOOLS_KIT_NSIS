import React, { useState, useEffect } from 'react';
import '../styles/GamingMode.css';

function GamingMode() {
  const [status, setStatus] = useState(null);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const currentStatus = await window.electronAPI.gaming.getStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const handleEnable = async () => {
    setEnabling(true);
    setResult(null);
    try {
      const result = await window.electronAPI.gaming.enable();
      setResult(result);
      await loadStatus();
    } catch (error) {
      console.error('Enable error:', error);
    } finally {
      setEnabling(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    setResult(null);
    try {
      const result = await window.electronAPI.gaming.disable();
      setResult(result);
      await loadStatus();
    } catch (error) {
      console.error('Disable error:', error);
    } finally {
      setDisabling(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">게이밍 모드</h1>
        <p className="page-description">게임 성능을 최적화하기 위한 게이밍 모드를 활성화하세요</p>
      </div>

      <div className="card">
        <h3>게이밍 모드 상태</h3>
        <div className="gaming-status">
          <div className={`status-indicator ${status?.enabled ? 'active' : 'inactive'}`}>
            <div className="status-dot" />
            <span>{status?.enabled ? '활성화됨' : '비활성화됨'}</span>
          </div>
          {status && (
            <div className="status-info">
              <p>마지막 업데이트: {new Date(status.timestamp).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>게이밍 모드 제어</h3>
        <div className="gaming-controls">
          <button
            className="button button-primary"
            onClick={handleEnable}
            disabled={enabling || disabling || status?.enabled}
          >
            {enabling ? '활성화 중...' : '게이밍 모드 활성화'}
          </button>
          <button
            className="button button-secondary"
            onClick={handleDisable}
            disabled={enabling || disabling || !status?.enabled}
          >
            {disabling ? '비활성화 중...' : '게이밍 모드 비활성화'}
          </button>
        </div>
        {result && (
          <div className="gaming-results">
            {result.gameMode && (
              <div className="success-message">✓ Windows 게임 모드 활성화</div>
            )}
            {result.backgroundApps && (
              <div className="success-message">✓ 백그라운드 앱 최적화</div>
            )}
            {result.gpuPriority && (
              <div className="success-message">✓ GPU 우선순위 설정</div>
            )}
            {result.services && (
              <div className="success-message">✓ 불필요한 서비스 일시 중지</div>
            )}
            {result.errors && result.errors.length > 0 && (
              <div className="error-message">
                일부 작업 중 오류가 발생했습니다. 관리자 권한이 필요할 수 있습니다.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3>게이밍 모드 기능</h3>
        <ul className="feature-list">
          <li>Windows 게임 모드 자동 활성화</li>
          <li>백그라운드 앱 성능 최적화</li>
          <li>GPU 스케줄링 우선순위 향상</li>
          <li>불필요한 서비스 일시 중지</li>
          <li>시스템 리소스 게임에 집중</li>
        </ul>
      </div>
    </div>
  );
}

export default GamingMode;
