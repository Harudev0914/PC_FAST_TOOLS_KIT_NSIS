import React from 'react';

/**
 * ---------
 * 2025-07-25
 * 개발자 : KR_Tuki
 * 기능 : React 앱 진입점
 * ---------
 * @main.jsx (1-27)
 * 날짜: 2025-07-25
 * Import 모듈 설명:
 * - react: React 라이브러리. React.StrictMode로 개발 모드에서 잠재적 문제 감지
 * - react-dom/client (ReactDOM): React DOM 렌더링 라이브러리
 *   사용 예: ReactDOM.createRoot() - React 18의 새로운 루트 생성 API, root.render() - 컴포넌트 렌더링
 * - App: 메인 앱 컴포넌트
 * - './styles/index.css': 전역 CSS 스타일
 * 변수 설명:
 *   - rootElement: React 앱이 마운트될 DOM 요소 (document.getElementById('root'))
 *   - root: React 18의 새로운 루트 객체 (ReactDOM.createRoot()로 생성)
 * 기능 원리:
 * 1. DOM 요소 확인: document.getElementById('root')로 마운트 포인트 확인
 * 2. React 루트 생성: ReactDOM.createRoot()로 새로운 루트 생성 (React 18)
 * 3. 컴포넌트 렌더링: root.render()로 App 컴포넌트 렌더링
 * 4. StrictMode: 개발 모드에서 잠재적 문제 감지 (이중 렌더링, deprecated API 사용 등)
 * 5. 에러 처리: root 요소가 없으면 에러 메시지 표시
 */
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="padding: 40px; color: red; font-family: Arial; background: #1a1a1a; min-height: 100vh; display: flex; align-items: center; justify-content: center;">오류: root 요소를 찾을 수 없습니다!</div>';
} else {
  console.log('Root element found, rendering App...');
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('App rendered successfully!');
  } catch (error) {
    console.error('Error rendering App:', error);
    rootElement.innerHTML = `
      <div style="padding: 40px; color: #e74c3c; font-family: Arial; background: #1a1a1a; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h1>렌더링 오류</h1>
        <p>${error.message || '앱을 렌더링하는 중 오류가 발생했습니다.'}</p>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
          새로고침
        </button>
      </div>
    `;
  }
}
