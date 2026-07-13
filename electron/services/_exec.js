// @ts-check
// @_exec.js
// 공통 프로세스 실행 유틸리티. 기존에는 ~19개 서비스가 아래 execAsync 래퍼와
// PowerShell UTF-8 프리앰블, timeout 레이스 헬퍼를 각자 복붙해 사용했다.
// 여기서 한 번만 정의해 모든 서비스가 재사용한다. (DRY / 단일 책임)
//
// - execAsync(command, options): exec의 Promise 버전. 모든 호출에 기본 타임아웃(2분)과
//   버퍼(20MB)를 적용해 무한 대기와 1MB 기본 버퍼 초과 크래시를 방지한다.
//   호출부가 options로 값을 넘기면 그 값이 우선한다.
// - execFileAsync(file, args, options): 셸을 거치지 않는 실행. 사용자 입력을 인자로
//   전달할 때 사용해 명령 주입을 원천 차단한다.
// - executePowerShell(command, options): chcp 65001 + UTF-8 출력 인코딩 프리앰블을
//   붙여 PowerShell을 실행한다(한글 깨짐 방지). command는 신뢰 가능한 문자열만 전달할 것.
// - withTimeout(promise, ms, label): Promise.race 기반 타임아웃 래퍼.

const { exec, execFile } = require('child_process');
const { promisify } = require('util');

const _execRaw = promisify(exec);
const _execFileRaw = promisify(execFile);

const DEFAULT_OPTS = { timeout: 120000, maxBuffer: 1024 * 1024 * 20 };

const execAsync = (command, options = {}) => _execRaw(command, { ...DEFAULT_OPTS, ...options });

const execFileAsync = (file, args = [], options = {}) =>
  _execFileRaw(file, args, { ...DEFAULT_OPTS, ...options });

const executePowerShell = (command, options = {}) => {
  const encoded = `chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`;
  return execAsync(
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "${encoded}"`,
    { encoding: 'utf8', ...options }
  );
};

const withTimeout = (promise, ms, label = 'Timeout') =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);

module.exports = { execAsync, execFileAsync, executePowerShell, withTimeout, DEFAULT_OPTS };
