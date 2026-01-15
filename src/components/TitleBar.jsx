// ---------
// 2025-10-05
// 개발자 : KR_Tuki
// 기능 : 타이틀 바 컴포넌트
// ---------

// @TitleBar.jsx (1-68)
// 날짜: 2025-10-05
// Import 모듈 설명:
// - react: React 라이브러리. 함수형 컴포넌트로 구현
// 변수 설명:
//   - handleMinimize: 윈도우 최소화 핸들러. window.electronAPI.window.minimize() 호출
//   - handleMaximize: 윈도우 최대화/복원 핸들러. window.electronAPI.window.toggleMaximize() 호출
//   - handleClose: 윈도우 닫기 핸들러. window.electronAPI.window.close() 호출
// 기능 원리:
// 1. 윈도우 컨트롤: Electron API를 통한 윈도우 최소화, 최대화/복원, 닫기 기능
// 2. 옵셔널 체이닝: window.electronAPI?.window로 API 존재 여부 확인 후 호출
// 3. 사용자 인터페이스: 커스텀 타이틀 바로 프레임리스 윈도우 제어

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
