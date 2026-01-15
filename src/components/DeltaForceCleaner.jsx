/**
 * ---------
 * 2025-09-20
 * 개발자 : KR_Tuki
 * 기능 : Delta Force 클리너 컴포넌트
 * ---------
 */

import React, { useState, useEffect } from 'react';
import '../styles/DeltaForceCleaner.css';

function DeltaForceCleaner() {
  const [directoryPath, setDirectoryPath] = useState('~\\Delta Force\\Game\\DeltaForce\\Saved\\Logs');
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [cleanResults, setCleanResults] = useState(null);
  const [finding, setFinding] = useState(false);

  const handleAutoScan = async () => {
    if (!window.electronAPI?.deltaForceCleaner) {
      console.error('Delta Force Cleaner API is not available');
      return;
    }

    setScanning(true);
    setScanResults(null);
    try {
      const results = await window.electronAPI.deltaForceCleaner.scan(directoryPath);
      setScanResults(results);
    } catch (error) {
      console.error('Scan error:', error);
      setScanResults({
        success: false,
        error: error.message || '스캔 중 오류가 발생했습니다.',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleFindDirectory = async () => {
    if (!window.electronAPI?.deltaForceCleaner) {
      console.error('Delta Force Cleaner API is not available');
      return;
    }

    setFinding(true);
    setScanResults(null);
    
    try {
      // Windows API로 디렉토리 검색
      const result = await window.electronAPI.deltaForceCleaner.findDirectory();
      
      if (result.success && result.scanResult) {
        setDirectoryPath(result.path);
        setScanResults(result.scanResult);
      } else {
        setScanResults({
          success: false,
          error: result.error || '디렉토리를 찾을 수 없습니다.',
          path: result.path,
        });
        setDirectoryPath('~\\Delta Force\\Game\\DeltaForce\\Saved\\Logs');
      }
    } catch (error) {
      console.error('Find directory error:', error);
      setScanResults({
        success: false,
        error: error.message || '디렉토리 검색 중 오류가 발생했습니다.',
      });
    } finally {
      setFinding(false);
    }
  };

  const handleClean = async () => {
    if (!window.electronAPI?.deltaForceCleaner) {
      console.error('Delta Force Cleaner API is not available');
      return;
    }

    if (!scanResults || !scanResults.success) {
      alert('먼저 디렉토리를 스캔해주세요.');
      return;
    }

    if (!window.confirm(`정말로 ${scanResults.fileCount}개의 파일과 ${scanResults.folderCount}개의 폴더를 삭제하시겠습니까?`)) {
      return;
    }

    setCleaning(true);
    setCleanResults(null);
    try {
      const results = await window.electronAPI.deltaForceCleaner.clean(directoryPath);
      setCleanResults(results);
      
      if (results.success) {
        setScanResults(null);
      }
    } catch (error) {
      console.error('Clean error:', error);
      setCleanResults({
        success: false,
        error: error.message || '삭제 중 오류가 발생했습니다.',
      });
    } finally {
      setCleaning(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const hasValidScanResults = () => {
    if (!scanResults || !scanResults.success) return false;
    return scanResults.fileCount > 0 || scanResults.folderCount > 0 || scanResults.totalSize > 0;
  };

  const hasValidCleanResults = () => {
    if (!cleanResults || !cleanResults.success) return false;
    return cleanResults.deletedFiles > 0 || cleanResults.deletedFolders > 0 || cleanResults.freedSpace > 0;
  };

  return (
    <div className="delta-force-cleaner">
      <div className="cleaner-header">
        <h2 className="cleaner-title">Delta Force Cleaner</h2>
        <p className="cleaner-description">Delta Force 게임 로그 파일을 정리하여 디스크 공간을 확보하세요</p>
      </div>

      <div className="cleaner-card">
        <div className="directory-section">
          <div className="directory-header">
            <label className="directory-label">Steam 다운로드 디렉토리</label>
            <button
              className="action-button find-path-button"
              onClick={handleFindDirectory}
              disabled={finding || scanning}
              title="경로 찾기"
            >
              찾기
            </button>
          </div>
          <div className="directory-path">
            {directoryPath}
            {scanResults && scanResults.success && scanResults.files && scanResults.files.length > 0 && (
              <div className="directory-file-info">
                <div className="file-count-info">
                  총 {scanResults.fileCount}개 파일
                  {scanResults.files.length <= 10 && (
                    <div className="file-list">
                      {scanResults.files.slice(0, 10).map((file, index) => (
                        <div key={index} className="file-item">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">{formatBytes(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {scanResults.files.length > 10 && (
                    <div className="file-list">
                      {scanResults.files.slice(0, 10).map((file, index) => (
                        <div key={index} className="file-item">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">{formatBytes(file.size)}</span>
                        </div>
                      ))}
                      <div className="file-item more-files">
                        외 {scanResults.files.length - 10}개 파일...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {scanResults && scanResults.success && (!scanResults.files || scanResults.files.length === 0) && (
              <div className="no-files-message">
                해당 디렉토리에 파일이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {scanning && (
        <div className="cleaner-card">
          <div className="scanning-section">
            <div className="scanning-message">디렉토리 스캔 중...</div>
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div className="progress-bar-fill"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasValidScanResults() && (
        <div className="cleaner-card">
          <div className="action-section">
            <button
              className="action-button clean-button"
              onClick={handleClean}
              disabled={cleaning}
            >
              {cleaning ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </div>
      )}

      {hasValidScanResults() && (
        <div className="cleaner-card">
          <h3 className="card-title">스캔 결과</h3>
          <div className="scan-result-info">
            <p className="scan-result-description">
              다음 리소스가 디스크 공간을 사용하고 있습니다:
            </p>
          </div>
          <div className="stats-grid">
            {scanResults.fileCount > 0 && (
              <div className="stat-card">
                <div className="stat-label">파일 개수</div>
                <div className="stat-value">{scanResults.fileCount.toLocaleString()}개</div>
              </div>
            )}
            {scanResults.folderCount > 0 && (
              <div className="stat-card">
                <div className="stat-label">폴더 개수</div>
                <div className="stat-value">{scanResults.folderCount.toLocaleString()}개</div>
              </div>
            )}
            {scanResults.totalSize > 0 && (
              <>
                <div className="stat-card highlight">
                  <div className="stat-label">사용 중인 용량</div>
                  <div className="stat-value">{formatBytes(scanResults.totalSize)}</div>
                </div>
                <div className="stat-card highlight">
                  <div className="stat-label">삭제 가능 용량</div>
                  <div className="stat-value delete-size">{formatBytes(scanResults.totalSize)}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {scanResults && !scanResults.success && (
        <div className="cleaner-card">
          <div className="not-installed-message">
            <div className="not-installed-icon">⚠️</div>
            <div className="not-installed-text">
              <h3 className="not-installed-title">해당 디바이스에 설치되어있지 않습니다.</h3>
              <p className="not-installed-description">
                Steam Delta Force가 설치되어 있지 않거나, 지정된 경로를 찾을 수 없습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasValidCleanResults() && (
        <div className="cleaner-card">
          <h3 className="card-title">삭제 결과</h3>
          <div className="clean-results">
            {cleanResults.deletedFiles > 0 && (
              <div className="result-item">
                <span className="result-label">삭제된 파일:</span>
                <span className="result-value">{cleanResults.deletedFiles.toLocaleString()}개</span>
              </div>
            )}
            {cleanResults.deletedFolders > 0 && (
              <div className="result-item">
                <span className="result-label">삭제된 폴더:</span>
                <span className="result-value">{cleanResults.deletedFolders.toLocaleString()}개</span>
              </div>
            )}
            {cleanResults.freedSpace > 0 && (
              <div className="result-item highlight">
                <span className="result-label">확보된 공간:</span>
                <span className="result-value success">{formatBytes(cleanResults.freedSpace)}</span>
              </div>
            )}
            {cleanResults.errors && cleanResults.errors.length > 0 && (
              <div className="error-message">
                <strong>오류:</strong> {cleanResults.errors.length}개 항목 처리 중 오류 발생
              </div>
            )}
          </div>
        </div>
      )}

      {cleanResults && !cleanResults.success && (
        <div className="cleaner-card">
          <div className="error-message">
            {cleanResults.error || '삭제 중 오류가 발생했습니다.'}
          </div>
        </div>
      )}
    </div>
  );
}

export default DeltaForceCleaner;
