import React, { useState, useEffect } from 'react';
import '../styles/DriverUpdater.css';

function DriverUpdater() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState({});
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const driverList = await window.electronAPI.driver.getDrivers();
      setDrivers(driverList);
    } catch (error) {
      console.error('Error loading drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const availableUpdates = await window.electronAPI.driver.checkUpdates();
      setUpdates(availableUpdates);
    } catch (error) {
      console.error('Error checking updates:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async (driver) => {
    setUpdating((prev) => ({ ...prev, [driver.id]: true }));
    try {
      const result = await window.electronAPI.driver.update(driver);
      if (result.success) {
        alert(`드라이버 업데이트가 시작되었습니다: ${driver.name}`);
      } else {
        alert(`업데이트 실패: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error updating driver:', error);
      alert('드라이버 업데이트 중 오류가 발생했습니다.');
    } finally {
      setUpdating((prev) => ({ ...prev, [driver.id]: false }));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">드라이버 업데이터</h1>
        <p className="page-description">하드웨어 드라이버를 확인하고 업데이트하세요</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <button className="button button-primary" onClick={loadDrivers} disabled={loading}>
            {loading ? '로딩 중...' : '드라이버 목록 새로고침'}
          </button>
          <button
            className="button button-secondary"
            onClick={handleCheckUpdates}
            disabled={checking || loading}
          >
            {checking ? '확인 중...' : '업데이트 확인'}
          </button>
          <span className="driver-count">{drivers.length}개 드라이버 발견</span>
        </div>
      </div>

      {updates.length > 0 && (
        <div className="card">
          <h3>사용 가능한 업데이트</h3>
          <div className="updates-list">
            {updates.map((update, index) => (
              <div key={index} className="update-item">
                <div className="update-info">
                  <div className="update-title">{update.Title || '드라이버 업데이트'}</div>
                  <div className="update-status">상태: {update.Status || '사용 가능'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="card">
          <h3>드라이버 목록</h3>
          <div className="drivers-list">
            {drivers.length === 0 ? (
              <div className="empty-state">드라이버를 찾을 수 없습니다.</div>
            ) : (
              drivers.map((driver) => (
                <div key={driver.id} className="driver-item">
                  <div className="driver-info">
                    <div className="driver-name">{driver.name}</div>
                    <div className="driver-details">
                      <span>버전: {driver.version}</span>
                      <span className={`driver-status ${driver.status?.toLowerCase()}`}>
                        상태: {driver.status}
                      </span>
                    </div>
                  </div>
                  <div className="driver-actions">
                    <button
                      className="button button-primary"
                      onClick={() => handleUpdate(driver)}
                      disabled={updating[driver.id]}
                    >
                      {updating[driver.id] ? '업데이트 중...' : '업데이트'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverUpdater;
