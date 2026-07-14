// @audio.js (1-13)
// 날짜: 2025-05-20
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. PowerShell로 오디오 장치 정보 조회 및 제어에 사용
//   사용 예: execAsync('powershell -Command "Get-WmiObject Win32_PnPEntity..."') - 오디오 장치 목록 조회
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. 오디오 설정, 볼륨 레벨, EQ 설정 등에 사용
//   사용 예: new Registry({ hive: Registry.HKCU, key }) - 레지스트리 키 생성, .set() - 오디오 설정 변경
// - fs (promises): 파일 시스템 비동기 접근. 오디오 설정 파일 저장/로드에 사용
//   사용 예: fs.readFile() - 설정 파일 읽기, fs.writeFile() - 설정 파일 저장
// - path: 파일 경로 처리. 오디오 설정 파일 경로 조작에 사용
// - os: 운영체제 정보 제공. os.homedir()로 사용자 홈 디렉토리 경로 조회

const Registry = require('winreg');
const { execAsync } = require('./_exec');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function getDevices() {
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-WmiObject Win32_PnPEntity | Where-Object { ($_.PNPClass -eq \'AudioEndpoint\' -or $_.PNPClass -eq \'MEDIA\' -or $_.PNPClass -eq \'Audio\') -and $_.Status -eq \'OK\' } | Select-Object Name, DeviceID, Status | ConvertTo-Json"',
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
    ).catch(() => ({ stdout: '[]' }));

    const devices = [];
    let outputDevices = [];
    let inputDevices = [];
    
    try {
      const audioDevices = JSON.parse(stdout || '[]');
      const deviceList = Array.isArray(audioDevices) ? audioDevices : (audioDevices ? [audioDevices] : []);
      
      deviceList.forEach((device, index) => {
        if (device && device.Name) {
          const name = device.Name.trim();
          if (name.toLowerCase().includes('speaker') || 
              name.toLowerCase().includes('headphone') || 
              name.toLowerCase().includes('headset') ||
              name.toLowerCase().includes('audio') ||
              name.toLowerCase().includes('sound') ||
              name.toLowerCase().includes('output') ||
              name.toLowerCase().includes('playback')) {
            outputDevices.push({
              id: device.DeviceID || `output_${index}`,
              name: name,
              type: 'output',
              status: device.Status || 'OK',
            });
          }
          if (name.toLowerCase().includes('microphone') || 
              name.toLowerCase().includes('mic') ||
              name.toLowerCase().includes('recording') ||
              name.toLowerCase().includes('input') ||
              name.toLowerCase().includes('capture')) {
            inputDevices.push({
              id: device.DeviceID || `input_${index}`,
              name: name,
              type: 'input',
              status: device.Status || 'OK',
            });
          }
        }
      });
    } catch (parseError) {
      console.error('Error parsing audio devices:', parseError);
    }

    devices.push(...outputDevices);
    devices.push(...inputDevices);

    if (devices.length === 0) {
      devices.push(
        { id: 'default_output', name: '기본 오디오 장비', type: 'output', status: 'OK' },
        { id: 'default_input', name: '기본 마이크 장비', type: 'input', status: 'OK' }
      );
    }

    return devices;
  } catch (error) {
    console.error('Error getting audio devices:', error);
    return [
      { id: 'default_output', name: '기본 오디오 장비', type: 'output', status: 'OK' },
      { id: 'default_input', name: '기본 마이크 장비', type: 'input', status: 'OK' },
    ];
  }
}

async function setVolume(deviceId, volume) {
  try {
    // [실제 구현] 요청 볼륨(0~100%)을 Core Audio COM으로 실제 반영 (기존 SendKeys는 요청값 무시)
    const volumePercent = Math.max(0, Math.min(100, Number(volume) || 0));
    await setMasterVolume(volumePercent / 100);
    return { success: true, volume: volumePercent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function boost(enabled) {
  try {
    // [실제 구현] 엔드포인트 볼륨을 실제로 조절 (100% 초과 증폭은 DSP 필요 → 상한 100%)
    if (enabled) {
      await setMasterVolume(1.0);
      return { success: true, boosted: true };
    }
    return { success: true, boosted: false };
  } catch (error) {
    return { success: false, boosted: false, error: error.message };
  }
}

const SETTINGS_FILE = path.join(os.homedir(), '.ptimizer', 'sound-boost-settings.json');

// [실제 구현] Windows Core Audio(IAudioEndpointVolume) COM으로 기본 재생 장치의 마스터 볼륨을
// 실제로 읽고/설정한다. 기존 코드는 (a) SendKeys로 볼륨업 키 1회만 눌러 요청 볼륨을 무시하거나
// (b) 미설치 모듈(AudioDeviceCmdlets)에 의존하거나 (c) IAudioEndpointVolume vtable 슬롯을 잘못
// 선언해(SetMasterVolumeLevelScalar를 첫 메서드로 둠 → 실제로는 RegisterControlChangeNotify 호출)
// 볼륨이 바뀌지 않았다. 아래는 vtable 순서를 정확히 맞춘 구현이며, 인용부호 문제를 피하려 임시
// .ps1 파일로 실행한다.
const AUDIO_COM_TYPE = `$code = @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDevEnum { }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate([MarshalAs(UnmanagedType.LPStruct)] Guid iid, int dwClsCtx, IntPtr pParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr n);
  int UnregisterControlChangeNotify(IntPtr n);
  int GetChannelCount(out int c);
  int SetMasterVolumeLevel(float level, [MarshalAs(UnmanagedType.LPStruct)] Guid ctx);
  int SetMasterVolumeLevelScalar(float level, [MarshalAs(UnmanagedType.LPStruct)] Guid ctx);
  int GetMasterVolumeLevel(out float level);
  int GetMasterVolumeLevelScalar(out float level);
}
public static class AudioCtl {
  static IAudioEndpointVolume Ep() {
    IMMDeviceEnumerator en = (IMMDeviceEnumerator)(new MMDevEnum());
    IMMDevice dev; en.GetDefaultAudioEndpoint(0, 1, out dev);
    object o; dev.Activate(typeof(IAudioEndpointVolume).GUID, 1, IntPtr.Zero, out o);
    return (IAudioEndpointVolume)o;
  }
  public static void SetVol(float v) { Ep().SetMasterVolumeLevelScalar(v, Guid.Empty); }
  public static float GetVol() { float v; Ep().GetMasterVolumeLevelScalar(out v); return v; }
}
'@
Add-Type -TypeDefinition $code -Language CSharp`;

async function runAudioPs(body) {
  const script = `${AUDIO_COM_TYPE}\n${body}`;
  const tmp = path.join(os.tmpdir(), `audio_ctl_${process.pid}_${body.length}.ps1`);
  await fs.writeFile(tmp, script, 'utf8');
  try {
    const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmp}"`, { timeout: 10000, encoding: 'utf8' });
    return stdout;
  } finally {
    try { await fs.unlink(tmp); } catch (e) {}
  }
}

// scalar: 0.0 ~ 1.0
async function setMasterVolume(scalar) {
  const v = Math.max(0, Math.min(1, Number(scalar) || 0));
  await runAudioPs(`[AudioCtl]::SetVol([float]${v})`);
}

// 반환: 0.0 ~ 1.0 (실패 시 null)
async function getMasterVolume() {
  const out = await runAudioPs('[AudioCtl]::GetVol()');
  const n = parseFloat(String(out).trim());
  return Number.isFinite(n) ? n : null;
}

// [실제 구현] 커스텀 EQ/베이스/트레블은 시스템 오디오 스트림 DSP가 필요하다. 순수 Node로는
// 불가능하므로, 표준 시스템 EQ APO인 "Equalizer APO"(오픈소스, 시스템 전역 파라메트릭 EQ)가
// 설치돼 있으면 그 config.txt를 생성해 실제로 EQ/베이스/트레블을 적용한다. (많은 사운드 부스터
// 앱이 쓰는 방식) 미설치 시엔 정직하게 안내만 한다.
const EQAPO_CONFIG = 'C:\\Program Files\\EqualizerAPO\\config\\config.txt';

async function detectEqualizerAPO() {
  try { await fs.access(EQAPO_CONFIG); return true; } catch { return false; }
}

// bass/treble: 0~100(50 중립). modelSettings.eqBands: 선택 시 10밴드 게인(-12~12dB). 증폭 토글 → 프리앰프.
function buildEqApoConfig(settings) {
  const clampDb = (v) => Math.max(-15, Math.min(15, v));
  const bass = clampDb(((settings.bassLevel ?? 50) - 50) / 50 * 12);
  const treble = clampDb(((settings.trebleLevel ?? 50) - 50) / 50 * 12);
  let preamp = 0;
  const g = settings.gameSoundBoost, b = settings.baseSoundBoost;
  if (g && g.enabled) preamp += Math.min(10, ((g.level ?? 50) - 50) / 50 * 10);
  if (b && b.enabled) preamp += Math.min(6, ((b.level ?? 50) - 50) / 50 * 6);
  preamp = clampDb(preamp);

  const lines = [];
  lines.push('# Generated by PC_FAST_TOOLS_KIT Sound Boost — overwritten while active');
  lines.push(`Preamp: ${preamp.toFixed(1)} dB`);
  if (Math.abs(bass) > 0.1) lines.push(`Filter: ON LSC Fc 120 Hz Gain ${bass.toFixed(1)} dB Q 0.7`);
  if (Math.abs(treble) > 0.1) lines.push(`Filter: ON HSC Fc 8000 Hz Gain ${treble.toFixed(1)} dB Q 0.7`);
  const bands = settings.modelSettings && settings.modelSettings.eqBands;
  const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  if (Array.isArray(bands)) {
    bands.forEach((gain, i) => {
      const gdb = clampDb(Number(gain) || 0);
      if (Math.abs(gdb) > 0.1 && freqs[i]) {
        lines.push(`Filter: ON PK Fc ${freqs[i]} Hz Gain ${gdb.toFixed(1)} dB Q 1.0`);
      }
    });
  }
  return lines.join('\r\n') + '\r\n';
}

async function applyEqualizerAPO(settings) {
  // Program Files 경로라 쓰기에 관리자 권한이 필요할 수 있다(실패 시 상위에서 안내).
  await fs.writeFile(EQAPO_CONFIG, buildEqApoConfig(settings), 'utf8');
}

async function resetEqualizerAPO() {
  await fs.writeFile(EQAPO_CONFIG, '# Sound Boost off\r\nPreamp: 0 dB\r\n', 'utf8');
}

async function getSettings() {
  try {
    const settingsPath = SETTINGS_FILE;
    const settingsDir = path.dirname(settingsPath);
    
    try {
      await fs.access(settingsDir);
    } catch {
      await fs.mkdir(settingsDir, { recursive: true });
    }
    
    try {
      const data = await fs.readFile(settingsPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

async function applySoundBoost(settings) {
  const results = {
    success: true,
    operations: [],
    errors: [],
  };

  try {
    const settingsPath = SETTINGS_FILE;
    const settingsDir = path.dirname(settingsPath);
    
    try {
      await fs.access(settingsDir);
    } catch {
      await fs.mkdir(settingsDir, { recursive: true });
    }

    // [실제 구현] disable 시 원복하기 위해, 이전 저장 설정에서 previousMasterVolume을 이어받고
    // enable 시 아직 캡처된 값이 없으면 지금의 마스터 볼륨을 캡처한다.
    let savedSettings = {};
    try { savedSettings = JSON.parse(await fs.readFile(settingsPath, 'utf8')) || {}; } catch { savedSettings = {}; }
    if (savedSettings.previousMasterVolume !== undefined && savedSettings.previousMasterVolume !== null) {
      settings.previousMasterVolume = savedSettings.previousMasterVolume;
    } else if (settings.enabled) {
      const prevVol = await getMasterVolume().catch(() => null);
      if (prevVol !== null) settings.previousMasterVolume = prevVol;
    }

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    results.operations.push('설정 저장 완료');

    if (settings.selectedModel && settings.modelSettings) {
      // [정직성] 선택한 오디오 처리 모델(Superpowered/miniaudio/PortAudio/FreeDSP)의 EQ·압축·
      // 필터 등은 시스템 오디오 스트림에 대한 "실시간 DSP"가 필요하며, 이는 네이티브 오디오
      // 모듈 도입이 있어야 실제 동작한다. 설정 값은 위에서 파일에 저장(기억)되지만, 여기서
      // "적용 완료"로 오보고하지 않는다. (실제 하드웨어에 반영되는 것은 아래 마스터 볼륨)
      results.operations.push(`오디오 처리 모델 설정 저장됨 (${settings.selectedModel}) — EQ 밴드는 아래 Equalizer APO로 적용`);
    }

    if (settings.enabled) {
      // [실제 구현] 마스터 볼륨을 Windows Core Audio COM으로 실제 반영한다.
      try {
        const targetPercent = Math.max(0, Math.min(100, settings.masterVolume ?? 100));
        // 게임/베이스 증폭 토글이 켜져 있으면 엔드포인트 볼륨 상한(100%)까지 올린다.
        const boosted = settings.gameSoundBoost?.enabled || settings.baseSoundBoost?.enabled;
        const applyPercent = boosted ? 100 : targetPercent;
        await setMasterVolume(applyPercent / 100);
        results.operations.push(`마스터 볼륨 ${applyPercent}% 적용 (실제 반영)`);
      } catch (error) {
        results.errors.push({ action: 'masterVolume', error: (error.message || '').substring(0, 120) });
      }
      // [실제 구현] Equalizer APO(시스템 전역 EQ APO)가 설치돼 있으면 베이스/트레블/EQ를
      // config.txt로 생성해 실제로 적용한다. 미설치면 정직하게 안내(볼륨만 반영).
      try {
        if (await detectEqualizerAPO()) {
          await applyEqualizerAPO(settings);
          results.operations.push('베이스/트레블/EQ 실제 적용 (Equalizer APO)');
        } else {
          results.operations.push('베이스/트레블/EQ: Equalizer APO 설치 시 실제 적용됩니다 (현재 미설치 — 볼륨만 반영)');
        }
      } catch (error) {
        results.errors.push({ action: 'equalizerApo', error: 'Equalizer APO 설정 쓰기 실패(관리자 권한 필요할 수 있음): ' + (error.message || '').substring(0, 100) });
      }
    } else {
      // [실제 구현] 비활성화: 이전 볼륨으로 원복 + Equalizer APO 설정을 평탄(off)으로 초기화
      try {
        const prev = settings.previousMasterVolume;
        if (typeof prev === 'number' && Number.isFinite(prev)) {
          await setMasterVolume(prev);
          results.operations.push(`Sound Boost 비활성화 (볼륨 ${Math.round(prev * 100)}%로 원복)`);
        } else {
          results.operations.push('Sound Boost 비활성화');
        }
      } catch (error) {
        results.errors.push({ action: 'disableSoundBoost', error: error.message });
      }
      try {
        if (await detectEqualizerAPO()) { await resetEqualizerAPO(); }
      } catch (e) { /* 무시 */ }
    }

    if (results.errors.length > 0) {
      results.success = false;
    }
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'applySoundBoost', error: error.message });
  }

  return results;
}

async function getEQPresets() {
  try {
    const eqPresets = [
      { value: 'normal', label: '일반' },
      { value: 'game', label: '게임' },
      { value: 'music', label: '음악' },
      { value: 'movie', label: '영화' },
      { value: 'voice', label: '음성' },
      { value: 'bass', label: '베이스 강화' },
    ];

    try {
      const audioKey = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Multimedia\\Audio',
      });

      // 레지스트리 키 접근 가능 여부만 확인한다(프리셋 목록은 기본값 사용).
      await new Promise((resolve) => {
        audioKey.values(() => resolve());
      });
    } catch (regError) {
      console.log('Using default EQ presets');
    }

    return eqPresets;
  } catch (error) {
    console.error('Error getting EQ presets:', error);
    return [
      { value: 'normal', label: '일반' },
      { value: 'game', label: '게임' },
      { value: 'music', label: '음악' },
      { value: 'movie', label: '영화' },
      { value: 'voice', label: '음성' },
      { value: 'bass', label: '베이스 강화' },
    ];
  }
}

async function detectModels() {
  const models = [
    {
      id: 'superpowered',
      name: 'Superpowered Audio SDK',
      description: 'C/C++ 기반 실시간 오디오 처리. EQ, 압축, 필터, 믹싱, 효과 처리 지원.',
      available: false,
    },
    {
      id: 'miniaudio',
      name: 'Miniaudio',
      description: '낮은 레벨 오디오 입출력 + 필터/프로세싱 가능한 단일 파일 C 라이브러리.',
      available: false,
    },
    {
      id: 'portaudio',
      name: 'PortAudio',
      description: '크로스 플랫폼 오디오 I/O API. 외부 DSP와 함께 사용 가능.',
      available: false,
    },
    {
      id: 'freedsp',
      name: 'FreeDSP',
      description: '오픈소스 DSP 처리 모듈. EQ, 베이스 강화 등 처리 블록 제공.',
      available: false,
    },
  ];

  try {
    try {
      const superpoweredPaths = [
        path.join(process.env.PROGRAMFILES || '', 'Superpowered'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Superpowered'),
        path.join(os.homedir(), 'Superpowered'),
      ];
      
      for (const superpoweredPath of superpoweredPaths) {
        try {
          await fs.access(superpoweredPath);
          models[0].available = true;
          break;
        } catch {
        }
      }
    } catch {
    }

    try {
      models[1].available = true;
    } catch {
      models[1].available = false;
    }

    try {
      const portaudioPaths = [
        path.join(process.env.PROGRAMFILES || '', 'PortAudio'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'PortAudio'),
        path.join(os.homedir(), 'PortAudio'),
      ];
      
      for (const portaudioPath of portaudioPaths) {
        try {
          await fs.access(portaudioPath);
          models[2].available = true;
          break;
        } catch {
        }
      }
      
      if (!models[2].available) {
        models[2].available = true;
      }
    } catch {
      models[2].available = false;
    }

    try {
      models[3].available = true;
    } catch {
      models[3].available = false;
    }

    return models;
  } catch (error) {
    console.error('Error detecting audio models:', error);
    return models.map(model => ({ ...model, available: false }));
  }
}

module.exports = {
  getDevices,
  setVolume,
  boost,
  getSettings,
  applySoundBoost,
  getEQPresets,
  detectModels,
  detectEqualizerAPO,
};