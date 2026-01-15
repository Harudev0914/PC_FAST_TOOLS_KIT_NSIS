// ---------
// 2025-11-01
// 개발자 : KR_Tuki
// 기능 : 파일 복구 컴포넌트
// ---------

import React, { useState } from 'react';
import '../styles/FileRecovery.css';

function FileRecovery() {
  const [scanning, setScanning] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [options, setOptions] = useState({
    drives: ['C:'],
    fileTypes: [],
    minSize: 0,
    maxSize: Infinity,
  });
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleScan = async () => {
    setScanning(true);
    setScanResults(null);
    setSelectedFiles([]);
    try {
      const results = await window.electronAPI.recovery.scan(options);
      setScanResults(results);
    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      setScanning(false);
    }
  };

  const handleRecover = async () => {
    if (selectedFiles.length === 0) {
      alert('복구할 파일을 선택하세요.');
      return;
    }

    setRecovering(true);
    try {
      for (const file of selectedFiles) {
        const destination = file.path.replace('$Recycle.Bin', 'Recovered');
        await window.electronAPI.recovery.recover(file.path, destination);
      }
      alert(`${selectedFiles.length}개 파일이 복구되었습니다.`);
      setSelectedFiles([]);
      setScanResults(null);
    } catch (error) {
      console.error('Recover error:', error);
      alert('파일 복구 중 오류가 발생했습니다.');
    } finally {
      setRecovering(false);
    }
  };

  const toggleFileSelection = (file) => {
    setSelectedFiles((prev) => {
      if (prev.some((f) => f.path === file.path)) {
        return prev.filter((f) => f.path !== file.path);
      } else {
        return [...prev, file];
      }
    });
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
        <h1 className="page-title">파일 복구</h1>
        <p className="page-description">삭제된 파일을 스캔하고 복구하세요</p>
      </div>

      <div className="card">
        <h3>스캔 옵션</h3>
        <div className="recovery-options">
          <div className="option-group">
            <label>드라이브 선택</label>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={options.drives.includes('C:')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setOptions({ ...options, drives: [...options.drives, 'C:'] });
                    } else {
                      setOptions({ ...options, drives: options.drives.filter((d) => d !== 'C:') });
                    }
                  }}
                />
                C:
              </label>
            </div>
          </div>
        </div>
        <button
          className="button button-primary"
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? '스캔 중...' : '파일 스캔 시작'}
        </button>
      </div>

      {scanResults && (
        <div className="card">
          <h3>스캔 결과</h3>
          <div className="scan-summary">
            <div className="summary-item">
              <span>발견된 파일:</span>
              <strong>{scanResults.total}개</strong>
            </div>
            <div className="summary-item">
              <span>총 크기:</span>
              <strong>{formatBytes(scanResults.totalSize)}</strong>
            </div>
            <div className="summary-item">
              <span>선택된 파일:</span>
              <strong>{selectedFiles.length}개</strong>
            </div>
          </div>
          <div className="file-list">
            <div className="file-list-header">
              <input
                type="checkbox"
                checked={selectedFiles.length === scanResults.files.length && scanResults.files.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedFiles(scanResults.files);
                  } else {
                    setSelectedFiles([]);
                  }
                }}
              />
              <div>파일 이름</div>
              <div>크기</div>
              <div>타입</div>
            </div>
            {scanResults.files.map((file, index) => (
              <div
                key={index}
                className={`file-item ${selectedFiles.some((f) => f.path === file.path) ? 'selected' : ''}`}
                onClick={() => toggleFileSelection(file)}
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.some((f) => f.path === file.path)}
                  onChange={() => toggleFileSelection(file)}
                />
                <div className="file-name">{file.name}</div>
                <div className="file-size">{formatBytes(file.size)}</div>
                <div className="file-type">{file.type}</div>
              </div>
            ))}
          </div>
          {selectedFiles.length > 0 && (
            <button
              className="button button-primary"
              onClick={handleRecover}
              disabled={recovering}
              style={{ marginTop: '20px' }}
            >
              {recovering ? '복구 중...' : `선택한 ${selectedFiles.length}개 파일 복구`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default FileRecovery;
