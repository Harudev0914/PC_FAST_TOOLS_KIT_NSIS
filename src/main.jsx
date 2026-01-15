import React from 'react';
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
