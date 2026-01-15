// ---------
// 2025-08-10
// 개발자 : KR_Tuki
// 기능 : 네트워크 오류 페이지 컴포넌트
// ---------

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/ErrorPages.css';

function ErrorNetwork({ statusCode: propStatusCode, errorMessage: propErrorMessage }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusCode, setStatusCode] = useState(propStatusCode);
  const [errorMessage, setErrorMessage] = useState(propErrorMessage);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    const messageParam = searchParams.get('message');
    
    if (codeParam && !statusCode) {
      setStatusCode(parseInt(codeParam, 10));
    }
    if (messageParam && !errorMessage) {
      setErrorMessage(decodeURIComponent(messageParam));
    }
  }, [searchParams, statusCode, errorMessage]);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleRetry = () => {
    window.location.reload();
  };

  const getErrorTitle = () => {
    switch (statusCode) {
      case 404:
        return '리소스를 찾을 수 없습니다';
      case 403:
        return '접근이 거부되었습니다';
      case 401:
        return '인증이 필요합니다';
      case 500:
      case 502:
      case 503:
        return '서버 오류가 발생했습니다';
      default:
        return '네트워크 오류가 발생했습니다';
    }
  };

  const getErrorDescription = () => {
    switch (statusCode) {
      case 404:
        return '요청하신 리소스를 찾을 수 없습니다.';
      case 403:
        return '이 리소스에 대한 접근 권한이 없습니다.';
      case 401:
        return '인증이 필요합니다. 다시 로그인해주세요.';
      case 500:
        return '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      case 502:
        return '게이트웨이 오류가 발생했습니다. 서버가 응답하지 않습니다.';
      case 503:
        return '서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
      default:
        return '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요.';
    }
  };

  return (
    <div className="error-page error-network">
      <div className="error-container">
        <div className="error-icon">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" stroke="#FF003F" strokeWidth="4" strokeDasharray="8 4" opacity="0.3"/>
            <path d="M30 60L50 40L70 60L90 40" stroke="#FF003F" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="50" cy="40" r="4" fill="#FF003F"/>
            <circle cx="90" cy="40" r="4" fill="#FF003F"/>
            <text x="60" y="95" textAnchor="middle" fill="#FF003F" fontSize="20" fontWeight="bold">
              {statusCode || 'ERR'}
            </text>
          </svg>
        </div>
        <h1 className="error-title">{getErrorTitle()}</h1>
        <p className="error-description">
          {errorMessage || getErrorDescription()}
        </p>
        <div className="error-actions">
          <button className="error-button primary" onClick={handleRetry}>
            다시 시도
          </button>
          <button className="error-button secondary" onClick={handleGoHome}>
            홈으로 돌아가기
          </button>
        </div>
        {statusCode && (
          <div className="error-code">
            오류 코드: {statusCode}
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

export default ErrorNetwork;
