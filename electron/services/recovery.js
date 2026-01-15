// ---------
// 2025-07-13
// 개발자 : KR_Tuki
// 기능 : 삭제된 파일 스캔 및 복구
// ---------

// @recovery.js (1-21)
// 날짜: 2025-07-13
// Import 모듈 설명:
// - fs (promises): 파일 시스템 비동기 접근. 파일 읽기, 복사, 디렉토리 생성에 사용
//   사용 예: fs.readdir() - 디렉토리 내용 조회, fs.stat() - 파일 통계 조회, fs.open() - 파일 열기
//   fs.read() - 파일 읽기, fs.copyFile() - 파일 복사, fs.mkdir() - 디렉토리 생성
// - path: 파일 경로 처리. 경로 조작 및 정규화에 사용
//   사용 예: path.join() - 경로 결합, path.dirname() - 디렉토리 경로 추출
// - child_process (exec): 시스템 명령어 실행 (현재 미사용, 향후 확장용)
// - util (promisify): 콜백 기반 함수를 Promise로 변환
// 변수 설명:
//   - FILE_SIGNATURES: 파일 타입별 매직 넘버(파일 시그니처) 객체
//     * jpg: JPEG 파일 시그니처 [0xFF, 0xD8, 0xFF]
//     * png: PNG 파일 시그니처 [0x89, 0x50, 0x4E, 0x47]
//     * pdf: PDF 파일 시그니처 [0x25, 0x50, 0x44, 0x46]
//     * zip/docx: ZIP/DOCX 파일 시그니처 [0x50, 0x4B, 0x03, 0x04]
//     * mp3: MP3 파일 시그니처 [0x49, 0x44, 0x33]
//     * mp4: MP4 파일 시그니처 [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]
// 파일 타입 판별: 파일의 첫 8바이트를 읽어 FILE_SIGNATURES와 비교하여 파일 타입 판별

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const FILE_SIGNATURES = {
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46],
  zip: [0x50, 0x4B, 0x03, 0x04],
  docx: [0x50, 0x4B, 0x03, 0x04],
  mp3: [0x49, 0x44, 0x33],
  mp4: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70],
};

// @recovery.js (23-80)
// scanDirectory 함수: 디렉토리 재귀 스캔 및 파일 타입 판별
// 매개변수: dirPath - 스캔할 디렉토리 경로, options - { fileTypes, minSize, maxSize } 스캔 옵션
// 반환값: 복구 가능한 파일 객체 배열 [{ path, name, size, type, modified, deleted }, ...]
// 변수 설명:
//   - fileTypes: 스캔할 파일 타입 배열 (빈 배열이면 모든 타입)
//   - minSize: 최소 파일 크기(바이트)
//   - maxSize: 최대 파일 크기(바이트)
//   - recoveredFiles: 발견된 복구 가능한 파일 배열
//   - entries: fs.readdir()로 조회한 디렉토리 항목 배열 (withFileTypes: true로 파일/디렉토리 구분)
//   - fullPath: 현재 항목의 전체 경로
//   - stats: fs.stat()로 조회한 파일 통계 정보 (size, mtime 등 포함)
//   - buffer: 파일의 첫 8바이트를 읽기 위한 Buffer
//   - fd: fs.open()으로 열린 파일 디스크립터
//   - fileType: FILE_SIGNATURES와 비교하여 판별한 파일 타입
// fs 모듈 사용:
//   - fs.readdir(dirPath, { withFileTypes: true }) - 디렉토리 내용 조회 (파일/디렉토리 구분)
//   - fs.stat(fullPath) - 파일 통계 정보 조회
//   - fs.open(fullPath, 'r') - 파일 읽기 모드로 열기
//   - fd.read(buffer, 0, 8, 0) - 파일의 첫 8바이트 읽기
//   - fd.close() - 파일 디스크립터 닫기

async function scanDirectory(dirPath, options = {}) {
  const {
    fileTypes = [],
    minSize = 0,
    maxSize = Infinity,
  } = options;

  const recoveredFiles = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      try {
        if (entry.isDirectory()) {
          const subFiles = await scanDirectory(fullPath, options);
          recoveredFiles.push(...subFiles);
        } else {
          const stats = await fs.stat(fullPath);
          
          if (stats.size >= minSize && stats.size <= maxSize) {
            const buffer = Buffer.alloc(8);
            const fd = await fs.open(fullPath, 'r');
            await fd.read(buffer, 0, 8, 0);
            await fd.close();

            let fileType = 'unknown';
            for (const [type, signature] of Object.entries(FILE_SIGNATURES)) {
              if (buffer.slice(0, signature.length).equals(Buffer.from(signature))) {
                fileType = type;
                break;
              }
            }

            if (fileTypes.length === 0 || fileTypes.includes(fileType)) {
              recoveredFiles.push({
                path: fullPath,
                name: entry.name,
                size: stats.size,
                type: fileType,
                modified: stats.mtime,
                deleted: false,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
  }

  return recoveredFiles;
}

// @recovery.js (82-107)
// scan 함수: 휴지통($Recycle.Bin) 스캔
// 매개변수: options - { drives, fileTypes, minSize, maxSize } 스캔 옵션
// 반환값: { files, total, totalSize }
// 변수 설명:
//   - drives: 스캔할 드라이브 문자 배열 (기본값: ['C:'])
//   - allFiles: 모든 드라이브에서 발견된 파일 배열
//   - recycleBinPath: 각 드라이브의 휴지통 경로 ($Recycle.Bin)
// path 모듈 사용: path.join()으로 드라이브 문자와 '$Recycle.Bin' 경로 결합

async function scan(options = {}) {
  const {
    drives = ['C:'],
    fileTypes = [],
    minSize = 0,
    maxSize = Infinity,
  } = options;

  const allFiles = [];

  for (const drive of drives) {
    try {
      const recycleBinPath = path.join(drive, '$Recycle.Bin');
      const files = await scanDirectory(recycleBinPath, { fileTypes, minSize, maxSize });
      allFiles.push(...files);
    } catch (error) {
      console.error(`Error scanning drive ${drive}:`, error.message);
    }
  }

  return {
    files: allFiles,
    total: allFiles.length,
    totalSize: allFiles.reduce((sum, file) => sum + file.size, 0),
  };
}

// @recovery.js (109-126)
// recover 함수: 파일 복구 수행
// 매개변수: filePath - 복구할 원본 파일 경로, destination - 복구될 대상 경로
// 반환값: { success, originalPath, recoveredPath } 또는 { success: false, error }
// 변수 설명:
//   - destination: 복구될 파일의 대상 경로
// fs 모듈 사용:
//   - fs.mkdir(path.dirname(destination), { recursive: true }) - 대상 디렉토리 생성 (재귀적으로 상위 디렉토리도 생성)
//   - fs.copyFile(filePath, destination) - 원본 파일을 대상 경로로 복사

async function recover(filePath, destination) {
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    
    await fs.copyFile(filePath, destination);
    
    return {
      success: true,
      originalPath: filePath,
      recoveredPath: destination,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  scan,
  recover,
};