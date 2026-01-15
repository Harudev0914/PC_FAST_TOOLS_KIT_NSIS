import React from 'react';

/**
 * ---------
 * 2025-10-10
 * 개발자 : KR_Tuki
 * 기능 : 로딩 화면 컴포넌트
 * ---------
 * @LoadingScreen.jsx (1-39)
 * 날짜: 2025-10-10
 * Import 모듈 설명:
 * - react: React 라이브러리. 함수형 컴포넌트로 구현
 * 변수 설명:
 *   - 브랜드 정보: Ptimizer 로고 및 버전 정보 표시
 *   - 로딩 스피너: CSS 애니메이션 기반 로딩 인디케이터
 * 기능 원리:
 * 1. 브랜드 표시: SVG 로고 및 앱 이름, 버전 정보 표시
 * 2. 로딩 애니메이션: CSS 스피너로 로딩 중임을 시각적으로 표시
 * 3. 사용자 경험: 앱 로드 중 사용자에게 시각적 피드백 제공
 * 4. 브랜드 인식: 일관된 브랜딩으로 사용자 경험 향상
 */
import '../styles/LoadingScreen.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="brand-container">
          <div className="logo-container">
            <svg 
              viewBox="0 0 100 100" 
              xmlns="http://www.w3.org/2000/svg" 
              aria-hidden="true" 
              className="logo-svg"
            >
              <path d="M100 34.2c-.4-2.6-3.3-4-5.3-5.3-3.6-2.4-7.1-4.7-10.7-7.1-8.5-5.7-17.1-11.4-25.6-17.1-2-1.3-4-2.7-6-4-1.4-1-3.3-1-4.8 0-5.7 3.8-11.5 7.7-17.2 11.5L5.2 29C3 30.4.1 31.8 0 34.8c-.1 3.3 0 6.7 0 10v16c0 2.9-.6 6.3 2.1 8.1 6.4 4.4 12.9 8.6 19.4 12.9 8 5.3 16 10.7 24 16 2.2 1.5 4.4 3.1 7.1 1.3 2.3-1.5 4.5-3 6.8-4.5 8.9-5.9 17.8-11.9 26.7-17.8l9.9-6.6c.6-.4 1.3-.8 1.9-1.3 1.4-1 2-2.4 2-4.1V37.3c.1-1.1.2-2.1.1-3.1 0-.1 0 .2 0 0zM54.3 12.3 88 34.8 73 44.9 54.3 32.4zm-8.6 0v20L27.1 44.8 12 34.8zM8.6 42.8 19.3 50 8.6 57.2zm37.1 44.9L12 65.2l15-10.1 18.6 12.5v20.1zM50 60.2 34.8 50 50 39.8 65.2 50zm4.3 27.5v-20l18.6-12.5 15 10.1zm37.1-30.5L80.7 50l10.8-7.2z"></path>
            </svg>
          </div>
          <div className="brand-info">
            <h1 className="brand-name">Ptimizer</h1>
            <p className="brand-version">Version 1.0</p>
          </div>
        </div>
      </div>
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    </div>
  );
}

export default LoadingScreen;
