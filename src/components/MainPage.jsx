import React, { useState, useEffect } from 'react';
import TitleBar from './TitleBar';
import SmartOptimization from './SmartOptimization';
import WindowsBoost from './WindowsBoost';
import DeltaForceCleaner from './DeltaForceCleaner';
import SoundBoost from './SoundBoost';
import GameMode from './GameMode';
import SoftwareUpdater from './SoftwareUpdater';
import {
  startOptimizationProgress,
  updateOptimizationProgress,
  endOptimizationProgress,
} from '../hooks/useOptimizationProgress';
import '../styles/MainPage.css';

const menuItems = [
  { id: 'smart', label: 'Smart Optimization', icon: '' },
  { id: 'windowsboost', label: 'Windows Boost', icon: '' },
  { id: 'sound', label: 'Sound Boost', icon: '' },
  { id: 'slim', label: 'Delta Force Cleaner', icon: '' },
  { id: 'optiwin', label: 'Game Mode', icon: '' },
  { id: 'updates', label: 'Updates', icon: '' },
];

// Fast Ping 버튼을 누르면 이 세 가지를 순서대로 모두 실행한다.
const FAST_PING_STAGES = [
  { method: 'batchOptimize', label: '일괄 최적화' },
  { method: 'batchAccelerate', label: '일괄 가속화' },
  { method: 'pingOptimize', label: '핑 최적화' },
];

// 세 단계의 결과를 하나로 합친다. 결과 패널은 boolean 플래그(cpuOptimized 등)와
// operations/errors 배열을 읽으므로, 플래그는 OR로 누적하고 배열은 이어붙인다.
function mergeStageResult(target, result) {
  if (!result) return;
  for (const [key, value] of Object.entries(result)) {
    if (key === 'operations' || key === 'errors') {
      if (Array.isArray(value)) target[key].push(...value);
    } else if (key !== 'success' && typeof value === 'boolean') {
      target[key] = target[key] || value;
    }
  }
  if (result.success === false) target.success = false;
}

function MainPage() {
  const [selectedMenu, setSelectedMenu] = useState('smart');
  const [fastPingOptimizing, setFastPingOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);
  const [globalOptimizationProgress, setGlobalOptimizationProgress] = useState(null);

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

  // Fast Ping 버튼: 일괄 최적화 → 일괄 가속화 → 핑 최적화를 순서대로 모두 실행한다.
  // 진행률은 각 단계가 실제로 끝난 시점에만 올린다(타이머로 퍼센트를 지어내지 않는다).
  const handleFastPing = async () => {
    if (fastPingOptimizing) return;

    if (!window.electronAPI?.fastPing) {
      console.error('Fast Ping API is not available');
      setOptimizeResult({
        success: false,
        errors: [{ action: 'fastPing', error: 'Fast Ping API를 사용할 수 없습니다.' }],
      });
      return;
    }

    setFastPingOptimizing(true);
    setOptimizeResult(null);
    startOptimizationProgress('fastping', '최적화 진행 중', `${FAST_PING_STAGES[0].label} 중...`);

    const merged = { success: true, operations: [], errors: [] };

    try {
      for (let i = 0; i < FAST_PING_STAGES.length; i++) {
        const stage = FAST_PING_STAGES[i];
        updateOptimizationProgress(
          Math.round((i / FAST_PING_STAGES.length) * 100),
          `${stage.label} 중...`
        );
        mergeStageResult(merged, await window.electronAPI.fastPing[stage.method]({}));
      }
      updateOptimizationProgress(100, '완료');
    } catch (error) {
      console.error('Fast Ping error:', error);
      merged.success = false;
      merged.errors.push({
        action: 'fastPing',
        error: error.message || '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setOptimizeResult(merged);
      setFastPingOptimizing(false);
      endOptimizationProgress();
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
                onClick={() => setSelectedMenu(item.id)}
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
          {selectedMenu === 'updates' && <SoftwareUpdater />}
          {selectedMenu !== 'smart' && selectedMenu !== 'windowsboost' && selectedMenu !== 'sound' && selectedMenu !== 'slim' && selectedMenu !== 'optiwin' && selectedMenu !== 'updates' && (
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
            {/* 해제(OFF) 작업은 "설정 해제 중"처럼 자기 제목을 넘긴다 */}
            <span className="global-progress-title">
              {globalOptimizationProgress.title || '최적화 진행 중'}
            </span>
            <span className="global-progress-component">
              {globalOptimizationProgress.component === 'cpu' && 'CPU'}
              {globalOptimizationProgress.component === 'memory' && '메모리'}
              {globalOptimizationProgress.component?.startsWith('disk-') && '디스크'}
              {globalOptimizationProgress.component === 'ethernet' && '이더넷'}
              {globalOptimizationProgress.component === 'wifi' && 'Wi-Fi'}
              {globalOptimizationProgress.component?.startsWith('gpu-') && 'GPU'}
              {globalOptimizationProgress.component === 'fastping' && '전체 최적화'}
              {globalOptimizationProgress.component === 'gamemode' && 'Game Mode'}
              {globalOptimizationProgress.component === 'windowsboost' && 'Windows Boost'}
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
      
      {/* 한 번 누르면 일괄 최적화·일괄 가속화·핑 최적화를 모두 실행한다 */}
      <button
        className="action-button"
        onClick={handleFastPing}
        disabled={fastPingOptimizing}
        title="일괄 최적화 · 일괄 가속화 · 핑 최적화 모두 실행"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

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
  );
}

export default MainPage;
