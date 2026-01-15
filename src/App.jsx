/**
 * ---------
 * 2025-07-20
 * 개발자 : KR_Tuki
 * 기능 : 메인 앱 컴포넌트 및 라우팅
 * ---------
 * @App.jsx (1-94)
 * 날짜: 2025-07-20
 * Import 모듈 설명:
 * - react (useState, useEffect): React 훅. 컴포넌트 상태 관리 및 생명주기 처리에 사용
 *   사용 예: useState() - 상태 변수 선언, useEffect() - 사이드 이펙트 처리 (API 확인, 데이터 로드 등)
 * - react-router-dom (HashRouter, Routes, Route, Navigate): React 라우팅 라이브러리
 *   사용 예: HashRouter - 해시 기반 라우팅, Routes - 라우트 정의, Route - 개별 라우트, Navigate - 리다이렉트
 * - ErrorBoundary: React 에러 바운더리 컴포넌트. 자식 컴포넌트의 에러를 잡아서 처리
 * - Error404, ErrorNetwork: 에러 페이지 컴포넌트
 * - LoadingScreen: 로딩 화면 컴포넌트
 * - MainPage: 메인 페이지 컴포넌트
 * 변수 설명:
 *   - apiReady: Electron API 준비 상태 (boolean)
 *   - showLoading: 로딩 화면 표시 여부 (boolean)
 *   - error: 에러 메시지 (string | null)
 *   - retries: API 확인 재시도 횟수 (number)
 *   - maxRetries: 최대 재시도 횟수 (50회, 5초 대기)
 * 기능 원리:
 * 1. Electron API 확인: useEffect에서 window.electronAPI 존재 여부 확인 (최대 50회 재시도)
 * 2. 오디오 데이터 사전 로드: API 준비 시 오디오 장치, EQ 프리셋, 설정 정보 미리 로드 (성능 최적화)
 * 3. 라우팅 설정: HashRouter 기반 라우팅 (/ 메인 페이지, /error/404, /error/network)
 * 4. 에러 처리: ErrorBoundary로 컴포넌트 에러 처리, 에러 발생 시 Error500 페이지 표시
 * 5. 상태 관리: useState로 API 준비 상태, 로딩 상태, 에러 상태 관리
 */

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
