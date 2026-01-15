// ---------
// 2025-09-05
// 개발자 : KR_Tuki
// 기능 : 게임 모드 컴포넌트
// ---------

import React, { useState, useEffect } from 'react';
import '../styles/GameMode.css';

function GameMode() {
  const [enabled, setEnabled] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [gameModeStatus, setGameModeStatus] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      if (window.electronAPI?.gaming?.getStatus) {
        const status = await window.electronAPI.gaming.getStatus();
        setGameModeStatus(status);
        setEnabled(status?.enabled || false);
      }
    } catch (error) {
      console.error('Error loading Game Mode status:', error);
    }
  };

  const handleApply = async () => {
    if (!window.electronAPI?.gaming) {
      console.error('Gaming API is not available');
      return;
    }

    setApplying(true);
    setApplyResult(null);

    try {
      let result;
      if (enabled) {
        result = await window.electronAPI.gaming.enableGameMode();
      } else {
        result = await window.electronAPI.gaming.disableGameMode();
      }
      setApplyResult(result);
      await loadStatus();
    } catch (error) {
      console.error('Apply error:', error);
      setApplyResult({
        success: false,
        error: error.message || 'Game Mode 설정 적용 중 오류가 발생했습니다.',
      });
    } finally {
      setApplying(false);
    }
  };

  const handleToggle = () => {
    setEnabled(!enabled);
  };

  return (
    <div className="game-mode">
      <div className="game-mode-header">
        <h2 className="game-mode-title">Game Mode</h2>
        <p className="game-mode-description">Windows Game Mode를 활성화하고 게임 성능을 최적화하세요</p>
      </div>

      <div className="game-mode-card">
        <div className="toggle-section">
          <div className="toggle-header">
            <label className="toggle-label">Game Mode 활성화</label>
            <button
              className={`toggle-button ${enabled ? 'active' : ''}`}
              onClick={handleToggle}
              disabled={applying}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="toggle-description">
            Game Mode를 활성화하면 CPU, GPU, 메모리, 네트워크 등 시스템 리소스가 게임에 최적화됩니다.
          </p>
        </div>
      </div>

      <div className="game-mode-card">
        <h3 className="card-title">적용될 최적화 설정</h3>
        <div className="setting-section">
          <div className="optimization-list">
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">Windows Game Mode 활성화</div>
                <div className="optimization-description">시스템 리소스를 게임에 집중시킵니다</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">CPU 최적화</div>
                <div className="optimization-description">고성능 전원 계획 및 CPU 부스트 활성화</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">GPU 최적화</div>
                <div className="optimization-description">GPU 스케줄링 우선순위 향상</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">메모리 최적화</div>
                <div className="optimization-description">메모리 정리 및 불필요한 프로세스 종료</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">네트워크 최적화</div>
                <div className="optimization-description">TCP/IP 파라미터 최적화 및 핑 지연 시간 최소화</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">오디오 최적화</div>
                <div className="optimization-description">게임 사운드 증폭 및 오디오 향상 기능 활성화</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">백그라운드 앱 최적화</div>
                <div className="optimization-description">불필요한 백그라운드 앱 및 서비스 일시 중지</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="game-mode-card">
        <div className="action-section">
          <button
            className="action-button apply-button"
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? '적용 중...' : '설정 적용'}
          </button>
        </div>
      </div>

      {applying && (
        <div className="game-mode-card">
          <div className="applying-section">
            <div className="applying-message">Game Mode 설정 적용 중...</div>
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div className="progress-bar-fill"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {applyResult && applyResult.success && (
        <div className="game-mode-card">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <div className="success-text">
              <h3 className="success-title">Game Mode 설정이 성공적으로 적용되었습니다.</h3>
              <p className="success-description">
                게임 성능 최적화 설정이 적용되었습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {applyResult && !applyResult.success && (
        <div className="game-mode-card">
          <div className="error-message">
            {applyResult.error || 'Game Mode 설정 적용 중 오류가 발생했습니다.'}
          </div>
        </div>
      )}

      {applyResult && applyResult.operations && applyResult.operations.length > 0 && (
        <div className="game-mode-card">
          <h3 className="card-title">적용된 작업</h3>
          <div className="operations-list">
            {applyResult.operations.map((operation, index) => (
              <div key={index} className="operation-item success">
                ✓ {operation}
              </div>
            ))}
          </div>
        </div>
      )}

      {applyResult && applyResult.errors && applyResult.errors.length > 0 && (
        <div className="game-mode-card">
          <h3 className="card-title">오류 발생</h3>
          <div className="operations-list">
            {applyResult.errors.map((error, index) => (
              <div key={index} className="operation-item error">
                ✗ {error.action || error.operation || '알 수 없는 작업'}: {error.error || '알 수 없는 오류'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GameMode;