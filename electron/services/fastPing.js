// @fastPing.js
// Fast Ping 버튼(일괄 최적화 → 일괄 가속화 → 핑 최적화)이 호출하는 최적화들.
//
// 이 앱은 사용자 권한으로만 동작한다 — HKLM 레지스트리(TCP 튜닝, Prefetch, 오디오 향상 끄기)처럼
// 관리자 권한이 필요한 항목은 UAC 없이는 어차피 실패하므로 아예 넣지 않는다.
//
// execAsync는 종료 코드가 0이 아니면 reject한다. 따라서 성공 플래그와 operations 메시지는
// await가 성공한 뒤에만 설정한다 — 실패한 작업을 성공했다고 보고하지 않기 위해서다.

const { execAsync } = require('./_exec');

async function batchOptimize() {
  const results = {
    success: true,
    mode: 'batch',
    operations: [],
    errors: [],
    cpuOptimized: false,
    memoryOptimized: false,
    diskOptimized: false,
    networkOptimized: false,
  };

  try {
    // 1. CPU 최적화
    try {
      const cpuService = require('./cpu');
      const cpuResult = await cpuService.optimize();
      if (cpuResult && cpuResult.success) {
        results.cpuOptimized = true;
        results.operations.push('CPU 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'cpuOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 2. 메모리 최적화
    try {
      const memoryService = require('./memory');
      const memoryResult = await memoryService.optimize();
      if (memoryResult && memoryResult.success) {
        results.memoryOptimized = true;
        results.operations.push('메모리 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'memoryOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 3. 디스크 최적화
    try {
      const diskService = require('./disk');
      const diskResult = await diskService.optimize();
      if (diskResult && diskResult.success) {
        results.diskOptimized = true;
        results.operations.push('디스크 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'diskOptimization', error: error?.message || '알 수 없는 오류' });
    }

    // 4. 네트워크 최적화
    try {
      const networkService = require('./network');
      const networkResult = await networkService.optimize({ adapterType: 'ethernet' });
      if (networkResult && networkResult.success) {
        results.networkOptimized = true;
        results.operations.push('네트워크 최적화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'networkOptimization', error: error?.message || '알 수 없는 오류' });
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error?.message || '알 수 없는 오류',
    };
  }
}

// 일괄 가속화 (시스템 가속화 작업들)
async function batchAccelerate() {
  const results = {
    success: true,
    mode: 'accelerate',
    operations: [],
    errors: [],
    cpuAccelerated: false,
    memoryAccelerated: false,
    diskAccelerated: false,
    networkAccelerated: false,
  };

  try {
    // 1. CPU 가속화 (고성능 모드)
    // 실패 시 execAsync가 reject 되므로 cpuAccelerated는 실제 성공 시에만 true
    try {
      await execAsync('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c');

      results.cpuAccelerated = true;
      results.operations.push('CPU 고성능 모드 활성화 완료');
    } catch (error) {
      results.errors.push({ action: 'cpuAcceleration', error: error?.message || '알 수 없는 오류' });
    }

    // 2. 메모리 가속화
    try {
      const memoryService = require('./memory');
      const memoryResult = await memoryService.optimize();
      if (memoryResult && memoryResult.success) {
        results.memoryAccelerated = true;
        results.operations.push('메모리 가속화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'memoryAcceleration', error: error?.message || '알 수 없는 오류' });
    }

    // 3. 네트워크 가속화
    try {
      const networkService = require('./network');
      const networkResult = await networkService.optimize({ adapterType: 'ethernet' });
      if (networkResult && networkResult.success) {
        results.networkAccelerated = true;
        results.operations.push('네트워크 가속화 완료');
      }
    } catch (error) {
      results.errors.push({ action: 'networkAcceleration', error: error?.message || '알 수 없는 오류' });
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error?.message || '알 수 없는 오류',
    };
  }
}

// 핑 최적화 (네트워크 지연 시간 최소화)
async function pingOptimize() {
  const results = {
    success: true,
    mode: 'ping',
    operations: [],
    errors: [],
    pingOptimized: false,
    dnsFlush: false,
    tcpOptimized: false,
  };

  try {
    // 1. DNS 캐시 정리
    try {
      await execAsync('ipconfig /flushdns');
      results.dnsFlush = true;
      results.operations.push('DNS 캐시 정리 완료');
    } catch (error) {
      results.errors.push({ action: 'dnsFlush', error: error?.message || '알 수 없는 오류' });
    }

    return results;
  } catch (error) {
    return {
      ...results,
      success: false,
      error: error?.message || '알 수 없는 오류',
    };
  }
}

module.exports = {
  batchOptimize,
  batchAccelerate,
  pingOptimize,
};
