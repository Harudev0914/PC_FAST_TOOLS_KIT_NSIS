// @permissions.js (1-7)
// 날짜: 2025-06-25
// Import 모듈 설명:
// - platform (platformService): 플랫폼별 기능 제공. isAdmin() 함수로 관리자 권한 확인
//   사용 예: platformService.isAdmin() - 현재 관리자 권한 여부 확인 (boolean 반환)
// 이 모듈은 platformService의 관리자 권한 관련 기능을 래핑하여 제공하는 서비스 레이어

const platformService = require('./platform');

async function isAdmin() {
  return await platformService.isAdmin();
}

async function requestAdmin() {
  const isAdminStatus = await platformService.isAdmin();
  
  if (isAdminStatus) {
    return {
      success: true,
      message: '관리자 권한이 활성화되어 있습니다.',
      isAdmin: true,
    };
  }
  
  return {
    success: false,
    message: '관리자 권한이 필요합니다. 관리자 권한이 필요한 작업은 별도로 실행됩니다.',
    isAdmin: false,
    requiresElevation: true,
  };
}

async function confirmAction(action, details) {
  return {
    action,
    details,
    confirmed: true,
  };
}

module.exports = {
  isAdmin,
  requestAdmin,
  confirmAction,
};