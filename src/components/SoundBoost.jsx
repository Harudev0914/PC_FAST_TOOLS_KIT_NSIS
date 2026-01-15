// ---------
// 2025-09-10
// 개발자 : KR_Tuki
// 기능 : 사운드 부스트 컴포넌트
// ---------

import React, { useState, useEffect } from 'react';
import '../styles/SoundBoost.css';

function SoundBoost() {
  const [enabled, setEnabled] = useState(false);
  const [gameSoundBoost, setGameSoundBoost] = useState({ enabled: false, level: 50 });
  const [baseSoundBoost, setBaseSoundBoost] = useState({ enabled: false, level: 50 });
  const [masterVolume, setMasterVolume] = useState(100);
  const [bassLevel, setBassLevel] = useState(50);
  const [trebleLevel, setTrebleLevel] = useState(50);
  const [eqPreset, setEqPreset] = useState('normal');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [devices, setDevices] = useState([]);
  const [eqPresets, setEqPresets] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [detectingModels, setDetectingModels] = useState(false);
  
  const [modelSettings, setModelSettings] = useState({
    superpowered: {
      eqEnabled: false,
      compressionEnabled: false,
      filterEnabled: false,
      mixingEnabled: false,
      effectsEnabled: false,
      eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 10-band EQ
      compressionRatio: 2.0,
      filterCutoff: 1000,
    },
    miniaudio: {
      filterEnabled: false,
      processingEnabled: false,
      mixingEnabled: false,
      filterType: 'lowpass',
      filterCutoff: 1000,
      processingLatency: 10,
    },
    portaudio: {
      ioEnabled: false,
      dspEnabled: false,
      latency: 50,
      sampleRate: 44100,
    },
    freedsp: {
      eqEnabled: false,
      bassBoostEnabled: false,
      eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      bassBoostLevel: 0,
    },
  });

  useEffect(() => {
    loadSettings();
    loadDevices();
    loadEQPresets();
  }, []);

  const loadSettings = async () => {
    try {
      if (window.__preloadedAudioSettings) {
        const settings = window.__preloadedAudioSettings;
        setEnabled(settings.enabled || false);
        setGameSoundBoost(settings.gameSoundBoost || { enabled: false, level: 50 });
        setBaseSoundBoost(settings.baseSoundBoost || { enabled: false, level: 50 });
        setMasterVolume(settings.masterVolume || 100);
        setBassLevel(settings.bassLevel || 50);
        setTrebleLevel(settings.trebleLevel || 50);
        setEqPreset(settings.eqPreset || 'normal');
        console.log('Settings loaded from preloaded data');
        return;
      }
      
      // 미리 로드된 데이터가 없으면 API 호출
      if (window.electronAPI?.audio?.getSettings) {
        const settings = await window.electronAPI.audio.getSettings();
        if (settings) {
          setEnabled(settings.enabled || false);
          setGameSoundBoost(settings.gameSoundBoost || { enabled: false, level: 50 });
          setBaseSoundBoost(settings.baseSoundBoost || { enabled: false, level: 50 });
          setMasterVolume(settings.masterVolume || 100);
          setBassLevel(settings.bassLevel || 50);
          setTrebleLevel(settings.trebleLevel || 50);
          setEqPreset(settings.eqPreset || 'normal');
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadDevices = async () => {
    try {
      if (window.__preloadedAudioDevices && window.__preloadedAudioDevices.length > 0) {
        setDevices(window.__preloadedAudioDevices);
        console.log('Devices loaded from preloaded data:', window.__preloadedAudioDevices.length);
        return;
      }
      
      if (window.electronAPI?.audio?.getDevices) {
        const deviceList = await window.electronAPI.audio.getDevices();
        setDevices(deviceList || []);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const loadEQPresets = async () => {
    try {
      // 먼저 미리 로드된 EQ 프리셋 확인
      if (window.__preloadedEQPresets && window.__preloadedEQPresets.length > 0) {
        setEqPresets(window.__preloadedEQPresets);
        console.log('EQ presets loaded from preloaded data:', window.__preloadedEQPresets.length);
        return;
      }
      
      if (window.electronAPI?.audio?.getEQPresets) {
        const presets = await window.electronAPI.audio.getEQPresets();
        setEqPresets(presets || []);
      } else {
        setEqPresets([
          { value: 'normal', label: '일반' },
          { value: 'game', label: '게임' },
          { value: 'music', label: '음악' },
          { value: 'movie', label: '영화' },
          { value: 'voice', label: '음성' },
          { value: 'bass', label: '베이스 강화' },
        ]);
      }
    } catch (error) {
      console.error('Error loading EQ presets:', error);
      setEqPresets([
        { value: 'normal', label: '일반' },
        { value: 'game', label: '게임' },
        { value: 'music', label: '음악' },
        { value: 'movie', label: '영화' },
        { value: 'voice', label: '음성' },
        { value: 'bass', label: '베이스 강화' },
      ]);
    }
  };

  const handleApply = async () => {
    if (!window.electronAPI?.audio) {
      console.error('Audio API is not available');
      return;
    }

    setApplying(true);
    setApplyResult(null);

    try {
      const settings = {
        enabled,
        gameSoundBoost,
        baseSoundBoost,
        masterVolume,
        bassLevel,
        trebleLevel,
        eqPreset,
        selectedModel,
        modelSettings: selectedModel ? modelSettings[selectedModel] : null,
      };

      const result = await window.electronAPI.audio.applySoundBoost(settings);
      setApplyResult(result);
    } catch (error) {
      console.error('Apply error:', error);
      setApplyResult({
        success: false,
        error: error.message || '설정 적용 중 오류가 발생했습니다.',
      });
    } finally {
      setApplying(false);
    }
  };

  const handleToggle = (type) => {
    if (type === 'main') {
      setEnabled(!enabled);
    } else if (type === 'game') {
      setGameSoundBoost({ ...gameSoundBoost, enabled: !gameSoundBoost.enabled });
    } else if (type === 'base') {
      setBaseSoundBoost({ ...baseSoundBoost, enabled: !baseSoundBoost.enabled });
    }
  };

  return (
    <div className="sound-boost">
      <div className="sound-boost-header">
        <h2 className="sound-boost-title">Sound Boost</h2>
        <p className="sound-boost-description">게임 중 사운드를 더 잘 들을 수 있도록 증폭 및 최적화하세요</p>
      </div>

      <div className="sound-boost-card">
        <div className="toggle-section">
          <div className="toggle-header">
            <label className="toggle-label">Sound Boost 활성화</label>
            <button
              className={`toggle-button ${enabled ? 'active' : ''}`}
              onClick={() => handleToggle('main')}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="toggle-description">
            Sound Boost 기능을 활성화하면 게임 사운드와 베이스 사운드가 증폭됩니다.
          </p>
        </div>
      </div>

      {/* 오디오 처리 모델 선택 (enabled일 때만 표시) */}
      {enabled && (
        <div className="sound-boost-card">
          <h3 className="card-title">오디오 처리 모델</h3>
          <p className="page-description" style={{ marginBottom: '16px' }}>
            고급 오디오 처리 라이브러리를 선택하여 더 나은 사운드 품질을 경험하세요.
          </p>
          
          {detectingModels ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#b0b0b0' }}>
              모델 감지 중...
            </div>
          ) : availableModels.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#b0b0b0' }}>
              사용 가능한 오디오 처리 모델이 없습니다.
            </div>
          ) : (
            <div className="model-selection">
              <div className="model-buttons">
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    className={`model-button ${selectedModel === model.id ? 'active' : ''}`}
                    onClick={() => setSelectedModel(model.id)}
                    disabled={!model.available}
                  >
                    <div className="model-button-content">
                      <div className="model-name">{model.name}</div>
                      <div className="model-description">{model.description}</div>
                      {!model.available && (
                        <div className="model-unavailable">사용 불가</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 선택된 모델별 설정 */}
      {enabled && selectedModel && (
        <div className="sound-boost-card">
          <h3 className="card-title">
            {selectedModel === 'superpowered' && 'Superpowered Audio SDK 설정'}
            {selectedModel === 'miniaudio' && 'Miniaudio 설정'}
            {selectedModel === 'portaudio' && 'PortAudio 설정'}
            {selectedModel === 'freedsp' && 'FreeDSP 설정'}
          </h3>
          
          {selectedModel === 'superpowered' && (
            <div className="model-settings">
              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">EQ (이퀄라이저)</label>
                  <button
                    className={`toggle-button small ${modelSettings.superpowered.eqEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      superpowered: { ...prev.superpowered, eqEnabled: !prev.superpowered.eqEnabled }
                    }))}
                  >
                    {modelSettings.superpowered.eqEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {modelSettings.superpowered.eqEnabled && (
                  <div className="eq-bands">
                    <label className="slider-label">10-Band EQ</label>
                    {modelSettings.superpowered.eqBands.map((band, index) => (
                      <div key={index} className="eq-band-item">
                        <label className="eq-band-label">{index === 0 ? '31Hz' : index === 1 ? '62Hz' : index === 2 ? '125Hz' : index === 3 ? '250Hz' : index === 4 ? '500Hz' : index === 5 ? '1kHz' : index === 6 ? '2kHz' : index === 7 ? '4kHz' : index === 8 ? '8kHz' : '16kHz'}</label>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          value={band}
                          onChange={(e) => {
                            const newBands = [...modelSettings.superpowered.eqBands];
                            newBands[index] = parseInt(e.target.value);
                            setModelSettings(prev => ({
                              ...prev,
                              superpowered: { ...prev.superpowered, eqBands: newBands }
                            }));
                          }}
                          className="slider"
                        />
                        <span className="eq-band-value">{band > 0 ? '+' : ''}{band}dB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">압축 (Compression)</label>
                  <button
                    className={`toggle-button small ${modelSettings.superpowered.compressionEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      superpowered: { ...prev.superpowered, compressionEnabled: !prev.superpowered.compressionEnabled }
                    }))}
                  >
                    {modelSettings.superpowered.compressionEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {modelSettings.superpowered.compressionEnabled && (
                  <div className="slider-section">
                    <label className="slider-label">압축 비율: {modelSettings.superpowered.compressionRatio}:1</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.1"
                      value={modelSettings.superpowered.compressionRatio}
                      onChange={(e) => setModelSettings(prev => ({
                        ...prev,
                        superpowered: { ...prev.superpowered, compressionRatio: parseFloat(e.target.value) }
                      }))}
                      className="slider"
                    />
                  </div>
                )}
              </div>

              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">필터</label>
                  <button
                    className={`toggle-button small ${modelSettings.superpowered.filterEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      superpowered: { ...prev.superpowered, filterEnabled: !prev.superpowered.filterEnabled }
                    }))}
                  >
                    {modelSettings.superpowered.filterEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {modelSettings.superpowered.filterEnabled && (
                  <div className="slider-section">
                    <label className="slider-label">컷오프 주파수: {modelSettings.superpowered.filterCutoff}Hz</label>
                    <input
                      type="range"
                      min="20"
                      max="20000"
                      value={modelSettings.superpowered.filterCutoff}
                      onChange={(e) => setModelSettings(prev => ({
                        ...prev,
                        superpowered: { ...prev.superpowered, filterCutoff: parseInt(e.target.value) }
                      }))}
                      className="slider"
                    />
                  </div>
                )}
              </div>

              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">믹싱</label>
                  <button
                    className={`toggle-button small ${modelSettings.superpowered.mixingEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      superpowered: { ...prev.superpowered, mixingEnabled: !prev.superpowered.mixingEnabled }
                    }))}
                  >
                    {modelSettings.superpowered.mixingEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">효과 처리</label>
                  <button
                    className={`toggle-button small ${modelSettings.superpowered.effectsEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      superpowered: { ...prev.superpowered, effectsEnabled: !prev.superpowered.effectsEnabled }
                    }))}
                  >
                    {modelSettings.superpowered.effectsEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedModel === 'miniaudio' && (
            <div className="model-settings">
              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">필터/프로세싱</label>
                  <button
                    className={`toggle-button small ${modelSettings.miniaudio.filterEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      miniaudio: { ...prev.miniaudio, filterEnabled: !prev.miniaudio.filterEnabled }
                    }))}
                  >
                    {modelSettings.miniaudio.filterEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {modelSettings.miniaudio.filterEnabled && (
                  <>
                    <div className="slider-section">
                      <label className="slider-label">필터 타입</label>
                      <select
                        value={modelSettings.miniaudio.filterType}
                        onChange={(e) => setModelSettings(prev => ({
                          ...prev,
                          miniaudio: { ...prev.miniaudio, filterType: e.target.value }
                        }))}
                        className="preset-select"
                      >
                        <option value="lowpass">Low Pass</option>
                        <option value="highpass">High Pass</option>
                        <option value="bandpass">Band Pass</option>
                        <option value="notch">Notch</option>
                      </select>
                    </div>
                    <div className="slider-section">
                      <label className="slider-label">컷오프 주파수: {modelSettings.miniaudio.filterCutoff}Hz</label>
                      <input
                        type="range"
                        min="20"
                        max="20000"
                        value={modelSettings.miniaudio.filterCutoff}
                        onChange={(e) => setModelSettings(prev => ({
                          ...prev,
                          miniaudio: { ...prev.miniaudio, filterCutoff: parseInt(e.target.value) }
                        }))}
                        className="slider"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">프로세싱</label>
                  <button
                    className={`toggle-button small ${modelSettings.miniaudio.processingEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      miniaudio: { ...prev.miniaudio, processingEnabled: !prev.miniaudio.processingEnabled }
                    }))}
                  >
                    {modelSettings.miniaudio.processingEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {modelSettings.miniaudio.processingEnabled && (
                  <div className="slider-section">
                    <label className="slider-label">지연 시간: {modelSettings.miniaudio.processingLatency}ms</label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={modelSettings.miniaudio.processingLatency}
                      onChange={(e) => setModelSettings(prev => ({
                        ...prev,
                        miniaudio: { ...prev.miniaudio, processingLatency: parseInt(e.target.value) }
                      }))}
                      className="slider"
                    />
                  </div>
                )}
              </div>

              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">믹싱</label>
                  <button
                    className={`toggle-button small ${modelSettings.miniaudio.mixingEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      miniaudio: { ...prev.miniaudio, mixingEnabled: !prev.miniaudio.mixingEnabled }
                    }))}
                  >
                    {modelSettings.miniaudio.mixingEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedModel === 'portaudio' && (
            <div className="model-settings">
              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">오디오 I/O</label>
                  <button
                    className={`toggle-button small ${modelSettings.portaudio.ioEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      portaudio: { ...prev.portaudio, ioEnabled: !prev.portaudio.ioEnabled }
                    }))}
                  >
                    {modelSettings.portaudio.ioEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">DSP 처리</label>
                  <button
                    className={`toggle-button small ${modelSettings.portaudio.dspEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      portaudio: { ...prev.portaudio, dspEnabled: !prev.portaudio.dspEnabled }
                    }))}
                  >
                    {modelSettings.portaudio.dspEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {modelSettings.portaudio.dspEnabled && (
                  <>
                    <div className="slider-section">
                      <label className="slider-label">지연 시간: {modelSettings.portaudio.latency}ms</label>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        value={modelSettings.portaudio.latency}
                        onChange={(e) => setModelSettings(prev => ({
                          ...prev,
                          portaudio: { ...prev.portaudio, latency: parseInt(e.target.value) }
                        }))}
                        className="slider"
                      />
                    </div>
                    <div className="slider-section">
                      <label className="slider-label">샘플 레이트: {modelSettings.portaudio.sampleRate}Hz</label>
                      <select
                        value={modelSettings.portaudio.sampleRate}
                        onChange={(e) => setModelSettings(prev => ({
                          ...prev,
                          portaudio: { ...prev.portaudio, sampleRate: parseInt(e.target.value) }
                        }))}
                        className="preset-select"
                      >
                        <option value="44100">44100 Hz</option>
                        <option value="48000">48000 Hz</option>
                        <option value="96000">96000 Hz</option>
                        <option value="192000">192000 Hz</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {selectedModel === 'freedsp' && (
            <div className="model-settings">
              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">EQ (이퀄라이저)</label>
                  <button
                    className={`toggle-button small ${modelSettings.freedsp.eqEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      freedsp: { ...prev.freedsp, eqEnabled: !prev.freedsp.eqEnabled }
                    }))}
                  >
                    {modelSettings.freedsp.eqEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {modelSettings.freedsp.eqEnabled && (
                  <div className="eq-bands">
                    <label className="slider-label">10-Band EQ</label>
                    {modelSettings.freedsp.eqBands.map((band, index) => (
                      <div key={index} className="eq-band-item">
                        <label className="eq-band-label">{index === 0 ? '31Hz' : index === 1 ? '62Hz' : index === 2 ? '125Hz' : index === 3 ? '250Hz' : index === 4 ? '500Hz' : index === 5 ? '1kHz' : index === 6 ? '2kHz' : index === 7 ? '4kHz' : index === 8 ? '8kHz' : '16kHz'}</label>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          value={band}
                          onChange={(e) => {
                            const newBands = [...modelSettings.freedsp.eqBands];
                            newBands[index] = parseInt(e.target.value);
                            setModelSettings(prev => ({
                              ...prev,
                              freedsp: { ...prev.freedsp, eqBands: newBands }
                            }));
                          }}
                          className="slider"
                        />
                        <span className="eq-band-value">{band > 0 ? '+' : ''}{band}dB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="setting-section">
                <div className="setting-header">
                  <label className="setting-label">베이스 강화</label>
                  <button
                    className={`toggle-button small ${modelSettings.freedsp.bassBoostEnabled ? 'active' : ''}`}
                    onClick={() => setModelSettings(prev => ({
                      ...prev,
                      freedsp: { ...prev.freedsp, bassBoostEnabled: !prev.freedsp.bassBoostEnabled }
                    }))}
                  >
                    {modelSettings.freedsp.bassBoostEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {modelSettings.freedsp.bassBoostEnabled && (
                  <div className="slider-section">
                    <label className="slider-label">베이스 레벨: {modelSettings.freedsp.bassBoostLevel}dB</label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={modelSettings.freedsp.bassBoostLevel}
                      onChange={(e) => setModelSettings(prev => ({
                        ...prev,
                        freedsp: { ...prev.freedsp, bassBoostLevel: parseInt(e.target.value) }
                      }))}
                      className="slider"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="sound-boost-card">
        <h3 className="card-title">게임 사운드 증폭</h3>
        <div className="setting-section">
          <div className="setting-header">
            <label className="setting-label">게임 사운드 증폭</label>
            <button
              className={`toggle-button small ${gameSoundBoost.enabled ? 'active' : ''}`}
              onClick={() => handleToggle('game')}
            >
              {gameSoundBoost.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {gameSoundBoost.enabled && (
            <div className="slider-section">
              <label className="slider-label">증폭 레벨: {gameSoundBoost.level}%</label>
              <input
                type="range"
                min="0"
                max="200"
                value={gameSoundBoost.level}
                onChange={(e) => setGameSoundBoost({ ...gameSoundBoost, level: parseInt(e.target.value) })}
                className="slider"
              />
              <div className="slider-values">
                <span>0%</span>
                <span>200%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sound-boost-card">
        <h3 className="card-title">베이스 사운드 증폭</h3>
        <div className="setting-section">
          <div className="setting-header">
            <label className="setting-label">베이스 사운드 증폭</label>
            <button
              className={`toggle-button small ${baseSoundBoost.enabled ? 'active' : ''}`}
              onClick={() => handleToggle('base')}
            >
              {baseSoundBoost.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {baseSoundBoost.enabled && (
            <div className="slider-section">
              <label className="slider-label">증폭 레벨: {baseSoundBoost.level}%</label>
              <input
                type="range"
                min="0"
                max="200"
                value={baseSoundBoost.level}
                onChange={(e) => setBaseSoundBoost({ ...baseSoundBoost, level: parseInt(e.target.value) })}
                className="slider"
              />
              <div className="slider-values">
                <span>0%</span>
                <span>200%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {devices.length > 0 && (
        <div className="sound-boost-card">
          <h3 className="card-title">연결된 오디오 장비</h3>
          <div className="setting-section">
            {devices.filter(d => d.type === 'output').length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label className="setting-label" style={{ marginBottom: '8px', display: 'block' }}>오디오 출력 장비</label>
                {devices.filter(d => d.type === 'output').map((device, index) => (
                  <div key={device.id || index} style={{ padding: '8px 0', color: '#b0b0b0', fontSize: '14px' }}>
                    • {device.name} {device.status && device.status !== 'OK' ? `(${device.status})` : ''}
                  </div>
                ))}
              </div>
            )}
            {devices.filter(d => d.type === 'input').length > 0 && (
              <div>
                <label className="setting-label" style={{ marginBottom: '8px', display: 'block' }}>마이크 입력 장비</label>
                {devices.filter(d => d.type === 'input').map((device, index) => (
                  <div key={device.id || index} style={{ padding: '8px 0', color: '#b0b0b0', fontSize: '14px' }}>
                    • {device.name} {device.status && device.status !== 'OK' ? `(${device.status})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="sound-boost-card">
        <h3 className="card-title">사운드 설정</h3>
        <div className="settings-grid">
          <div className="setting-item">
            <label className="setting-label">마스터 볼륨</label>
            <div className="slider-section">
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-value">{masterVolume}%</div>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">베이스</label>
            <div className="slider-section">
              <input
                type="range"
                min="0"
                max="100"
                value={bassLevel}
                onChange={(e) => setBassLevel(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-value">{bassLevel}%</div>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">트레블</label>
            <div className="slider-section">
              <input
                type="range"
                min="0"
                max="100"
                value={trebleLevel}
                onChange={(e) => setTrebleLevel(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-value">{trebleLevel}%</div>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">EQ 프리셋</label>
            <select
              value={eqPreset}
              onChange={(e) => setEqPreset(e.target.value)}
              className="preset-select"
            >
              {eqPresets.length > 0 ? (
                eqPresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))
              ) : (
                <>
                  <option value="normal">일반</option>
                  <option value="game">게임</option>
                  <option value="music">음악</option>
                  <option value="movie">영화</option>
                  <option value="voice">음성</option>
                  <option value="bass">베이스 강화</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="sound-boost-card">
        <div className="action-section">
          <button
            className="action-button apply-button"
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? '적용 중...' : '설정 적용'}
          </button>
        </div>
      </div>

      {applying && (
        <div className="sound-boost-card">
          <div className="applying-section">
            <div className="applying-message">사운드 설정 적용 중...</div>
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div className="progress-bar-fill"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {applyResult && applyResult.success && (
        <div className="sound-boost-card">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <div className="success-text">
              <h3 className="success-title">설정이 성공적으로 적용되었습니다.</h3>
              <p className="success-description">
                사운드 증폭 및 설정이 적용되었습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {applyResult && !applyResult.success && (
        <div className="sound-boost-card">
          <div className="error-message">
            {applyResult.error || '설정 적용 중 오류가 발생했습니다.'}
          </div>
        </div>
      )}
    </div>
  );
}

export default SoundBoost;
