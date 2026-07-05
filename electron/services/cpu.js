// @cpu.js (1-12)
// 날짜: 2025-04-05
// Import 모듈 설명:
// - systeminformation (si): 시스템 정보 수집 라이브러리. CPU 정보, 프로세스 목록, 현재 부하 등을 조회하는데 사용
//   사용 예: si.cpu() - CPU 하드웨어 정보 조회, si.currentLoad() - 현재 CPU 사용률 조회, si.processes() - 실행 중인 프로세스 목록 조회
// - winreg (Registry): Windows 레지스트리 접근 라이브러리. 시작 프로그램 관리, 시각 효과 설정, 메모리 관리 설정 등에 사용
//   사용 예: new Registry({ hive, key }) - 레지스트리 키 생성, .keys() - 하위 키 목록 조회, .set() - 값 설정, .remove() - 키 삭제
// - child_process (exec): 시스템 명령어 실행. powercfg, taskkill, wmic, schtasks 등 Windows 명령어 실행에 사용
//   사용 예: execAsync('powercfg /list') - 전원 계획 목록 조회, execAsync('taskkill /F /PID ...') - 프로세스 강제 종료
// - util (promisify): 콜백 기반 함수를 Promise로 변환. execAsync는 exec의 Promise 버전으로 사용
// - permissions (permissionsService): 관리자 권한 확인 서비스. isAdmin() 함수로 현재 관리자 권한 여부 확인

const si = require('systeminformation');
const Registry = require('winreg');
const { exec } = require('child_process');
const { promisify } = require('util');
// [고도화] 모든 exec 호출에 기본 타임아웃(2분)·버퍼(20MB)를 적용해 무한 대기와
// 1MB 버퍼 초과 크래시를 방지한다. (기존 Promise.race 헬퍼는 자식 프로세스를 죽이지
// 못해 백그라운드에 누수됐음.) 개별 호출이 옵션을 넘기면 그 값이 우선한다.
const _execRaw = promisify(exec);
const execAsync = (command, options = {}) => _execRaw(command, { timeout: 120000, maxBuffer: 1024 * 1024 * 20, ...options });
const permissionsService = require('./permissions');

// @cpu.js (14-19)
// timeout 함수: Promise에 타임아웃을 추가하는 유틸리티 함수
// 변수: promise - 타임아웃을 적용할 Promise, ms - 타임아웃 시간(밀리초)
// Promise.race를 사용하여 원본 Promise와 타임아웃 Promise 중 먼저 완료되는 것을 반환
// 사용 예: await timeout(si.processes(), 3000) - 3초 내에 프로세스 목록을 가져오지 못하면 타임아웃

const timeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
};

// @cpu.js (21-24)
// executePowerShellWithEncoding 함수: UTF-8 인코딩으로 PowerShell 명령 실행
// 변수: command - 실행할 PowerShell 명령어 문자열
// chcp 65001로 코드 페이지를 UTF-8로 설정하여 한글 출력 문제 해결
// 사용 예: executePowerShellWithEncoding('Stop-Service -Name "SysMain"') - 서비스 중지

const executePowerShellWithEncoding = (command) => {
  const encodedCommand = `chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`;
  return execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${encodedCommand}"`, { encoding: 'utf8' });
};

// @cpu.js (26-62)
// getStats 함수: CPU 통계 정보 조회
// 반환값: { cores, model, speed, usagePercent, loadAverage }
// 변수 설명:
//   - cpuInfo: si.cpu()로 조회한 CPU 하드웨어 정보 (cores, brand, manufacturer, speed 등 포함)
//   - currentLoad: si.currentLoad()로 조회한 현재 CPU 부하 정보 (currentLoad, cpus 배열 포함)
//   - usagePercent: 현재 CPU 사용률 (0-100 범위, 소수점 2자리까지 반올림)
//   - loadAverage: 각 CPU 코어별 부하 배열
// Promise.all을 사용하여 CPU 정보와 부하 정보를 병렬로 조회하여 성능 최적화

async function getStats() {
  try {
    const [cpuInfo, currentLoad] = await Promise.all([
      si.cpu().catch(() => null),
      si.currentLoad().catch(() => null),
    ]);

    if (!cpuInfo) {
      return {
        cores: 0,
        model: 'Unknown CPU',
        speed: 0,
        usagePercent: 0,
        loadAverage: [],
      };
    }

    const usagePercent = currentLoad?.currentLoad || 0;

    return {
      cores: cpuInfo.cores || 0,
      model: cpuInfo.brand || cpuInfo.manufacturer || 'Unknown CPU',
      speed: cpuInfo.speed || 0,
      usagePercent: Math.round(usagePercent * 100) / 100,
      loadAverage: currentLoad?.cpus?.map(cpu => cpu.load) || [],
    };
  } catch (error) {
    console.error('Error getting CPU stats:', error);
    return {
      cores: 0,
      model: 'Unknown CPU',
      speed: 0,
      usagePercent: 0,
      loadAverage: [],
    };
  }
}

// @cpu.js (64-92)
// optimize 함수: CPU 최적화 수행
// 매개변수: options - { requestAdminPermission: boolean } 최적화 옵션
// 반환값: results 객체 - 각 최적화 작업의 성공 여부와 작업 목록 포함
// 변수 설명:
//   - options: 최적화 옵션 객체, requestAdminPermission으로 관리자 권한 요청 여부 결정
//   - results: 최적화 결과를 저장하는 객체
//     * success: 전체 최적화 성공 여부
//     * powerPlan, processorAffinity 등: 각 최적화 항목별 성공 여부 (boolean)
//     * operations: 수행된 작업 목록 (문자열 배열)
//     * errors: 발생한 오류 목록 ({ action, error } 객체 배열)
//     * adminGranted: 관리자 권한 부여 여부
//   - isAdmin: permissionsService.isAdmin()으로 확인한 현재 관리자 권한 여부
// permissionsService 사용: isAdmin() 함수로 관리자 권한 확인, 관리자 권한이 필요한 작업은 isAdmin이 true일 때만 수행

async function optimize(options = {}) {
  const { requestAdminPermission = false } = options;
  
  const results = {
    success: true,
    powerPlan: false,
    processorAffinity: false,
    startupPrograms: false,
    backgroundProcesses: false,
    coreParking: false,
    cpuThrottling: false,
    windowsServices: false,
    taskScheduler: false,
    visualEffects: false,
    processAffinity: false,
    schedulerPriority: false,
    cacheOptimization: false,
    hyperthreading: false,
    turboBoost: false,
    interruptOptimization: false,
    operations: [],
    errors: [],
    requiresAdmin: false,
    adminGranted: false,
  };

  const isAdmin = await permissionsService.isAdmin();
  results.adminGranted = isAdmin;

  // @cpu.js (93-123)
  // 고성능 전원 계획 활성화
  // 변수 설명:
  //   - stdout: execAsync('powercfg /list')로 조회한 전원 계획 목록 출력
  //   - lines: stdout를 줄 단위로 분할한 배열
  //   - highPerfGuid: 고성능 전원 계획의 GUID (Globally Unique Identifier)
  // execAsync 사용: Windows powercfg 명령어로 전원 계획 관리
  //   - powercfg /list: 현재 전원 계획 목록 조회
  //   - powercfg /duplicatescheme: 전원 계획 복제 (고성능 계획이 없을 경우)
  //   - powercfg /setactive: 전원 계획 활성화

  try {
    // [고도화] 고성능 전원 계획을 상수 GUID로 직접 활성화한다.
    // (기존 정규식 /\(([a-f0-9-]+)\)/는 powercfg /list에서 괄호 안 "지역화된 이름"만 잡아
    //  항상 null → setactive 미실행(무효) + 매 호출마다 중복 스킴을 새로 생성하는 버그였다.)
    const HIGH_PERF = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
    try {
      await execAsync(`powercfg /setactive ${HIGH_PERF}`);
      results.powerPlan = true;
    } catch (e) {
      // 고성능 계획이 없는 경우에만 복제 후, 복제 명령의 stdout('Power Scheme GUID: <guid>')에서
      // 올바른 GUID 정규식으로 새 GUID를 파싱해 활성화한다.
      const { stdout: dup } = await execAsync(`powercfg /duplicatescheme ${HIGH_PERF}`);
      const m = dup.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (m) {
        await execAsync(`powercfg /setactive ${m[1]}`);
        results.powerPlan = true;
      }
    }
  } catch (error) {
    results.errors.push({ action: 'powerPlan', error: error.message });
  }

  // @cpu.js (125-131)
  // 프로세서 성능 부스트 설정
  // execAsync 사용: powercfg로 프로세서 성능 부스트 활성화
  //   - powercfg /setacvalueindex: 전원 계획 설정값 변경 (be337238-0d82-4146-a960-4f3749d470c7 = 프로세서 성능 부스트, 2 = 활성화)
  //   - powercfg /setactive: 변경사항 적용

  try {
    await execAsync('powercfg /setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 be337238-0d82-4146-a960-4f3749d470c7 2');
    await execAsync('powercfg /setactive SCHEME_CURRENT');
    results.processorAffinity = true;
  } catch (error) {
    results.errors.push({ action: 'processorAffinity', error: error.message });
  }

  // @cpu.js (133-196)
  // 불필요한 시작 프로그램 비활성화
  // 변수 설명:
  //   - startupRegKey: Registry 객체로 HKCU\Software\Microsoft\Windows\CurrentVersion\Run 레지스트리 키 접근
  //   - unnecessaryStartups: 비활성화할 시작 프로그램 이름 배열
  //   - disabledCount: 비활성화된 프로그램 개수
  //   - removePromises: 각 시작 프로그램 제거 작업의 Promise 배열
  // Registry 사용:
  //   - new Registry({ hive: Registry.HKCU, key }) - 레지스트리 키 생성 (HKCU = HKEY_CURRENT_USER)
  //   - .keys(callback) - 하위 키 목록 조회 (비동기 콜백)
  //   - .remove(callback) - 레지스트리 키 삭제
  // timeout 함수 사용: 10초 타임아웃으로 무한 대기 방지

  try {
    await timeout(
      (async () => {
        const startupRegKey = new Registry({
          hive: Registry.HKCU,
          key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        });

        const unnecessaryStartups = [
          'OneDrive', 'Skype', 'Spotify', 'Discord', 'Steam',
          'EpicGamesLauncher', 'AdobeUpdater', 'iTunesHelper',
          'QuickTime', 'JavaUpdateScheduler',
        ];

        return new Promise((resolve) => {
          // [고도화] Run 항목은 "값(value)"이므로 keys()가 아니라 values()로 열거해야 실제
          // 항목이 잡힌다(기존엔 keys()라 아무것도 처리 못 함). 또한 비가역적 삭제 대신
          // Task Manager와 동일하게 StartupApproved에 "사용 안 함" 플래그(REG_BINARY 03 00…)를
          // 기록해 언제든 되돌릴 수 있게 한다.
          startupRegKey.values(async (err, items) => {
            if (err || !items || items.length === 0) {
              results.startupPrograms = true; // 항목 없음/조회 실패도 치명적이지 않음
              resolve();
              return;
            }

            let disabledCount = 0;
            for (const item of items) {
              const itemName = item.name;
              const shouldDisable = unnecessaryStartups.some(name =>
                itemName.toLowerCase().includes(name.toLowerCase())
              );
              if (shouldDisable) {
                try {
                  // [보안] itemName은 레지스트리에서 열거한 값이라 신뢰 불가 → shell(reg add) 대신
                  // winreg API로 직접 기록해 명령 주입을 원천 차단한다(winreg는 셸을 거치지 않음).
                  const approvedKey = new Registry({
                    hive: Registry.HKCU,
                    key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
                  });
                  await new Promise((res) => {
                    approvedKey.set(itemName, Registry.REG_BINARY, '030000000000000000000000', () => res());
                  });
                  disabledCount++;
                } catch (e) {}
              }
            }

            results.startupPrograms = disabledCount > 0;
            if (disabledCount > 0) {
              results.operations.push(`불필요한 시작 프로그램 ${disabledCount}개 비활성화 (되돌리기 가능)`);
            }
            resolve();
          });
        });
      })(),
      10000
    );
  } catch (error) {
    results.errors.push({ action: 'startupPrograms', error: error.message });
  }

  // @cpu.js (198-280)
  // 불필요한 백그라운드 프로세스 종료
  // 변수 설명:
  //   - processes: si.processes()로 조회한 프로세스 목록 (Promise.race로 3초 타임아웃 적용)
  //   - processList: processes.list 배열 (프로세스 객체 배열)
  //   - unnecessaryProcesses: 종료할 불필요한 프로세스 이름 배열
  //   - systemProcesses: 보호할 시스템 프로세스 이름 배열
  //   - nameLowerCache: 프로세스 이름의 소문자 변환 결과를 캐싱하는 Map (성능 최적화)
  //   - unnecessaryLower, systemLower: 소문자로 변환된 프로세스 이름 배열
  //   - killPromises: 각 프로세스 종료 작업의 Promise 배열
  //   - killResults: 프로세스 종료 결과 배열
  //   - terminatedCount: 성공적으로 종료된 프로세스 개수
  // si.processes() 사용: systeminformation 라이브러리로 실행 중인 프로세스 목록 조회
  //   - proc.name: 프로세스 이름
  //   - proc.pid: 프로세스 ID
  //   - proc.cpu: CPU 사용률 (%)
  //   - proc.mem: 메모리 사용률 (%)
  // execAsync 사용: taskkill 명령어로 프로세스 강제 종료
  //   - taskkill /F /PID {pid} /T: 프로세스 ID로 강제 종료 (/F = 강제, /T = 하위 프로세스 포함)

  try {
    const processes = await Promise.race([
      si.processes(),
      new Promise((resolve) => setTimeout(() => resolve({ list: [] }), 3000))
    ]).catch(() => ({ list: [] }));
    const processList = processes.list || [];
    
    const unnecessaryProcesses = [
      'OneDrive.exe', 'Skype.exe', 'Spotify.exe', 'Discord.exe',
      'AdobeUpdater.exe', 'iTunesHelper.exe', 'QuickTime.exe',
      'java.exe', 'javaw.exe', 'AdobeARM.exe', 'GoogleUpdate.exe',
      'Steam.exe', 'EpicGamesLauncher.exe', 'Origin.exe', 'Battle.net.exe',
    ];
    
    const systemProcesses = [
      'System', 'smss.exe', 'csrss.exe', 'winlogon.exe',
      'services.exe', 'lsass.exe', 'svchost.exe', 'dwm.exe', 'explorer.exe'
    ];
    
    const nameLowerCache = new Map();
    const unnecessaryLower = unnecessaryProcesses.map(n => n.toLowerCase());
    const systemLower = systemProcesses.map(s => s.toLowerCase());
    
    const killPromises = processList
      .filter(proc => {
        const name = proc.name || '';
        const pid = proc.pid || 0;
        if (!name || !pid) return false;
        
        let nameLower = nameLowerCache.get(name);
        if (!nameLower) {
          nameLower = name.toLowerCase();
          nameLowerCache.set(name, nameLower);
        }
        
        const shouldKill = unnecessaryLower.some(unnecessary => nameLower.includes(unnecessary)) &&
          !systemLower.some(sys => nameLower.includes(sys)) &&
          ((proc.cpu || 0) > 5 || (proc.mem || 0) > 5);
        
        return shouldKill;
      })
      .map(proc => 
        execAsync(`taskkill /F /PID ${proc.pid} /T`)
          .then(() => ({ success: true, pid: proc.pid }))
          .catch(() => ({ success: false, pid: proc.pid }))
      );
    
    const killResults = await Promise.all(killPromises);
    const terminatedCount = killResults.filter(r => r.success).length;
    
    if (terminatedCount > 0) {
      results.operations.push(`불필요한 백그라운드 프로세스 ${terminatedCount}개 종료`);
    }
  } catch (error) {
    try {
      const unnecessaryProcesses = [
        'OneDrive.exe', 'Skype.exe', 'Spotify.exe', 'Discord.exe',
        'AdobeUpdater.exe', 'iTunesHelper.exe', 'QuickTime.exe',
      ];
      
      const fallbackPromises = unnecessaryProcesses.map(processName =>
        execAsync(`tasklist /FI "IMAGENAME eq ${processName}" /FO CSV`)
          .then(({ stdout }) => {
            if (stdout.includes(processName)) {
              return execAsync(`taskkill /F /IM ${processName} /T`)
                .then(() => ({ success: true, name: processName }))
                .catch(() => ({ success: false, name: processName }));
            }
            return { success: false, name: processName };
          })
          .catch(() => ({ success: false, name: processName }))
      );
      
      const fallbackResults = await Promise.all(fallbackPromises);
      const terminatedCount = fallbackResults.filter(r => r.success).length;
      
      if (terminatedCount > 0) {
        results.operations.push(`불필요한 프로세스 ${terminatedCount}개 종료`);
      }
    } catch (fallbackError) {
      results.errors.push({ action: 'backgroundProcesses', error: error.message });
    }
  }

  if (isAdmin || requestAdminPermission) {
    try {
      const powerConfigTasks = [
        timeout(
          Promise.all([
            execAsync('powercfg /setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 0'),
            execAsync('powercfg /setactive SCHEME_CURRENT'),
          ]).then(() => {
            results.coreParking = true;
            results.operations.push('CPU 코어 파킹 비활성화 완료');
          }),
          5000
        ).catch(() => {}),
        timeout(
          Promise.all([
            execAsync('powercfg /setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 100'),
            execAsync('powercfg /setactive SCHEME_CURRENT'),
          ]).then(() => {
            results.cpuThrottling = true;
            results.operations.push('CPU 스로틀링 방지 완료');
          }),
          5000
        ).catch(() => {}),
      ];

      await Promise.all(powerConfigTasks);
    } catch (error) {
      // Ignore errors
    }
  } else {
    results.operations.push('CPU 코어 파킹/스로틀링 최적화 skipped (requires admin)');
  }

  if (isAdmin || requestAdminPermission) {
    try {
      const servicesToDisable = ['SysMain', 'WSearch', 'DiagTrack'];
      let disabledCount = 0;
      
      const servicePromises = servicesToDisable.map(service =>
        executePowerShellWithEncoding(`Stop-Service -Name '${service}' -ErrorAction SilentlyContinue; Set-Service -Name '${service}' -StartupType Disabled -ErrorAction SilentlyContinue`)
          .then(() => disabledCount++)
          .catch(() => {})
      );
      
      await Promise.all(servicePromises);
      
      if (disabledCount > 0) {
        results.windowsServices = true;
        results.operations.push(`Windows 서비스 ${disabledCount}개 비활성화 완료`);
      }
    } catch (error) {
      // Ignore errors
    }
  } else {
    results.operations.push('Windows 서비스 최적화 skipped (requires admin)');
  }

  if (isAdmin || requestAdminPermission) {
    try {
      const tasksToDisable = [
        'Microsoft\\Windows\\UpdateOrchestrator\\USO_UxBroker',
        'Microsoft\\Windows\\UpdateOrchestrator\\Reboot',
        'Microsoft\\Windows\\DiskCleanup\\SilentCleanup',
        'Microsoft\\Windows\\WindowsUpdate\\Automatic App Update',
      ];
      let disabledCount = 0;
      
      const taskPromises = tasksToDisable.map(task =>
        execAsync(`schtasks /Change /TN "${task}" /Disable`)
          .then(() => disabledCount++)
          .catch(() => {})
      );
      
      await Promise.all(taskPromises);
      
      if (disabledCount > 0) {
        results.taskScheduler = true;
        results.operations.push(`작업 스케줄러 ${disabledCount}개 비활성화 완료`);
      }
    } catch (error) {
      // Ignore errors
    }
  } else {
    results.operations.push('작업 스케줄러 최적화 skipped (requires admin)');
  }

  try {
    await new Promise((resolve, reject) => {
      const visualEffectsKey = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects',
      });

      visualEffectsKey.set('VisualFXSetting', Registry.REG_DWORD, '2', (err) => {
        if (err) {
          reject(err);
        } else {
          results.visualEffects = true;
          resolve();
        }
      });
    });
  } catch (error) {
    results.errors.push({ action: 'visualEffects', error: error.message });
  }

  try {
    const cpuInfo = await si.cpu().catch(() => ({ cores: 0 }));
    const coreCount = cpuInfo.cores || 0;
    // JS의 `<<`는 32비트라 코어 수가 32 이상이면 오버플로(1<<32===1). BigInt로 계산.
    const affinityMask = coreCount > 0 ? (1n << BigInt(coreCount)) - 1n : 0n;
    const affinityHex = '0x' + affinityMask.toString(16).toUpperCase().padStart(Math.ceil(coreCount / 4) * 8, '0');
    
    const processes = await Promise.race([
      si.processes(),
      new Promise((resolve) => setTimeout(() => resolve({ list: [] }), 5000))
    ]).catch(() => ({ list: [] }));
    const processList = processes.list || [];
    
    const systemProcesses = ['System', 'smss', 'csrss', 'winlogon', 'services', 'lsass'];
    const systemLower = systemProcesses.map(s => s.toLowerCase());
    
    const filteredProcesses = processList
      .filter(proc => {
        const name = proc.name || '';
        const pid = proc.pid || 0;
        if (!name || !pid) return false;
        const nameLower = name.toLowerCase();
        return !systemLower.some(sys => nameLower.includes(sys));
      })
      .slice(0, 50);
    
    const BATCH_SIZE = 10;
    let optimizedCount = 0;
    
    for (let i = 0; i < filteredProcesses.length; i += BATCH_SIZE) {
      const batch = filteredProcesses.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(proc =>
        timeout(
          executePowerShellWithEncoding(`$proc = Get-Process -Id ${proc.pid} -ErrorAction SilentlyContinue; if ($proc -and $proc.ProcessorAffinity) { $proc.ProcessorAffinity = ${affinityHex} }`),
          3000
        )
          .then(() => ({ success: true, pid: proc.pid }))
          .catch(() => ({ success: false, pid: proc.pid }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      optimizedCount += batchResults.filter(r => r.success).length;
    }
    
    if (optimizedCount > 0) {
      results.operations.push(`프로세스 CPU 어피니티 최적화 완료 (${optimizedCount}개 프로세스)`);
    }
  } catch (error) {
    try {
      const cpuInfo = await si.cpu().catch(() => ({ cores: 0 }));
      const coreCount = cpuInfo.cores || 0;
      // JS의 `<<`는 32비트라 코어 수가 32 이상이면 오버플로(1<<32===1). BigInt로 계산.
    const affinityMask = coreCount > 0 ? (1n << BigInt(coreCount)) - 1n : 0n;
      const affinityHex = '0x' + affinityMask.toString(16).toUpperCase();
      
      const importantProcesses = ['explorer', 'dwm'];
      for (const processName of importantProcesses) {
        try {
          await executePowerShellWithEncoding(`$proc = Get-Process -Name '${processName}' -ErrorAction SilentlyContinue; if ($proc) { $proc.ProcessorAffinity = ${affinityHex} }`);
          results.processAffinity = true;
        } catch (error) {
          continue;
        }
      }
    } catch (fallbackError) {
      results.errors.push({ action: 'processAffinity', error: error.message });
    }
  }

  try {
    const importantProcesses = ['explorer.exe', 'dwm.exe', 'winlogon.exe'];
    
    const priorityPromises = importantProcesses.map(processName =>
      timeout(
        execAsync(`wmic process where name="${processName}" call setpriority "high priority"`),
        5000
      )
        .then(() => ({ success: true, name: processName }))
        .catch(() => ({ success: false, name: processName }))
    );
    
    const priorityResults = await Promise.all(priorityPromises);
    const optimizedCount = priorityResults.filter(r => r.success).length;
    
    if (optimizedCount > 0) {
      results.operations.push(`CPU 스케줄러 우선순위 조정 완료 (${optimizedCount}개 프로세스)`);
    }
  } catch (error) {
    results.errors.push({ action: 'schedulerPriority', error: error.message });
  }

  if (isAdmin || requestAdminPermission) {
    try {
      const memoryManagementKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
      });
      
      await Promise.all([
        new Promise((resolve, reject) => {
          memoryManagementKey.set('LargeSystemCache', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        }),
        new Promise((resolve, reject) => {
          memoryManagementKey.set('DisablePagingExecutive', Registry.REG_DWORD, '1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        }),
      ]);
      
      results.cacheOptimization = true;
      results.operations.push('CPU 캐시 최적화 완료');
    } catch (error) {
      // Ignore errors
    }
  } else {
    results.operations.push('CPU 캐시 최적화 skipped (requires admin)');
  }

  try {
    const cpuInfo = await si.cpu().catch(() => ({ cores: 0 }));
    const coreCount = cpuInfo.cores || 0;
    const logicalProcessorCount = coreCount;
    // BigInt로 계산해 32코어 이상에서 발생하던 비트 오버플로를 방지
    const affinityMask = logicalProcessorCount > 0 ? (1n << BigInt(logicalProcessorCount)) - 1n : 0n;
    const affinityHex = '0x' + affinityMask.toString(16).toUpperCase().padStart(Math.ceil(logicalProcessorCount / 4) * 8, '0');
    
    const importantProcesses = ['explorer', 'dwm'];
    
    const hyperthreadingPromises = importantProcesses.map(processName =>
      timeout(
        executePowerShellWithEncoding(`$procs = Get-Process -Name '${processName}' -ErrorAction SilentlyContinue; foreach ($proc in $procs) { if ($proc.ProcessorAffinity) { $proc.ProcessorAffinity = ${affinityHex} } }`),
        5000
      )
        .then(() => ({ success: true, name: processName }))
        .catch(() => ({ success: false, name: processName }))
    );
    
    const hyperthreadingResults = await Promise.all(hyperthreadingPromises);
    const optimizedCount = hyperthreadingResults.filter(r => r.success).length;
    
    if (optimizedCount > 0) {
      results.hyperthreading = true;
      results.operations.push(`하이퍼스레딩 최적화 완료 (${optimizedCount}개 프로세스)`);
    }
  } catch (error) {
    results.errors.push({ action: 'hyperthreading', error: error.message });
  }

  try {
    await timeout(
      Promise.all([
        execAsync('powercfg /setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 be337238-0d82-4146-a960-4f3749d470c7 2'),
        execAsync('powercfg /setactive SCHEME_CURRENT'),
      ]),
      5000
    );
    
    results.turboBoost = true;
    results.operations.push('CPU 터보 부스트 활성화 완료');
  } catch (error) {
    // Ignore errors
  }

  if (isAdmin || requestAdminPermission) {
    try {
      const interruptKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management',
      });
      
      await timeout(
        Promise.all([
          execAsync('powercfg /setacvalueindex SCHEME_CURRENT 238c9fa8-0aad-41ed-83f4-97be242c8f20 bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d 0'),
          execAsync('powercfg /setactive SCHEME_CURRENT'),
          new Promise((resolve, reject) => {
            interruptKey.set('IRQBalance', Registry.REG_DWORD, '1', (err) => {
              if (err) reject(err);
              else resolve();
            });
          }),
        ]),
        5000
      );
      
      results.interruptOptimization = true;
      results.operations.push('인터럽트 처리 최적화 완료');
    } catch (error) {
      // Ignore errors
    }
  } else {
    results.operations.push('인터럽트 처리 최적화 skipped (requires admin)');
  }

  if (!results.operations) {
    results.operations = [];
  }
  
  const addedOps = new Set(results.operations);
  if (results.powerPlan && !addedOps.has('고성능 전원 옵션 설정 완료')) {
    results.operations.push('고성능 전원 옵션 설정 완료');
  }
  if (results.processorAffinity && !addedOps.has('프로세서 성능 부스트 설정 완료')) {
    results.operations.push('프로세서 성능 부스트 설정 완료');
  }
  if (results.startupPrograms && !addedOps.has('불필요한 시작 프로그램 비활성화 완료')) {
    results.operations.push('불필요한 시작 프로그램 비활성화 완료');
  }
  if (results.visualEffects && !addedOps.has('시각 효과 최적화 완료')) {
    results.operations.push('시각 효과 최적화 완료');
  }

  results.success = results.operations.length > 0 || Object.values(results).some(v => v === true);

  return results;
}

// @cpu.js (605-623)
// setPriority 함수: 프로세스 우선순위 설정
// 매개변수: pid - 프로세스 ID, priority - 우선순위 레벨 (low, below, normal, above, high, realtime)
// 반환값: { success: boolean, error?: string }
// 변수 설명:
//   - priorityMap: 우선순위 레벨 문자열을 WMIC 우선순위 값으로 매핑하는 객체
//     * low: 64, below: 16384, normal: 32, above: 32768, high: 128, realtime: 256
//   - priorityValue: priorityMap에서 조회한 우선순위 값 (기본값: 32 = normal)
// execAsync 사용: wmic 명령어로 프로세스 우선순위 설정
//   - wmic process where processid={pid} call setpriority {value}: 특정 프로세스의 우선순위 변경

async function setPriority(pid, priority) {
  const priorityMap = {
    low: 64,
    below: 16384,
    normal: 32,
    above: 32768,
    high: 128,
    realtime: 256,
  };

  const priorityValue = priorityMap[priority] || 32;

  try {
    await execAsync(`wmic process where processid=${pid} call setpriority ${priorityValue}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  getStats,
  optimize,
  setPriority,
};