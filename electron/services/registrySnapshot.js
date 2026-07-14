// 최적화를 적용하기 "전"의 값을 그대로 찍어 두었다가, OFF에서 정확히 그 값으로 되돌린다.
//
// 왜 Windows 기본값이 아니라 스냅샷인가:
// 예전 구현은 OFF에서 하드코딩된 "Windows 기본값"을 써 넣었다. 그래서 원래 전원 계획을 고성능으로
// 쓰던 사용자가 ON을 켰다 끄면 균형 조정으로 바뀌어 버렸다 — 켜기 전엔 없던 설정을 OFF가 만들어낸
// 셈이다. 적용 직전 값을 저장해 두면 OFF는 진짜로 "되돌리기"가 된다.
//
// [중요] "값이 없었다"와 "값을 읽지 못했다"를 반드시 구분한다.
// 처음엔 값 하나당 `reg query /v <name>`을 한 번씩 돌렸는데, 앱이 바쁠 때 그중 하나가 타임아웃되면
// 그 값을 "원래 없었음"으로 단정했고 → OFF가 그 값을 지워 버렸다. 일시적인 읽기 실패가 사용자 설정
// 삭제로 이어진 것이다(실행할 때마다 결과가 달라짐).
//
// 그래서:
//   - 키 단위로 `reg query "<hive>\<path>"`를 한 번만 실행해 그 아래 값들을 한꺼번에 읽는다.
//   - reg.exe가 종료 코드 1로 끝나면 "키/값 없음"(정상) — 복원 시 삭제 대상.
//   - 타임아웃 등 그 외 실패는 "읽지 못함"으로 표시하고, 복원 때 그 값은 아예 건드리지 않는다.
//     되돌릴 기준을 모르는 값은 지우는 것보다 그대로 두는 편이 언제나 안전하다.

const { execAsync } = require('./_exec');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── 아래 세 함수는 순수 함수다(외부 명령 실행 없음). 위험한 규칙을 단위 테스트로 고정해 둔다. ──

// reg query 출력 한 줄:  "    MouseSpeed    REG_SZ    1"
// 이름 전체가 정확히 일치할 때만 매칭한다(MouseSpeed가 MouseSensitivity를 잡으면 안 된다).
function parseRegValue(stdout, name) {
  const match = stdout.match(
    new RegExp(`^\\s+${escapeRegExp(name)}\\s+(REG_\\w+)\\s+(.*?)\\s*$`, 'm')
  );
  return match ? { type: match[1], data: match[2] } : null;
}

// reg.exe 실패를 "값이 없다"와 "읽지 못했다"로 가른다.
// 종료 코드 1 = 키/값 없음(정상). 타임아웃/강제 종료 = 읽기 실패 → 절대 "없음"으로 단정하면 안 된다.
// (HKCU만 읽으므로 접근 거부는 발생하지 않는다. 메시지는 OS 언어에 따라 다르므로 종료 코드로 판단한다.)
function classifyQueryError(error) {
  if (!error.killed && error.code === 1) return 'missing';
  return 'unreadable';
}

// 스냅샷 항목 하나를 되돌리는 명령. null이면 "건드리지 말 것".
function restoreCommand(item) {
  // 찍을 때 읽지 못한 값 — 원래 상태를 모르므로 그대로 둔다. 지우면 사용자 설정이 날아간다.
  if (item.unreadable) return null;

  const key = `${item.hive}\\${item.regPath}`;
  return item.type === null
    ? `reg delete "${key}" /v ${item.name} /f`
    : `reg add "${key}" /v ${item.name} /t ${item.type} /d "${item.data}" /f`;
}

// 키 하나를 통째로 읽는다. 타임아웃 같은 일시적 실패는 한 번 더 시도한다.
async function queryKey(hive, regPath) {
  const command = `reg query "${hive}\\${regPath}"`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { stdout } = await execAsync(command, { timeout: 10000 });
      return { stdout, unreadable: false };
    } catch (error) {
      if (classifyQueryError(error) === 'missing') {
        return { stdout: '', unreadable: false };
      }
      // unreadable — 재시도
    }
  }

  return { stdout: '', unreadable: true };
}

// 적용 직전에 호출한다. entries: [{ hive, regPath, name }]
async function capture(entries) {
  // 같은 키에 속한 값들을 묶어 reg query 호출 수를 줄인다(=실패 가능성도 줄인다).
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.hive}\\${entry.regPath}`;
    if (!groups.has(key)) {
      groups.set(key, { hive: entry.hive, regPath: entry.regPath, names: [] });
    }
    groups.get(key).names.push(entry.name);
  }

  const snapshot = [];
  for (const group of groups.values()) {
    const { stdout, unreadable } = await queryKey(group.hive, group.regPath);

    for (const name of group.names) {
      const base = { hive: group.hive, regPath: group.regPath, name };

      if (unreadable) {
        // 되돌릴 기준을 모른다 — 복원 때 건드리지 않는다.
        snapshot.push({ ...base, unreadable: true });
        continue;
      }

      const value = parseRegValue(stdout, name);

      snapshot.push({
        ...base,
        // 적용 전에 없던 값이면 null — 복원 시 지워야 한다는 표시
        type: value ? value.type : null,
        data: value ? value.data : null,
      });
    }
  }

  return snapshot;
}

// 스냅샷을 그대로 다시 써 넣는다. 한 항목이 실패해도 나머지는 계속 복원한다.
async function restore(snapshot) {
  const result = { restored: 0, deleted: 0, skipped: 0, failed: 0 };
  if (!Array.isArray(snapshot)) return result;

  for (const item of snapshot) {
    const command = restoreCommand(item);

    if (command === null) {
      result.skipped++;
      continue;
    }

    const ok = await execAsync(command, { timeout: 5000 }).then(() => true).catch(() => false);

    if (!ok) result.failed++;
    else if (item.type === null) result.deleted++;
    else result.restored++;
  }

  return result;
}

// 활성 전원 계획 GUID. powercfg 출력: "전원 구성표 GUID: <guid>  (고성능)"
async function capturePowerPlan() {
  const { stdout } = await execAsync('powercfg /getactivescheme', { timeout: 5000 })
    .catch(() => ({ stdout: '' }));
  const match = stdout.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1] : null;
}

async function restorePowerPlan(guid) {
  if (!guid) return false;
  return execAsync(`powercfg /setactive ${guid}`, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
}

module.exports = {
  capture,
  restore,
  capturePowerPlan,
  restorePowerPlan,
  // 테스트용 순수 함수 — "읽기 실패를 값 없음으로 단정하지 않는다"는 규칙을 고정한다.
  parseRegValue,
  classifyQueryError,
  restoreCommand,
};
