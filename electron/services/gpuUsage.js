// @gpuUsage.js (1-10)
// 날짜: 2025-08-27
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. typeperf 명령어로 GPU 사용률 조회에 사용
//   사용 예: execAsync('typeperf "\\GPU Engine(*)\\Utilization Percentage" -sc 1 -si 1') - 모든 GPU 엔진 사용률 조회
//   execAsync('typeperf "\\GPU Engine(*_engtype_3D)\\Utilization Percentage" -sc 1 -si 1') - 3D 엔진 사용률 조회
//   -sc 1: 샘플 1개 수집, -si 1: 1초 간격
// - util: 유틸리티 함수 제공. util.promisify()로 콜백 기반 함수를 Promise로 변환
// typeperf 사용: Windows Performance Monitor 명령어로 GPU 성능 카운터 조회

const { exec } = require('child_process');
const util = require('util');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function getIntelGPUUsage() {
  try {
    const { stdout } = await execAsync('typeperf "\\GPU Engine(*)\\Utilization Percentage" -sc 1 -si 1', { timeout: 5000, encoding: 'utf8' });
    if (stdout) {
      const lines = stdout.split('\n').filter(l => l.trim() && l.includes(',') && !l.includes('"\\') && !l.includes('"Date"'));
      if (lines.length > 1) {
        let totalUsage = 0;
        let count = 0;
        for (const line of lines) {
          const match = line.match(/,\s*"([0-9.]+)"/);
          if (match) {
            const usage = parseFloat(match[1]) || 0;
            totalUsage += usage;
            count++;
          }
        }
        const avgUsage = count > 0 ? totalUsage / count : 0;
        const maxUsage = Math.min(100, Math.round(avgUsage));
        return maxUsage;
      }
    }
    try {
      const { stdout: stdout3D } = await execAsync('typeperf "\\GPU Engine(*_engtype_3D)\\Utilization Percentage" -sc 1 -si 1', { timeout: 5000, encoding: 'utf8' });
      if (stdout3D) {
        const lines = stdout3D.split('\n').filter(l => l.trim() && l.includes(',') && !l.includes('"\\'));
        if (lines.length > 1) {
          const lastLine = lines[lines.length - 1];
          const match = lastLine.match(/,\s*"([0-9.]+)"/);
          if (match) {
            const usage = parseFloat(match[1]) || 0;
            return Math.round(usage);
          }
        }
      }
    } catch (error3D) {
    }
    return 0;
  } catch (error) {
    console.error('Error getting GPU usage:', error);
    return 0;
  }
}

module.exports = {
  getIntelGPUUsage,
};