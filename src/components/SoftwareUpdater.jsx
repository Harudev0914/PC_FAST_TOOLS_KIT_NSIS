// ---------
// 2025-11-20
// 개발자 : KR_Tuki
// 기능 : 소프트웨어 업데이터 컴포넌트
// ---------

import React, { useState, useEffect } from 'react';
import '../styles/SoftwareUpdater.css';

function SoftwareUpdater() {
  const [software, setSoftware] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState({});
  const [updateResults, setUpdateResults] = useState({});

  useEffect(() => {
    loadSoftware();
  }, []);

  const loadSoftware = async () => {
    setLoading(true);
    try {
      const installed = await window.electronAPI.updater.getInstalled();
      setSoftware(installed);
    } catch (error) {
      console.error('Error loading software:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckUpdates = async (sw) => {
    try {
      const updateInfo = await window.electronAPI.updater.checkUpdates(sw);
      setUpdateResults((prev) => ({ ...prev, [sw.name]: updateInfo }));
    } catch (error) {
      console.error('Error checking updates:', error);
    }
  };

  const handleUpdate = async (sw) => {
    setUpdating((prev) => ({ ...prev, [sw.name]: true }));
    try {
      const result = await window.electronAPI.updater.update(sw);
      setUpdateResults((prev) => ({ ...prev, [sw.name]: result }));
    } catch (error) {
      console.error('Error updating:', error);
    } finally {
      setUpdating((prev) => ({ ...prev, [sw.name]: false }));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">소프트웨어 업데이터</h1>
        <p className="page-description">설치된 소프트웨어를 확인하고 업데이트하세요</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <button className="button button-primary" onClick={loadSoftware} disabled={loading}>
            {loading ? '로딩 중...' : '새로고침'}
          </button>
          <span className="software-count">{software.length}개 소프트웨어 설치됨</span>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="card">
          <h3>설치된 소프트웨어</h3>
          <div className="software-list">
            {software.length === 0 ? (
              <div className="empty-state">소프트웨어를 찾을 수 없습니다.</div>
            ) : (
              software.map((sw, index) => (
                <div key={index} className="software-item">
                  <div className="software-info">
                    <div className="software-name">{sw.name}</div>
                    <div className="software-details">
                      <span>버전: {sw.version}</span>
                      <span>제조사: {sw.publisher}</span>
                      {sw.installDate && <span>설치일: {sw.installDate}</span>}
                    </div>
                  </div>
                  <div className="software-actions">
                    <button
                      className="button button-secondary"
                      onClick={() => handleCheckUpdates(sw)}
                      disabled={updating[sw.name]}
                    >
                      업데이트 확인
                    </button>
                    {updateResults[sw.name]?.updateAvailable && (
                      <button
                        className="button button-primary"
                        onClick={() => handleUpdate(sw)}
                        disabled={updating[sw.name]}
                      >
                        {updating[sw.name] ? '업데이트 중...' : '업데이트'}
                      </button>
                    )}
                  </div>
                  {updateResults[sw.name] && (
                    <div className="update-info">
                      {updateResults[sw.name].updateAvailable ? (
                        <div className="success-message">
                          업데이트 사용 가능: {updateResults[sw.name].latestVersion}
                        </div>
                      ) : (
                        <div>최신 버전입니다.</div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SoftwareUpdater;
