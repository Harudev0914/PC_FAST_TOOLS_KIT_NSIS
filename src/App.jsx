import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Error404 from './components/Error404';
import ErrorNetwork from './components/ErrorNetwork';
import LoadingScreen from './components/LoadingScreen';
import MainPage from './components/MainPage';
import './styles/App.css';

function App() {
  const [showLoading, setShowLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 50;
    let timeoutId = null;
    let isMounted = true;
    
    const checkAPI = async () => {
      if (!isMounted) return;

      if (window.electronAPI) {

        try {
          if (window.electronAPI.audio?.getDevices) {
            const devices = await window.electronAPI.audio.getDevices();
            window.__preloadedAudioDevices = devices || [];
          }

          if (window.electronAPI.audio?.getEQPresets) {
            const presets = await window.electronAPI.audio.getEQPresets();
            window.__preloadedEQPresets = presets || [];
          }

          if (window.electronAPI.audio?.getSettings) {
            const settings = await window.electronAPI.audio.getSettings();
            window.__preloadedAudioSettings = settings || null;
          }
        } catch (error) {
          console.error('Error preloading audio data:', error);
        }

        timeoutId = setTimeout(() => {
          if (isMounted) {
            setShowLoading(false);
          }
        }, 1500);
      } else {
        retries++;
        if (retries < maxRetries) {
          setTimeout(checkAPI, 100);
        } else {
          console.error('electronAPI not available after retries');
          if (isMounted) {
            setError('Electron API를 로드할 수 없습니다. Electron 환경에서 실행 중인지 확인하세요.');
            setShowLoading(false);
          }
        }
      }
    };
    
    // 최대 10초 후에는 무조건 로딩 화면 닫기 (폴백)
    const fallbackTimeout = setTimeout(() => {
      // 이 이펙트는 마운트 시 한 번만 돌아 showLoading이 초기값(true)에 고정된다 —
      // 조건에서 아무 역할도 못 하므로 isMounted만 본다. setShowLoading(false)는 여러 번 불려도 무해.
      if (isMounted) {
        console.warn('Loading timeout - forcing show to false');
        setShowLoading(false);
      }
    }, 10000);
    
    checkAPI();
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      clearTimeout(fallbackTimeout);
    };
  }, []);

  if (showLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        color: '#e74c3c',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#1a1a1a',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h1>오류 발생</h1>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          새로고침
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/error/404" element={<Error404 />} />
          <Route path="/error/network" element={<ErrorNetwork />} />
          <Route path="*" element={<Error404 />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
