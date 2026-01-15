import React, { useState, useEffect } from 'react';
import '../styles/CPUOptimizer.css';

function CPUOptimizer() {
  const [stats, setStats] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);
  const [computeOptimizing, setComputeOptimizing] = useState(false);
  const [computeResult, setComputeResult] = useState(null);
  const [libraries, setLibraries] = useState(null);
  const [detectingLibraries, setDetectingLibraries] = useState(false);

  const isValidValue = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === 'Unknown' || trimmed === '0' || trimmed === '0.0' || trimmed === '0/0' || trimmed === '0/0GB' || trimmed === '0/0MB' || trimmed === '0:0:0:0' || trimmed === '0.0.0.0' || trimmed === '::') return false;
    }
    if (typeof value === 'number') {
      if (isNaN(value) || value === 0) return false;
    }
    if (typeof value === 'boolean') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return true;
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const systemStats = await window.electronAPI.systemStats.getAll();
        setStats(systemStats.cpu);
      } catch (error) {
        console.error('Error fetching CPU stats:', error);
      }
    }, 2000);

    // 라이브러리 감지
    detectLibraries();

    return () => clearInterval(interval);
  }, []);

  const detectLibraries = async () => {
    if (!window.electronAPI?.computeOptimization) return;
    
    setDetectingLibraries(true);
    try {
      const detected = await window.electronAPI.computeOptimization.detectLibraries();
      setLibraries(detected);
    } catch (error) {
      console.error('Error detecting libraries:', error);
    } finally {
      setDetectingLibraries(false);
    }
  };

  const handleComputeOptimize = async () => {
    if (!window.electronAPI?.computeOptimization) {
      console.error('Compute Optimization API is not available');
      return;
    }

    setComputeOptimizing(true);
    setComputeResult(null);

    try {
      const result = await window.electronAPI.computeOptimization.optimizeAll({
        requestAdminPermission: true,
      });
      setComputeResult(result);
    } catch (error) {
      console.error('Compute optimization error:', error);
      setComputeResult({
        success: false,
        error: error.message || '컴퓨팅 최적화 중 오류가 발생했습니다.',
      });
    } finally {
      setComputeOptimizing(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeResult(null);
    try {
      const result = await window.electronAPI.cpu.optimize();
      setOptimizeResult(result);
      const systemStats = await window.electronAPI.systemStats.getAll();
      setStats(systemStats.cpu);
    } catch (error) {
      console.error('Optimize error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">CPU 최적화</h1>
        <p className="page-description">CPU 성능을 모니터링하고 최적화하세요</p>
      </div>

      {stats && (
        <div className="card">
          <h3>CPU 정보</h3>
          <div className="cpu-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#667eea' }}>
                  {stats.cores || 0}
                </div>
                <div className="stat-label">코어 수</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#764ba2' }}>
                  {(stats.usage || 0).toFixed(1)}%
                </div>
                <div className="stat-label">사용률</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#2ecc71' }}>
                  {stats.speed || '0 GHz'}
                </div>
                <div className="stat-label">속도</div>
              </div>
            </div>
            <div className="cpu-details">
              <div className="detail-item">
                <span>모델:</span>
                <strong>{stats.model || 'Unknown CPU'}</strong>
              </div>
              {isValidValue(stats.threads) && (
                <div className="detail-item">
                  <span>논리 프로세서:</span>
                  <strong>{stats.threads}</strong>
                </div>
              )}
              {isValidValue(stats.sockets) && stats.sockets > 0 && (
                <div className="detail-item">
                  <span>소켓:</span>
                  <strong>{stats.sockets}</strong>
                </div>
              )}
              {isValidValue(stats.baseSpeed) && stats.baseSpeed !== '0 GHz' && (
                <div className="detail-item">
                  <span>기본 속도:</span>
                  <strong>{stats.baseSpeed}</strong>
                </div>
              )}
              {stats.virtualization !== undefined && (
                <div className="detail-item">
                  <span>가상화:</span>
                  <strong>{stats.virtualization ? '사용' : '사용 안 함'}</strong>
                </div>
              )}
              {isValidValue(stats.processes) && (
                <div className="detail-item">
                  <span>프로세스:</span>
                  <strong>{stats.processes}</strong>
                </div>
              )}
              {isValidValue(stats.threads) && (
                <div className="detail-item">
                  <span>스레드:</span>
                  <strong>{stats.threads}</strong>
                </div>
              )}
              {isValidValue(stats.handles) && (
                <div className="detail-item">
                  <span>핸들:</span>
                  <strong>{stats.handles}</strong>
                </div>
              )}
              {isValidValue(stats.uptime) && stats.uptime !== '0:0:0:0' && (
                <div className="detail-item">
                  <span>작동 시간:</span>
                  <strong>{stats.uptime}</strong>
                </div>
              )}
              {isValidValue(stats.l1Cache) && stats.l1Cache !== '0KB' && (
                <div className="detail-item">
                  <span>L1 캐시:</span>
                  <strong>{stats.l1Cache}</strong>
                </div>
              )}
              {isValidValue(stats.l2Cache) && stats.l2Cache !== '0MB' && (
                <div className="detail-item">
                  <span>L2 캐시:</span>
                  <strong>{stats.l2Cache}</strong>
                </div>
              )}
              {isValidValue(stats.l3Cache) && stats.l3Cache !== '0MB' && (
                <div className="detail-item">
                  <span>L3 캐시:</span>
                  <strong>{stats.l3Cache}</strong>
                </div>
              )}
            </div>
            <div className="cpu-usage-bar">
              <div className="usage-bar-container">
                <div
                  className="usage-bar-fill"
                  style={{ width: `${stats.usage || 0}%` }}
                />
              </div>
              <div className="usage-info">
                CPU 사용률: {(stats.usage || 0).toFixed(1)}%
              </div>
            </div>
          </div>
          <button
            className="button button-primary"
            onClick={handleOptimize}
            disabled={optimizing}
            style={{ marginTop: '20px' }}
          >
            {optimizing ? '최적화 중...' : 'CPU 최적화'}
          </button>
          {optimizeResult && (
            <div className="optimize-results">
              {optimizeResult.powerPlan && (
                <div className="optimize-result-item success">✓ 고성능 전원 계획 활성화</div>
              )}
              {optimizeResult.processorAffinity && (
                <div className="optimize-result-item success">✓ 프로세서 성능 부스트 활성화</div>
              )}
              {optimizeResult.errors && optimizeResult.errors.length > 0 && (
                <div className="optimize-result-item error">
                  ❌ 일부 작업 중 오류가 발생했습니다. 관리자 권한이 필요할 수 있습니다.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>최적화 기능</h3>
        <ul className="feature-list">
          <li>고성능 전원 계획 자동 활성화</li>
          <li>프로세서 성능 부스트 최대화</li>
          <li>CPU 스로틀링 방지</li>
          <li>프로세스 우선순위 최적화</li>
        </ul>
      </div>

      <div className="card">
        <h3>컴퓨팅 라이브러리 최적화</h3>
        <p className="page-description" style={{ marginBottom: '16px' }}>
          OpenCL, CUDA, Intel oneAPI 등 고급 컴퓨팅 라이브러리를 활용한 CPU/GPU 최적화
        </p>
        
        {detectingLibraries && (
          <div style={{ padding: '12px', color: '#b0b0b0' }}>라이브러리 감지 중...</div>
        )}

        {libraries && (
          <div className="libraries-status" style={{ marginBottom: '20px' }}>
            <div className="library-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ color: libraries.opencl ? '#2ecc71' : '#e74c3c' }}>
                {libraries.opencl ? '✓' : '✗'}
              </span>
              <span>OpenCL (GPU/CPU/DSP/FPGA 병렬 처리)</span>
            </div>
            <div className="library-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ color: libraries.cuda ? '#2ecc71' : '#e74c3c' }}>
                {libraries.cuda ? '✓' : '✗'}
              </span>
              <span>CUDA (NVIDIA GPU 가속 - cuBLAS, cuFFT, cuDNN, cuSPARSE)</span>
            </div>
            <div className="library-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ color: libraries.oneAPI ? '#2ecc71' : '#e74c3c' }}>
                {libraries.oneAPI ? '✓' : '✗'}
              </span>
              <span>Intel oneAPI (oneDNN, oneMKL, SYCL)</span>
            </div>
          </div>
        )}

        <button
          className="button button-primary"
          onClick={handleComputeOptimize}
          disabled={computeOptimizing}
        >
          {computeOptimizing ? '컴퓨팅 최적화 중...' : '컴퓨팅 라이브러리 최적화'}
        </button>

        {computeResult && (
          <div className="optimize-results" style={{ marginTop: '20px' }}>
            {computeResult.success && computeResult.operations && computeResult.operations.length > 0 && (
              <div>
                <h4 style={{ color: '#2ecc71', marginBottom: '12px' }}>성공한 작업:</h4>
                {computeResult.operations.map((op, idx) => (
                  <div key={idx} className="optimize-result-item success">
                    ✓ {op}
                  </div>
                ))}
              </div>
            )}
            {computeResult.errors && computeResult.errors.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ color: '#e74c3c', marginBottom: '12px' }}>오류:</h4>
                {computeResult.errors.map((err, idx) => (
                  <div key={idx} className="optimize-result-item error">
                    ✗ {err.action || err.operation || '알 수 없는 작업'}: {err.error}
                  </div>
                ))}
              </div>
            )}
            {computeResult.opencl && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
                <strong style={{ color: '#667eea' }}>OpenCL:</strong> {computeResult.opencl.openclDetected ? '감지됨' : '미감지'}
                {computeResult.opencl.openclOptimized && <span style={{ color: '#2ecc71', marginLeft: '8px' }}>✓ 최적화 완료</span>}
              </div>
            )}
            {computeResult.cuda && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
                <strong style={{ color: '#76b900' }}>CUDA:</strong> {computeResult.cuda.cudaDetected ? '감지됨' : '미감지'}
                {computeResult.cuda.cudaOptimized && <span style={{ color: '#2ecc71', marginLeft: '8px' }}>✓ 최적화 완료</span>}
                {computeResult.cuda.cudaLibraries && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#b0b0b0' }}>
                    {computeResult.cuda.cudaLibraries.cuBLAS && 'cuBLAS '}
                    {computeResult.cuda.cudaLibraries.cuFFT && 'cuFFT '}
                    {computeResult.cuda.cudaLibraries.cuDNN && 'cuDNN '}
                    {computeResult.cuda.cudaLibraries.cuSPARSE && 'cuSPARSE'}
                  </div>
                )}
              </div>
            )}
            {computeResult.oneAPI && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
                <strong style={{ color: '#0071c5' }}>Intel oneAPI:</strong> {computeResult.oneAPI.oneAPIDetected ? '감지됨' : '미감지'}
                {computeResult.oneAPI.oneAPIOptimized && <span style={{ color: '#2ecc71', marginLeft: '8px' }}>✓ 최적화 완료</span>}
                {computeResult.oneAPI.libraries && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#b0b0b0' }}>
                    {computeResult.oneAPI.libraries.oneDNN && 'oneDNN '}
                    {computeResult.oneAPI.libraries.oneMKL && 'oneMKL '}
                    {computeResult.oneAPI.libraries.SYCL && 'SYCL'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CPUOptimizer;
