// ---------
// 2025-11-15
// 개발자 : KR_Tuki
// 기능 : 메모리 최적화 컴포넌트
// ---------

// @MemoryOptimizer.jsx (1-149)
// 날짜: 2025-11-15
// Import 모듈 설명:
// - react (useState, useEffect): React 훅. 상태 관리 및 생명주기 처리에 사용
//   사용 예: useState() - 상태 변수 선언, useEffect() - 사이드 이펙트 처리 (통계 조회 등)
// 변수 설명:
//   - stats: 메모리 통계 정보 (사용량, 전체, 여유, 사용률 등)
//   - processes: 프로세스 목록 (메모리 사용량 상위)
//   - optimizing: 메모리 최적화 진행 상태 (boolean)
//   - optimizeResult: 메모리 최적화 결과 객체
// 기능 원리:
// 1. 메모리 통계 조회: useEffect에서 2초마다 Promise.all()로 메모리 통계와 프로세스 목록 병렬 조회
// 2. 메모리 최적화: memory.optimize() API 호출로 메모리 최적화 수행
// 3. 프로세스 종료: memory.killProcess() API로 특정 프로세스 강제 종료
// 4. 데이터 포맷팅: formatBytes() 함수로 바이트 단위를 읽기 쉬운 형식으로 변환
// 5. 에러 처리: try-catch로 모든 API 호출 에러 처리
// 6. 메모리 관리: setInterval 정리 (cleanup 함수)로 메모리 누수 방지

import React, { useState, useEffect } from 'react';
import '../styles/MemoryOptimizer.css';

function MemoryOptimizer() {
  const [stats, setStats] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [memoryStats, processList] = await Promise.all([
          window.electronAPI.memory.getStats(),
          window.electronAPI.memory.getProcesses(),
        ]);
        setStats(memoryStats);
        setProcesses(processList.slice(0, 20));
      } catch (error) {
        console.error('Error fetching memory stats:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeResult(null);
    try {
      const result = await window.electronAPI.memory.optimize();
      setOptimizeResult(result);
      const newStats = await window.electronAPI.memory.getStats();
      setStats(newStats);
    } catch (error) {
      console.error('Optimize error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const handleKillProcess = async (pid) => {
    if (window.confirm('이 프로세스를 종료하시겠습니까?')) {
      try {
        const result = await window.electronAPI.memory.killProcess(pid);
        if (result.success) {
          setProcesses(processes.filter(p => p.pid !== pid));
        }
      } catch (error) {
        console.error('Kill process error:', error);
      }
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">메모리 최적화</h1>
        <p className="page-description">메모리 사용량을 모니터링하고 최적화하세요</p>
      </div>

      {stats && (
        <div className="card">
          <h3>메모리 상태</h3>
          <div className="memory-stats">
            <div className="memory-bar-container">
              <div className="memory-bar">
                <div
                  className="memory-bar-fill"
                  style={{ width: `${stats.usagePercent}%` }}
                />
              </div>
              <div className="memory-info">
                <span>사용 중: {formatBytes(stats.used)}</span>
                <span>사용률: {stats.usagePercent.toFixed(1)}%</span>
                <span>여유: {formatBytes(stats.free)}</span>
              </div>
            </div>
            <div className="stats-details">
              <div className="stat-item">
                <div className="stat-label">총 메모리</div>
                <div className="stat-value">{formatBytes(stats.total)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">사용 중</div>
                <div className="stat-value">{formatBytes(stats.used)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">여유</div>
                <div className="stat-value">{formatBytes(stats.free)}</div>
              </div>
            </div>
          </div>
          <button
            className="button button-primary"
            onClick={handleOptimize}
            disabled={optimizing}
            style={{ marginTop: '20px' }}
          >
            {optimizing ? '최적화 중...' : '메모리 최적화'}
          </button>
          {optimizeResult && (
            <div className={optimizeResult.success ? 'success-message' : 'error-message'}>
              {optimizeResult.success ? '메모리 최적화가 완료되었습니다.' : optimizeResult.error}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>프로세스 목록 (메모리 사용량 상위)</h3>
        <div className="process-list">
          <div className="process-header">
            <div>프로세스 이름</div>
            <div>메모리 사용량</div>
            <div>작업</div>
          </div>
          {processes.map((process) => (
            <div key={process.pid} className="process-item">
              <div className="process-name">{process.name}</div>
              <div className="process-memory">{formatBytes(process.memory)}</div>
              <button
                className="button button-danger"
                onClick={() => handleKillProcess(process.pid)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                종료
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MemoryOptimizer;
