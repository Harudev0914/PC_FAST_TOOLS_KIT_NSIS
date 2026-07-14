import { describe, it, expect, vi } from 'vitest';

// deltaForceCleaner는 electron의 app을 require한다 — 테스트에서는 스텁으로 대체한다.
vi.mock('electron', () => ({ app: { getPath: () => '' } }));

// CJS 모듈이라 default를 통해 꺼낸다.
const cleaner = (await import('../electron/services/deltaForceCleaner.js')).default;
const { isSafeToDeleteTempEntry } = cleaner;

// 앱이 자기 임시 파일을 지워 렌더러를 죽였던 회귀를 고정한다.
// cutoff = min(앱 시작 시각, 지금-1시간) 이며, 이보다 나중에 수정된 항목은 절대 지우지 않는다.
describe('임시 파일 정리 가드', () => {
  const CUTOFF = 1_000_000;
  const TEMP = 'C:\\Users\\me\\AppData\\Local\\Temp';

  it('cutoff보다 오래된 항목은 삭제 대상이다', () => {
    expect(isSafeToDeleteTempEntry(`${TEMP}\\old-junk`, CUTOFF - 1, CUTOFF, [])).toBe(true);
  });

  it('앱이 켜진 뒤 만들어진 항목(cutoff 이후)은 건드리지 않는다', () => {
    expect(isSafeToDeleteTempEntry(`${TEMP}\\chrome-scratch`, CUTOFF + 1, CUTOFF, [])).toBe(false);
  });

  it('cutoff와 정확히 같은 시각도 건드리지 않는다 (경계)', () => {
    expect(isSafeToDeleteTempEntry(`${TEMP}\\edge`, CUTOFF, CUTOFF, [])).toBe(false);
  });

  it('보호 경로 자신은 오래됐어도 지우지 않는다', () => {
    const protectedPaths = [`${TEMP}\\ptimizer-data`.toLowerCase()];
    expect(
      isSafeToDeleteTempEntry(`${TEMP}\\ptimizer-data`, CUTOFF - 1, CUTOFF, protectedPaths)
    ).toBe(false);
  });

  // 핵심: 조상 디렉터리를 지우면 그 안의 보호 경로까지 함께 날아간다.
  it('보호 경로를 품고 있는 조상 디렉터리도 지우지 않는다', () => {
    const protectedPaths = [`${TEMP}\\outer\\inner\\userdata`.toLowerCase()];
    expect(
      isSafeToDeleteTempEntry(`${TEMP}\\outer`, CUTOFF - 1, CUTOFF, protectedPaths)
    ).toBe(false);
  });

  it('보호 경로와 무관한 형제 디렉터리는 지운다', () => {
    const protectedPaths = [`${TEMP}\\outer\\userdata`.toLowerCase()];
    expect(
      isSafeToDeleteTempEntry(`${TEMP}\\other`, CUTOFF - 1, CUTOFF, protectedPaths)
    ).toBe(true);
  });

  // 이름이 접두사로만 겹치는 경우(outer vs outer-backup)를 조상으로 오인하면 안 된다.
  it('이름이 접두사로 겹치기만 하는 디렉터리는 조상이 아니다', () => {
    const protectedPaths = [`${TEMP}\\outer\\userdata`.toLowerCase()];
    expect(
      isSafeToDeleteTempEntry(`${TEMP}\\outer-backup`, CUTOFF - 1, CUTOFF, protectedPaths)
    ).toBe(true);
  });

  it('대소문자가 달라도 보호 경로로 인식한다 (Windows 경로)', () => {
    const protectedPaths = [`${TEMP}\\ptimizer-data`.toLowerCase()];
    expect(
      isSafeToDeleteTempEntry(`${TEMP}\\PTIMIZER-DATA`, CUTOFF - 1, CUTOFF, protectedPaths)
    ).toBe(false);
  });
});
