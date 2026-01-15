// ---------
// 2025-08-18
// 개발자 : KR_Tuki
// 기능 : 데이터 캐싱 서비스 (정적/동적 데이터 캐시 관리)
// ---------

// @cache.js (1-30)
// 날짜: 2025-08-18
// 변수 설명:
//   - cache: 캐시 데이터를 저장하는 객체
//     * static: 정적 데이터 캐시 객체 (변경 빈도가 낮은 데이터: cpu, memory, disk, gpu, network 하드웨어 정보)
//     * dynamic: 동적 데이터 캐시 객체 (변경 빈도가 높은 데이터: cpuUsage, memoryUsage, diskUsage, gpuUsage, networkStats 사용률 정보)
//     * timestamps: 캐시 저장 시각 객체 (static, dynamic 각각의 타임스탬프)
//     * ttl: Time To Live (캐시 유효 시간) 객체
//       - static: 5분 (5 * 60 * 1000 밀리초) - 정적 데이터는 5분간 유효
//       - dynamic: 1초 (1000 밀리초) - 동적 데이터는 1초간 유효
// 이 모듈은 메모리 내 캐시를 제공하여 반복적인 시스템 정보 조회 시 성능 최적화

const cache = {
  static: {
    cpu: null,
    memory: null,
    disk: null,
    gpu: null,
    network: null,
  },
  dynamic: {
    cpuUsage: null,
    memoryUsage: null,
    diskUsage: null,
    gpuUsage: null,
    networkStats: null,
  },
  timestamps: {
    static: 0,
    dynamic: 0,
  },
  ttl: {
    static: 5 * 60 * 1000,
    dynamic: 1000,
  },
};

// @cache.js (32-56)
// getStaticCache 함수: 정적 데이터 캐시 조회
// 매개변수: key - 캐시 키 (cpu, memory, disk, gpu, network)
// 반환값: 캐시된 값 또는 null (캐시가 없거나 만료된 경우)
// 변수 설명:
//   - now: 현재 시각(밀리초)
//   - cache.static[key]: 정적 캐시에서 key에 해당하는 값
//   - (now - cache.timestamps.static): 캐시 저장 후 경과 시간
//   - cache.ttl.static: 정적 캐시 유효 시간 (5분)
// TTL 검사: 경과 시간이 TTL보다 작으면 캐시 유효, 그렇지 않으면 null 반환

function getStaticCache(key) {
  const now = Date.now();
  if (cache.static[key] && (now - cache.timestamps.static) < cache.ttl.static) {
    return cache.static[key];
  }
  return null;
}

// setStaticCache 함수: 정적 데이터 캐시 저장
// 매개변수: key - 캐시 키, value - 저장할 값
// cache.timestamps.static을 현재 시각으로 업데이트하여 TTL 계산 기준점 설정

function setStaticCache(key, value) {
  cache.static[key] = value;
  cache.timestamps.static = Date.now();
}

// getDynamicCache 함수: 동적 데이터 캐시 조회
// 매개변수: key - 캐시 키 (cpuUsage, memoryUsage, diskUsage, gpuUsage, networkStats)
// 반환값: 캐시된 값 또는 null
// 동적 캐시는 1초 TTL로 매우 짧은 시간 동안만 유효 (빠르게 변경되는 사용률 데이터)

function getDynamicCache(key) {
  const now = Date.now();
  if (cache.dynamic[key] && (now - cache.timestamps.dynamic) < cache.ttl.dynamic) {
    return cache.dynamic[key];
  }
  return null;
}

// setDynamicCache 함수: 동적 데이터 캐시 저장
// 매개변수: key - 캐시 키, value - 저장할 값
// cache.timestamps.dynamic을 현재 시각으로 업데이트

function setDynamicCache(key, value) {
  cache.dynamic[key] = value;
  cache.timestamps.dynamic = Date.now();
}

function clearCache() {
  cache.static = {
    cpu: null,
    memory: null,
    disk: null,
    gpu: null,
    network: null,
  };
  cache.dynamic = {
    cpuUsage: null,
    memoryUsage: null,
    diskUsage: null,
    gpuUsage: null,
    networkStats: null,
  };
  cache.timestamps = {
    static: 0,
    dynamic: 0,
  };
}

function clearCacheKey(key, type = 'static') {
  if (type === 'static') {
    cache.static[key] = null;
  } else {
    cache.dynamic[key] = null;
  }
}

module.exports = {
  getStaticCache,
  setStaticCache,
  getDynamicCache,
  setDynamicCache,
  clearCache,
  clearCacheKey,
};