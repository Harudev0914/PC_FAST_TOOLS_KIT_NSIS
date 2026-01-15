import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ErrorPages.css';

/**
 * ---------
 * 2025-09-01
 * 개발자 : KR_Tuki
 * 기능 : 500 오류 페이지 컴포넌트
 * ---------
 * @Error500.jsx (1-87)
 * 날짜: 2025-09-01
 * Import 모듈 설명:
 * - react (useState): React 훅. 컴포넌트 상태 관리에 사용
 *   사용 예: useState(false) - 오류 상세 정보 표시 여부 관리
 * - react-router-dom (useNavigate): React 라우팅 훅. 페이지 네비게이션에 사용
 *   사용 예: navigate('/') - 홈 페이지로 이동
 * - '../styles/ErrorPages.css': 오류 페이지 스타일시트
 * 변수 설명:
 *   - error: 전달받은 오류 객체 (props)
 *   - errorInfo: 전달받은 오류 정보 객체 (props)
 *   - showDetails: 오류 상세 정보 표시 여부 (boolean)
 *   - navigate: 페이지 네비게이션 함수 (useNavigate 훅)
 * 기능 원리:
 * 1. 오류 표시: 500 서버 오류를 시각적으로 표시 (SVG 아이콘, 메시지)
 * 2. 네비게이션: 홈으로 돌아가기, 페이지 새로고침 버튼 제공
 * 3. 오류 상세 정보: 토글 버튼으로 오류 메시지 및 컴포넌트 스택 표시/숨김
 * 4. 디스코드 연락처: 개발자 연락처 정보 표시
 */

function Error500({ error, errorInfo }) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="error-page error-500">
      <div className="error-container">
        <div className="error-icon">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" stroke="#FF003F" strokeWidth="4" strokeDasharray="8 4" opacity="0.3"/>
            <path d="M60 30V70M60 80V90" stroke="#FF003F" strokeWidth="6" strokeLinecap="round"/>
            <circle cx="60" cy="100" r="4" fill="#FF003F"/>
            <text x="60" y="50" textAnchor="middle" fill="#FF003F" fontSize="24" fontWeight="bold">500</text>
          </svg>
        </div>
        <h1 className="error-title">서버 오류가 발생했습니다</h1>
        <p className="error-description">
          예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <div className="error-actions">
          <button className="error-button primary" onClick={handleReload}>
            페이지 새로고침
          </button>
          <button className="error-button secondary" onClick={handleGoHome}>
            홈으로 돌아가기
          </button>
        </div>
        {(error || errorInfo) && (
          <div className="error-details">
            <button 
              className="error-details-toggle"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '▼' : '▶'} 오류 상세 정보
            </button>
            {showDetails && (
              <div className="error-details-content">
                {error && (
                  <div className="error-detail-item">
                    <strong>오류 메시지:</strong>
                    <pre>{error.toString()}</pre>
                  </div>
                )}
                {errorInfo && errorInfo.componentStack && (
                  <div className="error-detail-item">
                    <strong>컴포넌트 스택:</strong>
                    <pre>{errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="error-discord">
          <svg width="48" height="48" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g>
              <path d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z" fill="#FF003F" fillRule="nonzero"/>
            </g>
          </svg>
          <span className="discord-username">kr_tuki</span>
        </div>
      </div>
    </div>
  );
}

export default Error500;
