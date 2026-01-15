// ---------
// 2025-08-20
// 개발자 : KR_Tuki
// 기능 : Windows Boost 컴포넌트
// ---------

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
      const result = await window.electronAPI.deltaForceCleaner.optimizeWithWindowsAPI({
        requestAdminPermission: true,
      });
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
            Windows Boost를 활성화하면 서비스, 메모리, Prefetch 등 시스템 리소스가 최적화됩니다.
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
                <div className="optimization-name">서비스 최적화</div>
                <div className="optimization-description">불필요한 Windows 서비스 비활성화 (Windows Search, Superfetch 등)</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">Prefetch/Superfetch 최적화</div>
                <div className="optimization-description">시스템 부팅 및 앱 시작 속도 최적화</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">Windows Search 최적화</div>
                <div className="optimization-description">검색 인덱싱 최적화로 시스템 리소스 절약</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">메모리 최적화</div>
                <div className="optimization-description">프로세스 우선순위 조정 및 메모리 관리</div>
              </div>
            </div>
            <div className="optimization-item">
              <span className="optimization-icon">✓</span>
              <div className="optimization-content">
                <div className="optimization-name">디스크 최적화</div>
                <div className="optimization-description">디스크 조각 모음 권장</div>
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

export default WindowsBoost;
