import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/Dashboard.css';

// 폴링 주기 (ms). 2초 간격은 CPU 부하와 반응성의 균형점.
const POLL_INTERVAL = 2000;
// 히스토리 링버퍼 최대 길이 (차트에 표시할 최근 포인트 수).
const HISTORY_MAX = 30;

// 누적 바이트/카운터를 고정 길이 링버퍼에 push (배열 재할당 최소화).
function pushHistory(prev, point) {
  const next = prev.length >= HISTORY_MAX ? prev.slice(prev.length - HISTORY_MAX + 1) : prev.slice();
  next.push(point);
  return next;
}

function formatSize(gb) {
  const n = Number(gb) || 0;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} TB`;
  return `${n.toFixed(1)} GB`;
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState({
    cpu: [],
    memory: [],
    gpu: [],
    disk: [],
    netSend: [],   // MB/s
    netReceive: [], // MB/s
  });

  // --- 최적화용 ref들 (리렌더 없이 유지) ---
  const inFlightRef = useRef(false);          // 이전 요청이 아직 진행 중이면 중복 호출 방지
  const prevNetRef = useRef(null);            // 네트워크 누적값 이전 스냅샷 (throughput 델타 계산용)
  const prevTsRef = useRef(0);                // 이전 폴링 시각 (초당 속도 정규화용)
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    if (!window.electronAPI?.systemStats?.getAll) return;
    // in-flight 가드: 직전 IPC가 아직 안 끝났으면 이번 틱은 건너뜀 → 큐 적체/CPU 폭주 방지
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const data = await window.electronAPI.systemStats.getAll();
      if (!mountedRef.current) return;
      if (!data || data.success === false) {
        setError(true);
        return;
      }
      setError(false);
      setStats(data);

      const now = Date.now();
      const label = new Date(now).toLocaleTimeString();

      // 네트워크 throughput: 누적 sendMB/receiveMB의 델타를 경과 초로 나눠 MB/s 산출.
      const eth = data.ethernet || {};
      const wifi = data.wifi || {};
      const sendTotal = (eth.sendMB || 0) + (wifi.sendMB || 0);
      const recvTotal = (eth.receiveMB || 0) + (wifi.receiveMB || 0);
      let sendRate = 0;
      let recvRate = 0;
      if (prevNetRef.current && prevTsRef.current) {
        const elapsed = Math.max(0.001, (now - prevTsRef.current) / 1000);
        // 카운터가 리셋되면(현재<이전) 음수 방지를 위해 0으로 클램프
        sendRate = Math.max(0, (sendTotal - prevNetRef.current.send) / elapsed);
        recvRate = Math.max(0, (recvTotal - prevNetRef.current.receive) / elapsed);
      }
      prevNetRef.current = { send: sendTotal, receive: recvTotal };
      prevTsRef.current = now;

      const gpu0 = Array.isArray(data.gpu) ? data.gpu[0] : data.gpu;
      const disk0 = Array.isArray(data.disk) ? data.disk[0] : data.disk;

      setHistory((prev) => ({
        cpu: pushHistory(prev.cpu, { time: label, usage: data.cpu?.usage ?? 0 }),
        memory: pushHistory(prev.memory, { time: label, usage: data.memory?.usage ?? 0 }),
        gpu: pushHistory(prev.gpu, { time: label, usage: gpu0?.usage ?? 0 }),
        disk: pushHistory(prev.disk, { time: label, usage: disk0?.usage ?? 0 }),
        netSend: pushHistory(prev.netSend, { time: label, value: Number(sendRate.toFixed(3)) }),
        netReceive: pushHistory(prev.netReceive, { time: label, value: Number(recvRate.toFixed(3)) }),
      }));
    } catch (e) {
      console.error('Dashboard poll error:', e);
      if (mountedRef.current) setError(true);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // 실행 시 즉시 1회 fetch (첫 화면 공백 최소화)
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [poll]);

  if (!window.electronAPI) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">대시보드</h1>
          <p className="page-description">Electron API를 로드하는 중...</p>
        </div>
      </div>
    );
  }

  const cpu = stats?.cpu || {};
  const memory = stats?.memory || {};
  const disks = Array.isArray(stats?.disk) ? stats.disk : (stats?.disk ? [stats.disk] : []);
  const gpus = Array.isArray(stats?.gpu) ? stats.gpu : (stats?.gpu ? [stats.gpu] : []);
  const gpu0 = gpus[0] || {};
  const ethernet = stats?.ethernet || {};
  const wifi = stats?.wifi || {};

  const lastSend = history.netSend[history.netSend.length - 1]?.value ?? 0;
  const lastRecv = history.netReceive[history.netReceive.length - 1]?.value ?? 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">대시보드</h1>
        <p className="page-description">
          시스템 전체 상태 실시간 모니터링{error ? ' · 데이터 수신 오류' : (stats ? '' : ' · 로딩 중...')}
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#764ba2' }}>{cpu.usage ?? 0}%</div>
          <div className="stat-label">CPU 사용률</div>
          <div className="stat-detail">{cpu.cores ?? 0}코어 / {cpu.threads ?? 0}스레드</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#667eea' }}>{(memory.usage ?? 0)}%</div>
          <div className="stat-label">메모리 사용률</div>
          <div className="stat-detail">{formatSize(memory.used)} / {formatSize(memory.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f39c12' }}>{(gpu0.usage ?? 0)}%</div>
          <div className="stat-label">GPU 사용률</div>
          <div className="stat-detail">{gpu0.model || 'GPU 감지 중...'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#16a085' }}>{(disks[0]?.usage ?? 0)}%</div>
          <div className="stat-label">디스크 사용률 ({disks[0]?.letter || 'C:'})</div>
          <div className="stat-detail">{disks[0]?.used ?? 0} / {disks[0]?.total ?? 0} GB · {disks[0]?.type || 'Unknown'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#2ecc71' }}>{lastRecv.toFixed(2)}</div>
          <div className="stat-label">네트워크 수신 (MB/s)</div>
          <div className="stat-detail">송신: {lastSend.toFixed(2)} MB/s</div>
        </div>
      </div>

      {/* 차트 */}
      <div className="charts-grid">
        <div className="card">
          <h3>CPU 사용률 (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history.cpu}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="usage" stroke="#764ba2" fill="#764ba2" fillOpacity={0.3} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>메모리 사용률 (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history.memory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="usage" stroke="#667eea" fill="#667eea" fillOpacity={0.3} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>GPU 사용률 (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history.gpu}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="usage" stroke="#f39c12" fill="#f39c12" fillOpacity={0.3} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>네트워크 처리량 (MB/s)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history.netReceive.map((r, i) => ({ time: r.time, receive: r.value, send: history.netSend[i]?.value ?? 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="receive" name="수신" stroke="#2ecc71" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="send" name="송신" stroke="#e74c3c" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 세부 값 */}
      <div className="detail-grid">
        <div className="detail-card">
          <h3>CPU</h3>
          <DetailRow label="모델" value={cpu.model} />
          <DetailRow label="현재 속도" value={cpu.speed} />
          <DetailRow label="기본 속도" value={cpu.baseSpeed} />
          <DetailRow label="코어 / 스레드" value={`${cpu.cores ?? 0} / ${cpu.threads ?? 0}`} />
          <DetailRow label="가상화" value={cpu.virtualization ? '사용' : '사용 안 함'} />
          <DetailRow label="L2 / L3 캐시" value={`${cpu.l2Cache || '-'} / ${cpu.l3Cache || '-'}`} />
          <DetailRow label="프로세스 / 핸들" value={`${cpu.processes ?? 0} / ${cpu.handles ?? 0}`} />
          <DetailRow label="가동 시간" value={cpu.uptime} />
        </div>

        <div className="detail-card">
          <h3>메모리</h3>
          <DetailRow label="전체" value={formatSize(memory.total)} />
          <DetailRow label="사용 중" value={formatSize(memory.used)} />
          <DetailRow label="사용 가능" value={formatSize(memory.available)} />
          <DetailRow label="캐시됨" value={formatSize(memory.cached)} />
          <DetailRow label="속도" value={memory.speed} />
          <DetailRow label="슬롯" value={memory.slots} />
          <DetailRow label="폼 팩터" value={memory.formFactor} />
        </div>

        <div className="detail-card">
          <h3>이더넷</h3>
          <DetailRow label="어댑터" value={ethernet.adapterName} />
          <DetailRow label="IPv4" value={ethernet.ipv4} />
          <DetailRow label="IPv6" value={ethernet.ipv6} />
          <DetailRow label="송신 (누적)" value={`${(ethernet.sendMB || 0).toFixed(2)} MB`} />
          <DetailRow label="수신 (누적)" value={`${(ethernet.receiveMB || 0).toFixed(2)} MB`} />
        </div>

        <div className="detail-card">
          <h3>Wi-Fi</h3>
          <DetailRow label="어댑터" value={wifi.adapterName} />
          <DetailRow label="SSID" value={wifi.ssid} />
          <DetailRow label="신호 강도" value={wifi.signalStrength ? `${wifi.signalStrength}%` : undefined} />
          <DetailRow label="IPv4" value={wifi.ipv4} />
          <DetailRow label="송신 (누적)" value={`${(wifi.sendMB || 0).toFixed(2)} MB`} />
          <DetailRow label="수신 (누적)" value={`${(wifi.receiveMB || 0).toFixed(2)} MB`} />
        </div>

        {disks.map((d, i) => (
          <div className="detail-card" key={d.letter || i}>
            <h3>디스크 {i} ({d.letter})</h3>
            <DetailRow label="종류" value={d.type} />
            <DetailRow label="모델" value={d.model} />
            <DetailRow label="사용률" value={`${d.usage ?? 0}%`} />
            <DetailRow label="사용 / 전체" value={`${d.used ?? 0} / ${d.total ?? 0} GB`} />
            <DetailRow label="여유 공간" value={`${d.free ?? 0} GB`} />
            <DetailRow label="시스템 디스크" value={d.systemDisk ? '예' : '아니오'} />
          </div>
        ))}

        {gpus.map((g, i) => (
          <div className="detail-card" key={i}>
            <h3>GPU {i}</h3>
            <DetailRow label="모델" value={g.model} />
            <DetailRow label="사용률" value={`${g.usage ?? 0}%`} />
            <DetailRow label="전용 메모리" value={g.gpuMemory} />
            <DetailRow label="공유 메모리" value={g.sharedGpuMemory} />
            <DetailRow label="드라이버" value={g.driverVersion} />
            <DetailRow label="DirectX" value={g.directXVersion} />
          </div>
        ))}
      </div>
    </div>
  );
}

// 값이 비어있거나 의미 없는 기본값이면 '-'로 표시
function DetailRow({ label, value }) {
  const invalid =
    value === null || value === undefined || value === '' ||
    value === 'Unknown' || value === '0 GHz' || value === '0/0' ||
    value === '0.0.0.0' || value === '::' || value === '0:0:0:0';
  return (
    <div className="detail-row">
      <span className="detail-key">{label}</span>
      <span className="detail-val">{invalid ? '-' : value}</span>
    </div>
  );
}

export default Dashboard;
