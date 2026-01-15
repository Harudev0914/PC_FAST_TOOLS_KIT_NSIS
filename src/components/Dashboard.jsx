// ---------
// 2025-11-25
// 개발자 : KR_Tuki
// 기능 : 대시보드 컴포넌트
// ---------

import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import '../styles/Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState({
    memory: { used: 0, total: 0, percent: 0 },
    cpu: { usage: 0 },
    network: { bytesReceived: 0, bytesSent: 0 },
  });
  const [memoryHistory, setMemoryHistory] = useState([]);
  const [cpuHistory, setCpuHistory] = useState([]);

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI is not available');
      return;
    }

    const interval = setInterval(async () => {
      try {
        const [memoryStats, cpuStats, networkStats] = await Promise.all([
          window.electronAPI.memory.getStats(),
          window.electronAPI.cpu.getStats(),
          window.electronAPI.network.getStats(),
        ]);

        setStats({
          memory: memoryStats,
          cpu: cpuStats,
          network: networkStats,
        });

        const now = new Date().toLocaleTimeString();
        setMemoryHistory((prev) => {
          const newData = [...prev, { time: now, usage: memoryStats.usagePercent }];
          return newData.slice(-20);
        });
        setCpuHistory((prev) => {
          const newData = [...prev, { time: now, usage: cpuStats.usagePercent }];
          return newData.slice(-20);
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

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

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">대시보드</h1>
        <p className="page-description">시스템 상태 및 빠른 액세스</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#667eea' }}>
            {stats.memory.percent.toFixed(1)}%
          </div>
          <div className="stat-label">메모리 사용률</div>
          <div className="stat-detail">{formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: '#764ba2' }}>
            {stats.cpu.usagePercent.toFixed(1)}%
          </div>
          <div className="stat-label">CPU 사용률</div>
          <div className="stat-detail">{stats.cpu.cores} 코어</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: '#2ecc71' }}>
            {formatBytes(stats.network.total)}
          </div>
          <div className="stat-label">네트워크 트래픽</div>
          <div className="stat-detail">받음: {formatBytes(stats.network.bytesReceived)}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <h3>메모리 사용률</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={memoryHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="usage" stroke="#667eea" fill="#667eea" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>CPU 사용률</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cpuHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="usage" stroke="#764ba2" fill="#764ba2" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
