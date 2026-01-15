const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const execAsync = promisify(exec);

// Windows Memory-Mapped Files를 위한 PowerShell 스크립트
class SharedMemoryAllocator {
  constructor(name, size = 64 * 1024 * 1024) { // 기본 64MB
    this.name = name;
    this.size = size;
    this.mappedFile = null;
    this.baseAddress = null;
    this.isMainProcess = process.type === 'browser';
    this.tempFilePath = path.join(os.tmpdir(), `shm_${name}_${process.pid}.dat`);
  }

  /**
   * Shared Memory 생성 (메인 프로세스)
   */
  async create() {
    if (!this.isMainProcess) {
      throw new Error('Shared memory can only be created in main process');
    }

    try {
      // Windows Memory-Mapped File 생성
      // PowerShell을 사용하여 CreateFileMapping 구현
      // 변수를 안전하게 이스케이프 처리
      const escapedName = this.name.replace(/'/g, "''").replace(/\$/g, '`$');
      const psScript = `
$name = '${escapedName}';
$size = ${this.size};

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class SharedMemory {
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern SafeFileHandle CreateFileMapping(
    IntPtr hFile,
    IntPtr lpAttributes,
    uint flProtect,
    uint dwMaximumSizeHigh,
    uint dwMaximumSizeLow,
    string lpName
  );

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern IntPtr MapViewOfFile(
    SafeFileHandle hFileMappingObject,
    uint dwDesiredAccess,
    uint dwFileOffsetHigh,
    uint dwFileOffsetLow,
    IntPtr dwNumberOfBytesToMap
  );

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool UnmapViewOfFile(IntPtr lpBaseAddress);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr hObject);

  public const uint PAGE_READWRITE = 0x04;
  public const uint FILE_MAP_ALL_ACCESS = 0xF001F;
  public const uint INVALID_HANDLE_VALUE = 0xFFFFFFFF;
}
'@

try {
  $handle = [SharedMemory]::CreateFileMapping(
    [IntPtr]::new(-1),
    [IntPtr]::Zero,
    [SharedMemory]::PAGE_READWRITE,
    0,
    $size,
    $name
  );

  if ($handle.IsInvalid) {
    $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Host "ERROR:$errorCode" -NoNewline
    exit 1
  }

  $view = [SharedMemory]::MapViewOfFile(
    $handle.DangerousGetHandle(),
    [SharedMemory]::FILE_MAP_ALL_ACCESS,
    0,
    0,
    [IntPtr]::Zero
  );

  if ($view -eq [IntPtr]::Zero) {
    $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Host "ERROR:$errorCode" -NoNewline
    $handle.Dispose()
    exit 1
  }

  $address = [int64]$view
  Write-Host "SUCCESS:$address" -NoNewline
  $handle.Dispose()
  exit 0
} catch {
  Write-Host "ERROR:Exception" -NoNewline
  exit 1
}
      `.trim();

      const tempScript = path.join(os.tmpdir(), `shm_create_${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, psScript, 'utf8');

      try {
        const { stdout, stderr } = await execAsync(
          `powershell -ExecutionPolicy Bypass -NoProfile -File "${tempScript}"`,
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );

        // stdout 정리 (줄바꿈, 공백 제거)
        const cleanOutput = stdout.trim().replace(/\r\n/g, '\n').split('\n').find(line => 
          line.includes('ERROR:') || line.includes('SUCCESS:')
        ) || stdout.trim();

        if (stderr && stderr.trim()) {
          console.warn('PowerShell stderr:', stderr);
        }

        if (cleanOutput.includes('ERROR:')) {
          const errorMatch = cleanOutput.match(/ERROR:(.+)/);
          const errorCode = errorMatch ? errorMatch[1].trim() : 'Unknown error';
          throw new Error(`Failed to create shared memory: ${errorCode}`);
        }

        if (cleanOutput.includes('SUCCESS:')) {
          const successMatch = cleanOutput.match(/SUCCESS:(\d+)/);
          if (!successMatch) {
            throw new Error('Invalid SUCCESS response format');
          }
          const address = parseInt(successMatch[1]);
          if (isNaN(address)) {
            throw new Error('Invalid address in SUCCESS response');
          }
          this.baseAddress = address;
          this.mappedFile = { handle: null, address };
          
          // 메타데이터 저장 (파일로)
          const metadata = {
            name: this.name,
            size: this.size,
            address: address.toString(),
            created: Date.now(),
          };
          fs.writeFileSync(this.tempFilePath, JSON.stringify(metadata), 'utf8');
          
          return { success: true, address, size: this.size };
        }

        throw new Error(`Unknown response from PowerShell script: ${cleanOutput.substring(0, 100)}`);
      } finally {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error('SharedMemory create error:', error);
      // PowerShell 스크립트 실행 실패 시 더 자세한 정보 로깅
      if (error.message.includes('Unknown response')) {
        console.error('PowerShell script output was not in expected format');
        console.error('This may indicate a PowerShell execution issue or permission problem');
      }
      throw error;
    }
  }

  /**
   * Shared Memory 열기 (렌더러 프로세스)
   */
  async open() {
    try {
      // 메타데이터 파일 읽기
      if (!fs.existsSync(this.tempFilePath)) {
        throw new Error(`Shared memory metadata not found: ${this.tempFilePath}`);
      }

      const metadata = JSON.parse(fs.readFileSync(this.tempFilePath, 'utf8'));
      this.size = metadata.size;
      this.baseAddress = parseInt(metadata.address);

      // PowerShell을 사용하여 OpenFileMapping 구현
      // 변수를 안전하게 이스케이프 처리
      const escapedName = this.name.replace(/'/g, "''").replace(/\$/g, '`$');
      const psScript = `
$name = '${escapedName}';

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class SharedMemory {
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern SafeFileHandle OpenFileMapping(
    uint dwDesiredAccess,
    bool bInheritHandle,
    string lpName
  );

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern IntPtr MapViewOfFile(
    SafeFileHandle hFileMappingObject,
    uint dwDesiredAccess,
    uint dwFileOffsetHigh,
    uint dwFileOffsetLow,
    IntPtr dwNumberOfBytesToMap
  );

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool UnmapViewOfFile(IntPtr lpBaseAddress);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr hObject);

  public const uint FILE_MAP_ALL_ACCESS = 0xF001F;
}
'@

try {
  $handle = [SharedMemory]::OpenFileMapping(
    [SharedMemory]::FILE_MAP_ALL_ACCESS,
    $false,
    $name
  );

  if ($handle.IsInvalid) {
    $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Host "ERROR:$errorCode" -NoNewline
    exit 1
  }

  $view = [SharedMemory]::MapViewOfFile(
    $handle.DangerousGetHandle(),
    [SharedMemory]::FILE_MAP_ALL_ACCESS,
    0,
    0,
    [IntPtr]::Zero
  );

  if ($view -eq [IntPtr]::Zero) {
    $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Host "ERROR:$errorCode" -NoNewline
    $handle.Dispose()
    exit 1
  }

  $address = [int64]$view
  Write-Host "SUCCESS:$address" -NoNewline
  $handle.Dispose()
  exit 0
} catch {
  Write-Host "ERROR:Exception" -NoNewline
  exit 1
}
      `.trim();

      const tempScript = path.join(os.tmpdir(), `shm_open_${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, psScript, 'utf8');

      try {
        const { stdout, stderr } = await execAsync(
          `powershell -ExecutionPolicy Bypass -NoProfile -File "${tempScript}"`,
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );

        // stdout 정리 (줄바꿈, 공백 제거)
        const cleanOutput = stdout.trim().replace(/\r\n/g, '\n').split('\n').find(line => 
          line.includes('ERROR:') || line.includes('SUCCESS:')
        ) || stdout.trim();

        if (stderr && stderr.trim()) {
          console.warn('PowerShell stderr:', stderr);
        }

        if (cleanOutput.includes('ERROR:')) {
          const errorMatch = cleanOutput.match(/ERROR:(.+)/);
          const errorCode = errorMatch ? errorMatch[1].trim() : 'Unknown error';
          throw new Error(`Failed to open shared memory: ${errorCode}`);
        }

        if (cleanOutput.includes('SUCCESS:')) {
          const successMatch = cleanOutput.match(/SUCCESS:(\d+)/);
          if (!successMatch) {
            throw new Error('Invalid SUCCESS response format');
          }
          const address = parseInt(successMatch[1]);
          if (isNaN(address)) {
            throw new Error('Invalid address in SUCCESS response');
          }
          this.baseAddress = address;
          this.mappedFile = { handle: null, address };
          
          return { success: true, address, size: this.size };
        }

        throw new Error(`Unknown response from PowerShell script: ${cleanOutput.substring(0, 100)}`);
      } finally {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error('SharedMemory open error:', error);
      // 메타데이터 파일이 없으면 초기화가 안 된 것
      if (error.message.includes('metadata not found')) {
        console.warn('Shared memory not initialized - will use standard IPC');
      }
      throw error;
    }
  }

  /**
   * 데이터 쓰기 (메인 프로세스)
   * 실제로는 Node.js Buffer를 사용하여 임시 파일에 쓰고,
   * PowerShell을 통해 shared memory에 복사
   */
  async write(offset, data) {
    if (!this.mappedFile) {
      throw new Error('Shared memory not initialized');
    }

    try {
      // 데이터를 Buffer로 변환
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data), 'utf8');
      
      // 임시 파일에 쓰기
      const tempDataFile = path.join(os.tmpdir(), `shm_data_${Date.now()}.dat`);
      fs.writeFileSync(tempDataFile, buffer);

      // PowerShell을 통해 shared memory에 복사
      // 변수를 안전하게 이스케이프 처리
      const escapedDataFile = tempDataFile.replace(/'/g, "''").replace(/\$/g, '`$');
      const psScript = `
$baseAddress = [IntPtr]::new(${this.baseAddress});
$dataFile = '${escapedDataFile}';
$offset = ${offset};

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.IO;

public class SharedMemory {
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool WriteProcessMemory(
    IntPtr hProcess,
    IntPtr lpBaseAddress,
    byte[] lpBuffer,
    int nSize,
    out IntPtr lpNumberOfBytesWritten
  );

  [DllImport("kernel32.dll")]
  public static extern IntPtr GetCurrentProcess();
}
'@

try {
  $data = [System.IO.File]::ReadAllBytes($dataFile);
  $targetAddress = [IntPtr]::new($baseAddress.ToInt64() + $offset);
  
  $written = [IntPtr]::Zero;
  $result = [SharedMemory]::WriteProcessMemory(
    [SharedMemory]::GetCurrentProcess(),
    $targetAddress,
    $data,
    $data.Length,
    [ref]$written
  );

  if ($result) {
    $bytesWritten = $written.ToInt64()
    Write-Host "SUCCESS:$bytesWritten" -NoNewline
  } else {
    $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Host "ERROR:$errorCode" -NoNewline
  }
} catch {
  Write-Host "ERROR:Exception" -NoNewline
} finally {
  if (Test-Path $dataFile) {
    Remove-Item $dataFile -Force
  }
}
      `.trim();

      const tempScript = path.join(os.tmpdir(), `shm_write_${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, psScript, 'utf8');

      try {
        const { stdout, stderr } = await execAsync(
          `powershell -ExecutionPolicy Bypass -NoProfile -File "${tempScript}"`,
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );

        // stdout 정리
        const cleanOutput = stdout.trim().replace(/\r\n/g, '\n').split('\n').find(line => 
          line.includes('ERROR:') || line.includes('SUCCESS:')
        ) || stdout.trim();

        if (stderr && stderr.trim()) {
          console.warn('PowerShell stderr:', stderr);
        }

        if (cleanOutput.includes('ERROR:')) {
          const errorMatch = cleanOutput.match(/ERROR:(.+)/);
          const errorCode = errorMatch ? errorMatch[1].trim() : 'Unknown error';
          throw new Error(`Failed to write to shared memory: ${errorCode}`);
        }

        if (cleanOutput.includes('SUCCESS:')) {
          const successMatch = cleanOutput.match(/SUCCESS:(\d+)/);
          if (!successMatch) {
            throw new Error('Invalid SUCCESS response format');
          }
          const written = parseInt(successMatch[1]);
          if (isNaN(written)) {
            throw new Error('Invalid written bytes in SUCCESS response');
          }
          return { success: true, written };
        }

        throw new Error(`Unknown response from PowerShell script: ${cleanOutput.substring(0, 100)}`);
      } finally {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error('SharedMemory write error:', error);
      throw error;
    }
  }

  /**
   * 데이터 읽기 (렌더러 프로세스)
   */
  async read(offset, length) {
    if (!this.mappedFile) {
      throw new Error('Shared memory not initialized');
    }

    try {
      const outputFile = path.join(os.tmpdir(), `shm_read_${Date.now()}.dat`);
      const escapedOutputFile = outputFile.replace(/'/g, "''").replace(/\$/g, '`$');
      const psScript = `
$baseAddress = [IntPtr]::new(${this.baseAddress});
$offset = ${offset};
$length = ${length};
$outputFile = '${escapedOutputFile}';

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.IO;

public class SharedMemory {
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool ReadProcessMemory(
    IntPtr hProcess,
    IntPtr lpBaseAddress,
    byte[] lpBuffer,
    int nSize,
    out IntPtr lpNumberOfBytesRead
  );

  [DllImport("kernel32.dll")]
  public static extern IntPtr GetCurrentProcess();
}
'@

try {
  $targetAddress = [IntPtr]::new($baseAddress.ToInt64() + $offset);
  $buffer = New-Object byte[] $length;
  $read = [IntPtr]::Zero;
  
  $result = [SharedMemory]::ReadProcessMemory(
    [SharedMemory]::GetCurrentProcess(),
    $targetAddress,
    $buffer,
    $length,
    [ref]$read
  );

  if ($result) {
    [System.IO.File]::WriteAllBytes($outputFile, $buffer);
    $bytesRead = $read.ToInt64()
    Write-Host "SUCCESS:$bytesRead:$outputFile" -NoNewline
  } else {
    $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Host "ERROR:$errorCode" -NoNewline
  }
} catch {
  Write-Host "ERROR:Exception" -NoNewline
}
      `.trim();

      const tempScript = path.join(os.tmpdir(), `shm_read_${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, psScript, 'utf8');

      try {
        const { stdout, stderr } = await execAsync(
          `powershell -ExecutionPolicy Bypass -NoProfile -File "${tempScript}"`,
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );

        // stdout 정리
        const cleanOutput = stdout.trim().replace(/\r\n/g, '\n').split('\n').find(line => 
          line.includes('ERROR:') || line.includes('SUCCESS:')
        ) || stdout.trim();

        if (stderr && stderr.trim()) {
          console.warn('PowerShell stderr:', stderr);
        }

        if (cleanOutput.includes('ERROR:')) {
          const errorMatch = cleanOutput.match(/ERROR:(.+)/);
          const errorCode = errorMatch ? errorMatch[1].trim() : 'Unknown error';
          throw new Error(`Failed to read from shared memory: ${errorCode}`);
        }

        if (cleanOutput.includes('SUCCESS:')) {
          const successMatch = cleanOutput.match(/SUCCESS:(\d+):(.+)/);
          if (!successMatch) {
            throw new Error('Invalid SUCCESS response format');
          }
          const readBytes = parseInt(successMatch[1]);
          const outputFilePath = successMatch[2].trim();
          
          if (isNaN(readBytes)) {
            throw new Error('Invalid read bytes in SUCCESS response');
          }
          
          if (!fs.existsSync(outputFilePath)) {
            throw new Error(`Output file not found: ${outputFilePath}`);
          }
          
          const data = fs.readFileSync(outputFilePath);
          fs.unlinkSync(outputFilePath);
          
          return { success: true, data, read: readBytes };
        }

        throw new Error(`Unknown response from PowerShell script: ${cleanOutput.substring(0, 100)}`);
      } finally {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error('SharedMemory read error:', error);
      throw error;
    }
  }

  /**
   * Shared Memory 해제
   */
  async close() {
    if (this.mappedFile) {
      // PowerShell을 통해 UnmapViewOfFile 호출
      const psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class SharedMemory {
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool UnmapViewOfFile(IntPtr lpBaseAddress);
}

$baseAddress = [IntPtr]::new(${this.baseAddress});

try {
  $result = [SharedMemory]::UnmapViewOfFile($baseAddress);
  if ($result) {
    Write-Host "SUCCESS" -NoNewline
  } else {
    $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Host "ERROR:$errorCode" -NoNewline
  }
} catch {
  Write-Host "ERROR:Exception" -NoNewline
}
'@
      `.trim();

      const tempScript = path.join(os.tmpdir(), `shm_close_${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, psScript, 'utf8');

      try {
        await execAsync(
          `powershell -ExecutionPolicy Bypass -NoProfile -File "${tempScript}"`,
          { encoding: 'utf8' }
        );
      } catch (e) {
        // Ignore cleanup errors
        console.warn('SharedMemory close warning:', e.message);
      } finally {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      this.mappedFile = null;
      this.baseAddress = null;
    }

    // 메타데이터 파일 삭제
    try {
      if (fs.existsSync(this.tempFilePath)) {
        fs.unlinkSync(this.tempFilePath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

module.exports = SharedMemoryAllocator;
