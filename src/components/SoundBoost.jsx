import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/SoundBoost.css';

const EQ_FREQS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const PRESETS = {
  normal: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  game: [4, 3, 1, 0, -1, 0, 2, 4, 4, 3],
  music: [3, 2, 0, 0, -1, -1, 0, 1, 2, 3],
  movie: [4, 3, 2, 0, 0, 1, 2, 2, 3, 4],
  voice: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  bass: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
};
const PRESET_LABELS = { normal: '일반', game: '게임', music: '음악', movie: '영화', voice: '음성', bass: '베이스' };

// 오디오 인터페이스 스타일 로터리 노브 (LED 링 + 드래그로 회전)
function Knob({ label, value, min, max, unit, onChange, size = 92, accent = '#35e0d0' }) {
  const dragRef = useRef(null);
  const pct = (value - min) / (max - min);
  const START = 135, SWEEP = 270;
  const angle = START + pct * SWEEP;
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 9;
  const polar = (deg) => {
    const r = ((deg - 90) * Math.PI) / 180;
    return [cx + R * Math.cos(r), cy + R * Math.sin(r)];
  };
  const arcPath = (a0, a1) => {
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const onDown = (e) => {
    e.preventDefault();
    dragRef.current = { y: e.clientY, v: value };
    const move = (ev) => {
      const dy = dragRef.current.y - ev.clientY;
      let nv = dragRef.current.v + Math.round(dy / 2);
      nv = Math.max(min, Math.min(max, nv));
      onChange(nv);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const [px, py] = polar(angle);
  const [dx, dy] = polar(angle); // pointer dot near edge
  return (
    <div className="ai-knob">
      <svg width={size} height={size} className="ai-knob-svg" onMouseDown={onDown} onDoubleClick={() => onChange(Math.round((min + max) / 2))}>
        <path d={arcPath(START, START + SWEEP)} className="ai-knob-track" />
        <path d={arcPath(START, Math.max(START + 0.1, angle))} className="ai-knob-fill" style={{ stroke: accent }} />
        <circle cx={cx} cy={cy} r={R - 9} className="ai-knob-body" />
        <circle cx={cx} cy={cy} r={R - 9} className="ai-knob-bevel" />
        <line x1={cx} y1={cy} x2={cx + (R - 12) * Math.cos(((angle - 90) * Math.PI) / 180)} y2={cy + (R - 12) * Math.sin(((angle - 90) * Math.PI) / 180)} className="ai-knob-pointer" style={{ stroke: accent }} />
        <circle cx={dx} cy={dy} r="2.6" className="ai-knob-dot" style={{ fill: accent }} />
      </svg>
      <div className="ai-knob-val">{value > 0 && unit === 'dB' ? '+' : ''}{value}{unit}</div>
      <div className="ai-knob-label">{label}</div>
    </div>
  );
}

// 세그먼트 LED 미터 (출력 레벨)
function LedMeter({ level }) {
  const segs = 14;
  const lit = Math.round((level / 100) * segs);
  return (
    <div className="ai-meter">
      {Array.from({ length: segs }).map((_, i) => {
        const idx = segs - 1 - i; // 위에서 아래로
        const on = idx < lit;
        const tone = idx >= segs - 2 ? 'red' : idx >= segs - 5 ? 'amber' : 'green';
        return <span key={i} className={`ai-meter-seg ${tone} ${on ? 'on' : ''}`} />;
      })}
    </div>
  );
}

function SoundBoost() {
  const [enabled, setEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(80);
  const [bassLevel, setBassLevel] = useState(50);
  const [trebleLevel, setTrebleLevel] = useState(50);
  const [eqBands, setEqBands] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [eqPreset, setEqPreset] = useState('normal');
  const [gameBoost, setGameBoost] = useState({ enabled: false, level: 50 });
  const [bassBoost, setBassBoost] = useState({ enabled: false, level: 50 });
  const [devices, setDevices] = useState([]);
  const [apoInstalled, setApoInstalled] = useState(null);
  const [installingApo, setInstallingApo] = useState(false);
  const [apoMsg, setApoMsg] = useState('');
  const [applying, setApplying] = useState(false);

  const curveRef = useRef(null);
  const timerRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { enabled, masterVolume, bassLevel, trebleLevel, eqPreset, gameBoost, bassBoost, eqBands };

  useEffect(() => {
    (async () => {
      const s = window.__preloadedAudioSettings ||
        (window.electronAPI?.audio?.getSettings ? await window.electronAPI.audio.getSettings().catch(() => null) : null);
      if (s) {
        setEnabled(!!s.enabled);
        setMasterVolume(s.masterVolume ?? 80);
        setBassLevel(s.bassLevel ?? 50);
        setTrebleLevel(s.trebleLevel ?? 50);
        setEqPreset(s.eqPreset || 'normal');
        if (Array.isArray(s.modelSettings?.eqBands) && s.modelSettings.eqBands.length === 10) setEqBands(s.modelSettings.eqBands);
        if (s.gameSoundBoost) setGameBoost(s.gameSoundBoost);
        if (s.baseSoundBoost) setBassBoost(s.baseSoundBoost);
      }
      const d = window.__preloadedAudioDevices ||
        (window.electronAPI?.audio?.getDevices ? await window.electronAPI.audio.getDevices().catch(() => []) : []);
      setDevices(Array.isArray(d) ? d : []);
      if (window.electronAPI?.audio?.isEqualizerApoInstalled) {
        const r = await window.electronAPI.audio.isEqualizerApoInstalled().catch(() => null);
        setApoInstalled(!!(r && r.installed));
      }
    })();
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, []);

  const doApply = useCallback(async (over = {}) => {
    if (!window.electronAPI?.audio?.applySoundBoost) return;
    const s = { ...stateRef.current, ...over };
    setApplying(true);
    try {
      await window.electronAPI.audio.applySoundBoost({
        enabled: s.enabled,
        masterVolume: s.masterVolume,
        bassLevel: s.bassLevel,
        trebleLevel: s.trebleLevel,
        eqPreset: s.eqPreset,
        gameSoundBoost: s.gameBoost,
        baseSoundBoost: s.bassBoost,
        modelSettings: { eqBands: s.eqBands },
      });
    } catch (e) { /* ignore */ } finally { setApplying(false); }
  }, []);

  const scheduleApply = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { if (stateRef.current.enabled) doApply(); }, 280);
  }, [doApply]);

  const togglePower = () => {
    const next = !enabled;
    setEnabled(next);
    doApply({ enabled: next });
  };

  const changeBand = (i, v) => {
    const n = [...eqBands]; n[i] = v;
    setEqBands(n); setEqPreset('custom');
    if (enabled) scheduleApply();
  };
  const applyPreset = (key) => {
    setEqPreset(key); setEqBands(PRESETS[key] || PRESETS.normal);
    if (enabled) scheduleApply();
  };
  const changeVal = (setter) => (v) => { setter(v); if (enabled) scheduleApply(); };
  const toggleEnhancer = (which) => {
    if (which === 'game') setGameBoost((p) => ({ ...p, enabled: !p.enabled }));
    else setBassBoost((p) => ({ ...p, enabled: !p.enabled }));
    if (enabled) scheduleApply();
  };
  const changeEnhancerLevel = (which, level) => {
    if (which === 'game') setGameBoost((p) => ({ ...p, level }));
    else setBassBoost((p) => ({ ...p, level }));
    if (enabled) scheduleApply();
  };

  // EQ 커브 그리기
  useEffect(() => {
    const c = curveRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const accent = enabled ? '#35e0d0' : '#4a5560';
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const n = eqBands.length;
    for (let i = 0; i < n; i++) {
      const x = (w / (n - 1)) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    // 0 dB reference
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    // curve points
    const pts = eqBands.map((g, i) => ({
      x: (w / (n - 1)) * i,
      y: h / 2 - (Math.max(-12, Math.min(12, g)) / 12) * (h / 2 * 0.86),
    }));
    // smooth line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    // fill under
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, enabled ? 'rgba(53,224,208,0.28)' : 'rgba(74,85,96,0.18)');
    grad.addColorStop(1, 'rgba(53,224,208,0)');
    ctx.save();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.restore();
    // stroke curve again on top
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = enabled ? 10 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // nodes
    pts.forEach((p) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = accent; ctx.fill();
    });
  }, [eqBands, enabled]);

  const handleInstallApo = async () => {
    if (!window.electronAPI?.audio?.installEqualizerApo) return;
    setInstallingApo(true);
    setApoMsg('설치 프로그램을 다운로드하는 중... (약 12MB)');
    try {
      const r = await window.electronAPI.audio.installEqualizerApo();
      if (r && r.launched) setApoMsg('설치 프로그램 실행됨 → 출력 장치 선택 후 재부팅하면 EQ가 실제 적용됩니다.');
      else if (r && r.openedPage) setApoMsg('자동 다운로드 실패 → 다운로드 페이지를 열었습니다. 수동 설치해 주세요.');
      else setApoMsg('설치 시작 실패: ' + ((r && r.error) || '알 수 없는 오류'));
    } catch (e) {
      setApoMsg('오류: ' + (e.message || ''));
    } finally {
      setInstallingApo(false);
    }
  };

  const outputDevice = devices.find((d) => d.type === 'output');

  return (
    <div className={`ai-console ${enabled ? 'on' : 'off'}`}>
      {/* ===== Chassis header ===== */}
      <div className="ai-header">
        <div className="ai-brand">
          <span className={`ai-power-led ${enabled ? 'lit' : ''}`} />
          <div>
            <div className="ai-brand-title">SOUND BOOST</div>
            <div className="ai-brand-sub">STUDIO INTERFACE</div>
          </div>
        </div>
        <div className="ai-header-right">
          <span className="ai-status-text">{enabled ? (applying ? 'APPLYING…' : 'ACTIVE') : 'STANDBY'}</span>
          <button className={`ai-power-btn ${enabled ? 'on' : ''}`} onClick={togglePower} title="전원 ON/OFF">
            <span className="ai-power-glyph">⏻</span>
            <span className="ai-power-label">{enabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* ===== Top rack: monitor/tone knobs + output meter ===== */}
      <div className="ai-rack">
        <div className="ai-module ai-knobs">
          <div className="ai-module-label">MONITOR &nbsp;/&nbsp; TONE</div>
          <div className="ai-knob-row">
            <Knob label="MONITOR" value={masterVolume} min={0} max={100} unit="%" onChange={changeVal(setMasterVolume)} size={104} accent="#35e0d0" />
            <Knob label="BASS" value={bassLevel} min={0} max={100} unit="" onChange={changeVal(setBassLevel)} accent="#7aa2ff" />
            <Knob label="TREBLE" value={trebleLevel} min={0} max={100} unit="" onChange={changeVal(setTrebleLevel)} accent="#ffb84d" />
          </div>
        </div>
        <div className="ai-module ai-output">
          <div className="ai-module-label">OUTPUT</div>
          <div className="ai-output-body">
            <LedMeter level={enabled ? masterVolume : 0} />
            <div className="ai-output-info">
              <div className="ai-io-line"><span className="ai-io-dot on" /> {outputDevice ? outputDevice.name : '기본 출력 장치'}</div>
              <div className="ai-io-sub">{enabled ? '신호 전송 중' : '대기'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Graphic EQ module ===== */}
      <div className="ai-module ai-eq">
        <div className="ai-module-label">10-BAND GRAPHIC EQ <span className="ai-db-hint">±12 dB</span></div>
        <div className="ai-eq-body">
          <canvas ref={curveRef} width={760} height={116} className="ai-eq-curve" />
          <div className="ai-eq-faders">
            {eqBands.map((g, i) => (
              <div className="ai-fader" key={i}>
                <div className="ai-fader-val">{g > 0 ? '+' : ''}{g}</div>
                <input
                  type="range" min={-12} max={12} step={1} value={g}
                  className="ai-vfader"
                  onChange={(e) => changeBand(i, parseInt(e.target.value))}
                  onDoubleClick={() => changeBand(i, 0)}
                />
                <div className="ai-fader-freq">{EQ_FREQS[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Presets ===== */}
      <div className="ai-module ai-presets">
        <div className="ai-module-label">PRESET</div>
        <div className="ai-preset-row">
          {Object.keys(PRESETS).map((key) => (
            <button
              key={key}
              className={`ai-preset-btn ${eqPreset === key ? 'active' : ''}`}
              onClick={() => applyPreset(key)}
            >
              {PRESET_LABELS[key]}
            </button>
          ))}
          {eqPreset === 'custom' && <span className="ai-preset-custom">CUSTOM</span>}
        </div>
      </div>

      {/* ===== Enhancers ===== */}
      <div className="ai-module ai-enhancers">
        <div className="ai-module-label">ENHANCERS</div>
        <div className="ai-enh-grid">
          <div className={`ai-enh ${gameBoost.enabled ? 'on' : ''}`}>
            <div className="ai-enh-head">
              <span className="ai-enh-name">GAME BOOST</span>
              <button className={`ai-switch ${gameBoost.enabled ? 'on' : ''}`} onClick={() => toggleEnhancer('game')}>
                <span className="ai-switch-knob" />
              </button>
            </div>
            <div className="ai-enh-slider">
              <input type="range" min={0} max={200} value={gameBoost.level} disabled={!gameBoost.enabled}
                onChange={(e) => changeEnhancerLevel('game', parseInt(e.target.value))} className="ai-hslider" />
              <span className="ai-enh-lvl">{gameBoost.level}%</span>
            </div>
          </div>
          <div className={`ai-enh ${bassBoost.enabled ? 'on' : ''}`}>
            <div className="ai-enh-head">
              <span className="ai-enh-name">BASS BOOST</span>
              <button className={`ai-switch ${bassBoost.enabled ? 'on' : ''}`} onClick={() => toggleEnhancer('base')}>
                <span className="ai-switch-knob" />
              </button>
            </div>
            <div className="ai-enh-slider">
              <input type="range" min={0} max={200} value={bassBoost.level} disabled={!bassBoost.enabled}
                onChange={(e) => changeEnhancerLevel('base', parseInt(e.target.value))} className="ai-hslider" />
              <span className="ai-enh-lvl">{bassBoost.level}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== EQ engine (Equalizer APO) status ===== */}
      <div className="ai-module ai-engine">
        <div className="ai-engine-left">
          <div className="ai-module-label" style={{ marginBottom: 6 }}>EQ ENGINE</div>
          {apoInstalled === true && (
            <div className="ai-engine-status ok"><span className="ai-io-dot on" /> Equalizer APO 감지됨 — EQ·베이스·트레블 실제 적용</div>
          )}
          {apoInstalled === false && (
            <div className="ai-engine-status warn">
              <span className="ai-io-dot warn" /> 볼륨은 즉시 적용됩니다. EQ·베이스·트레블 실제 적용엔 Equalizer APO가 필요합니다.
            </div>
          )}
          {apoInstalled === null && (
            <div className="ai-engine-status"><span className="ai-io-dot" /> 엔진 확인 중…</div>
          )}
          {apoMsg && <div className="ai-engine-msg">{apoMsg}</div>}
        </div>
        {apoInstalled === false && (
          <button className="ai-install-btn" onClick={handleInstallApo} disabled={installingApo}>
            {installingApo ? '설치 준비 중…' : 'Equalizer APO 설치'}
          </button>
        )}
      </div>
    </div>
  );
}

// [perf] props가 없는 패널 — React.memo로 부모(MainPage) 리렌더 전파를 차단한다.
export default React.memo(SoundBoost);
