// Electron GUI 런처
// -----------------------------------------------------------------------------
// 일부 터미널/도구(예: VSCode 확장, 일부 CI)는 ELECTRON_RUN_AS_NODE=1 환경변수를
// 설정한다. 이 값이 설정된 상태로 electron.exe를 실행하면 GUI가 아닌 "순수 Node"로
// 동작하여 require('electron')이 API 객체 대신 실행 파일 경로 문자열을 반환한다.
// 그 결과 main.js의 `const { app } = require('electron')`에서 app이 undefined가 되고
// `app.on(...)` 호출 시 즉시 크래시하여 창이 전혀 뜨지 않는다("앱이 안 보임").
//
// 이 런처는 자식 electron 프로세스의 환경에서 해당 변수를 제거하여, 부모 터미널의
// 설정과 무관하게 항상 GUI 모드로 앱이 실행되도록 보장한다.
const { spawn } = require('child_process');

// electron npm 패키지는 실행 파일(electron.exe)의 절대 경로 문자열을 export 한다.
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// 프로젝트 루트를 앱 경로로 넘기고, 추가 인자(예: --url=...)를 그대로 전달
const args = ['.', ...process.argv.slice(2)];

const child = spawn(electronPath, args, { stdio: 'inherit', env });

child.on('close', (code) => process.exit(code == null ? 0 : code));
child.on('error', (err) => {
  console.error('Failed to launch Electron:', err);
  process.exit(1);
});
