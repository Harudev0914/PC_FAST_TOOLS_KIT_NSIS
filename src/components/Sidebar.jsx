import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

const menuItems = [
  { path: '/', icon: '📊', label: '대시보드' },
  { path: '/cleaner', icon: '🧹', label: '컴퓨터 클리너' },
  { path: '/memory', icon: '💾', label: '메모리 최적화' },
  { path: '/network', icon: '🌐', label: '네트워크 최적화' },
  { path: '/audio', icon: '🔊', label: '오디오 증폭' },
  { path: '/gaming', icon: '🎮', label: '게이밍 모드' },
  { path: '/recovery', icon: '📁', label: '파일 복구' },
  { path: '/software-updater', icon: '🔄', label: '소프트웨어 업데이터' },
  { path: '/driver-updater', icon: '⚙️', label: '드라이버 업데이터' },
  { path: '/cpu', icon: '⚡', label: 'CPU 최적화' },
  { path: '/history', icon: '🗑️', label: '기록 삭제' },
];

function Sidebar({ theme, setTheme }) {
  const location = useLocation();

  return (
    <aside className={`sidebar ${theme}`}>
      <div className="sidebar-header">
        <h1 className="sidebar-title">PC Optimizer</h1>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
