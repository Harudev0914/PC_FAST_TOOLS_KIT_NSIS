/**
 * ---------
 * 2025-11-05
 * 개발자 : KR_Tuki
 * 기능 : 기록 자동삭제 컴포넌트
 * ---------
 */

import React, { useState, useEffect } from 'react';
import '../styles/HistoryCleaner.css';

function HistoryCleaner() {
  const [types, setTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [scheduleConfig, setScheduleConfig] = useState({
    enabled: false,
    interval: 'daily',
    time: '02:00',
    types: [],
  });

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    try {
      const historyTypes = await window.electronAPI.history.getTypes();
      setTypes(historyTypes);
    } catch (error) {
      console.error('Error loading types:', error);
    }
  };

  const handleTypeToggle = (typeId) => {
    setSelectedTypes((prev) => {
      if (prev.includes(typeId)) {
        return prev.filter((id) => id !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  };

  const handleClear = async () => {
    if (selectedTypes.length === 0) {
      alert('삭제할 항목을 선택하세요.');
      return;
    }

    if (!window.confirm('선택한 기록을 삭제하시겠습니까?')) {
      return;
    }

    setClearing(true);
    setClearResult(null);
    try {
      const result = await window.electronAPI.history.clear(selectedTypes);
      setClearResult(result);
      setSelectedTypes([]);
    } catch (error) {
      console.error('Clear error:', error);
    } finally {
      setClearing(false);
    }
  };

  const handleScheduleSave = async () => {
    try {
      const config = {
        ...scheduleConfig,
        types: selectedTypes,
      };
      const result = await window.electronAPI.history.schedule(config);
      if (result.success) {
        alert('자동 삭제 스케줄이 저장되었습니다.');
      }
    } catch (error) {
      console.error('Schedule error:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">기록 자동삭제</h1>
        <p className="page-description">브라우저 기록, 활동 기록 등을 삭제하세요</p>
      </div>

      <div className="card">
        <h3>삭제할 항목 선택</h3>
        <div className="history-types">
          {types.map((type) => (
            <label key={type.id} className="history-type-item">
              <input
                type="checkbox"
                checked={selectedTypes.includes(type.id)}
                onChange={() => handleTypeToggle(type.id)}
              />
              <div className="type-info">
                <div className="type-name">{type.name}</div>
                {type.browsers && (
                  <div className="type-browsers">
                    지원 브라우저: {type.browsers.join(', ')}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
        <button
          className="button button-primary"
          onClick={handleClear}
          disabled={clearing || selectedTypes.length === 0}
          style={{ marginTop: '20px' }}
        >
          {clearing ? '삭제 중...' : '선택한 기록 삭제'}
        </button>
        {clearResult && (
          <div className="clear-results">
            {clearResult.cleared.length > 0 && (
              <div className="success-message">
                {clearResult.cleared.length}개 항목이 삭제되었습니다.
              </div>
            )}
            {clearResult.errors && clearResult.errors.length > 0 && (
              <div className="error-message">
                {clearResult.errors.length}개 항목 처리 중 오류 발생
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3>자동 삭제 스케줄</h3>
        <div className="schedule-config">
          <label className="schedule-toggle">
            <input
              type="checkbox"
              checked={scheduleConfig.enabled}
              onChange={(e) =>
                setScheduleConfig({ ...scheduleConfig, enabled: e.target.checked })
              }
            />
            <span>자동 삭제 활성화</span>
          </label>
          {scheduleConfig.enabled && (
            <>
              <div className="schedule-options">
                <label>
                  <span>간격:</span>
                  <select
                    value={scheduleConfig.interval}
                    onChange={(e) =>
                      setScheduleConfig({ ...scheduleConfig, interval: e.target.value })
                    }
                  >
                    <option value="daily">매일</option>
                    <option value="weekly">매주</option>
                    <option value="monthly">매월</option>
                  </select>
                </label>
                <label>
                  <span>시간:</span>
                  <input
                    type="time"
                    value={scheduleConfig.time}
                    onChange={(e) =>
                      setScheduleConfig({ ...scheduleConfig, time: e.target.value })
                    }
                  />
                </label>
              </div>
              <button
                className="button button-secondary"
                onClick={handleScheduleSave}
              >
                스케줄 저장
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryCleaner;
