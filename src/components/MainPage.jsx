import React, { useState, useEffect, useRef } from 'react';
import TitleBar from './TitleBar';
import SmartOptimization from './SmartOptimization';
import WindowsBoost from './WindowsBoost';
import DeltaForceCleaner from './DeltaForceCleaner';
import SoundBoost from './SoundBoost';
import GameMode from './GameMode';
import '../styles/MainPage.css';

const menuItems = [
  { id: 'smart', label: 'Smart Optimization', icon: '' },
  { id: 'windowsboost', label: 'Windows Boost', icon: '' },
  { id: 'sound', label: 'Sound Boost', icon: '' },
  { id: 'slim', label: 'Delta Force Cleaner', icon: '' },
  { id: 'optiwin', label: 'Game Mode', icon: '' },
];

function MainPage() {
  const [selectedMenu, setSelectedMenu] = useState('smart');
  const [fastPingMenuOpen, setFastPingMenuOpen] = useState(false);
  const [fastPingOptimizing, setFastPingOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState({ percent: 0, currentTask: '' });
  const [optimizeResult, setOptimizeResult] = useState(null);
  const [adminPermissionEnabled, setAdminPermissionEnabled] = useState(false);
  const [globalOptimizationProgress, setGlobalOptimizationProgress] = useState(null);
  const fastPingMenuRef = useRef(null);
  const actionButtonRef = useRef(null);

  useEffect(() => {
    // [perf] 진행률 오버레이 폴링. 200ms면 프로그레스 바 갱신엔 충분히 부드럽고
    // 유휴 시(비활성)에는 이미 null이면 setState를 건너뛰어 불필요한 리렌더를 없앤다.
    const checkGlobalProgress = () => {
      const gp = window.__globalOptimizationProgress;
      if (gp && gp.active) {
        // 새 객체로 복사해 전달 (동일 참조면 React가 setState를 bail out해 오버레이가 안 갱신됨)
        setGlobalOptimizationProgress({ ...gp });
      } else {
        setGlobalOptimizationProgress((prev) => (prev === null ? prev : null));
      }
    };

    const interval = setInterval(checkGlobalProgress, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        fastPingMenuOpen &&
        fastPingMenuRef.current &&
        !fastPingMenuRef.current.contains(event.target) &&
        actionButtonRef.current &&
        !actionButtonRef.current.contains(event.target)
      ) {
        setFastPingMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [fastPingMenuOpen]);

  // 일괄 최적화 핸들러
  const handleBatchOptimize = async () => {
    if (!window.electronAPI?.fastPing) {
      console.error('Fast Ping API is not available');
      setOptimizeResult({ errors: [{ action: 'batchOptimize', error: 'Fast Ping API를 사용할 수 없습니다.' }] });
      return;
    }

    setFastPingMenuOpen(false);
    setFastPingOptimizing(true);
    setOptimizeProgress({ percent: 0, currentTask: '일괄 최적화 시작...' });
    
    window.__globalOptimizationProgress = {
      active: true,
      component: 'batch',
      percent: 0,
      currentTask: '일괄 최적화 시작...',
    };
    
    let progressInterval = null;
    try {
      const requestAdminPermission = adminPermissionEnabled;
      
      const updateProgress = (percent, task) => {
        setOptimizeProgress({ percent, currentTask: task });
        if (window.__globalOptimizationProgress) {
          window.__globalOptimizationProgress.percent = percent;
          window.__globalOptimizationProgress.currentTask = task;
        }
      };
      
      progressInterval = setInterval(() => {
        setOptimizeProgress(prev => {
          if (prev.percent >= 90) return prev;
          const newPercent = prev.percent + 2;
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = newPercent;
          }
          return { ...prev, percent: newPercent };
        });
      }, 200);
      
      updateProgress(10, 'CPU 최적화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(30, '메모리 최적화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(50, '디스크 최적화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(70, '네트워크 최적화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(85, '최종 최적화 중...');
      const result = await window.electronAPI.fastPing.batchOptimize({ requestAdminPermission });
      
      if (progressInterval) clearInterval(progressInterval);
      updateProgress(100, '완료');
      setOptimizeResult(result);
      
      // 완료 후 전역 상태 업데이트
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
        setTimeout(() => {
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = 0;
            window.__globalOptimizationProgress.currentTask = '';
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Batch Optimize error:', error);
      if (progressInterval) clearInterval(progressInterval);
      setOptimizeResult({ 
        success: false,
        errors: [{ action: 'batchOptimize', error: error.message || '알 수 없는 오류가 발생했습니다.' }] 
      });
      setOptimizeProgress({ percent: 0, currentTask: '오류 발생' });
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
        window.__globalOptimizationProgress.currentTask = '오류 발생';
      }
    } finally {
      setFastPingOptimizing(false);
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
      }
      setTimeout(() => {
        setOptimizeProgress({ percent: 0, currentTask: '' });
        if (window.__globalOptimizationProgress) {
          window.__globalOptimizationProgress.percent = 0;
          window.__globalOptimizationProgress.currentTask = '';
        }
      }, 1000);
    }
  };

  // 일괄 가속화 핸들러
  const handleBatchAccelerate = async () => {
    if (!window.electronAPI?.fastPing) {
      console.error('Fast Ping API is not available');
      setOptimizeResult({ errors: [{ action: 'batchAccelerate', error: 'Fast Ping API를 사용할 수 없습니다.' }] });
      return;
    }

    setFastPingMenuOpen(false);
    setFastPingOptimizing(true);
    setOptimizeProgress({ percent: 0, currentTask: '일괄 가속화 시작...' });
    
    window.__globalOptimizationProgress = {
      active: true,
      component: 'batch-accelerate',
      percent: 0,
      currentTask: '일괄 가속화 시작...',
    };
    
    let progressInterval = null;
    try {
      const requestAdminPermission = adminPermissionEnabled;
      
      const updateProgress = (percent, task) => {
        setOptimizeProgress({ percent, currentTask: task });
        if (window.__globalOptimizationProgress) {
          window.__globalOptimizationProgress.percent = percent;
          window.__globalOptimizationProgress.currentTask = task;
        }
      };
      
      progressInterval = setInterval(() => {
        setOptimizeProgress(prev => {
          if (prev.percent >= 90) return prev;
          const newPercent = prev.percent + 2;
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = newPercent;
          }
          return { ...prev, percent: newPercent };
        });
      }, 200);
      
      updateProgress(15, 'CPU 고성능 모드 활성화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(35, '메모리 가속화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(55, '디스크 프리페치 가속화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(75, '네트워크 가속화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(85, '최종 가속화 중...');
      const result = await window.electronAPI.fastPing.batchAccelerate({ requestAdminPermission });
      
      if (progressInterval) clearInterval(progressInterval);
      updateProgress(100, '완료');
      setOptimizeResult(result);
      
      // 완료 후 전역 상태 업데이트
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
        setTimeout(() => {
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = 0;
            window.__globalOptimizationProgress.currentTask = '';
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Batch Accelerate error:', error);
      if (progressInterval) clearInterval(progressInterval);
      setOptimizeResult({ 
        success: false,
        errors: [{ action: 'batchAccelerate', error: error.message || '알 수 없는 오류가 발생했습니다.' }] 
      });
      setOptimizeProgress({ percent: 0, currentTask: '오류 발생' });
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
        window.__globalOptimizationProgress.currentTask = '오류 발생';
      }
    } finally {
      setFastPingOptimizing(false);
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
      }
      setTimeout(() => {
        setOptimizeProgress({ percent: 0, currentTask: '' });
        if (window.__globalOptimizationProgress) {
          window.__globalOptimizationProgress.percent = 0;
          window.__globalOptimizationProgress.currentTask = '';
        }
      }, 1000);
    }
  };

  // 핑 최적화 핸들러
  const handlePingOptimize = async () => {
    if (!window.electronAPI?.fastPing) {
      console.error('Fast Ping API is not available');
      setOptimizeResult({ errors: [{ action: 'pingOptimize', error: 'Fast Ping API를 사용할 수 없습니다.' }] });
      return;
    }

    setFastPingMenuOpen(false);
    setFastPingOptimizing(true);
    setOptimizeProgress({ percent: 0, currentTask: '핑 최적화 시작...' });
    
    window.__globalOptimizationProgress = {
      active: true,
      component: 'ping',
      percent: 0,
      currentTask: '핑 최적화 시작...',
    };
    
    let progressInterval = null;
    try {
      const requestAdminPermission = adminPermissionEnabled;
      
      const updateProgress = (percent, task) => {
        setOptimizeProgress({ percent, currentTask: task });
        if (window.__globalOptimizationProgress) {
          window.__globalOptimizationProgress.percent = percent;
          window.__globalOptimizationProgress.currentTask = task;
        }
      };
      
      progressInterval = setInterval(() => {
        setOptimizeProgress(prev => {
          if (prev.percent >= 90) return prev;
          const newPercent = prev.percent + 3;
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = newPercent;
          }
          return { ...prev, percent: newPercent };
        });
      }, 200);
      
      updateProgress(20, 'DNS 캐시 정리 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(50, 'TCP/IP 파라미터 최적화 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(80, '네트워크 지연 시간 최소화 중...');
      const result = await window.electronAPI.fastPing.pingOptimize({ requestAdminPermission });
      
      if (progressInterval) clearInterval(progressInterval);
      updateProgress(100, '완료');
      setOptimizeResult(result);
      
      // 완료 후 전역 상태 업데이트
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
        setTimeout(() => {
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = 0;
            window.__globalOptimizationProgress.currentTask = '';
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Ping Optimize error:', error);
      if (progressInterval) clearInterval(progressInterval);
      setOptimizeResult({ 
        success: false,
        errors: [{ action: 'pingOptimize', error: error.message || '알 수 없는 오류가 발생했습니다.' }] 
      });
      setOptimizeProgress({ percent: 0, currentTask: '오류 발생' });
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
        window.__globalOptimizationProgress.currentTask = '오류 발생';
      }
    } finally {
      setFastPingOptimizing(false);
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
      }
      setTimeout(() => {
        setOptimizeProgress({ percent: 0, currentTask: '' });
        if (window.__globalOptimizationProgress) {
          window.__globalOptimizationProgress.percent = 0;
          window.__globalOptimizationProgress.currentTask = '';
        }
      }, 1000);
    }
  };

  return (
    <div className="main-page">
      <TitleBar />
      <div className="page-content">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <svg 
                viewBox="0 0 100 100" 
                xmlns="http://www.w3.org/2000/svg" 
                className="logo-icon"
              >
                <path d="M100 34.2c-.4-2.6-3.3-4-5.3-5.3-3.6-2.4-7.1-4.7-10.7-7.1-8.5-5.7-17.1-11.4-25.6-17.1-2-1.3-4-2.7-6-4-1.4-1-3.3-1-4.8 0-5.7 3.8-11.5 7.7-17.2 11.5L5.2 29C3 30.4.1 31.8 0 34.8c-.1 3.3 0 6.7 0 10v16c0 2.9-.6 6.3 2.1 8.1 6.4 4.4 12.9 8.6 19.4 12.9 8 5.3 16 10.7 24 16 2.2 1.5 4.4 3.1 7.1 1.3 2.3-1.5 4.5-3 6.8-4.5 8.9-5.9 17.8-11.9 26.7-17.8l9.9-6.6c.6-.4 1.3-.8 1.9-1.3 1.4-1 2-2.4 2-4.1V37.3c.1-1.1.2-2.1.1-3.1 0-.1 0 .2 0 0zM54.3 12.3 88 34.8 73 44.9 54.3 32.4zm-8.6 0v20L27.1 44.8 12 34.8zM8.6 42.8 19.3 50 8.6 57.2zm37.1 44.9L12 65.2l15-10.1 18.6 12.5v20.1zM50 60.2 34.8 50 50 39.8 65.2 50zm4.3 27.5v-20l18.6-12.5 15 10.1zm37.1-30.5L80.7 50l10.8-7.2z"></path>
              </svg>
              <span className="sidebar-brand">Ptimizer</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className={`nav-item ${selectedMenu === item.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedMenu(item.id);
                  setFastPingMenuOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="discord-info">
              <svg width="20" height="20" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z" fill="#FF003F" fillRule="nonzero"/>
                </g>
              </svg>
              <span className="discord-username">kr_tuki</span>
            </div>
          </div>
        </div>
        <div className="main-content-area">
          {selectedMenu === 'smart' && <SmartOptimization />}
          {selectedMenu === 'windowsboost' && <WindowsBoost />}
          {selectedMenu === 'sound' && <SoundBoost />}
          {selectedMenu === 'slim' && <DeltaForceCleaner />}
          {selectedMenu === 'optiwin' && <GameMode />}
          {selectedMenu !== 'smart' && selectedMenu !== 'windowsboost' && selectedMenu !== 'sound' && selectedMenu !== 'slim' && selectedMenu !== 'optiwin' && (
            <div className="coming-soon">
              <div className="coming-soon-icon">🚧</div>
              <h2>준비 중입니다</h2>
              <p>곧 출시될 예정입니다.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* 전역 최적화 진행 상황 표시 (왼쪽 하단) */}
      {globalOptimizationProgress && globalOptimizationProgress.active && (
        <div className="global-optimization-progress">
          <div className="global-progress-header">
            <span className="global-progress-title">최적화 진행 중</span>
            <span className="global-progress-component">
              {globalOptimizationProgress.component === 'cpu' && 'CPU'}
              {globalOptimizationProgress.component === 'memory' && '메모리'}
              {globalOptimizationProgress.component?.startsWith('disk-') && '디스크'}
              {globalOptimizationProgress.component === 'ethernet' && '이더넷'}
              {globalOptimizationProgress.component === 'wifi' && 'Wi-Fi'}
              {globalOptimizationProgress.component?.startsWith('gpu-') && 'GPU'}
              {globalOptimizationProgress.component === 'batch' && '일괄 최적화'}
              {globalOptimizationProgress.component === 'batch-accelerate' && '일괄 가속화'}
              {globalOptimizationProgress.component === 'ping' && '핑 최적화'}
            </span>
          </div>
          <div className="global-progress-task">{globalOptimizationProgress.currentTask}</div>
          <div className="global-progress-bar-container">
            <div 
              className="global-progress-bar-fill"
              style={{ width: `${globalOptimizationProgress.percent}%` }}
            ></div>
          </div>
          <div className="global-progress-percent">{globalOptimizationProgress.percent}%</div>
        </div>
      )}
      
      <button
        ref={actionButtonRef}
        className="action-button"
        onClick={() => setFastPingMenuOpen(!fastPingMenuOpen)}
        title="Fast Ping 메뉴"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      {/* Fast Ping Menu */}
      {fastPingMenuOpen && (
        <div ref={fastPingMenuRef} className="fast-ping-menu">
          <button 
            className="fast-ping-mode-btn batch-optimize"
            onClick={handleBatchOptimize}
            disabled={fastPingOptimizing}
          >
            일괄 최적화
          </button>
          <button 
            className="fast-ping-mode-btn batch-accelerate"
            onClick={handleBatchAccelerate}
            disabled={fastPingOptimizing}
          >
            일괄 가속화
          </button>
          <button 
            className="fast-ping-mode-btn ping-optimize"
            onClick={handlePingOptimize}
            disabled={fastPingOptimizing}
          >
            핑 최적화
          </button>

          {/* 최적화 결과 표시 */}
          {optimizeResult && (
            <div className="optimize-result-panel">
              <div className="optimize-result-header">
                <h3>최적화 결과</h3>
                <button 
                  className="close-result-btn"
                  onClick={() => setOptimizeResult(null)}
                >
                  ×
                </button>
              </div>
              <div className="optimize-result-content">
                {optimizeResult.success !== false && (
                  <div className="result-section">
                    <h4>성공한 작업</h4>
                    <div className="result-grid">
                      {optimizeResult.cpuOptimized && (
                        <div className="result-item success">
                          <span className="result-label">CPU</span>
                          <span className="result-status">최적화 완료</span>
                        </div>
                      )}
                      {optimizeResult.memoryOptimized && (
                        <div className="result-item success">
                          <span className="result-label">메모리</span>
                          <span className="result-status">최적화 완료</span>
                        </div>
                      )}
                      {optimizeResult.diskOptimized && (
                        <div className="result-item success">
                          <span className="result-label">디스크</span>
                          <span className="result-status">최적화 완료</span>
                        </div>
                      )}
                      {optimizeResult.networkOptimized && (
                        <div className="result-item success">
                          <span className="result-label">네트워크</span>
                          <span className="result-status">최적화 완료</span>
                        </div>
                      )}
                      {optimizeResult.gpuOptimized && (
                        <div className="result-item success">
                          <span className="result-label">GPU</span>
                          <span className="result-status">최적화 완료</span>
                        </div>
                      )}
                      {optimizeResult.pingOptimized && (
                        <div className="result-item success">
                          <span className="result-label">핑</span>
                          <span className="result-status">최적화 완료</span>
                        </div>
                      )}
                      {optimizeResult.cpuAccelerated && (
                        <div className="result-item success">
                          <span className="result-label">CPU</span>
                          <span className="result-status">가속화 완료</span>
                        </div>
                      )}
                      {optimizeResult.memoryAccelerated && (
                        <div className="result-item success">
                          <span className="result-label">메모리</span>
                          <span className="result-status">가속화 완료</span>
                        </div>
                      )}
                      {optimizeResult.diskAccelerated && (
                        <div className="result-item success">
                          <span className="result-label">디스크</span>
                          <span className="result-status">가속화 완료</span>
                        </div>
                      )}
                      {optimizeResult.networkAccelerated && (
                        <div className="result-item success">
                          <span className="result-label">네트워크</span>
                          <span className="result-status">가속화 완료</span>
                        </div>
                      )}
                      {optimizeResult.dnsFlush && (
                        <div className="result-item success">
                          <span className="result-label">DNS 캐시</span>
                          <span className="result-status">정리 완료</span>
                        </div>
                      )}
                      {optimizeResult.tcpOptimized && (
                        <div className="result-item success">
                          <span className="result-label">TCP/IP</span>
                          <span className="result-status">최적화 완료</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {optimizeResult.errors && optimizeResult.errors.length > 0 && (
                  <div className="result-section">
                    <h4>오류 발생</h4>
                    <div className="result-errors">
                      {optimizeResult.errors.map((error, index) => (
                        <div key={index} className="result-item error">
                          <span className="result-label">{error.action || error.operation || '알 수 없음'}</span>
                          <span className="result-status">{error.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {optimizeResult.operations && optimizeResult.operations.length > 0 && (
                  <div className="result-section">
                    <h4>작업 내역</h4>
                    <ul className="result-operations">
                      {optimizeResult.operations.map((operation, index) => (
                        <li key={index}>{operation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MainPage;
