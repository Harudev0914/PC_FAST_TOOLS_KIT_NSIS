import React, { useState } from 'react';
import {
  useOptimizationProgress,
  startOptimizationProgress,
  endOptimizationProgress,
} from '../hooks/useOptimizationProgress';
import { useAppliedState } from '../hooks/useAppliedState';
import '../styles/GameMode.css';

function GameMode() {
  // 메뉴를 옮기면 이 패널은 언마운트된다 — 적용 상태는 백엔드에서 복원한다.
  const [enabled, setEnabled] = useAppliedState('gamemode');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);

  // 백엔드 단계별 진행률을 좌하단 토스트로 중계
  useOptimizationProgress('gamemode');

  // ON이면 게임 최적화를 즉시 적용하고, OFF면 켜기 직전에 찍어둔 설정으로 되돌린다.
  // 실패하면 토글을 원래 위치로 되돌려 UI와 실제 시스템 상태가 어긋나지 않게 한다.
  const handleToggle = async () => {
    if (applying) return;

    if (!window.electronAPI?.gaming) {
      console.error('Gaming API is not available');
      return;
    }

    const next = !enabled;
    setEnabled(next);
    setApplying(true);
    setApplyResult(null);
    startOptimizationProgress(
      'gamemode',
      next ? '최적화 진행 중' : '설정 해제 중',
      next ? '게임 최적화 시작...' : '기본값 복원 시작...'
    );

    try {
      const result = next
        ? await window.electronAPI.gaming.enableGameMode()
        : await window.electronAPI.gaming.disableGameMode();
      setApplyResult(result);
      if (!result?.success) {
        setEnabled(!next);
      }
    } catch (error) {
      console.error('Apply error:', error);
      setEnabled(!next);
      setApplyResult({
        success: false,
        error:
          error.message ||
          (next
            ? 'Game Mode 설정 적용 중 오류가 발생했습니다.'
            : 'Game Mode 설정 해제 중 오류가 발생했습니다.'),
      });
    } finally {
      setApplying(false);
      endOptimizationProgress();
    }
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
            ON으로 켜면 FPS·마우스 가속·반응속도 최적화가 즉시 적용되고, OFF로 끄면 <strong>켜기 직전의 설정</strong>으로 정확히 되돌립니다.
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
          </div>
        </div>
      </div>

      {/* 진행 상황은 좌하단 전역 진행률 토스트(MainPage)가 단계별로 표시한다. */}

      {applyResult && applyResult.success && (
        <div className="game-mode-card">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <div className="success-text">
              <h3 className="success-title">
                Game Mode 설정이 성공적으로 {enabled ? '적용' : '해제'}되었습니다.
              </h3>
              <p className="success-description">
                {enabled
                  ? '게임 성능 최적화 설정이 적용되었습니다.'
                  : '켜기 직전의 설정으로 되돌렸습니다.'}
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

// [perf] props가 없는 패널 — React.memo로 부모(MainPage) 리렌더 전파를 차단한다.
export default React.memo(GameMode);