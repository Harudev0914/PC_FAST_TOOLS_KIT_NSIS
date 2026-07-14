import React, { useState } from 'react';
import {
  useOptimizationProgress,
  startOptimizationProgress,
  endOptimizationProgress,
} from '../hooks/useOptimizationProgress';
import { useAppliedState } from '../hooks/useAppliedState';
import '../styles/WindowsBoost.css';

function WindowsBoost() {
  // 메뉴를 옮기면 이 패널은 언마운트된다 — 적용 상태는 백엔드에서 복원한다.
  const [enabled, setEnabled] = useAppliedState('windowsboost');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);

  // 백엔드 단계별 진행률을 좌하단 토스트로 중계
  useOptimizationProgress('windowsboost');

  // ON이면 최적화를 즉시 적용하고, OFF면 켜기 직전에 찍어둔 설정으로 되돌린다.
  // 실패하면 토글을 원래 위치로 되돌려 UI와 실제 시스템 상태가 어긋나지 않게 한다.
  const handleToggle = async () => {
    if (applying) return;

    if (!window.electronAPI?.deltaForceCleaner) {
      console.error('Windows Boost API is not available');
      return;
    }

    const next = !enabled;
    setEnabled(next);
    setApplying(true);
    setApplyResult(null);
    startOptimizationProgress(
      'windowsboost',
      next ? '최적화 진행 중' : '설정 해제 중',
      next ? '최적화 시작...' : '기본값 복원 시작...'
    );

    try {
      const result = next
        ? await window.electronAPI.deltaForceCleaner.optimizeWithWindowsAPI()
        : await window.electronAPI.deltaForceCleaner.restoreWindowsDefaults();
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
            ? 'Windows Boost 설정 적용 중 오류가 발생했습니다.'
            : 'Windows Boost 설정 해제 중 오류가 발생했습니다.'),
      });
    } finally {
      setApplying(false);
      endOptimizationProgress();
    }
  };

  return (
    <div className="windows-boost">
      <div className="windows-boost-header">
        <h2 className="windows-boost-title">Windows Boost</h2>
        <p className="windows-boost-description">Windows API를 활용하여 시스템 성능을 최적화하세요</p>
      </div>

      <div className="windows-boost-card">
        <div className="toggle-section">
          <div className="toggle-header">
            <label className="toggle-label">Windows Boost 활성화</label>
            <button
              className={`toggle-button ${enabled ? 'active' : ''}`}
              onClick={handleToggle}
              disabled={applying}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="toggle-description">
            ON으로 켜면 아래 최적화가 즉시 적용되고, OFF로 끄면 <strong>켜기 직전의 설정</strong>으로 정확히 되돌립니다. (임시 파일 삭제는 되돌릴 수 없습니다)
          </p>
        </div>
      </div>

      <div className="windows-boost-card">
        <h3 className="card-title">적용될 최적화 설정</h3>
        <div className="setting-section">
          <div className="optimization-list">
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">임시 파일 정리</div>
                <div className="optimization-description">오래된 임시 파일만 삭제하며, 실행 중인 프로그램이 쓰고 있는 파일은 건너뜁니다</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">게임 모드 활성화</div>
                <div className="optimization-description">Windows 게임 모드로 게임 성능 우선</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">Game DVR 비활성화</div>
                <div className="optimization-description">백그라운드 녹화 종료로 게임 프레임 향상</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">시각 효과 최적화</div>
                <div className="optimization-description">애니메이션·그림자 최소화로 성능 우선</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">메모리 최적화</div>
                <div className="optimization-description">백그라운드 프로세스 우선순위 조정 및 메모리 정리</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">DNS 캐시 플러시</div>
                <div className="optimization-description">네트워크 응답 지연 개선</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 진행 상황은 좌하단 전역 진행률 토스트(MainPage)가 단계별로 표시한다. */}

      {applyResult && applyResult.success && (
        <div className="windows-boost-card">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <div className="success-text">
              <h3 className="success-title">
                Windows Boost 설정이 성공적으로 {enabled ? '적용' : '해제'}되었습니다.
              </h3>
              <p className="success-description">
                {enabled
                  ? '시스템 최적화 설정이 적용되었습니다.'
                  : '켜기 직전의 설정으로 되돌렸습니다.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {applyResult && !applyResult.success && (
        <div className="windows-boost-card">
          <div className="error-message">
            {applyResult.error || 'Windows Boost 설정 적용 중 오류가 발생했습니다.'}
          </div>
        </div>
      )}

      {applyResult && applyResult.operations && applyResult.operations.length > 0 && (
        <div className="windows-boost-card">
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
        <div className="windows-boost-card">
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

// [perf] MainPage 부모가 진행률 폴링으로 자주 리렌더되지만 이 패널은 props가 없어
// React.memo로 감싸면 자신의 내부 상태 변화에만 리렌더된다(부모 리렌더 전파 차단).
export default React.memo(WindowsBoost);
