// ---------
// 2025-05-25
// 개발자 : KR_Tuki
// 기능 : 중앙화된 에러 처리 유틸리티
// ---------

// @errorHandler.js (1-161)
// 날짜: 2025-05-25
// Export 함수 설명:
// - handleHttpError(statusCode, errorMessage): HTTP 에러 코드에 따라 적절한 에러 페이지로 리다이렉트
//   사용 예: handleHttpError(404) - 404 에러 페이지로 이동, handleHttpError(500, '서버 오류') - 네트워크 에러 페이지로 이동
// - handleIpcError(error, context): IPC 통신 에러 처리 및 에러 객체 반환
//   사용 예: handleIpcError(error, 'memory:getStats') - IPC 에러 처리 및 에러 타입 반환
// - handleFileSystemError(error, filePath): 파일 시스템 에러 처리
//   사용 예: handleFileSystemError(error, '/path/to/file') - 파일 시스템 에러 타입 및 메시지 반환
// - withErrorHandling(asyncFn, options): 비동기 함수 래퍼, 에러 처리 자동화
//   사용 예: await withErrorHandling(() => apiCall(), { errorType: 'ipc', context: 'functionName' })
// - isNetworkError(error): 네트워크 에러 여부 확인
// - getUserFriendlyErrorMessage(error): 사용자 친화적인 에러 메시지 반환
// 변수 설명:
//   - errorType: 에러 타입 ('generic', 'ipc', 'filesystem')
//   - context: 에러 발생 컨텍스트 (함수명, API 이름 등)
//   - networkErrorPatterns: 네트워크 에러 패턴 배열 (ECONNREFUSED, ENOTFOUND, ETIMEDOUT 등)
// 기능 원리:
// 1. HTTP 에러 처리: 상태 코드에 따라 적절한 에러 페이지로 리다이렉트
// 2. IPC 에러 처리: IPC 통신 중 발생한 에러를 감지하고 에러 객체 생성
// 3. 파일 시스템 에러 처리: 파일 시스템 작업 중 발생한 에러를 타입별로 분류
// 4. 에러 래퍼: withErrorHandling으로 비동기 함수를 래핑하여 일관된 에러 처리
// 5. 사용자 친화적 메시지: 기술적인 에러 메시지를 사용자가 이해하기 쉬운 메시지로 변환

export function handleHttpError(statusCode, errorMessage = null) {
  const navigate = (path) => {
    if (window.location.hash) {
      window.location.hash = path;
    } else {
      window.location.href = `#${path}`;
    }
  };

  switch (statusCode) {
    case 404:
      navigate('/error/404');
      break;
    case 403:
    case 401:
    case 500:
    case 502:
    case 503:
      navigate(`/error/network?code=${statusCode}&message=${encodeURIComponent(errorMessage || '')}`);
      break;
    default:
      navigate(`/error/network?code=${statusCode}&message=${encodeURIComponent(errorMessage || '')}`);
  }
}

export function handleIpcError(error, context = '') {
  console.error(`IPC Error in ${context}:`, error);
  
  if (error.message && (
    error.message.includes('network') ||
    error.message.includes('fetch') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ENOTFOUND')
  )) {
    handleHttpError(503, '서버에 연결할 수 없습니다.');
    return;
  }

  return {
    type: 'ipc_error',
    message: error.message || 'IPC 통신 중 오류가 발생했습니다.',
    context,
  };
}

export function handleFileSystemError(error, filePath = '') {
  console.error(`File System Error for ${filePath}:`, error);

  if (error.code === 'ENOENT') {
    return {
      type: 'file_not_found',
      message: `파일을 찾을 수 없습니다: ${filePath}`,
      code: 404,
    };
  }

  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return {
      type: 'permission_denied',
      message: `파일 접근 권한이 없습니다: ${filePath}`,
      code: 403,
    };
  }

  return {
    type: 'file_system_error',
    message: error.message || '파일 시스템 오류가 발생했습니다.',
    code: 500,
  };
}

export async function withErrorHandling(asyncFn, options = {}) {
  const {
    onError = null,
    errorType = 'generic',
    context = '',
  } = options;

  try {
    return await asyncFn();
  } catch (error) {
    console.error(`Error in ${context}:`, error);

    if (error.status || error.statusCode) {
      const statusCode = error.status || error.statusCode;
      handleHttpError(statusCode, error.message);
      return;
    }

    if (errorType === 'ipc') {
      const ipcError = handleIpcError(error, context);
      if (onError) {
        onError(ipcError);
      }
      throw ipcError;
    }

    if (errorType === 'filesystem') {
      const fsError = handleFileSystemError(error, context);
      if (onError) {
        onError(fsError);
      }
      throw fsError;
    }

    if (onError) {
      onError({
        type: 'generic',
        message: error.message || '알 수 없는 오류가 발생했습니다.',
        error,
      });
    }

    throw error;
  }
}

export function isNetworkError(error) {
  if (!error) return false;

  const networkErrorPatterns = [
    'network',
    'fetch',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'timeout',
  ];

  const errorMessage = (error.message || '').toLowerCase();
  return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
}

export function getUserFriendlyErrorMessage(error) {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  if (isNetworkError(error)) {
    return '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요.';
  }

  if (error.code === 'ENOENT') {
    return '파일 또는 디렉토리를 찾을 수 없습니다.';
  }

  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return '파일 접근 권한이 없습니다. 관리자 권한이 필요할 수 있습니다.';
  }

  if (error.message && error.message.includes('electronAPI')) {
    return 'Electron API를 사용할 수 없습니다. 앱을 다시 시작해주세요.';
  }

  return error.message || '알 수 없는 오류가 발생했습니다.';
}