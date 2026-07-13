import React, { useState, useEffect, useCallback } from 'react';
import { getUserFriendlyErrorMessage } from '../utils/errorHandler';
import '../styles/SoftwareUpdater.css';

// 소프트웨어(winget) + 드라이버 업데이트 패널.
// - 소프트웨어: updater.checkAllUpdates()가 `winget upgrade` 결과(업그레이드 가능한 패키지)를 반환.
// - 드라이버: driver.getDrivers()로 목록 조회, driver.update()로 개별 업데이트.
function SoftwareUpdater() {
  const [software, setSoftware] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loadingSoftware, setLoadingSoftware] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [busyItem, setBusyItem] = useState(null); // 현재 업데이트 중인 항목 키
  const [message, setMessage] = useState(null);

  const loadSoftware = useCallback(async () => {
    if (!window.electronAPI?.updater?.checkAllUpdates) return;
    setLoadingSoftware(true);
    setMessage(null);
    try {
      const list = await window.electronAPI.updater.checkAllUpdates();
      setSoftware(Array.isArray(list) ? list : []);
    } catch (error) {
      setMessage({ type: 'error', text: getUserFriendlyErrorMessage(error) });
    } finally {
      setLoadingSoftware(false);
    }
  }, []);

  const loadDrivers = useCallback(async () => {
    if (!window.electronAPI?.driver?.getDrivers) return;
    setLoadingDrivers(true);
    try {
      const list = await window.electronAPI.driver.getDrivers();
      setDrivers(Array.isArray(list) ? list.slice(0, 50) : []);
    } catch (error) {
      setMessage({ type: 'error', text: getUserFriendlyErrorMessage(error) });
    } finally {
      setLoadingDrivers(false);
    }
  }, []);

  useEffect(() => {
    loadSoftware();
    loadDrivers();
  }, [loadSoftware, loadDrivers]);

  const updateSoftware = async (pkg) => {
    if (!window.electronAPI?.updater?.update) return;
    const key = `sw:${pkg.id}`;
    setBusyItem(key);
    setMessage(null);
    try {
      const result = await window.electronAPI.updater.update({ name: pkg.name, id: pkg.id });
      if (result?.success) {
        setMessage({ type: 'success', text: `${pkg.name} 업데이트를 시작했습니다.` });
        setSoftware((prev) => prev.filter((p) => p.id !== pkg.id));
      } else {
        setMessage({ type: 'error', text: result?.message || result?.error || '업데이트에 실패했습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: getUserFriendlyErrorMessage(error) });
    } finally {
      setBusyItem(null);
    }
  };

  const updateDriver = async (driver) => {
    if (!window.electronAPI?.driver?.update) return;
    const key = `drv:${driver.id}`;
    setBusyItem(key);
    setMessage(null);
    try {
      const result = await window.electronAPI.driver.update(driver);
      setMessage(
        result?.success
          ? { type: 'success', text: `${driver.name} 드라이버 업데이트를 시작했습니다.` }
          : { type: 'error', text: result?.error || '드라이버 업데이트에 실패했습니다.' }
      );
    } catch (error) {
      setMessage({ type: 'error', text: getUserFriendlyErrorMessage(error) });
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <div className="sw-updater">
      <div className="sw-updater-header">
        <h2 className="sw-updater-title">업데이트</h2>
        <p className="sw-updater-description">
          설치된 소프트웨어(winget)와 드라이버의 최신 버전을 확인하고 업데이트합니다.
        </p>
      </div>

      {message && <div className={`sw-message sw-message--${message.type}`}>{message.text}</div>}

      <section className="sw-card">
        <div className="sw-card-head">
          <h3 className="sw-card-title">소프트웨어 업데이트</h3>
          <button className="sw-refresh" onClick={loadSoftware} disabled={loadingSoftware}>
            {loadingSoftware ? '확인 중…' : '새로 고침'}
          </button>
        </div>

        {loadingSoftware && software.length === 0 ? (
          <p className="sw-empty">winget으로 업데이트를 확인하는 중…</p>
        ) : software.length === 0 ? (
          <p className="sw-empty">업데이트 가능한 소프트웨어가 없습니다.</p>
        ) : (
          <ul className="sw-list">
            {software.map((pkg) => (
              <li key={pkg.id} className="sw-item">
                <div className="sw-item-info">
                  <span className="sw-item-name">{pkg.name}</span>
                  <span className="sw-item-ver">
                    {pkg.currentVersion} <span className="sw-arrow">→</span>{' '}
                    <span className="sw-item-latest">{pkg.latestVersion}</span>
                  </span>
                </div>
                <button
                  className="sw-update-btn"
                  onClick={() => updateSoftware(pkg)}
                  disabled={busyItem === `sw:${pkg.id}`}
                >
                  {busyItem === `sw:${pkg.id}` ? '업데이트 중…' : '업데이트'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sw-card">
        <div className="sw-card-head">
          <h3 className="sw-card-title">드라이버</h3>
          <button className="sw-refresh" onClick={loadDrivers} disabled={loadingDrivers}>
            {loadingDrivers ? '조회 중…' : '새로 고침'}
          </button>
        </div>

        {loadingDrivers && drivers.length === 0 ? (
          <p className="sw-empty">드라이버 목록을 불러오는 중…</p>
        ) : drivers.length === 0 ? (
          <p className="sw-empty">표시할 드라이버가 없습니다.</p>
        ) : (
          <ul className="sw-list">
            {drivers.map((driver) => (
              <li key={driver.id} className="sw-item">
                <div className="sw-item-info">
                  <span className="sw-item-name">{driver.name}</span>
                  <span className="sw-item-ver">{driver.status || '상태 미상'}</span>
                </div>
                <button
                  className="sw-update-btn"
                  onClick={() => updateDriver(driver)}
                  disabled={busyItem === `drv:${driver.id}`}
                >
                  {busyItem === `drv:${driver.id}` ? '업데이트 중…' : '업데이트'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// [perf] props가 없는 패널 — React.memo로 부모(MainPage) 리렌더 전파를 차단한다.
export default React.memo(SoftwareUpdater);
