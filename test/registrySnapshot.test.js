import { describe, it, expect } from 'vitest';

const { parseRegValue, classifyQueryError, restoreCommand } = (
  await import('../electron/services/registrySnapshot.js')
).default;

// 실제 reg query 출력 (Windows는 CRLF로 끝난다)
const REG_OUTPUT =
  '\r\nHKEY_CURRENT_USER\\Control Panel\\Desktop\r\n' +
  '    MenuShowDelay    REG_SZ    150\r\n' +
  '    MouseSpeed    REG_SZ    2\r\n' +
  '    MouseSensitivity    REG_SZ    10\r\n' +
  '    VisualFXSetting    REG_DWORD    0x3\r\n\r\n';

const KEY = { hive: 'HKCU', regPath: 'Control Panel\\Desktop' };

describe('reg query 출력 파싱', () => {
  it('값이 있으면 타입과 데이터를 뽑는다', () => {
    expect(parseRegValue(REG_OUTPUT, 'MenuShowDelay')).toEqual({ type: 'REG_SZ', data: '150' });
    expect(parseRegValue(REG_OUTPUT, 'VisualFXSetting')).toEqual({ type: 'REG_DWORD', data: '0x3' });
  });

  it('출력에 없는 값은 null이다', () => {
    expect(parseRegValue(REG_OUTPUT, 'AutoEndTasks')).toBeNull();
  });

  // 이름이 서로의 접두사인 값들을 혼동하면 엉뚱한 값을 복원하게 된다.
  it('이름이 접두사로 겹쳐도 정확히 그 값만 읽는다 (MouseSpeed vs MouseSensitivity)', () => {
    expect(parseRegValue(REG_OUTPUT, 'MouseSpeed')).toEqual({ type: 'REG_SZ', data: '2' });
    expect(parseRegValue(REG_OUTPUT, 'MouseSensitivity')).toEqual({ type: 'REG_SZ', data: '10' });
  });

  it('빈 출력이면 null이다', () => {
    expect(parseRegValue('', 'MenuShowDelay')).toBeNull();
  });
});

describe('reg query 실패 분류', () => {
  it('종료 코드 1은 "값 없음"이다 (reg.exe가 키/값을 못 찾은 정상 상황)', () => {
    expect(classifyQueryError({ code: 1, killed: false })).toBe('missing');
  });

  // 핵심: 타임아웃을 "값 없음"으로 단정하면, 복원 때 멀쩡한 사용자 설정을 지워 버린다.
  it('타임아웃(killed)은 "읽지 못함"이다 — 값 없음으로 단정하지 않는다', () => {
    expect(classifyQueryError({ killed: true })).toBe('unreadable');
  });

  it('종료 코드 1이라도 강제 종료됐으면 "읽지 못함"이다', () => {
    expect(classifyQueryError({ code: 1, killed: true })).toBe('unreadable');
  });

  it('알 수 없는 종료 코드는 "읽지 못함"이다 (안전한 쪽)', () => {
    expect(classifyQueryError({ code: 5, killed: false })).toBe('unreadable');
    expect(classifyQueryError({})).toBe('unreadable');
  });
});

describe('복원 명령 생성', () => {
  it('값이 있었으면 reg add로 그 값을 그대로 되돌린다', () => {
    const cmd = restoreCommand({ ...KEY, name: 'MenuShowDelay', type: 'REG_SZ', data: '150' });

    expect(cmd).toContain('reg add');
    expect(cmd).toContain('/v MenuShowDelay');
    expect(cmd).toContain('/t REG_SZ');
    expect(cmd).toContain('/d "150"');
  });

  it('켜기 전에 없던 값(type=null)은 reg delete로 지운다', () => {
    const cmd = restoreCommand({ ...KEY, name: 'GameDVR_EFSEFeatureFlags', type: null, data: null });

    expect(cmd).toContain('reg delete');
    expect(cmd).toContain('/v GameDVR_EFSEFeatureFlags');
  });

  // 회귀 방지의 핵심.
  // 예전엔 값 하나당 reg query를 돌렸는데, 앱이 바쁠 때 하나가 타임아웃되면 "원래 없음"으로 단정했고
  // OFF가 그 값을 삭제해 버렸다(HungAppTimeout, WaitToKillAppTimeout이 실제로 날아갔다).
  it('읽지 못한 값(unreadable)은 아무 명령도 만들지 않는다 — 절대 지우지 않는다', () => {
    expect(restoreCommand({ ...KEY, name: 'HungAppTimeout', unreadable: true })).toBeNull();
  });
});
