// ---------
// 2025-10-20
// 개발자 : KR_Tuki
// 기능 : 컴퓨터 클리너 컴포넌트
// ---------

import React, { useState } from 'react';
import '../styles/Cleaner.css';

function Cleaner() {
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [cleanResults, setCleanResults] = useState(null);
  const [options, setOptions] = useState({
    tempFiles: true,
    browserCache: true,
    registry: false,
    safeDelete: true,
  });

  const handleScan = async () => {
    setScanning(true);
    setScanResults(null);
    try {
      const results = await window.electronAPI.cleaner.scan();
      setScanResults(results);
    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      setScanning(false);
    }
  };

  const handleClean = async () => {
    if (!scanResults) {
      await handleScan();
      return;
    }

    setCleaning(true);
    setCleanResults(null);
    try {
      const results = await window.electronAPI.cleaner.clean(options);
      setCleanResults(results);
      setScanResults(null);
    } catch (error) {
      console.error('Clean error:', error);
    } finally {
      setCleaning(false);
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
        <h1 className="page-title">컴퓨터 클리너</h1>
        <p className="page-description">불필요한 파일과 캐시를 정리하여 디스크 공간을 확보하세요</p>
      </div>

      <div className="card">
        <h3>정리 옵션</h3>
        <div className="options-grid">
          <label className="option-item">
            <input
              type="checkbox"
              checked={options.tempFiles}
              onChange={(e) => setOptions({ ...options, tempFiles: e.target.checked })}
            />
            <span>임시 파일</span>
          </label>
          <label className="option-item">
            <input
              type="checkbox"
              checked={options.browserCache}
              onChange={(e) => setOptions({ ...options, browserCache: e.target.checked })}
            />
            <span>브라우저 캐시</span>
          </label>
          <label className="option-item">
            <input
              type="checkbox"
              checked={options.registry}
              onChange={(e) => setOptions({ ...options, registry: e.target.checked })}
            />
            <span>레지스트리 정리</span>
          </label>
          <label className="option-item">
            <input
              type="checkbox"
              checked={options.safeDelete}
              onChange={(e) => setOptions({ ...options, safeDelete: e.target.checked })}
            />
            <span>안전한 삭제 (휴지통)</span>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="action-buttons">
          <button
            className="button button-primary"
            onClick={handleScan}
            disabled={scanning || cleaning}
          >
            {scanning ? '스캔 중...' : '스캔 시작'}
          </button>
          <button
            className="button button-primary"
            onClick={handleClean}
            disabled={cleaning || (!scanResults && !scanning)}
          >
            {cleaning ? '정리 중...' : '정리 시작'}
          </button>
        </div>
      </div>

      {scanResults && (
        <div className="card">
          <h3>스캔 결과</h3>
          <div className="results-grid">
            <div className="result-item">
              <div className="result-label">임시 파일</div>
              <div className="result-value">{formatBytes(scanResults.tempFiles.totalSize)}</div>
              <div className="result-count">{scanResults.tempFiles.files.length}개 파일</div>
            </div>
            <div className="result-item">
              <div className="result-label">브라우저 캐시</div>
              <div className="result-value">{formatBytes(scanResults.browserCache.totalSize)}</div>
              <div className="result-count">{scanResults.browserCache.files.length}개 파일</div>
            </div>
            <div className="result-item">
              <div className="result-label">총 정리 가능</div>
              <div className="result-value" style={{ color: '#2ecc71' }}>
                {formatBytes(scanResults.totalSize)}
              </div>
            </div>
          </div>
        </div>
      )}

      {cleanResults && (
        <div className="card">
          <h3>정리 완료</h3>
          <div className="success-message">
            <strong>{cleanResults.deleted}개 파일</strong>이 삭제되었습니다.
            <br />
            <strong>{formatBytes(cleanResults.freedSpace)}</strong>의 공간이 확보되었습니다.
          </div>
          {cleanResults.errors.length > 0 && (
            <div className="error-message">
              <strong>오류:</strong> {cleanResults.errors.length}개 항목 처리 중 오류 발생
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Cleaner;
