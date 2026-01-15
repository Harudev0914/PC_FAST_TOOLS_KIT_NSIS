// ---------
// 2025-07-25
// 개발자 : KR_Tuki
// 기능 : React 앱 진입점
// ---------

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="padding: 40px; color: red; font-family: Arial;">오류: root 요소를 찾을 수 없습니다!</div>';
} else {
  console.log('Root element found, rendering App...');
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('App rendered successfully!');
}
