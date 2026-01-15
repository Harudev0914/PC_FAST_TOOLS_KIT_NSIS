// ---------
// 2025-07-20
// 개발자 : KR_Tuki
// 기능 : 메인 앱 컴포넌트 및 라우팅
// ---------

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
    
    const checkAPI = async () => {
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
        
        setTimeout(() => {
          setShowLoading(false);
        }, 1500);
      } else {
        retries++;
        if (retries < maxRetries) {
          setTimeout(checkAPI, 100);
        } else {
          console.error('electronAPI not available after retries');
          setError('Electron API를 로드할 수 없습니다. Electron 환경에서 실행 중인지 확인하세요.');
          setApiReady(true);
          setShowLoading(false);
        }
      }
    };
    checkAPI();
  }, []);

  if (showLoading) {
    return <LoadingScreen />;
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
