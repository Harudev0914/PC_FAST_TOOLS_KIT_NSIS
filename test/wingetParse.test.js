import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parseWingetUpgradeTable } = require('../electron/services/wingetParse.js');

// 실제 winget 출력을 본뜬 픽스처. 헤더가 한국어여도(언어 무관) 파싱돼야 한다.
const SAMPLE = [
  "'msstore' 원본을 사용하려면 계약에 동의해야 합니다.",
  'Terms of Transaction: https://aka.ms/microsoft-store-terms-of-transaction',
  '',
  '이름                        ID                    버전            사용 가능        원본',
  '-----------------------------------------------------------------------------------------',
  'Bandizip                    Bandisoft.Bandizip    7.32            7.44            winget',
  'Google Chrome               Google.Chrome.EXE     150.0.7871.101  150.0.7871.115  winget',
  'NVIDIA PhysX 시스템 소프트웨어  Nvidia.PhysX          9.21.0713       9.23.1019       winget',
  '3 upgrades available.',
].join('\n');

describe('parseWingetUpgradeTable', () => {
  it('parses rows below the dashed separator regardless of header language', () => {
    const rows = parseWingetUpgradeTable(SAMPLE);
    expect(rows.length).toBe(3);
  });

  it('extracts name/id/version/available/source by fixed trailing columns', () => {
    const rows = parseWingetUpgradeTable(SAMPLE);
    const chrome = rows.find((r) => r.id === 'Google.Chrome.EXE');
    expect(chrome).toMatchObject({
      name: 'Google Chrome',
      currentVersion: '150.0.7871.101',
      latestVersion: '150.0.7871.115',
      source: 'winget',
    });
  });

  it('keeps multi-word (space-containing) names intact', () => {
    const rows = parseWingetUpgradeTable(SAMPLE);
    const physx = rows.find((r) => r.id === 'Nvidia.PhysX');
    expect(physx.name).toContain('NVIDIA PhysX');
  });

  it('drops the summary tail line ("N upgrades available.")', () => {
    const rows = parseWingetUpgradeTable(SAMPLE);
    expect(rows.some((r) => /upgrades available/i.test(r.name))).toBe(false);
  });

  it('returns [] when there is no separator line', () => {
    expect(parseWingetUpgradeTable('no table here')).toEqual([]);
    expect(parseWingetUpgradeTable('')).toEqual([]);
  });

  it('tolerates non-string input', () => {
    expect(parseWingetUpgradeTable(undefined)).toEqual([]);
    expect(parseWingetUpgradeTable(null)).toEqual([]);
  });
});
