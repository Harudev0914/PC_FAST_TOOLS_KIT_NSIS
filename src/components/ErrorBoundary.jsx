// ---------
// 2025-08-05
// 개발자 : KR_Tuki
// 기능 : React 에러 바운더리 컴포넌트
// ---------

// @ErrorBoundary.jsx (1-44)
// 날짜: 2025-08-05
// Import 모듈 설명:
// - react: React 라이브러리. 클래스 컴포넌트로 에러 바운더리 구현
//   사용 예: React.Component - 클래스 컴포넌트 상속, getDerivedStateFromError() - 에러 발생 시 상태 업데이트, componentDidCatch() - 에러 처리
// - Error500: 500 에러 페이지 컴포넌트. 에러 발생 시 표시
// 변수 설명:
//   - hasError: 에러 발생 여부 (boolean)
//   - error: 발생한 에러 객체 (Error 인스턴스)
//   - errorInfo: 에러 정보 객체 (componentStack 포함)
// 기능 원리:
// 1. 에러 감지: getDerivedStateFromError()로 자식 컴포넌트의 에러 감지 및 상태 업데이트
// 2. 에러 처리: componentDidCatch()로 에러 로깅 및 상태 업데이트
// 3. 에러 UI 표시: hasError가 true일 때 Error500 컴포넌트 렌더링
// 4. 정상 UI 표시: 에러가 없을 때 this.props.children 렌더링
// 5. 에러 격리: 하나의 컴포넌트에서 발생한 에러가 전체 앱을 중단시키지 않도록 방지

import React from 'react';
import Error500 from './Error500';
import '../styles/ErrorPages.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Error500 
          error={this.state.error} 
          errorInfo={this.state.errorInfo}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
