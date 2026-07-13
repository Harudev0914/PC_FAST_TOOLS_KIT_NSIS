// @ts-check
// @wingetParse.js
// winget `upgrade` 출력(고정폭 표)을 파싱하는 순수 함수. IO가 없어 단위 테스트가 쉽다.
// 헤더가 OS 언어에 따라 달라지므로 구분선(---) 아래 각 행을 2칸 이상 공백으로 분할하고,
// 이름에 공백이 있을 수 있어 뒤에서부터(Source/Available/Version/Id) 고정 열을 떼어낸다.

/**
 * @typedef {Object} WingetPackage
 * @property {string} name
 * @property {string} id
 * @property {string} currentVersion
 * @property {string} latestVersion
 * @property {string} source
 */

/**
 * winget `upgrade` 표 출력을 파싱한다.
 * @param {string} stdout
 * @returns {WingetPackage[]}
 */
function parseWingetUpgradeTable(stdout) {
  const lines = String(stdout).split(/\r?\n/);
  const sepIndex = lines.findIndex((l) => /^-{5,}/.test(l.trim()));
  if (sepIndex < 0) return [];
  const rows = [];
  for (let i = sepIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    // 진행률/요약 꼬리 줄(예: "N upgrades available.") 제외
    if (/available|upgrad|business|package/i.test(line) && !/\S\s{2,}\S/.test(line)) continue;
    const cols = line.trim().split(/\s{2,}/);
    if (cols.length < 4) continue;
    const source = cols[cols.length - 1];
    const available = cols[cols.length - 2];
    const version = cols[cols.length - 3];
    const id = cols[cols.length - 4];
    const name = cols.slice(0, cols.length - 4).join(' ') || id;
    // 버전 칸이 실제 버전처럼 보이는지 최소 검증(숫자 포함)
    if (!/\d/.test(version) || !/\d|unknown/i.test(available)) continue;
    rows.push({ name, id, currentVersion: version, latestVersion: available, source });
  }
  return rows;
}

module.exports = { parseWingetUpgradeTable };
