/**
 * ---------
 * 2025-12-01
 * 개발자 : KR_Tuki
 * 기능 : 사이드바 컴포넌트
 * ---------
 * @Sidebar.jsx (1-58)
 * 날짜: 2025-12-01
 * Import 모듈 설명:
 * - react: React 라이브러리. 함수형 컴포넌트로 구현
 * - react-router-dom (Link, useLocation): React 라우팅 라이브러리
 *   사용 예: Link - 라우트 링크 컴포넌트, useLocation() - 현재 경로 정보 조회
 * 변수 설명:
 *   - menuItems: 사이드바 메뉴 항목 배열 (path, icon, label 속성 포함)
 *   - theme: 테마 설정 ('light', 'dark' 등)
 *   - setTheme: 테마 변경 함수
 *   - location: 현재 경로 정보 (useLocation() 훅으로 조회)
 * 기능 원리:
 * 1. 네비게이션 메뉴: Link 컴포넌트로 페이지 간 이동
 * 2. 현재 페이지 표시: useLocation()으로 현재 경로 확인 후 활성 메뉴 강조
 * 3. 테마 관리: 테마 변경 버튼으로 라이트/다크 모드 전환
 * 4. 반응형 디자인: 사이드바 토글 버튼으로 모바일 환경 대응
 */

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
