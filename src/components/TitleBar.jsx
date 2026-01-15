// ---------
// 2025-10-05
// 개발자 : KR_Tuki
// 기능 : 타이틀 바 컴포넌트
// ---------

import React from 'react';
import '../styles/TitleBar.css';

function TitleBar() {
  const handleMinimize = () => {
    if (window.electronAPI?.window) {
      window.electronAPI.window.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.window) {
      window.electronAPI.window.toggleMaximize();
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.window) {
      window.electronAPI.window.close();
    }
  };

  return (
    <div className="title-bar">
      <div className="title-bar-content">
        <div className="title-bar-title">Optimizer</div>
        <div className="title-bar-controls">
          <button 
            className="title-bar-button minimize-button" 
            onClick={handleMinimize}
            title="최소화"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="5" width="12" height="1" fill="currentColor"/>
            </svg>
          </button>
          <button 
            className="title-bar-button maximize-button" 
            onClick={handleMaximize}
            title="최대화/복원"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1" fill="none"/>
            </svg>
          </button>
          <button 
            className="title-bar-button close-button" 
            onClick={handleClose}
            title="닫기"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TitleBar;
