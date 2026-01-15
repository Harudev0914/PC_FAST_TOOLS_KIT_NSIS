import React, { useState, useEffect } from 'react';

/**
 * ---------
 * 2025-10-15
 * 개발자 : KR_Tuki
 * 기능 : 오디오 증폭 컴포넌트
 * ---------
 */
import '../styles/AudioAmplifier.css';

function AudioAmplifier() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [volume, setVolume] = useState(50);
  const [boostEnabled, setBoostEnabled] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const deviceList = await window.electronAPI.audio.getDevices();
      setDevices(deviceList);
      if (deviceList.length > 0) {
        setSelectedDevice(deviceList[0].id);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const handleVolumeChange = async (newVolume) => {
    setVolume(newVolume);
    if (selectedDevice) {
      try {
        await window.electronAPI.audio.setVolume(selectedDevice, newVolume);
      } catch (error) {
        console.error('Error setting volume:', error);
      }
    }
  };

  const handleBoostToggle = async () => {
    const newBoostState = !boostEnabled;
    setBoostEnabled(newBoostState);
    try {
      await window.electronAPI.audio.boost(newBoostState);
    } catch (error) {
      console.error('Error toggling boost:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">오디오 증폭</h1>
        <p className="page-description">오디오 볼륨을 부스트하고 증폭하세요</p>
      </div>

      <div className="card">
        <h3>오디오 장치 선택</h3>
        <select
          className="device-select"
          value={selectedDevice || ''}
          onChange={(e) => setSelectedDevice(e.target.value)}
        >
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <h3>볼륨 제어</h3>
        <div className="volume-control">
          <div className="volume-label">
            <span>볼륨: {volume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
            className="volume-slider"
          />
          <div className="volume-buttons">
            <button
              className="button button-secondary"
              onClick={() => handleVolumeChange(Math.max(0, volume - 10))}
            >
              -10
            </button>
            <button
              className="button button-secondary"
              onClick={() => handleVolumeChange(Math.min(100, volume + 10))}
            >
              +10
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>오디오 부스트</h3>
        <div className="boost-control">
          <label className="boost-toggle">
            <input
              type="checkbox"
              checked={boostEnabled}
              onChange={handleBoostToggle}
            />
            <span>오디오 부스트 활성화</span>
          </label>
          <p className="boost-description">
            오디오 부스트를 활성화하면 볼륨이 최대화되고 오디오 향상 기능이 켜집니다.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>프리셋</h3>
        <div className="preset-buttons">
          <button
            className="button button-secondary"
            onClick={() => {
              handleVolumeChange(50);
              setBoostEnabled(false);
            }}
          >
            일반 모드
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              handleVolumeChange(80);
              setBoostEnabled(true);
            }}
          >
            게임 모드
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              handleVolumeChange(100);
              setBoostEnabled(true);
            }}
          >
            음악 모드
          </button>
        </div>
      </div>
    </div>
  );
}

export default AudioAmplifier;
