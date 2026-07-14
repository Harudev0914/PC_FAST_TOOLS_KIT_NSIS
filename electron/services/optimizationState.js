// 최적화 토글(Game Mode / Windows Boost)의 적용 여부와, 적용 직전의 원래 설정을 파일에 보관한다.
//
// 렌더러의 각 패널은 메뉴를 옮길 때마다 언마운트되므로(MainPage가 조건부 렌더링) 로컬 state가
// 사라진다. 메인 프로세스의 메모리 변수만 쓰면 페이지 이동은 버티지만 앱을 다시 켜면 초기화된다.
// 실제 최적화는 레지스트리에 남아 있는데 UI만 OFF로 보이는 상태가 되므로, 파일로 남긴다.
//
// snapshot: ON을 누르기 직전의 레지스트리/전원 계획 값. OFF는 이 값으로 되돌린다.
// 앱을 껐다 켜도 되돌릴 수 있어야 하므로 메모리가 아니라 여기에 함께 저장한다.
//
// 레지스트리를 역으로 읽어 적용 여부를 판정하지 않는 이유: Game Mode와 Windows Boost가
// GameDVR_Enabled·VisualFXSetting 같은 키를 공유해서, 레지스트리만 봐서는 둘 중 무엇이 켠
// 것인지 구분할 수 없다.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const stateFile = () => path.join(app.getPath('userData'), 'optimization-state.json');

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // 파일이 없거나 깨졌으면 "아무것도 적용되지 않음"으로 본다.
    return {};
  }
}

function writeAll(state) {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    // 저장에 실패해도 최적화 자체는 이미 적용됐다 — 기능을 막지 않고 로그만 남긴다.
    console.error('Failed to persist optimization state:', error);
  }
}

function isEnabled(key) {
  return readAll()[key]?.enabled === true;
}

// ON: 적용 직전 스냅샷과 함께 켜짐으로 기록한다.
function markEnabled(key, snapshot) {
  const state = readAll();
  state[key] = { enabled: true, snapshot };
  writeAll(state);
}

// OFF: 스냅샷을 버리고 꺼짐으로 기록한다.
function markDisabled(key) {
  const state = readAll();
  state[key] = { enabled: false };
  writeAll(state);
}

// OFF에서 되돌릴 스냅샷. ON을 거치지 않았거나 파일이 없으면 null.
function getSnapshot(key) {
  return readAll()[key]?.snapshot || null;
}

module.exports = {
  isEnabled,
  markEnabled,
  markDisabled,
  getSnapshot,
};
