// ---------
// 2025-11-17
// 개발자 : KR_Tuki
// 기능 : CPU/GPU Compute Optimization Service
// ---------

// @computeOptimization.js (1-19)
// 날짜: 2025-11-17
// Import 모듈 설명:
// - child_process (exec): 시스템 명령어 실행. OpenCL, CUDA, Intel oneAPI 라이브러리 감지 및 설정에 사용
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// - winreg (Registry): Windows 레지스트리 접근. 컴퓨팅 라이브러리 설정 변경에 사용
// - fs (promises): 파일 시스템 비동기 접근. 라이브러리 DLL 파일 존재 확인에 사용
//   사용 예: fs.access() - 파일 접근 가능 여부 확인, fs.readFile() - 설정 파일 읽기
// - path: 파일 경로 처리. 라이브러리 경로 조작에 사용
//   사용 예: path.join() - 경로 결합, path.dirname() - 디렉토리 경로 추출
// - os: 운영체제 정보 제공. os.platform() 등으로 플랫폼 확인
// 지원 기능:
// - OpenCL 최적화 (GPU/CPU/DSP/FPGA 병렬 처리)
// - CUDA 최적화 (NVIDIA GPU 가속 - cuBLAS, cuFFT, cuDNN, cuSPARSE)
// - Intel oneAPI 최적화 (oneDNN, oneMKL, SYCL)
// - 라이브러리 감지 및 설정

const { exec } = require('child_process');
const { promisify } = require('util');
const Registry = require('winreg');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * OpenCL 최적화
 * GPU/CPU/DSP/FPGA 등 이종 시스템에서 병렬 처리를 위한 표준 API
 */
async function optimizeOpenCL(options = {}) {
  const results = {
    success: false,
    operations: [],
    errors: [],
    openclDetected: false,
    openclOptimized: false,
  };

  try {
    // OpenCL 설치 확인
    const openclPaths = [
      path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'OpenCL.dll'),
      path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'SysWOW64', 'OpenCL.dll'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'NVIDIA Corporation', 'OpenCL', 'OpenCL.dll'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'NVIDIA Corporation', 'OpenCL', 'OpenCL.dll'),
    ];

    let openclFound = false;
    for (const openclPath of openclPaths) {
      try {
        await fs.access(openclPath);
        openclFound = true;
        results.openclDetected = true;
        results.operations.push(`OpenCL 라이브러리 발견: ${openclPath}`);
        break;
      } catch {
        // 파일이 없으면 다음 경로 확인
      }
    }

    if (!openclFound) {
      results.errors.push({ action: 'openclDetection', error: 'OpenCL 라이브러리를 찾을 수 없습니다.' });
      return results;
    }

    // OpenCL 환경 변수 최적화
    try {
      const openclKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
      });

      // OpenCL 플랫폼 우선순위 설정
      await new Promise((resolve, reject) => {
        openclKey.set('OPENCL_VENDOR_PATH', Registry.REG_EXPAND_SZ, process.env.PROGRAMFILES || 'C:\\Program Files', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.openclOptimized = true;
      results.operations.push('OpenCL 환경 변수 최적화 완료');
    } catch (error) {
      results.errors.push({ action: 'openclOptimization', error: error.message });
    }

    // OpenCL 디바이스 우선순위 설정 (레지스트리)
    try {
      const openclRegKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SOFTWARE\\Khronos\\OpenCL',
      });

      // GPU 우선순위 설정
      await new Promise((resolve, reject) => {
        openclRegKey.set('PreferredDevice', Registry.REG_SZ, 'GPU', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.operations.push('OpenCL 디바이스 우선순위 설정 완료');
    } catch (error) {
      // 레지스트리 키가 없을 수 있음 (무시)
      results.operations.push('OpenCL 레지스트리 설정 (선택적)');
    }

    results.success = true;
  } catch (error) {
    results.errors.push({ action: 'opencl', error: error.message });
  }

  return results;
}

/**
 * CUDA 최적화
 * NVIDIA GPU에서 가속 연산을 위한 CUDA 및 CUDA-X Libraries 최적화
 */
async function optimizeCUDA(options = {}) {
  const results = {
    success: false,
    operations: [],
    errors: [],
    cudaDetected: false,
    cudaOptimized: false,
    cudaLibraries: {
      cuBLAS: false,
      cuFFT: false,
      cuDNN: false,
      cuSPARSE: false,
    },
  };

  try {
    // CUDA 설치 확인
    const cudaPaths = [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'NVIDIA GPU Computing Toolkit', 'CUDA'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'NVIDIA GPU Computing Toolkit', 'CUDA'),
      process.env.CUDA_PATH,
      process.env.CUDA_PATH_V11_0,
      process.env.CUDA_PATH_V11_1,
      process.env.CUDA_PATH_V11_2,
      process.env.CUDA_PATH_V12_0,
      process.env.CUDA_PATH_V12_1,
    ].filter(Boolean);

    let cudaFound = false;
    let cudaVersion = null;

    for (const cudaPath of cudaPaths) {
      try {
        const cudaLibPath = path.join(cudaPath, 'bin', 'cudart64_*.dll');
        const files = await fs.readdir(path.join(cudaPath, 'bin')).catch(() => []);
        const cudartFile = files.find(f => f.startsWith('cudart64_'));
        
        if (cudartFile) {
          cudaFound = true;
          cudaVersion = cudartFile.match(/cudart64_(\d+)_(\d+)/);
          results.cudaDetected = true;
          results.operations.push(`CUDA 발견: ${cudaPath} (버전: ${cudaVersion ? cudaVersion[1] + '.' + cudaVersion[2] : 'Unknown'})`);
          break;
        }
      } catch {
        // 경로가 없으면 다음 확인
      }
    }

    if (!cudaFound) {
      // nvidia-smi로 CUDA 확인
      try {
        const { stdout } = await execAsync('nvidia-smi --query-gpu=driver_version,cuda_version --format=csv,noheader');
        if (stdout && stdout.includes('CUDA')) {
          cudaFound = true;
          results.cudaDetected = true;
          results.operations.push(`CUDA 드라이버 확인: ${stdout.trim()}`);
        }
      } catch {
        // nvidia-smi가 없거나 실패
      }
    }

    if (!cudaFound) {
      results.errors.push({ action: 'cudaDetection', error: 'CUDA를 찾을 수 없습니다. NVIDIA GPU와 CUDA Toolkit이 설치되어 있는지 확인하세요.' });
      return results;
    }

    // CUDA 환경 변수 설정
    try {
      const cudaKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
      });

      for (const cudaPath of cudaPaths) {
        try {
          await fs.access(cudaPath);
          
          // CUDA_PATH 설정
          await new Promise((resolve, reject) => {
            cudaKey.set('CUDA_PATH', Registry.REG_EXPAND_SZ, cudaPath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          // CUDA 라이브러리 경로 설정
          const cudaLibPath = path.join(cudaPath, 'lib', 'x64');
          const cudaBinPath = path.join(cudaPath, 'bin');
          
          await new Promise((resolve, reject) => {
            cudaKey.set('CUDA_LIB_PATH', Registry.REG_EXPAND_SZ, cudaLibPath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          results.operations.push(`CUDA 환경 변수 설정: ${cudaPath}`);
          break;
        } catch {
          continue;
        }
      }
    } catch (error) {
      results.errors.push({ action: 'cudaEnvironment', error: error.message });
    }

    // CUDA 라이브러리 확인 (cuBLAS, cuFFT, cuDNN, cuSPARSE)
    try {
      for (const cudaPath of cudaPaths) {
        try {
          await fs.access(cudaPath);
          const libPath = path.join(cudaPath, 'lib', 'x64');
          const files = await fs.readdir(libPath).catch(() => []);

          if (files.some(f => f.includes('cublas'))) {
            results.cudaLibraries.cuBLAS = true;
            results.operations.push('cuBLAS (선형대수) 라이브러리 확인');
          }
          if (files.some(f => f.includes('cufft'))) {
            results.cudaLibraries.cuFFT = true;
            results.operations.push('cuFFT (Fourier 변환) 라이브러리 확인');
          }
          if (files.some(f => f.includes('cudnn'))) {
            results.cudaLibraries.cuDNN = true;
            results.operations.push('cuDNN (딥러닝) 라이브러리 확인');
          }
          if (files.some(f => f.includes('cusparse'))) {
            results.cudaLibraries.cuSPARSE = true;
            results.operations.push('cuSPARSE (희소 행렬) 라이브러리 확인');
          }
          break;
        } catch {
          continue;
        }
      }
    } catch (error) {
      results.errors.push({ action: 'cudaLibraries', error: error.message });
    }

    // CUDA 최적화 레지스트리 설정
    try {
      const nvidiaKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Services\\nvlddmkm',
      });

      // CUDA 계산 우선순위 설정
      await new Promise((resolve, reject) => {
        nvidiaKey.set('CudaComputePriority', Registry.REG_DWORD, '1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.cudaOptimized = true;
      results.operations.push('CUDA 계산 우선순위 최적화 완료');
    } catch (error) {
      // 레지스트리 키가 없을 수 있음
      results.operations.push('CUDA 레지스트리 설정 (선택적)');
    }

    results.success = true;
  } catch (error) {
    results.errors.push({ action: 'cuda', error: error.message });
  }

  return results;
}

/**
 * Intel oneAPI 최적화
 * oneDNN, oneMKL, SYCL 등 Intel 하드웨어 최적화 라이브러리
 */
async function optimizeIntelOneAPI(options = {}) {
  const results = {
    success: false,
    operations: [],
    errors: [],
    oneAPIDetected: false,
    oneAPIOptimized: false,
    libraries: {
      oneDNN: false,
      oneMKL: false,
      SYCL: false,
    },
  };

  try {
    // Intel oneAPI 설치 확인
    const oneAPIPaths = [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files (x86)', 'Intel', 'oneAPI'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Intel', 'oneAPI'),
      process.env.ONEAPI_ROOT,
    ].filter(Boolean);

    let oneAPIFound = false;
    let oneAPIPath = null;

    for (const apiPath of oneAPIPaths) {
      try {
        await fs.access(apiPath);
        oneAPIFound = true;
        oneAPIPath = apiPath;
        results.oneAPIDetected = true;
        results.operations.push(`Intel oneAPI 발견: ${apiPath}`);
        break;
      } catch {
        continue;
      }
    }

    if (!oneAPIFound) {
      results.errors.push({ action: 'oneAPIDetection', error: 'Intel oneAPI를 찾을 수 없습니다.' });
      return results;
    }

    // oneDNN 확인 (딥러닝 연산 최적화)
    try {
      const oneDNNPaths = [
        path.join(oneAPIPath, 'dnnl', 'latest'),
        path.join(oneAPIPath, 'dnnl'),
      ];

      for (const dnnPath of oneDNNPaths) {
        try {
          await fs.access(path.join(dnnPath, 'lib', 'onednn.lib'));
          results.libraries.oneDNN = true;
          results.operations.push(`oneDNN (딥러닝) 라이브러리 확인: ${dnnPath}`);
          break;
        } catch {
          continue;
        }
      }
    } catch (error) {
      results.errors.push({ action: 'oneDNN', error: error.message });
    }

    // oneMKL 확인 (수치연산 최적화 - BLAS, LAPACK)
    try {
      const oneMKLPaths = [
        path.join(oneAPIPath, 'mkl', 'latest'),
        path.join(oneAPIPath, 'mkl'),
      ];

      for (const mklPath of oneMKLPaths) {
        try {
          await fs.access(path.join(mklPath, 'lib', 'intel64', 'mkl_core.lib'));
          results.libraries.oneMKL = true;
          results.operations.push(`oneMKL (수치연산) 라이브러리 확인: ${mklPath}`);
          break;
        } catch {
          continue;
        }
      }
    } catch (error) {
      results.errors.push({ action: 'oneMKL', error: error.message });
    }

    // SYCL 확인 (범용 병렬 프로그래밍 API)
    try {
      const syclPaths = [
        path.join(oneAPIPath, 'compiler', 'latest'),
        path.join(oneAPIPath, 'compiler'),
      ];

      for (const syclPath of syclPaths) {
        try {
          await fs.access(path.join(syclPath, 'bin', 'dpcpp.exe'));
          results.libraries.SYCL = true;
          results.operations.push(`SYCL 컴파일러 확인: ${syclPath}`);
          break;
        } catch {
          continue;
        }
      }
    } catch (error) {
      results.errors.push({ action: 'SYCL', error: error.message });
    }

    // Intel oneAPI 환경 변수 설정
    try {
      const envKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
      });

      await new Promise((resolve, reject) => {
        envKey.set('ONEAPI_ROOT', Registry.REG_EXPAND_SZ, oneAPIPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.operations.push('Intel oneAPI 환경 변수 설정 완료');
    } catch (error) {
      results.errors.push({ action: 'oneAPIEnvironment', error: error.message });
    }

    // Intel GPU/CPU 최적화 레지스트리 설정
    try {
      const intelKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
      });

      // Intel GPU 성능 모드
      await new Promise((resolve, reject) => {
        intelKey.set('IntelPerformanceMode', Registry.REG_DWORD, '1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      results.oneAPIOptimized = true;
      results.operations.push('Intel GPU 성능 모드 활성화 완료');
    } catch (error) {
      // 레지스트리 키가 없을 수 있음
      results.operations.push('Intel GPU 레지스트리 설정 (선택적)');
    }

    results.success = true;
  } catch (error) {
    results.errors.push({ action: 'oneAPI', error: error.message });
  }

  return results;
}

/**
 * 전체 컴퓨팅 최적화 실행
 */
async function optimizeAll(options = {}) {
  const { requestAdminPermission = false } = options;

  const results = {
    success: true,
    operations: [],
    errors: [],
    opencl: null,
    cuda: null,
    oneAPI: null,
  };

  try {
    // OpenCL 최적화
    results.opencl = await optimizeOpenCL(options);
    if (results.opencl.success) {
      results.operations.push(...results.opencl.operations);
    } else {
      results.errors.push(...results.opencl.errors);
    }

    // CUDA 최적화
    results.cuda = await optimizeCUDA(options);
    if (results.cuda.success) {
      results.operations.push(...results.cuda.operations);
    } else {
      results.errors.push(...results.cuda.errors);
    }

    // Intel oneAPI 최적화
    results.oneAPI = await optimizeIntelOneAPI(options);
    if (results.oneAPI.success) {
      results.operations.push(...results.oneAPI.operations);
    } else {
      results.errors.push(...results.oneAPI.errors);
    }

    // 전체 성공 여부 결정
    results.success = results.operations.length > 0;
  } catch (error) {
    results.success = false;
    results.errors.push({ action: 'optimizeAll', error: error.message });
  }

  return results;
}

/**
 * 설치된 라이브러리 감지
 */
async function detectLibraries() {
  const detected = {
    opencl: false,
    cuda: false,
    oneAPI: false,
    details: {},
  };

  try {
    // OpenCL 감지
    const openclResult = await optimizeOpenCL();
    detected.opencl = openclResult.openclDetected;
    detected.details.opencl = openclResult;

    // CUDA 감지
    const cudaResult = await optimizeCUDA();
    detected.cuda = cudaResult.cudaDetected;
    detected.details.cuda = cudaResult;

    // Intel oneAPI 감지
    const oneAPIResult = await optimizeIntelOneAPI();
    detected.oneAPI = oneAPIResult.oneAPIDetected;
    detected.details.oneAPI = oneAPIResult;
  } catch (error) {
    console.error('Error detecting libraries:', error);
  }

  return detected;
}

module.exports = {
  optimizeOpenCL,
  optimizeCUDA,
  optimizeIntelOneAPI,
  optimizeAll,
  detectLibraries,
};
