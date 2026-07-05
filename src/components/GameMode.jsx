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
            원클릭으로 FPS·마우스 가속·반응속도·핑을 한 번에 최적화합니다. 관리자 권한 없이 즉시 적용되며, 앱을 관리자 권한으로 실행하면 GPU 스케줄링·핑(네트워크)·게임 작업 우선순위까지 자동 적용됩니다.
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
                <div className="optimization-name">Windows 게임 모드 (FPS 향상)</div>
                <div className="optimization-description">시스템 리소스를 게임에 집중시켜 프레임을 높입니다</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">Game DVR·백그라운드 녹화 비활성화</div>
                <div className="optimization-description">숨은 녹화 오버헤드를 제거해 FPS·프레임타임 개선</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">마우스 가속 비활성화</div>
                <div className="optimization-description">1:1 조준 일관성 확보 (재로그인 없이 즉시 적용)</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">입력·UI 반응속도 향상</div>
                <div className="optimization-description">메뉴 표시 지연 0, 키 반복 지연 최소화</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">시각 효과 성능 우선 + 고성능 전원</div>
                <div className="optimization-description">애니메이션 최소화 및 고성능 전원 계획 적용</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">메모리 정리 + DNS 플러시</div>
                <div className="optimization-description">백그라운드 우선순위 조정 및 응답 지연 개선</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">핑·네트워크 지연 최소화 <span style={{ opacity: 0.6 }}>(관리자 실행 시)</span></div>
                <div className="optimization-description">Nagle/ACK 지연 off, TCP 튜닝으로 반응속도 향상</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">GPU 스케줄링·게임 작업 우선순위 <span style={{ opacity: 0.6 }}>(관리자 실행 시)</span></div>
                <div className="optimization-description">하드웨어 가속 GPU 스케줄링 및 MMCSS 우선순위 상향</div>
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