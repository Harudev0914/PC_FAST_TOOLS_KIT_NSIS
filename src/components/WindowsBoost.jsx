import React, { useState } from 'react';
import '../styles/WindowsBoost.css';

function WindowsBoost() {
  const [enabled, setEnabled] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);

  const handleApply = async () => {
    if (!window.electronAPI?.deltaForceCleaner) {
      console.error('Windows Boost API is not available');
      return;
    }

    setApplying(true);
    setApplyResult(null);

    try {
      // 관리자 권한을 요구하지 않는다(UAC 없음). 사용자 권한으로 가능한 최적화를 수행하고,
      // 앱이 이미 관리자로 실행 중이면 백엔드가 심화 최적화까지 자동 적용한다.
      const result = await window.electronAPI.deltaForceCleaner.optimizeWithWindowsAPI({});
      setApplyResult(result);
      if (result.success) {
        setEnabled(true);
      }
    } catch (error) {
      console.error('Apply error:', error);
      setApplyResult({
        success: false,
        error: error.message || 'Windows Boost 설정 적용 중 오류가 발생했습니다.',
      });
    } finally {
      setApplying(false);
    }
  };

  const handleToggle = () => {
    setEnabled(!enabled);
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
            관리자 권한 없이 즉시 적용 가능한 최적화를 수행합니다. (앱을 관리자 권한으로 실행하면 서비스·Prefetch·디스크 최적화까지 자동 적용)
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
                <div className="optimization-description">사용자 임시 폴더의 불필요한 파일 삭제 (관리자 권한 불필요)</div>
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

      <div className="windows-boost-card">
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
        <div className="windows-boost-card">
          <div className="applying-section">
            <div className="applying-message">Windows Boost 설정 적용 중...</div>
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div className="progress-bar-fill"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {applyResult && applyResult.success && (
        <div className="windows-boost-card">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <div className="success-text">
              <h3 className="success-title">Windows Boost 설정이 성공적으로 적용되었습니다.</h3>
              <p className="success-description">
                시스템 최적화 설정이 적용되었습니다.
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
