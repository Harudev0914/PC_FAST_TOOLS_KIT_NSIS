// ---------
// 2025-11-08
// 개발자 : KR_Tuki
// 기능 : IPC 가상 메모리 할당자 (고수준 API)
// ---------

// @ipcAllocator.js (1-8)
// 날짜: 2025-11-08
// Import 모듈 설명:
// - sharedMemory (SharedMemoryAllocator): 공유 메모리 할당자 클래스. Windows Memory-Mapped Files 기반 IPC 제공
//   사용 예: new SharedMemoryAllocator(name, size) - 공유 메모리 할당자 생성
//   .create() - 공유 메모리 생성, .write(offset, buffer) - 메모리 쓰기, .read(offset, length) - 메모리 읽기
// 이 모듈은 SharedMemoryAllocator를 래핑하여 malloc/free처럼 사용할 수 있는 고수준 인터페이스 제공
// 변수 설명:
//   - allocator: SharedMemoryAllocator 인스턴스
//   - allocations: 할당된 메모리 영역을 추적하는 Map (offset -> { size, type })
//   - nextOffset: 다음 할당 위치를 저장하는 변수
//   - headerSize: 메타데이터 영역 크기 (1024 바이트)

const SharedMemoryAllocator = require('./sharedMemory');

class IPCAllocator {
  constructor(name = 'ElectronIPC', size = 64 * 1024 * 1024) {
    this.allocator = new SharedMemoryAllocator(name, size);
    this.isInitialized = false;
    this.allocations = new Map(); // offset -> { size, type }
    this.nextOffset = 0;
    this.headerSize = 1024; // 메타데이터 영역
  }

  /**
   * 초기화 (메인 프로세스에서 호출)
   */
  async init() {
    if (this.isInitialized) {
      return { success: true };
    }

    try {
      await this.allocator.create();
      this.nextOffset = this.headerSize;
      this.isInitialized = true;
      
      // 헤더 초기화
      const header = {
        version: 1,
        totalSize: this.allocator.size,
        allocationCount: 0,
        allocations: [],
      };
      
      await this.allocator.write(0, Buffer.from(JSON.stringify(header), 'utf8'));
      
      return { success: true, size: this.allocator.size };
    } catch (error) {
      console.error('IPCAllocator init error:', error);
      // 초기화 실패 시 상태 리셋하여 재시도 가능하도록
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 열기 (렌더러 프로세스에서 호출)
   */
  async open() {
    if (this.isInitialized) {
      return { success: true };
    }

    try {
      await this.allocator.open();
      
      // 헤더 읽기
      const headerResult = await this.allocator.read(0, this.headerSize);
      if (headerResult.success) {
        const header = JSON.parse(headerResult.data.toString('utf8'));
        this.nextOffset = this.headerSize;
        this.isInitialized = true;
        
        // 기존 할당 정보 복원
        if (header.allocations) {
          header.allocations.forEach(alloc => {
            this.allocations.set(alloc.offset, { size: alloc.size, type: alloc.type });
            if (alloc.offset + alloc.size > this.nextOffset) {
              this.nextOffset = alloc.offset + alloc.size;
            }
          });
        }
      }
      
      return { success: true, size: this.allocator.size };
    } catch (error) {
      console.error('IPCAllocator open error:', error);
      throw error;
    }
  }

  /**
   * 메모리 할당 (malloc)
   */
  async malloc(size, type = 'data') {
    if (!this.isInitialized) {
      throw new Error('IPCAllocator not initialized');
    }

    // 8바이트 정렬
    const alignedSize = Math.ceil(size / 8) * 8;
    
    if (this.nextOffset + alignedSize > this.allocator.size) {
      throw new Error('Out of shared memory');
    }

    const offset = this.nextOffset;
    this.nextOffset += alignedSize;

    // 할당 정보 저장
    this.allocations.set(offset, { size: alignedSize, type });

    // 헤더 업데이트
    await this.updateHeader();

    return { offset, size: alignedSize };
  }

  /**
   * 메모리 해제 (free)
   */
  async free(offset) {
    if (!this.isInitialized) {
      throw new Error('IPCAllocator not initialized');
    }

    if (!this.allocations.has(offset)) {
      throw new Error(`Invalid offset: ${offset}`);
    }

    this.allocations.delete(offset);
    
    // 헤더 업데이트
    await this.updateHeader();

    return { success: true };
  }

  /**
   * 데이터 쓰기
   */
  async write(offset, data) {
    if (!this.isInitialized) {
      throw new Error('IPCAllocator not initialized');
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data), 'utf8');
    
    if (!this.allocations.has(offset)) {
      throw new Error(`Invalid offset: ${offset}`);
    }

    const alloc = this.allocations.get(offset);
    if (buffer.length > alloc.size) {
      throw new Error(`Data size (${buffer.length}) exceeds allocation size (${alloc.size})`);
    }

    return await this.allocator.write(offset, buffer);
  }

  /**
   * 데이터 읽기
   */
  async read(offset) {
    if (!this.isInitialized) {
      throw new Error('IPCAllocator not initialized');
    }

    if (!this.allocations.has(offset)) {
      throw new Error(`Invalid offset: ${offset}`);
    }

    const alloc = this.allocations.get(offset);
    const result = await this.allocator.read(offset, alloc.size);
    
    if (result.success) {
      // 타입에 따라 파싱
      if (alloc.type === 'json' || alloc.type === 'systemStats') {
        try {
          if (Buffer.isBuffer(result.data)) {
            return { success: true, data: JSON.parse(result.data.toString('utf8')) };
          } else if (typeof result.data === 'string') {
            return { success: true, data: JSON.parse(result.data) };
          } else {
            return { success: true, data: result.data };
          }
        } catch (e) {
          return { success: true, data: result.data };
        }
      }
      
      return { success: true, data: result.data };
    }

    return result;
  }

  /**
   * 헤더 업데이트
   */
  async updateHeader() {
    const header = {
      version: 1,
      totalSize: this.allocator.size,
      allocationCount: this.allocations.size,
      allocations: Array.from(this.allocations.entries()).map(([offset, info]) => ({
        offset,
        size: info.size,
        type: info.type,
      })),
    };

    const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8');
    if (headerBuffer.length > this.headerSize) {
      console.warn('Header size exceeds allocated space');
    }

    await this.allocator.write(0, headerBuffer.slice(0, this.headerSize));
  }

  /**
   * 정리
   */
  async close() {
    if (this.isInitialized) {
      await this.allocator.close();
      this.isInitialized = false;
      this.allocations.clear();
      this.nextOffset = 0;
    }
  }

  /**
   * 통계 정보
   */
  getStats() {
    let totalAllocated = 0;
    this.allocations.forEach(alloc => {
      totalAllocated += alloc.size;
    });

    return {
      totalSize: this.allocator.size,
      allocated: totalAllocated,
      free: this.allocator.size - totalAllocated,
      allocationCount: this.allocations.size,
      usagePercent: ((totalAllocated / this.allocator.size) * 100).toFixed(2),
    };
  }
}

// 싱글톤 인스턴스
let globalAllocator = null;

/**
 * 전역 할당자 가져오기
 */
function getIPCAllocator(name = 'ElectronIPC', size = 64 * 1024 * 1024) {
  if (!globalAllocator) {
    globalAllocator = new IPCAllocator(name, size);
  }
  return globalAllocator;
}

module.exports = {
  IPCAllocator,
  getIPCAllocator,
};
