import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Error404 from './components/Error404';
import ErrorNetwork from './components/ErrorNetwork';
import LoadingScreen from './components/LoadingScreen';
import MainPage from './components/MainPage';
import './styles/App.css';

function App() {
  const [apiReady, setApiReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 50;
    let timeoutId = null;
    let isMounted = true;
    
    console.log('App useEffect started, checking electronAPI...');
    
    const checkAPI = async () => {
      if (!isMounted) return;
      
      if (window.electronAPI) {
        console.log('electronAPI is ready');
        setApiReady(true);
        
        try {
          if (window.electronAPI.audio?.getDevices) {
            const devices = await window.electronAPI.audio.getDevices();
            window.__preloadedAudioDevices = devices || [];
            console.log('Audio devices preloaded:', window.__preloadedAudioDevices);
          }
          
          if (window.electronAPI.audio?.getEQPresets) {
            const presets = await window.electronAPI.audio.getEQPresets();
            window.__preloadedEQPresets = presets || [];
            console.log('EQ presets preloaded:', window.__preloadedEQPresets);
          }
          
          if (window.electronAPI.audio?.getSettings) {
            const settings = await window.electronAPI.audio.getSettings();
            window.__preloadedAudioSettings = settings || null;
            console.log('Audio settings preloaded:', window.__preloadedAudioSettings);
          }
        } catch (error) {
          console.error('Error preloading audio data:', error);
        }
        
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.log('Setting showLoading to false');
            setShowLoading(false);
          }
        }, 1500);
      } else {
        retries++;
        console.log(`electronAPI check retry ${retries}/${maxRetries}`);
        if (retries < maxRetries) {
          setTimeout(checkAPI, 100);
        } else {
          console.error('electronAPI not available after retries');
          if (isMounted) {
            setError('Electron API를 로드할 수 없습니다. Electron 환경에서 실행 중인지 확인하세요.');
            setApiReady(true);
            setShowLoading(false);
          }
        }
      }
    };
    
    // 최대 10초 후에는 무조건 로딩 화면 닫기 (폴백)
    const fallbackTimeout = setTimeout(() => {
      if (isMounted && showLoading) {
        console.warn('Loading timeout - forcing show to false');
        setShowLoading(false);
        setApiReady(true);
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
