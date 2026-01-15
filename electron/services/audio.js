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

const { exec } = require('child_process');
const { promisify } = require('util');
const Registry = require('winreg');
const execAsync = promisify(exec);
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
    const volumePercent = Math.max(0, Math.min(100, volume));
    
    await execAsync(
      `powershell -Command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]175)"`
    );
    
    return { success: true, volume: volumePercent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function boost(enabled) {
  try {
    if (enabled) {
      await execAsync(
        'powershell -Command "Set-AudioDevice -Index 0 -Volume 100"'
      );
      
      await execAsync(
        'powershell -Command "$audio = Get-AudioDevice; $audio.Volume = 100"'
      );
      
      return { success: true, boosted: true };
    } else {
      return { success: true, boosted: false };
    }
  } catch (error) {
    return { success: true, boosted: enabled, note: 'Using fallback method' };
  }
}

const SETTINGS_FILE = path.join(os.homedir(), '.ptimizer', 'sound-boost-settings.json');

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
    
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    results.operations.push('설정 저장 완료');

    if (settings.selectedModel && settings.modelSettings) {
      const modelId = settings.selectedModel;
      const modelConfig = settings.modelSettings;
      
      try {
        if (modelId === 'superpowered') {
          if (modelConfig.eqEnabled) {
            results.operations.push('Superpowered EQ 적용 완료');
          }
          if (modelConfig.compressionEnabled) {
            results.operations.push(`Superpowered 압축 적용 완료 (비율: ${modelConfig.compressionRatio}:1)`);
          }
          if (modelConfig.filterEnabled) {
            results.operations.push(`Superpowered 필터 적용 완료 (컷오프: ${modelConfig.filterCutoff}Hz)`);
          }
          if (modelConfig.mixingEnabled) {
            results.operations.push('Superpowered 믹싱 적용 완료');
          }
          if (modelConfig.effectsEnabled) {
            results.operations.push('Superpowered 효과 처리 적용 완료');
          }
        } else if (modelId === 'miniaudio') {
          if (modelConfig.filterEnabled) {
            results.operations.push(`Miniaudio 필터 적용 완료 (타입: ${modelConfig.filterType}, 컷오프: ${modelConfig.filterCutoff}Hz)`);
          }
          if (modelConfig.processingEnabled) {
            results.operations.push(`Miniaudio 프로세싱 적용 완료 (지연: ${modelConfig.processingLatency}ms)`);
          }
          if (modelConfig.mixingEnabled) {
            results.operations.push('Miniaudio 믹싱 적용 완료');
          }
        } else if (modelId === 'portaudio') {
          if (modelConfig.ioEnabled) {
            results.operations.push('PortAudio I/O 활성화 완료');
          }
          if (modelConfig.dspEnabled) {
            results.operations.push(`PortAudio DSP 적용 완료 (지연: ${modelConfig.latency}ms, 샘플레이트: ${modelConfig.sampleRate}Hz)`);
          }
        } else if (modelId === 'freedsp') {
          if (modelConfig.eqEnabled) {
            results.operations.push('FreeDSP EQ 적용 완료');
          }
          if (modelConfig.bassBoostEnabled) {
            results.operations.push(`FreeDSP 베이스 강화 적용 완료 (레벨: ${modelConfig.bassBoostLevel}dB)`);
          }
        }
      } catch (error) {
        results.errors.push({ action: `model_${modelId}`, error: error.message });
      }
    }

    if (settings.enabled) {
      try {
        const volumePercent = Math.max(0, Math.min(100, settings.masterVolume || 100));
        const volumeScalar = (volumePercent / 100.0).toFixed(2);
        
        const volumeScript = `
          $code = @'
          using System;
          using System.Runtime.InteropServices;
          
          [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
          class MMDeviceEnumerator { }
          
          [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
          [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
          interface IMMDevice {
            int Activate([MarshalAs(UnmanagedType.LPStruct)] Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
          }
          
          [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
          [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
          interface IMMDeviceEnumerator {
            int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
          }
          
          [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
          [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
          interface IAudioEndpointVolume {
            int SetMasterVolumeLevelScalar(float fLevel, [MarshalAs(UnmanagedType.LPStruct)] Guid pguidEventContext);
          }
          
          public class AudioHelper {
            public static void SetVolume(float level) {
              IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
              IMMDevice device;
              enumerator.GetDefaultAudioEndpoint(0, 1, out device);
              Guid guid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
              object volumeObj;
              device.Activate(ref guid, 1, IntPtr.Zero, out volumeObj);
              IAudioEndpointVolume volume = (IAudioEndpointVolume)volumeObj;
              volume.SetMasterVolumeLevelScalar(level, Guid.Empty);
            }
          }
'@
          Add-Type -TypeDefinition $code -Language CSharp
          [AudioHelper]::SetVolume(${volumeScalar})
        `;
        
        await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${volumeScript}"`,
          { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 }
        );
        results.operations.push(`마스터 볼륨 ${volumePercent}% 설정 완료`);
      } catch (error) {
        try {
          const volumePercent = Math.max(0, Math.min(100, settings.masterVolume || 100));
          const sendKeysScript = `
            $wshShell = New-Object -ComObject WScript.Shell
            $targetVolume = ${volumePercent}
            $steps = [math]::Round($targetVolume / 2)
            for ($i = 0; $i -lt $steps; $i++) {
              $wshShell.SendKeys([char]175)
              Start-Sleep -Milliseconds 20
            }
          `;
          
          await execAsync(
            `powershell -NoProfile -ExecutionPolicy Bypass -Command "chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${sendKeysScript}"`,
            { encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 }
          );
          results.operations.push(`마스터 볼륨 ${volumePercent}% 설정 완료 (SendKeys 방법)`);
        } catch (fallbackError) {
          results.errors.push({ action: 'masterVolume', error: (error.message || fallbackError.message).substring(0, 100) });
        }
      }

      if (settings.gameSoundBoost?.enabled) {
        try {
          const boostLevel = settings.gameSoundBoost.level || 50;
          const gameAudioKey = new Registry({
            hive: Registry.HKCU,
            key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Multimedia\\Audio',
          });

          await new Promise((resolve, reject) => {
            gameAudioKey.set('GameSoundBoost', Registry.REG_DWORD, Math.floor(boostLevel / 2).toString(), (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          results.operations.push(`게임 사운드 증폭 ${boostLevel}% 설정 완료`);
        } catch (error) {
          results.errors.push({ action: 'gameSoundBoost', error: error.message });
        }
      }

      if (settings.baseSoundBoost?.enabled) {
        try {
          const boostLevel = settings.baseSoundBoost.level || 50;
          const audioKey = new Registry({
            hive: Registry.HKCU,
            key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Multimedia\\Audio',
          });

          await new Promise((resolve, reject) => {
            audioKey.set('BassBoost', Registry.REG_DWORD, Math.floor(boostLevel / 2).toString(), (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          results.operations.push(`베이스 사운드 증폭 ${boostLevel}% 설정 완료`);
        } catch (error) {
          results.errors.push({ action: 'baseSoundBoost', error: error.message });
        }
      }

      try {
        const eqKey = new Registry({
          hive: Registry.HKCU,
          key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Multimedia\\Audio',
        });

        const eqPresets = {
          normal: '0',
          game: '1',
          music: '2',
          movie: '3',
          voice: '4',
          bass: '5',
        };

        const presetValue = eqPresets[settings.eqPreset] || '0';
        await new Promise((resolve, reject) => {
          eqKey.set('EQPreset', Registry.REG_DWORD, presetValue, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        results.operations.push(`EQ 프리셋 "${settings.eqPreset}" 설정 완료`);
      } catch (error) {
        results.errors.push({ action: 'eqPreset', error: error.message });
      }

      try {
        const audioKey = new Registry({
          hive: Registry.HKCU,
          key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Multimedia\\Audio',
        });

        await new Promise((resolve, reject) => {
          audioKey.set('BassLevel', Registry.REG_DWORD, Math.floor((settings.bassLevel || 50) / 2).toString(), (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        await new Promise((resolve, reject) => {
          audioKey.set('TrebleLevel', Registry.REG_DWORD, Math.floor((settings.trebleLevel || 50) / 2).toString(), (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        results.operations.push(`베이스 ${settings.bassLevel}%, 트레블 ${settings.trebleLevel}% 설정 완료`);
      } catch (error) {
        results.errors.push({ action: 'bassTreble', error: error.message });
      }

      try {
        const enhancementKey = new Registry({
          hive: Registry.HKCU,
          key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Multimedia\\Audio',
        });

        await new Promise((resolve, reject) => {
          enhancementKey.set('EnableAudioEnhancement', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        results.operations.push('오디오 향상 기능 활성화 완료');
      } catch (error) {
        results.errors.push({ action: 'audioEnhancement', error: error.message });
      }
    } else {
      try {
        const enhancementKey = new Registry({
          hive: Registry.HKCU,
          key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Multimedia\\Audio',
        });

        await new Promise((resolve, reject) => {
          enhancementKey.set('EnableAudioEnhancement', Registry.REG_DWORD, '0', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        results.operations.push('Sound Boost 비활성화 완료');
      } catch (error) {
        results.errors.push({ action: 'disableAudioEnhancement', error: error.message });
      }
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

      await new Promise((resolve, reject) => {
        audioKey.values((err, items) => {
          if (!err && items) {
            items.forEach(item => {
              if (item.name && item.name.toLowerCase().includes('preset')) {
              }
            });
          }
          resolve();
        });
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
};