// ---------
// 2025-08-01
// 개발자 : KR_Tuki
// 기능 : 스마트 최적화 컴포넌트
// ---------

import React, { useState, useEffect, useRef } from 'react';
import ColorPicker from './ColorPicker';
import '../styles/SmartOptimization.css';

function SmartOptimization() {
  const loadGlobalState = () => {
    if (window.__smartOptimizationState) {
      return window.__smartOptimizationState;
    }
    return null;
  };

  const saveGlobalState = (state) => {
    window.__smartOptimizationState = state;
  };

  const globalState = loadGlobalState();
  
  const [selectedComponent, setSelectedComponent] = useState(globalState?.selectedComponent || 'cpu');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);
  const [optimizeProgress, setOptimizeProgress] = useState(globalState?.optimizeProgress || { percent: 0, currentTask: '' });
  const [optimizingComponent, setOptimizingComponent] = useState(globalState?.optimizingComponent || null);
  const [optimizationCompleted, setOptimizationCompleted] = useState(globalState?.optimizationCompleted || {});
  const [adminPermissionEnabled, setAdminPermissionEnabled] = useState(globalState?.adminPermissionEnabled || false);
  const [isAdmin, setIsAdmin] = useState(globalState?.isAdmin || false);
  const [chartColors, setChartColors] = useState(globalState?.chartColors || {
    cpu: '#7E8087',
    memory: '#7E8087',
    disk: '#7E8087',
    ethernet: '#7E8087',
    wifi: '#7E8087',
    gpu: '#7E8087',
  });
  const [historyData, setHistoryData] = useState(globalState?.historyData || {
    cpu: [],
    memory: [],
    ethernet: [],
    ethernetSend: [],
    ethernetReceive: [],
    wifi: [],
    wifiSend: [],
    wifiReceive: [],
    gpu: [],
  });
  const [systemStats, setSystemStats] = useState(globalState?.systemStats || {
    cpu: { usage: 0, speed: '0 GHz', model: 'Unknown CPU', cores: 0, threads: 0, processes: 0, handles: 0, uptime: '0:0:0:0', baseSpeed: '0 GHz', sockets: 1, virtualization: false, l1Cache: '0KB', l2Cache: '0MB', l3Cache: '0MB' },
    memory: { usage: 0, total: 0, used: 0, free: 0, unit: 'GB' },
    disk: [
      { letter: 'C:', usage: 0, total: 0, used: 0, free: 0, type: 'Unknown', name: '디스크 0 (C:)' },
    ],
    ethernet: { sendMB: 0, receiveMB: 0, name: '이더넷', adapterName: 'Unknown', ipv4: '0.0.0.0', ipv6: '::' },
    wifi: { sendMB: 0, receiveMB: 0, name: 'Wi-Fi', adapterName: 'Unknown', ipv4: '0.0.0.0', ipv6: '::' },
    gpu: [{ usage: 0, model: 'Unknown GPU', name: 'GPU 0' }],
  });
  const canvasRef = useRef(null);
  const diskActiveTimeCanvasRef = useRef(null);
  const diskReadSpeedCanvasRef = useRef(null);
  const diskWriteSpeedCanvasRef = useRef(null);
  const ethernetSendCanvasRef = useRef(null);
  const ethernetReceiveCanvasRef = useRef(null);
  const wifiSendCanvasRef = useRef(null);
  const wifiReceiveCanvasRef = useRef(null);
  const gpu3DCanvasRef = useRef(null);
  const gpuCopyCanvasRef = useRef(null);
  const gpuVideoDecodeCanvasRef = useRef(null);
  const gpuVideoProcessingCanvasRef = useRef(null);
  const gpuSharedMemoryCanvasRef = useRef(null);
  const gpuVramCanvasRef = useRef(null);
  const gpuMemoryUtilCanvasRef = useRef(null);
  const gpuTemperatureCanvasRef = useRef(null);
  const gpuPowerCanvasRef = useRef(null);
  const gpuGraphicsClockCanvasRef = useRef(null);
  const gpuMemoryClockCanvasRef = useRef(null);
  const miniCanvasRefs = useRef({});

  // 값이 유효한지 확인하는 헬퍼 함수 (Unknown, 0, null, undefined, 빈 문자열은 false)
  const isValidValue = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === 'Unknown' || trimmed === '0' || trimmed === '0.0' || trimmed === '0/0' || trimmed === '0/0GB' || trimmed === '0/0MB' || trimmed === '0:0:0:0' || trimmed === '0.0.0.0' || trimmed === '::') return false;
    }
    if (typeof value === 'number') {
      if (isNaN(value) || value === 0) return false;
    }
    if (typeof value === 'boolean') {
      return true; // boolean은 항상 유효
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return true;
  };

  // 컴포넌트 리스트 초기화 (디스크는 동적으로 추가됨)
  const [components, setComponents] = useState([
    { key: 'gpu', label: 'GPU 0' },
    { key: 'cpu', label: 'CPU' },
    { key: 'memory', label: '메모리' },
    { key: 'ethernet', label: '이더넷' },
    { key: 'wifi', label: 'Wi-Fi' },
  ]);

  // 상태 변경 시 전역 상태에 저장
  useEffect(() => {
    saveGlobalState({
      selectedComponent,
      optimizeProgress,
      optimizingComponent,
      optimizationCompleted,
      adminPermissionEnabled,
      isAdmin,
      chartColors,
      historyData,
      systemStats,
    });
  }, [selectedComponent, optimizeProgress, optimizingComponent, optimizationCompleted, adminPermissionEnabled, isAdmin, chartColors, historyData, systemStats]);

  // 탭 변경 시 최적화 결과 상세 내용 초기화 (완료 여부는 유지)
  useEffect(() => {
    setOptimizeResult(null);
  }, [selectedComponent]);

  // 스로틀링: 마지막 호출 시간 추적 (useRef로 관리하여 재렌더링 시에도 유지)
  const lastUpdateTimeRef = React.useRef(0);
  const updatePendingRef = React.useRef(false);
  const UPDATE_INTERVAL = 2000; // 2초마다 업데이트 (기존 1초에서 변경)
  
  // 실제 시스템 통계 업데이트
  const updateStats = React.useCallback(async () => {
      const now = Date.now();
      // 스로틀링: 최소 2초 간격으로만 호출
      if (now - lastUpdateTimeRef.current < UPDATE_INTERVAL) {
        return;
      }
      
      // 이미 업데이트 중이면 스킵
      if (updatePendingRef.current) {
        return;
      }
      
      updatePendingRef.current = true;
      lastUpdateTimeRef.current = now;
      
      if (window.electronAPI?.systemStats) {
        try {
          // IPC 할당자 사용 시도 (zero-copy) - 한 번만 열기
          let stats = null;
          let useSharedMemory = false;
          
          // IPC Allocator 상태 캐싱 (반복 호출 방지)
          if (!window.__ipcAllocatorOpened) {
            try {
              // IPC 할당자 열기 시도 (한 번만)
              if (window.electronAPI?.ipcAllocator) {
                const openResult = await window.electronAPI.ipcAllocator.open();
                if (openResult.success) {
                  window.__ipcAllocatorOpened = true;
                }
              }
            } catch (openError) {
              // 열기 실패 시 일반 IPC 사용
              window.__ipcAllocatorOpened = false;
            }
          }
          
          // 이미 열려있으면 shared memory 사용 시도
          if (window.__ipcAllocatorOpened && window.electronAPI?.ipcAllocator) {
            try {
              // systemStats.getAll() 호출 (shared memory offset 포함)
              const statsResult = await window.electronAPI.systemStats.getAll();
              
              if (statsResult._useSharedMemory && statsResult._sharedMemoryOffset) {
                // Shared memory에서 직접 읽기
                const readResult = await window.electronAPI.ipcAllocator.read(statsResult._sharedMemoryOffset);
                if (readResult.success) {
                  // Buffer를 JSON으로 파싱
                  if (Buffer.isBuffer(readResult.data)) {
                    stats = JSON.parse(readResult.data.toString('utf8'));
                  } else if (typeof readResult.data === 'string') {
                    stats = JSON.parse(readResult.data);
                  } else {
                    stats = readResult.data;
                  }
                  useSharedMemory = true;
                } else {
                  // 읽기 실패 시 일반 IPC로 폴백
                  window.__ipcAllocatorOpened = false;
                }
              }
            } catch (sharedMemoryError) {
              // Shared memory 접근 실패 시 일반 IPC로 폴백
              window.__ipcAllocatorOpened = false;
            }
          }
          
          // Shared memory 실패 시 일반 IPC 사용
          if (!stats) {
            stats = await window.electronAPI.systemStats.getAll();
            // _useSharedMemory, _sharedMemoryOffset 제거
            if (stats._useSharedMemory !== undefined) {
              delete stats._useSharedMemory;
              delete stats._sharedMemoryOffset;
            }
          }
          
          const diskArray = Array.isArray(stats.disk) ? stats.disk : (stats.disk ? [stats.disk] : []);
          
          setSystemStats(prev => ({
            cpu: { ...prev.cpu, ...stats.cpu },
            memory: { ...prev.memory, ...stats.memory },
            disk: diskArray,
            ethernet: { ...prev.ethernet, ...stats.ethernet },
            wifi: { ...prev.wifi, ...stats.wifi },
            gpu: Array.isArray(stats.gpu) ? stats.gpu : (stats.gpu ? [stats.gpu] : prev.gpu),
          }));

          // 컴포넌트 리스트 업데이트 (디스크 동적 추가)
          setComponents(prev => {
            const baseComponents = prev.filter(c => !c.key.startsWith('disk-'));
            const diskComponents = diskArray.map((disk, index) => {
              // 디스크 타입 표시 (SSD, HDD, SSD(NVMe) 등)
              let typeLabel = '';
              if (disk.type) {
                if (disk.type === 'SSD(NVMe)') {
                  typeLabel = 'SSD(NVMe)';
                } else if (disk.type === 'SSD') {
                  typeLabel = 'SSD';
                } else if (disk.type === 'HDD') {
                  typeLabel = 'HDD';
                } else {
                  typeLabel = disk.type;
                }
              } else {
                typeLabel = 'Unknown';
              }
              return {
                key: `disk-${disk.letter}`,
                label: `디스크 ${index} (${disk.letter}) ${typeLabel}`,
              };
            });
            const gpuComponents = Array.isArray(stats.gpu) ? stats.gpu : (stats.gpu ? [stats.gpu] : []);
            const gpuList = gpuComponents.map((gpu, index) => ({
              key: `gpu-${index}`,
              label: `GPU ${index}`,
            }));
            
            // CPU, Memory, 디스크들, 이더넷, WiFi, GPU 순서로 정렬
            const cpuComp = baseComponents.find(c => c.key === 'cpu');
            const memComp = baseComponents.find(c => c.key === 'memory');
            const ethComp = baseComponents.find(c => c.key === 'ethernet');
            const wifiComp = baseComponents.find(c => c.key === 'wifi');
            
            return [
              ...(cpuComp ? [cpuComp] : []),
              ...(memComp ? [memComp] : []),
              ...diskComponents,
              ...(ethComp ? [ethComp] : []),
              ...(wifiComp ? [wifiComp] : []),
              ...gpuList,
            ];
          });

          // 히스토리 데이터 추가 (최대 60개 유지) - 함수형 업데이트 사용
          const timestamp = Date.now();
          const gpuData = Array.isArray(stats.gpu) ? stats.gpu[0] : stats.gpu;
          
          // WiFi와 이더넷의 경우 초당 속도 계산 (MB/s)
          // 이전 값과 비교하여 초당 속도 계산
          const ethernetSendMB = (stats.ethernet?.sendMB || 0); // MB (누적)
          const ethernetReceiveMB = (stats.ethernet?.receiveMB || 0); // MB (누적)
          const wifiSendMB = (stats.wifi?.sendMB || 0); // MB (누적)
          const wifiReceiveMB = (stats.wifi?.receiveMB || 0); // MB (누적)
          
          // 함수형 업데이트를 사용하여 최신 historyData 참조
          setHistoryData(prevHistoryData => {
            // 이전 누적 값 가져오기 (초당 속도 계산용)
            const prevEthernetSendTotal = prevHistoryData?.['ethernet-send-total']?.length > 0 
              ? prevHistoryData['ethernet-send-total'][prevHistoryData['ethernet-send-total'].length - 1]?.value 
              : ethernetSendMB;
            const prevEthernetReceiveTotal = prevHistoryData?.['ethernet-receive-total']?.length > 0
              ? prevHistoryData['ethernet-receive-total'][prevHistoryData['ethernet-receive-total'].length - 1]?.value
              : ethernetReceiveMB;
            const prevWifiSendTotal = prevHistoryData?.['wifi-send-total']?.length > 0
              ? prevHistoryData['wifi-send-total'][prevHistoryData['wifi-send-total'].length - 1]?.value
              : wifiSendMB;
            const prevWifiReceiveTotal = prevHistoryData?.['wifi-receive-total']?.length > 0
              ? prevHistoryData['wifi-receive-total'][prevHistoryData['wifi-receive-total'].length - 1]?.value
              : wifiReceiveMB;
            
            // 초당 속도 계산 (MB/s) - 2초 간격이므로 2로 나눔
            // 첫 번째 호출이거나 이전 값이 현재 값보다 큰 경우(재시작 등) 0으로 설정
            const ethernetSendSpeed = Math.max(0, (ethernetSendMB >= prevEthernetSendTotal ? (ethernetSendMB - prevEthernetSendTotal) : 0) / 2);
            const ethernetReceiveSpeed = Math.max(0, (ethernetReceiveMB >= prevEthernetReceiveTotal ? (ethernetReceiveMB - prevEthernetReceiveTotal) : 0) / 2);
            const wifiSendSpeed = Math.max(0, (wifiSendMB >= prevWifiSendTotal ? (wifiSendMB - prevWifiSendTotal) : 0) / 2);
            const wifiReceiveSpeed = Math.max(0, (wifiReceiveMB >= prevWifiReceiveTotal ? (wifiReceiveMB - prevWifiReceiveTotal) : 0) / 2);
            // 각 디스크별 히스토리 데이터 업데이트
            const newHistoryData = {
              cpu: [...(prevHistoryData.cpu || []).slice(-59), { time: timestamp, value: stats.cpu?.usage || 0 }],
              memory: [...(prevHistoryData.memory || []).slice(-59), { time: timestamp, value: stats.memory?.usage || 0 }],
              ethernet: [...(prevHistoryData.ethernet || []).slice(-59), { time: timestamp, value: ethernetSendSpeed + ethernetReceiveSpeed }],
              'ethernet-send': [...(prevHistoryData['ethernet-send'] || []).slice(-59), { time: timestamp, value: ethernetSendSpeed }],
              'ethernet-receive': [...(prevHistoryData['ethernet-receive'] || []).slice(-59), { time: timestamp, value: ethernetReceiveSpeed }],
              'ethernet-send-total': [...(prevHistoryData['ethernet-send-total'] || []).slice(-59), { time: timestamp, value: ethernetSendMB }],
              'ethernet-receive-total': [...(prevHistoryData['ethernet-receive-total'] || []).slice(-59), { time: timestamp, value: ethernetReceiveMB }],
              wifi: [...(prevHistoryData.wifi || []).slice(-59), { time: timestamp, value: wifiSendSpeed + wifiReceiveSpeed }],
              'wifi-send': [...(prevHistoryData['wifi-send'] || []).slice(-59), { time: timestamp, value: wifiSendSpeed }],
              'wifi-receive': [...(prevHistoryData['wifi-receive'] || []).slice(-59), { time: timestamp, value: wifiReceiveSpeed }],
              'wifi-send-total': [...(prevHistoryData['wifi-send-total'] || []).slice(-59), { time: timestamp, value: wifiSendMB }],
              'wifi-receive-total': [...(prevHistoryData['wifi-receive-total'] || []).slice(-59), { time: timestamp, value: wifiReceiveMB }],
              // GPU 사용률 (gpu와 gpu-0 둘 다 저장)
              gpu: [...(prevHistoryData.gpu || []).slice(-59), { time: timestamp, value: gpuData?.usage || 0 }],
              'gpu-0': [...(prevHistoryData['gpu-0'] || []).slice(-59), { time: timestamp, value: gpuData?.usage || 0 }],
            };
            
            // 각 디스크별 히스토리 데이터 추가
            diskArray.forEach(disk => {
              const diskKey = `disk-${disk.letter}`;
              const diskKeyUsage = `${diskKey}-usage`;
              const diskKeyActiveTime = `${diskKey}-activeTime`;
              const diskKeyReadSpeed = `${diskKey}-readSpeed`;
              const diskKeyWriteSpeed = `${diskKey}-writeSpeed`;
              
              // 읽기/쓰기 속도 (KB/s → MB/s) - 값이 없거나 0이어도 기록
              const diskReadSpeedKB = disk.readSpeed || 0;
              const diskWriteSpeedKB = disk.writeSpeed || 0;
              const diskReadSpeedMB = diskReadSpeedKB / 1024;
              const diskWriteSpeedMB = diskWriteSpeedKB / 1024;
              
              // 활성 시간: 백분율(%)을 실제 시간(초)으로 변환
              // UPDATE_INTERVAL (2000ms = 2초) 동안의 활성 시간 계산
              // activeTime은 백분율이므로: (activeTime% / 100) * 2초 = 실제 활성 시간(초)
              const activeTimePercent = disk.activeTime !== undefined ? disk.activeTime : 0;
              const activeTimeSeconds = (activeTimePercent / 100) * 2;
              
              // 데이터가 0이어도 기록 (차트에 그리드라도 표시)
              newHistoryData[diskKeyUsage] = [...((prevHistoryData[diskKeyUsage] || []).slice(-59)), { time: timestamp, value: disk.usage || 0 }];
              newHistoryData[diskKeyActiveTime] = [...((prevHistoryData[diskKeyActiveTime] || []).slice(-59)), { time: timestamp, value: activeTimeSeconds }];
              newHistoryData[diskKeyReadSpeed] = [...((prevHistoryData[diskKeyReadSpeed] || []).slice(-59)), { time: timestamp, value: diskReadSpeedMB }];
              newHistoryData[diskKeyWriteSpeed] = [...((prevHistoryData[diskKeyWriteSpeed] || []).slice(-59)), { time: timestamp, value: diskWriteSpeedMB }];
            });
            
            // GPU 세부 히스토리 데이터 추가 (gpu-0 형식으로 저장, systeminformation/nvidia-smi에서 가져올 수 있는 모든 값)
            if (gpuData) {
              const gpuKey = 'gpu-0'; // 항상 gpu-0으로 저장
              
              // 기본 GPU 사용률 (%)
              if (gpuData.usage !== undefined && gpuData.usage !== null) {
                newHistoryData[gpuKey] = [...((prevHistoryData[gpuKey] || []).slice(-59)), { time: timestamp, value: gpuData.usage }];
              }
              
              // 메모리 사용률 (%) - nvidia-smi에서
              if (gpuData.memoryUtilization !== undefined && gpuData.memoryUtilization !== null) {
                newHistoryData[`${gpuKey}-MemoryUtil`] = [...((prevHistoryData[`${gpuKey}-MemoryUtil`] || []).slice(-59)), { time: timestamp, value: gpuData.memoryUtilization }];
              }
              
              // 3D 사용률 (%)
              if (gpuData.usage3D !== undefined && gpuData.usage3D !== null && gpuData.usage3D > 0) {
                newHistoryData[`${gpuKey}-3D`] = [...((prevHistoryData[`${gpuKey}-3D`] || []).slice(-59)), { time: timestamp, value: gpuData.usage3D }];
              }
              
              // Copy 사용률 (%)
              if (gpuData.usageCopy !== undefined && gpuData.usageCopy !== null && gpuData.usageCopy > 0) {
                newHistoryData[`${gpuKey}-Copy`] = [...((prevHistoryData[`${gpuKey}-Copy`] || []).slice(-59)), { time: timestamp, value: gpuData.usageCopy }];
              }
              
              // Video Decode 사용률 (%)
              if (gpuData.usageVideoDecode !== undefined && gpuData.usageVideoDecode !== null && gpuData.usageVideoDecode > 0) {
                newHistoryData[`${gpuKey}-VideoDecode`] = [...((prevHistoryData[`${gpuKey}-VideoDecode`] || []).slice(-59)), { time: timestamp, value: gpuData.usageVideoDecode }];
              }
              
              // Video Processing 사용률 (%)
              if (gpuData.usageVideoProcessing !== undefined && gpuData.usageVideoProcessing !== null && gpuData.usageVideoProcessing > 0) {
                newHistoryData[`${gpuKey}-VideoProcessing`] = [...((prevHistoryData[`${gpuKey}-VideoProcessing`] || []).slice(-59)), { time: timestamp, value: gpuData.usageVideoProcessing }];
              }
              
              // Shared GPU Memory (GB 단위) - 사용량
              if (gpuData.sharedMemoryUsed !== undefined && gpuData.sharedMemoryUsed !== null && gpuData.sharedMemoryUsed > 0) {
                newHistoryData[`${gpuKey}-SharedMemory`] = [...((prevHistoryData[`${gpuKey}-SharedMemory`] || []).slice(-59)), { time: timestamp, value: gpuData.sharedMemoryUsed }];
              } else {
                // 문자열에서 파싱 시도
                const sharedMemMatch = (gpuData.sharedGpuMemory || '0/0GB').match(/([\d.]+)\/([\d.]+)GB/);
                if (sharedMemMatch) {
                  const sharedMemoryUsed = parseFloat(sharedMemMatch[1]) || 0;
                  if (sharedMemoryUsed > 0) {
                    newHistoryData[`${gpuKey}-SharedMemory`] = [...((prevHistoryData[`${gpuKey}-SharedMemory`] || []).slice(-59)), { time: timestamp, value: sharedMemoryUsed }];
                  }
                }
              }
              
              // VRAM 사용률 (%)
              if (gpuData.vramUsedPercent !== undefined && gpuData.vramUsedPercent !== null && gpuData.vramUsedPercent > 0) {
                newHistoryData[`${gpuKey}-VRAM`] = [...((prevHistoryData[`${gpuKey}-VRAM`] || []).slice(-59)), { time: timestamp, value: gpuData.vramUsedPercent }];
              }
              
              // VRAM 사용량 (MB 단위)
              if (gpuData.vramUsed !== undefined && gpuData.vramUsed !== null && gpuData.vramUsed > 0) {
                newHistoryData[`${gpuKey}-VRAMUsed`] = [...((prevHistoryData[`${gpuKey}-VRAMUsed`] || []).slice(-59)), { time: timestamp, value: gpuData.vramUsed }];
              }
              
              // GPU 온도 (°C) - nvidia-smi에서
              if (gpuData.temperature !== undefined && gpuData.temperature !== null && gpuData.temperature > 0) {
                newHistoryData[`${gpuKey}-Temperature`] = [...((prevHistoryData[`${gpuKey}-Temperature`] || []).slice(-59)), { time: timestamp, value: gpuData.temperature }];
              }
              
              // 전력 소비 (W) - nvidia-smi에서
              if (gpuData.powerDraw !== undefined && gpuData.powerDraw !== null && gpuData.powerDraw > 0) {
                newHistoryData[`${gpuKey}-Power`] = [...((prevHistoryData[`${gpuKey}-Power`] || []).slice(-59)), { time: timestamp, value: gpuData.powerDraw }];
              }
              
              // 그래픽 클럭 (MHz) - nvidia-smi에서
              if (gpuData.graphicsClock !== undefined && gpuData.graphicsClock !== null && gpuData.graphicsClock > 0) {
                newHistoryData[`${gpuKey}-GraphicsClock`] = [...((prevHistoryData[`${gpuKey}-GraphicsClock`] || []).slice(-59)), { time: timestamp, value: gpuData.graphicsClock }];
              }
              
              // 메모리 클럭 (MHz) - nvidia-smi에서
              if (gpuData.memoryClock !== undefined && gpuData.memoryClock !== null && gpuData.memoryClock > 0) {
                newHistoryData[`${gpuKey}-MemoryClock`] = [...((prevHistoryData[`${gpuKey}-MemoryClock`] || []).slice(-59)), { time: timestamp, value: gpuData.memoryClock }];
              }
            }
            
            return newHistoryData;
          });
        } catch (error) {
          console.error('Error fetching system stats:', error);
        } finally {
          updatePendingRef.current = false;
        }
      } else {
        updatePendingRef.current = false;
      }
    }, [selectedComponent]);

  useEffect(() => {
    // 관리자 권한 상태 확인 및 토글 초기화
    const checkAdminStatus = async () => {
      if (window.electronAPI?.permissions?.isAdmin) {
        const adminStatus = await window.electronAPI.permissions.isAdmin();
        setIsAdmin(adminStatus);
        // 관리자 권한이 있으면 토글을 ON으로 설정, 없으면 OFF
        setAdminPermissionEnabled(adminStatus);
      }
    };
    checkAdminStatus();
    
    // 초기 로드 - 백그라운드에서 즉시 시작 (UI 블로킹 방지)
    // Promise로 감싸서 비동기 처리
    Promise.resolve().then(() => {
      updateStats();
    });

    // 2초마다 업데이트 - 백그라운드에서 비동기로 처리 (스로틀링 적용)
    const interval = setInterval(() => {
      // 백그라운드에서 비동기로 업데이트 (UI 블로킹 방지)
      Promise.resolve().then(() => {
        updateStats();
      });
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [updateStats]);

  // 차트 그리기 헬퍼 함수 (useCallback으로 메모이제이션)
  const drawChart = React.useCallback((ctx, data, color, maxValue) => {
    if (!ctx || !ctx.canvas) return;
    
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // 배경 지우기
    ctx.fillStyle = '#1A1A1E';
    ctx.fillRect(0, 0, width, height);

    // 그리드 그리기
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 데이터가 없으면 그리드만 표시하고 종료
    if (!data || data.length === 0) {
      // 그리드만 표시하고 종료 (데이터가 없어도 차트는 표시)
      return;
    }

    const points = data.map((d, i) => {
      const x = data.length > 1 ? (width / (data.length - 1)) * i : width / 2;
      const y = height - Math.max(0, Math.min(height, (d.value / maxValue) * height));
      return { x, y };
    });

    // 영역 차트 그리기 (라인 아래 영역 채우기)
    if (points.length > 1) {
      // 그라디언트 생성 (영역 채우기용)
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '00'); // 투명도 추가
      
      // 영역 채우기
      ctx.fillStyle = color + '40'; // 약간 투명한 색상 (hex alpha: 40 = 약 25% 불투명도)
      ctx.beginPath();
      ctx.moveTo(points[0].x, height); // 왼쪽 하단
      ctx.lineTo(points[0].x, points[0].y); // 첫 번째 점
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, height); // 오른쪽 하단
      ctx.closePath();
      ctx.fill();
      
      // 라인 그리기
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      
      // 각 포인트에 점 그리기 (시간별 포인트)
      ctx.fillStyle = color;
      points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();
        // 점 주변에 배경색 테두리 추가 (가시성 향상)
        ctx.strokeStyle = '#1A1A1E';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    } else if (points.length === 1) {
      // 데이터가 1개일 때도 영역으로 표시
      ctx.fillStyle = color + '40';
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, points[0].y);
      ctx.lineTo(width, points[0].y);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
      
      // 라인 그리기
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, points[0].y);
      ctx.lineTo(width, points[0].y);
      ctx.stroke();
      
      // 포인트에 점 그리기
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1A1A1E';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, []);

  // 디스크 차트 그리기 (Active Time, Read Speed, Write Speed) - historyData 업데이트 시마다 재그리기
  useEffect(() => {
    if (!selectedComponent.startsWith('disk-')) return;
    
    const activeTimeCanvas = diskActiveTimeCanvasRef.current;
    const readSpeedCanvas = diskReadSpeedCanvasRef.current;
    const writeSpeedCanvas = diskWriteSpeedCanvasRef.current;
    if (!activeTimeCanvas || !readSpeedCanvas || !writeSpeedCanvas) return;

    const activeTimeKey = `${selectedComponent}-activeTime`;
    const readSpeedKey = `${selectedComponent}-readSpeed`;
    const writeSpeedKey = `${selectedComponent}-writeSpeed`;
    const color = chartColors[selectedComponent] || '#7E8087';

    // Active Time 차트 그리기 (초 단위, 동적 최대값 계산)
    const activeTimeCtx = activeTimeCanvas.getContext('2d');
    const activeTimeData = historyData[activeTimeKey] || [];
    if (activeTimeCtx) {
      const maxDataValue = activeTimeData.length > 0 ? Math.max(...activeTimeData.map(d => d.value || 0)) : 0;
      const maxValue = Math.max(0.5, Math.ceil(maxDataValue * 1.2));
      drawChart(activeTimeCtx, activeTimeData, color, maxValue);
    }

    // Read Speed 차트 그리기 (MB/s 단위) - 동적 최대값 계산
    const readSpeedCtx = readSpeedCanvas.getContext('2d');
    const readSpeedData = historyData[readSpeedKey] || [];
    if (readSpeedCtx) {
      const maxDataValue = readSpeedData.length > 0 ? Math.max(...readSpeedData.map(d => d.value || 0)) : 0;
      const maxValue = Math.max(1, Math.ceil(maxDataValue * 1.2));
      drawChart(readSpeedCtx, readSpeedData, color, maxValue);
    }

    // Write Speed 차트 그리기 (MB/s 단위) - 동적 최대값 계산
    const writeSpeedCtx = writeSpeedCanvas.getContext('2d');
    const writeSpeedData = historyData[writeSpeedKey] || [];
    if (writeSpeedCtx) {
      const maxDataValue = writeSpeedData.length > 0 ? Math.max(...writeSpeedData.map(d => d.value || 0)) : 0;
      const maxValue = Math.max(1, Math.ceil(maxDataValue * 1.2));
      drawChart(writeSpeedCtx, writeSpeedData, color, maxValue);
    }
  }, [historyData, selectedComponent, chartColors, drawChart]);

  // GPU 세부 차트 그리기 (3D, Copy, Video Decode, Video Processing, Shared Memory, VRAM)
  useEffect(() => {
    if (selectedComponent !== 'gpu' && !selectedComponent.startsWith('gpu-')) return;
    
    const gpuKey = 'gpu-0'; // 항상 gpu-0으로 처리
    const color = chartColors[selectedComponent] || chartColors['gpu'] || '#7E8087';
    // systemStats에서 직접 GPU 데이터 가져오기
    const gpuArray = Array.isArray(systemStats.gpu) ? systemStats.gpu : (systemStats.gpu ? [systemStats.gpu] : []);
    const gpuData = gpuArray[0] || null;
    
    // 3D Usage 차트
    const canvas3D = gpu3DCanvasRef.current;
    if (canvas3D) {
      const ctx3D = canvas3D.getContext('2d');
      const data3D = historyData[`${gpuKey}-3D`] || [];
      if (ctx3D) {
        const maxValue = 100; // 0-100% 범위
        drawChart(ctx3D, data3D, color, maxValue);
      }
    }
    
    // Copy Usage 차트
    const canvasCopy = gpuCopyCanvasRef.current;
    if (canvasCopy) {
      const ctxCopy = canvasCopy.getContext('2d');
      const dataCopy = historyData[`${gpuKey}-Copy`] || [];
      if (ctxCopy) {
        const maxValue = 100; // 0-100% 범위
        drawChart(ctxCopy, dataCopy, color, maxValue);
      }
    }
    
    // Video Decode Usage 차트
    const canvasVideoDecode = gpuVideoDecodeCanvasRef.current;
    if (canvasVideoDecode) {
      const ctxVideoDecode = canvasVideoDecode.getContext('2d');
      const dataVideoDecode = historyData[`${gpuKey}-VideoDecode`] || [];
      if (ctxVideoDecode) {
        const maxValue = 100; // 0-100% 범위
        drawChart(ctxVideoDecode, dataVideoDecode, color, maxValue);
      }
    }
    
    // Video Processing Usage 차트
    const canvasVideoProcessing = gpuVideoProcessingCanvasRef.current;
    if (canvasVideoProcessing) {
      const ctxVideoProcessing = canvasVideoProcessing.getContext('2d');
      const dataVideoProcessing = historyData[`${gpuKey}-VideoProcessing`] || [];
      if (ctxVideoProcessing) {
        const maxValue = 100; // 0-100% 범위
        drawChart(ctxVideoProcessing, dataVideoProcessing, color, maxValue);
      }
    }
    
    // Shared GPU Memory 차트 (GB 단위)
    const canvasSharedMemory = gpuSharedMemoryCanvasRef.current;
    if (canvasSharedMemory) {
      const ctxSharedMemory = canvasSharedMemory.getContext('2d');
      const dataSharedMemory = historyData[`${gpuKey}-SharedMemory`] || [];
      if (ctxSharedMemory) {
        // Shared Memory Total은 systemStats에서 가져오기
        const sharedMemoryTotal = gpuData?.sharedMemoryTotal || parseFloat((gpuData?.sharedGpuMemory || '0/0GB').split('/')[1]?.replace('GB', '') || '0') || 1;
        const maxValue = Math.max(1, Math.ceil(sharedMemoryTotal * 1.2)); // 최소 1GB
        drawChart(ctxSharedMemory, dataSharedMemory, color, maxValue);
      }
    }
    
    // VRAM 사용률 차트 (%)
    const canvasVRAM = gpuVramCanvasRef.current;
    if (canvasVRAM) {
      const ctxVRAM = canvasVRAM.getContext('2d');
      const dataVRAM = historyData[`${gpuKey}-VRAM`] || [];
      if (ctxVRAM) {
        const maxValue = 100; // 0-100% 범위
        drawChart(ctxVRAM, dataVRAM, color, maxValue);
      }
    }
    
    // 메모리 사용률 차트 (%) - nvidia-smi에서
    const canvasMemoryUtil = gpuMemoryUtilCanvasRef.current;
    if (canvasMemoryUtil) {
      const ctxMemoryUtil = canvasMemoryUtil.getContext('2d');
      const dataMemoryUtil = historyData[`${gpuKey}-MemoryUtil`] || [];
      if (ctxMemoryUtil) {
        const maxValue = 100; // 0-100% 범위
        drawChart(ctxMemoryUtil, dataMemoryUtil, color, maxValue);
      }
    }
    
    // GPU 온도 차트 (°C) - nvidia-smi에서
    const canvasTemperature = gpuTemperatureCanvasRef.current;
    if (canvasTemperature) {
      const ctxTemperature = canvasTemperature.getContext('2d');
      const dataTemperature = historyData[`${gpuKey}-Temperature`] || [];
      if (ctxTemperature) {
        // 온도는 일반적으로 0-100°C 범위 (최대값은 동적으로 계산)
        const maxDataValue = dataTemperature.length > 0 ? Math.max(...dataTemperature.map(d => d.value || 0)) : 0;
        const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2)); // 최소 50°C
        drawChart(ctxTemperature, dataTemperature, color, maxValue);
      }
    }
    
    // 전력 소비 차트 (W) - nvidia-smi에서
    const canvasPower = gpuPowerCanvasRef.current;
    if (canvasPower) {
      const ctxPower = canvasPower.getContext('2d');
      const dataPower = historyData[`${gpuKey}-Power`] || [];
      if (ctxPower) {
        // 전력은 GPU에 따라 다르므로 동적으로 계산
        const maxDataValue = dataPower.length > 0 ? Math.max(...dataPower.map(d => d.value || 0)) : 0;
        const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2)); // 최소 50W
        drawChart(ctxPower, dataPower, color, maxValue);
      }
    }
    
    // 그래픽 클럭 차트 (MHz) - nvidia-smi에서
    const canvasGraphicsClock = gpuGraphicsClockCanvasRef.current;
    if (canvasGraphicsClock) {
      const ctxGraphicsClock = canvasGraphicsClock.getContext('2d');
      const dataGraphicsClock = historyData[`${gpuKey}-GraphicsClock`] || [];
      if (ctxGraphicsClock) {
        // 클럭은 GPU에 따라 다르므로 동적으로 계산
        const maxDataValue = dataGraphicsClock.length > 0 ? Math.max(...dataGraphicsClock.map(d => d.value || 0)) : 0;
        const maxValue = Math.max(1000, Math.ceil(maxDataValue * 1.1)); // 최소 1000MHz
        drawChart(ctxGraphicsClock, dataGraphicsClock, color, maxValue);
      }
    }
    
    // 메모리 클럭 차트 (MHz) - nvidia-smi에서
    const canvasMemoryClock = gpuMemoryClockCanvasRef.current;
    if (canvasMemoryClock) {
      const ctxMemoryClock = canvasMemoryClock.getContext('2d');
      const dataMemoryClock = historyData[`${gpuKey}-MemoryClock`] || [];
      if (ctxMemoryClock) {
        // 클럭은 GPU에 따라 다르므로 동적으로 계산
        const maxDataValue = dataMemoryClock.length > 0 ? Math.max(...dataMemoryClock.map(d => d.value || 0)) : 0;
        const maxValue = Math.max(1000, Math.ceil(maxDataValue * 1.1)); // 최소 1000MHz
        drawChart(ctxMemoryClock, dataMemoryClock, color, maxValue);
      }
    }
  }, [historyData, selectedComponent, chartColors, drawChart, systemStats]);

  // 네트워크 차트 그리기 (이더넷, WiFi - 보내기/받기)
  useEffect(() => {
    if (selectedComponent !== 'ethernet' && selectedComponent !== 'wifi') return;
    
    const sendCanvas = selectedComponent === 'ethernet' ? ethernetSendCanvasRef.current : wifiSendCanvasRef.current;
    const receiveCanvas = selectedComponent === 'ethernet' ? ethernetReceiveCanvasRef.current : wifiReceiveCanvasRef.current;
    if (!sendCanvas || !receiveCanvas) return;

    const sendKey = `${selectedComponent}-send`;
    const receiveKey = `${selectedComponent}-receive`;
    const color = chartColors[selectedComponent] || '#7E8087';

    // 보내기 속도 차트 (MB/s 단위)
    const sendCtx = sendCanvas.getContext('2d');
    const sendData = historyData[sendKey] || [];
    if (sendCtx) {
      // 데이터가 없어도 차트를 그리기 위해 최소값 설정
      const maxDataValue = sendData.length > 0 ? Math.max(...sendData.map(d => d.value || 0)) : 0;
      const maxValue = Math.max(1, Math.ceil(maxDataValue * 1.2)); // 최소 1 MB/s (0이면 차트가 안 보임)
      drawChart(sendCtx, sendData, color, maxValue);
    }

    // 받기 속도 차트 (MB/s 단위)
    const receiveCtx = receiveCanvas.getContext('2d');
    const receiveData = historyData[receiveKey] || [];
    if (receiveCtx) {
      // 데이터가 없어도 차트를 그리기 위해 최소값 설정
      const maxDataValue = receiveData.length > 0 ? Math.max(...receiveData.map(d => d.value || 0)) : 0;
      const maxValue = Math.max(1, Math.ceil(maxDataValue * 1.2)); // 최소 1 MB/s (0이면 차트가 안 보임)
      drawChart(receiveCtx, receiveData, color, maxValue);
    }
  }, [historyData, selectedComponent, chartColors, drawChart]);

  // GPU 메인 차트 그리기 (GPU 사용률)
  useEffect(() => {
    if (selectedComponent !== 'gpu' && !selectedComponent.startsWith('gpu-')) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // GPU 히스토리 데이터 가져오기 (gpu-0 형식)
    const data = historyData['gpu-0'] || historyData.gpu || [];
    
    // 그래프 색상
    const color = chartColors[selectedComponent] || chartColors['gpu'] || '#7E8087';

    // GPU 사용률은 0-100% 범위
    drawChart(ctx, data, color, 100);
  }, [historyData, selectedComponent, chartColors, drawChart]);

  // 일반 차트 그리기 (CPU, Memory) - historyData 업데이트 시마다 다시 그리기
  useEffect(() => {
    if (selectedComponent.startsWith('disk-') || selectedComponent === 'ethernet' || selectedComponent === 'wifi' || selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) return; // 디스크, 네트워크, GPU는 별도 처리
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 현재 선택된 컴포넌트의 히스토리 데이터 가져오기
    let data = historyData[selectedComponent] || [];
    
    // GPU의 경우 gpu-0 형식으로 키가 저장되어 있을 수 있음
    if (selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) {
      data = historyData['gpu-0'] || historyData.gpu || [];
    }
    
    // 그래프 색상 (사용자가 선택한 색상)
    const color = chartColors[selectedComponent] || '#7E8087';

    // 데이터 정규화 및 그리기
    // CPU, Memory, GPU: 0-100% 범위
    let maxValue = 100;
    if (selectedComponent === 'cpu' || selectedComponent === 'memory' || selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) {
      maxValue = 100; // CPU, Memory, GPU는 0-100% 범위
    }
    
    // drawChart 함수를 사용하여 차트 그리기 (배경, 그리드, 데이터 모두 포함)
    drawChart(ctx, data, color, maxValue);
  }, [historyData, selectedComponent, chartColors, drawChart]);

  // 미니 차트 그리기 - 별도 useEffect로 분리하여 historyData 업데이트 시마다 다시 그리기
  useEffect(() => {
    components.forEach((comp) => {
      const key = comp.key;
      const miniCanvas = miniCanvasRefs.current[key];
      if (!miniCanvas) return;

      const miniCtx = miniCanvas.getContext('2d');
      if (!miniCtx) return;

      // 데이터 가져오기 (디스크는 usage 데이터 사용, 네트워크는 총 속도 사용, GPU는 gpu-0 형식)
      let miniData = [];
      if (key.startsWith('disk-')) {
        const diskKey = `${key}-usage`;
        miniData = historyData[diskKey] || [];
      } else if (key === 'ethernet' || key === 'wifi') {
        // 네트워크는 총 속도 (보내기 + 받기)
        miniData = historyData[key] || [];
      } else if (key === 'gpu') {
        // GPU는 gpu-0 형식으로 저장됨
        miniData = historyData['gpu-0'] || historyData.gpu || [];
      } else {
        miniData = historyData[key] || [];
      }

      // 색상
      const miniColor = chartColors[key] || '#7E8087';

      // 최대값 계산
      let miniMaxValue = 100;
      if (key === 'ethernet' || key === 'wifi') {
        // 네트워크 속도: 데이터에서 최대값을 찾아서 1.2배로 여유 공간 확보 (최소 10 MB/s)
        const maxDataValue = miniData.length > 0 ? Math.max(...miniData.map(d => d.value || 0)) : 0;
        miniMaxValue = Math.max(10, Math.ceil(maxDataValue * 1.2)); // 최소 10 MB/s, 최대값의 1.2배
      } else if (key.startsWith('disk-')) {
        miniMaxValue = 100; // 디스크 사용률은 0-100%
      }

      // drawChart 함수 사용 (데이터가 없어도 그리드 표시)
      drawChart(miniCtx, miniData, miniColor, miniMaxValue);
    });
  }, [historyData, chartColors, components, drawChart]);

  const getComponentDisplay = (key) => {
    // 디스크 키 처리 (disk-{letter} 형식)
    if (key.startsWith('disk-')) {
      const diskLetter = key.replace('disk-', '');
      const diskArray = Array.isArray(systemStats.disk) ? systemStats.disk : (systemStats.disk ? [systemStats.disk] : []);
      const disk = diskArray.find(d => d.letter === diskLetter);
      if (disk) {
        return {
          usage: disk.usage || 0,
          detail: `${disk.type || 'Unknown'}`,
        };
      }
      return { usage: 0, detail: 'Unknown' };
    }
    
    // GPU 키 처리 (gpu-{index} 형식)
    if (key.startsWith('gpu-')) {
      const gpuIndex = parseInt(key.replace('gpu-', ''));
      const gpuArray = Array.isArray(systemStats.gpu) ? systemStats.gpu : (systemStats.gpu ? [systemStats.gpu] : []);
      const gpu = gpuArray[gpuIndex];
      if (gpu) {
        return {
          usage: gpu.usage || 0,
          detail: gpu.model || 'Unknown GPU',
        };
      }
      return { usage: 0, detail: 'Unknown GPU' };
    }

    const stat = systemStats[key];
    if (!stat) return { usage: 0, detail: '' };

    if (key === 'cpu') {
      return {
        usage: stat.usage || 0,
        detail: `${stat.speed || '0 GHz'}`,
      };
    }
    if (key === 'memory') {
      return {
        usage: stat.usage || 0,
        detail: `${stat.used || 0}/${stat.total || 0}GB (${stat.usage || 0}%)`,
      };
    }
    if (key === 'ethernet') {
      return {
        usage: 0,
        detail: `보내기: ${(stat.sendMB || 0).toFixed(2)}MB 받기: ${(stat.receiveMB || 0).toFixed(2)}MB`,
      };
    }
    if (key === 'wifi') {
      return {
        usage: 0,
        detail: `보내기: ${(stat.sendMB || 0).toFixed(2)}MB 받기: ${(stat.receiveMB || 0).toFixed(2)}MB`,
      };
    }
    return { usage: 0, detail: '' };
  };

  const getCurrentStat = () => {
    if (selectedComponent === 'cpu') {
      return systemStats.cpu;
    }
    if (selectedComponent === 'memory') {
      return systemStats.memory;
    }
    // 디스크 키 처리 (disk-{letter} 형식)
    if (selectedComponent.startsWith('disk-')) {
      const diskLetter = selectedComponent.replace('disk-', '');
      const diskArray = Array.isArray(systemStats.disk) ? systemStats.disk : (systemStats.disk ? [systemStats.disk] : []);
      return diskArray.find(d => d.letter === diskLetter) || null;
    }
    // GPU 키 처리 (gpu 또는 gpu-{index} 형식)
    if (selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) {
      // GPU는 항상 첫 번째 GPU (gpu-0)를 반환
      const gpuArray = Array.isArray(systemStats.gpu) ? systemStats.gpu : (systemStats.gpu ? [systemStats.gpu] : []);
      return gpuArray[0] || null;
    }
    if (selectedComponent === 'ethernet') {
      return systemStats.ethernet;
    }
    if (selectedComponent === 'wifi') {
      return systemStats.wifi;
    }
    return null;
  };

  // stats-column에 표시할 항목이 있는지 확인하는 헬퍼 함수
  const hasValidStatsForColumn = (columnIndex) => {
    const currentStat = getCurrentStat();
    
    if (columnIndex === 0) {
      // 첫 번째 컬럼
      if (selectedComponent === 'cpu') {
        return isValidValue(systemStats.cpu.usage) ||
               (isValidValue(systemStats.cpu.speed) && systemStats.cpu.speed !== '0 GHz') ||
               isValidValue(systemStats.cpu.processes) ||
               isValidValue(systemStats.cpu.threads) ||
               isValidValue(systemStats.cpu.handles) ||
               (isValidValue(systemStats.cpu.uptime) && systemStats.cpu.uptime !== '0:0:0:0');
      }
      if (selectedComponent === 'memory') {
        return isValidValue(systemStats.memory.used) ||
               (isValidValue(systemStats.memory.committed?.used) && isValidValue(systemStats.memory.committed?.total)) ||
               isValidValue(systemStats.memory.pagingPool) ||
               isValidValue(systemStats.memory.nonPagingPool);
      }
      if (selectedComponent.startsWith('disk-')) {
        return isValidValue(currentStat?.activeTime) ||
               isValidValue(currentStat?.responseTime) ||
               isValidValue(currentStat?.readSpeed) ||
               isValidValue(currentStat?.writeSpeed) ||
               isValidValue(currentStat?.rIO_sec) ||
               isValidValue(currentStat?.wIO_sec) ||
               isValidValue(currentStat?.tIO_sec) ||
               isValidValue(currentStat?.tx_sec) ||
               isValidValue(currentStat?.rWaitTime) ||
               isValidValue(currentStat?.wWaitTime) ||
               isValidValue(currentStat?.tWaitTime) ||
               isValidValue(currentStat?.rWaitPercent) ||
               isValidValue(currentStat?.wWaitPercent) ||
               isValidValue(currentStat?.tWaitPercent);
      }
      if (selectedComponent === 'ethernet' || selectedComponent === 'wifi') {
        const sendMB = currentStat?.sendMB || 0;
        const receiveMB = currentStat?.receiveMB || 0;
        const totalMB = sendMB + receiveMB;
        return (isValidValue(totalMB) && totalMB > 0) ||
               isValidValue(currentStat?.sendMB) ||
               isValidValue(currentStat?.receiveMB) ||
               (isValidValue(currentStat?.ipv4) && currentStat.ipv4 !== '0.0.0.0') ||
               (isValidValue(currentStat?.ipv6) && currentStat.ipv6 !== '::');
      }
      if (selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) {
        return isValidValue(currentStat?.usage) ||
               (isValidValue(currentStat?.gpuMemory) && currentStat.gpuMemory !== '0/0GB' && currentStat.gpuMemory !== '0/0MB');
      }
      // 기타 컴포넌트
      return isValidValue(currentStat?.usage);
    } else if (columnIndex === 1) {
      // 두 번째 컬럼
      if (selectedComponent === 'cpu') {
        return (isValidValue(systemStats.cpu.baseSpeed) && systemStats.cpu.baseSpeed !== '0 GHz') ||
               (isValidValue(systemStats.cpu.sockets) && systemStats.cpu.sockets > 0) ||
               isValidValue(systemStats.cpu.cores) ||
               isValidValue(systemStats.cpu.threads) ||
               systemStats.cpu.virtualization !== undefined ||
               (isValidValue(systemStats.cpu.l1Cache) && systemStats.cpu.l1Cache !== '0KB') ||
               (isValidValue(systemStats.cpu.l2Cache) && systemStats.cpu.l2Cache !== '0MB') ||
               (isValidValue(systemStats.cpu.l3Cache) && systemStats.cpu.l3Cache !== '0MB');
      }
      if (selectedComponent === 'memory') {
        return isValidValue(systemStats.memory.available) ||
               isValidValue(systemStats.memory.cached) ||
               isValidValue(systemStats.memory.speed) ||
               (isValidValue(systemStats.memory.slots) && systemStats.memory.slots !== '0/0') ||
               isValidValue(systemStats.memory.formFactor) ||
               isValidValue(systemStats.memory.hardwareReserved);
      }
      if (selectedComponent.startsWith('disk-')) {
        return (isValidValue(currentStat?.model) && currentStat.model !== 'Unknown') ||
               (isValidValue(currentStat?.vendor) && currentStat.vendor !== 'Unknown') ||
               (isValidValue(currentStat?.serialNum) && currentStat.serialNum !== 'Unknown') ||
               (isValidValue(currentStat?.firmwareRevision) && currentStat.firmwareRevision !== 'Unknown') ||
               (isValidValue(currentStat?.interfaceType) && currentStat.interfaceType !== 'Unknown') ||
               (isValidValue(currentStat?.interface) && currentStat.interface !== 'Unknown') ||
               (isValidValue(currentStat?.smartStatus) && currentStat.smartStatus !== 'Unknown') ||
               isValidValue(currentStat?.temperature) ||
               isValidValue(currentStat?.total) ||
               (isValidValue(currentStat?.fsType) && currentStat.fsType !== 'Unknown') ||
               (isValidValue(currentStat?.blockDeviceType) && currentStat.blockDeviceType !== 'Unknown') ||
               isValidValue(currentStat?.blockDeviceLabel) ||
               isValidValue(currentStat?.blockDeviceProtocol) ||
               currentStat?.blockDeviceRemovable !== undefined ||
               isValidValue(currentStat?.bytesPerSector) ||
               isValidValue(currentStat?.totalSectors) ||
               isValidValue(currentStat?.totalCylinders) ||
               isValidValue(currentStat?.totalHeads) ||
               isValidValue(currentStat?.rIO) ||
               isValidValue(currentStat?.wIO) ||
               isValidValue(currentStat?.tIO) ||
               isValidValue(currentStat?.rx) ||
               isValidValue(currentStat?.wx) ||
               isValidValue(currentStat?.tx) ||
               isValidValue(currentStat?.ms) ||
               currentStat?.systemDisk !== undefined ||
               currentStat?.pageFile !== undefined ||
               isValidValue(currentStat?.type);
      }
      if (selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) {
        return (isValidValue(currentStat?.model) && currentStat.model !== 'Unknown GPU') ||
               (isValidValue(currentStat?.vendor) && currentStat.vendor !== 'Unknown') ||
               (isValidValue(currentStat?.subVendor) && currentStat.subVendor !== 'Unknown') ||
               (isValidValue(currentStat?.vendorId) && currentStat.vendorId !== 'Unknown') ||
               (isValidValue(currentStat?.deviceId) && currentStat.deviceId !== 'Unknown') ||
               (isValidValue(currentStat?.bus) && currentStat.bus !== 'Unknown') ||
               (isValidValue(currentStat?.physicalLocation) && currentStat.physicalLocation !== 'Unknown') ||
               isValidValue(currentStat?.vramGB) ||
               isValidValue(currentStat?.vram) ||
               currentStat?.vramDynamic !== undefined ||
               currentStat?.external !== undefined ||
               (isValidValue(currentStat?.cores) && currentStat.cores > 0) ||
               (isValidValue(currentStat?.metalVersion) && currentStat.metalVersion !== 'Unknown') ||
               (isValidValue(currentStat?.sharedGpuMemory) && currentStat.sharedGpuMemory !== '0/0GB' && currentStat.sharedGpuMemory !== '0/0MB') ||
               (isValidValue(currentStat?.driverVersion) && currentStat.driverVersion !== 'Unknown') ||
               (isValidValue(currentStat?.driverDate) && currentStat.driverDate !== 'Unknown') ||
               (isValidValue(currentStat?.directXVersion) && currentStat.directXVersion !== 'Unknown') ||
               isValidValue(currentStat?.memoryUtilization) ||
               isValidValue(currentStat?.temperature) ||
               isValidValue(currentStat?.powerDraw) ||
               isValidValue(currentStat?.graphicsClock) ||
               isValidValue(currentStat?.memoryClock) ||
               isValidValue(currentStat?.vramUsed) ||
               isValidValue(currentStat?.vramUsedPercent) ||
               isValidValue(currentStat?.sharedMemoryUsed) ||
               isValidValue(currentStat?.sharedMemoryTotal) ||
               (currentStat?.displays && Array.isArray(currentStat.displays) && currentStat.displays.length > 0);
      }
      if (selectedComponent === 'ethernet') {
        return isValidValue(currentStat?.adapterName);
      }
      if (selectedComponent === 'wifi') {
        return isValidValue(currentStat?.adapterName) ||
               isValidValue(currentStat?.ssid) ||
               isValidValue(currentStat?.connectionType) ||
               (isValidValue(currentStat?.ipv4) && currentStat.ipv4 !== '0.0.0.0') ||
               (isValidValue(currentStat?.ipv6) && currentStat.ipv6 !== '::') ||
               isValidValue(currentStat?.signalStrength);
      }
    }
    return false;
  };

  const handleOptimize = async () => {
    if (selectedComponent !== 'cpu' && selectedComponent !== 'memory' && !selectedComponent.startsWith('disk-') && selectedComponent !== 'ethernet' && selectedComponent !== 'wifi' && selectedComponent !== 'gpu' && !selectedComponent.startsWith('gpu-')) return;
    
    // 토글 상태에 따라 관리자 권한이 필요한 작업 실행 여부 결정
    const requestAdminPermission = adminPermissionEnabled;
    
    setOptimizing(true);
    setOptimizeResult(null);
    setOptimizingComponent(selectedComponent);
    setOptimizeProgress({ percent: 0, currentTask: '초기화 중...' });
    
    // 전역 최적화 상태에 저장 (다른 메뉴에서도 볼 수 있도록)
    window.__globalOptimizationProgress = {
      active: true,
      component: selectedComponent,
      percent: 0,
      currentTask: '초기화 중...',
    };
    
    let progressInterval = null;
    try {
      let result;
      if (selectedComponent === 'cpu' && window.electronAPI?.cpu) {
        const updateProgress = (percent, task) => {
          setOptimizeProgress({ percent, currentTask: task });
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = percent;
            window.__globalOptimizationProgress.currentTask = task;
          }
        };
        
        // CPU 최적화는 실제 작업 단계에 맞춰 진행률 업데이트
        updateProgress(5, 'CPU 정보 확인 중...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        updateProgress(10, '전원 옵션 설정 중...');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        updateProgress(20, '시작 프로그램 비활성화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        updateProgress(30, '백그라운드 프로세스 제거 중...');
        await new Promise(resolve => setTimeout(resolve, 400));
        
        updateProgress(40, 'CPU 코어 파킹/스로틀링 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        updateProgress(50, 'Windows 서비스 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        updateProgress(60, '작업 스케줄러 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        updateProgress(70, 'CPU 어피니티 및 우선순위 설정 중...');
        
        // 실제 최적화 실행 (타임아웃 추가)
        const optimizePromise = window.electronAPI.cpu.optimize();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('CPU 최적화 시간 초과 (60초)')), 60000)
        );
        
        result = await Promise.race([optimizePromise, timeoutPromise]);
        
        updateProgress(95, '최적화 완료 처리 중...');
        await new Promise(resolve => setTimeout(resolve, 200));
        updateProgress(100, '완료');
      } else if (selectedComponent === 'memory' && window.electronAPI?.memory) {
        const updateProgress = (percent, task) => {
          setOptimizeProgress({ percent, currentTask: task });
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = percent;
            window.__globalOptimizationProgress.currentTask = task;
          }
        };
        updateProgress(10, 'Idle tasks 완료 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(25, '메모리 가비지 컬렉션 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(40, 'Standby 메모리 정리 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(60, '페이지 파일 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(80, '메모리 프리페치 최적화 중...');
        result = await window.electronAPI.memory.optimize({ requestAdminPermission });
        updateProgress(100, '완료');
      } else if (selectedComponent.startsWith('disk-') && window.electronAPI?.disk) {
        const diskLetter = getCurrentStat()?.letter || 'C:';
        const updateProgress = (percent, task) => {
          setOptimizeProgress({ percent, currentTask: task });
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = percent;
            window.__globalOptimizationProgress.currentTask = task;
          }
        };
        updateProgress(10, '임시 파일 정리 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(30, '브라우저 캐시 정리 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(50, '휴지통 비우는 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(70, '디스크 최적화 중...');
        result = await window.electronAPI.disk.optimize({ requestAdminPermission, diskLetter });
        updateProgress(100, '완료');
      } else if (selectedComponent === 'ethernet' && window.electronAPI?.network) {
        const updateProgress = (percent, task) => {
          setOptimizeProgress({ percent, currentTask: task });
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = percent;
            window.__globalOptimizationProgress.currentTask = task;
          }
        };
        updateProgress(10, 'DNS 캐시 정리 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(30, 'TCP/IP 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(50, 'QoS 패킷 스케줄러 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(70, '이더넷 전원 관리 최적화 중...');
        result = await window.electronAPI.network.optimize({ adapterType: 'ethernet', requestAdminPermission });
        updateProgress(100, '완료');
      } else if (selectedComponent === 'wifi' && window.electronAPI?.network) {
        const updateProgress = (percent, task) => {
          setOptimizeProgress({ percent, currentTask: task });
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = percent;
            window.__globalOptimizationProgress.currentTask = task;
          }
        };
        updateProgress(10, 'DNS 캐시 정리 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(30, 'TCP/IP 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(50, 'WiFi 전원 관리 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(70, 'WiFi 어댑터 우선순위 조정 중...');
        result = await window.electronAPI.network.optimize({ adapterType: 'wifi', requestAdminPermission });
        updateProgress(100, '완료');
      } else if (selectedComponent.startsWith('gpu-') && window.electronAPI?.gpu) {
        const updateProgress = (percent, task) => {
          setOptimizeProgress({ percent, currentTask: task });
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = percent;
            window.__globalOptimizationProgress.currentTask = task;
          }
        };
        updateProgress(10, 'GPU 타입 감지 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(30, 'GPU 전원 관리 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(50, 'GPU 스케줄링 최적화 중...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(70, 'DirectX 최적화 중...');
        result = await window.electronAPI.gpu.optimize({ requestAdminPermission });
        updateProgress(100, '완료');
      }
      
      // 진행률 interval 정리 (CPU 최적화는 실제 진행률을 사용하므로 interval 불필요)
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      // 현재 탭에서만 상세 결과 표시
      if (optimizingComponent === selectedComponent) {
        setOptimizeResult(result);
      }
      
      // 완료 여부만 저장
      if (result?.success) {
        setOptimizationCompleted(prev => ({
          ...prev,
          [selectedComponent]: true
        }));
      }
      
      // 최적화 완료 후 전역 상태 업데이트
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
        setTimeout(() => {
          if (window.__globalOptimizationProgress) {
            window.__globalOptimizationProgress.percent = 0;
            window.__globalOptimizationProgress.currentTask = '';
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Optimize error:', error);
      if (progressInterval) clearInterval(progressInterval);
      
      const errorResult = { 
        success: false,
        errors: [{ action: 'optimize', error: error.message || '알 수 없는 오류가 발생했습니다.' }] 
      };
      
      // 현재 탭에서만 에러 결과 표시
      if (optimizingComponent === selectedComponent) {
        setOptimizeResult(errorResult);
      }
      
      setOptimizeProgress({ percent: 0, currentTask: '오류 발생' });
      
      // 에러 발생 시 전역 상태 업데이트
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
        window.__globalOptimizationProgress.currentTask = '오류 발생';
      }
    } finally {
      setOptimizing(false);
      // 최적화 종료 시 전역 상태 업데이트
      if (window.__globalOptimizationProgress) {
        window.__globalOptimizationProgress.active = false;
      }
      setTimeout(() => {
        setOptimizingComponent(null);
        setOptimizeProgress({ percent: 0, currentTask: '' });
        if (window.__globalOptimizationProgress) {
          window.__globalOptimizationProgress.percent = 0;
          window.__globalOptimizationProgress.currentTask = '';
        }
      }, 1000);
    }
  };


  return (
    <div className="smart-optimization">
      <div className="performance-container">
        <div className="performance-layout">
        {/* Left Sidebar - Component List */}
        <div className="component-sidebar">
          <div className="component-list">
            {components.map((comp) => {
              const display = getComponentDisplay(comp.key);
              const isActive = selectedComponent === comp.key;
              const isOptimizing = optimizingComponent === comp.key;
              return (
                <div
                  key={comp.key}
                  className={`component-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedComponent(comp.key)}
                >
                  <div className="component-info">
                    <div className="component-header">
                      <span className="component-name">{comp.label}</span>
                      {isOptimizing && (
                        <div className="optimizing-indicator" style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#FF003F',
                          animation: 'pulse 1.5s ease-in-out infinite',
                          marginLeft: '8px'
                        }}></div>
                      )}
                    </div>
                    <div className="component-stats">
                      <span className="component-usage">{display.usage}%</span>
                      <span className="component-detail">{display.detail}</span>
                    </div>
                  </div>
                  <div className="component-mini-graph">
                    <canvas
                      ref={(el) => {
                        if (el) {
                          miniCanvasRefs.current[comp.key] = el;
                        }
                      }}
                      width={60}
                      height={40}
                      className="mini-chart-canvas"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Detailed View */}
        <div className="detail-panel">
          <div className="detail-header">
            <div className="detail-title-section">
              <h2 className="detail-title">{getCurrentStat()?.name || components.find(c => c.key === selectedComponent)?.label || 'CPU'}</h2>
              {selectedComponent === 'cpu' && (
                <div className="detail-subtitle">{systemStats.cpu.model || 'Unknown CPU'}</div>
              )}
              {selectedComponent === 'memory' && (
                <div className="detail-subtitle">
                  <span className="memory-total-value">{systemStats.memory.total || 0}GB</span>
                  <span className="memory-used-value">{systemStats.memory.used || 0}GB</span>
                </div>
              )}
              {(selectedComponent === 'ethernet' || selectedComponent === 'wifi') && (
                <div className="detail-subtitle">{getCurrentStat()?.adapterName || 'Unknown'}</div>
              )}
              {(selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) && (
                <div className="detail-subtitle">{getCurrentStat()?.model || 'Unknown GPU'}</div>
              )}
              {selectedComponent.startsWith('disk-') && (
                <div className="detail-subtitle">{getCurrentStat()?.model || 'Unknown'}</div>
              )}
            </div>
            <div className="detail-header-actions">
              {(selectedComponent === 'cpu' || selectedComponent === 'memory' || selectedComponent.startsWith('disk-') || selectedComponent === 'ethernet' || selectedComponent === 'wifi' || selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) && (
                <>
                  {/* 진행률 바를 버튼 왼쪽에 배치 */}
                  {optimizing && selectedComponent === (optimizingComponent || selectedComponent) && (
                    <div className="optimize-progress-container">
                      <div className="optimize-progress-info">
                        <span className="optimize-progress-task">{optimizeProgress.currentTask}</span>
                        <span className="optimize-progress-percent">{optimizeProgress.percent}%</span>
                      </div>
                      <div className="optimize-progress-bar">
                        <div 
                          className="optimize-progress-fill"
                          style={{ width: `${optimizeProgress.percent}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <button
                    className="optimize-button"
                    onClick={handleOptimize}
                    disabled={optimizing}
                  >
                    {optimizing ? '최적화 중...' : '최적화 실행'}
                  </button>
                  {/* CPU, Memory, Disk 모두 관리자 권한 토글 표시 */}
                  <div className="admin-toggle-container">
                    <span className="admin-toggle-label">관리자 권한</span>
                    <label className="admin-toggle">
                      <input
                        type="checkbox"
                        checked={adminPermissionEnabled}
                        onChange={async (e) => {
                          const enabled = e.target.checked;
                          
                          if (enabled) {
                            // 토글을 켤 때 - 관리자 권한 상태 확인
                            const adminStatus = await window.electronAPI?.permissions?.isAdmin();
                            setIsAdmin(adminStatus || false);
                            setAdminPermissionEnabled(adminStatus || false);
                            
                            if (!adminStatus) {
                              // 관리자 권한이 없으면 안내 메시지
                              alert('관리자 권한이 없습니다. 관리자 권한이 필요한 작업은 별도로 실행됩니다.');
                            }
                          } else {
                            // 토글을 끌 때 - 자유롭게 OFF 가능
                            setAdminPermissionEnabled(false);
                          }
                        }}
                      />
                      <span className="admin-toggle-slider">
                        <span className="admin-toggle-slider-button"></span>
                      </span>
                    </label>
                  </div>
                  {/* CPU, Memory, Disk만 차트 색상 선택기 표시 */}
                  <ColorPicker
                    color={chartColors[selectedComponent] || '#7E8087'}
                    onChange={(color) => {
                      setChartColors(prev => ({
                        ...prev,
                        [selectedComponent]: color
                      }));
                    }}
                    label="차트 색상"
                  />
                </>
              )}
            </div>
          </div>

            <div className="detail-content">
            {optimizationCompleted[selectedComponent] && !optimizeResult && (
              <div className="optimize-results">
                <div className="optimize-result-item success" style={{ marginBottom: '16px' }}>
                  ✓ 최적화 실행 완료
                </div>
              </div>
            )}
            {selectedComponent === 'cpu' && optimizeResult && optimizingComponent === selectedComponent && (
              <div className="optimize-results">
                {optimizeResult.operations && optimizeResult.operations.length > 0 && (
                  <>
                    {optimizeResult.operations.map((op, index) => (
                      <div key={index} className="optimize-result-item success">
                        ✓ {op}
                      </div>
                    ))}
                  </>
                )}
                {optimizeResult.requiresAdmin && !optimizeResult.adminGranted && (
                  <div className="optimize-result-item warning">
                    ⚠ 일부 작업은 관리자 권한이 필요하여 건너뛰었습니다.
                  </div>
                )}
                {optimizeResult.errors && optimizeResult.errors.length > 0 && (
                  <>
                    {optimizeResult.errors.filter(e => e.requiresAdmin).length > 0 && (
                      <div className="optimize-result-item warning">
                        ⚠ 관리자 권한이 필요한 작업:
                        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                          {optimizeResult.errors
                            .filter(e => e.requiresAdmin)
                            .map((error, idx) => (
                              <li key={idx} style={{ margin: '4px 0' }}>
                                {error.action || error.operation}: {error.error}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    {optimizeResult.errors.filter(e => !e.requiresAdmin).length > 0 && (
                      <div className="optimize-result-item error">
                        ❌ 오류가 발생한 작업:
                        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                          {optimizeResult.errors
                            .filter(e => !e.requiresAdmin)
                            .map((error, idx) => (
                              <li key={idx} style={{ margin: '4px 0' }}>
                                {error.action || error.operation}: {error.error}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {selectedComponent === 'memory' && optimizeResult && optimizingComponent === selectedComponent && (
              <div className="optimize-results">
                {optimizeResult.operations && optimizeResult.operations.length > 0 && (
                  <>
                    {optimizeResult.operations.map((op, index) => (
                      <div key={index} className="optimize-result-item success">
                        ✓ {op}
                      </div>
                    ))}
                  </>
                )}
                {optimizeResult.standbyMemoryCleared && (
                  <div className="optimize-result-item success">
                    ✓ Standby 메모리 정리 완료
                  </div>
                )}
                {optimizeResult.pageFileOptimized && (
                  <div className="optimize-result-item success">
                    ✓ 페이지 파일 최적화 완료
                  </div>
                )}
                {optimizeResult.prefetchOptimized && (
                  <div className="optimize-result-item success">
                    ✓ 메모리 프리페치 최적화 완료
                  </div>
                )}
                {optimizeResult.processesTerminated && (
                  <div className="optimize-result-item success">
                    ✓ 불필요한 프로세스 종료 완료
                  </div>
                )}
                {optimizeResult.memoryDefragmented && (
                  <div className="optimize-result-item success">
                    ✓ 메모리 조각 모음 완료
                  </div>
                )}
                {optimizeResult.virtualMemoryOptimized && (
                  <div className="optimize-result-item success">
                    ✓ 가상 메모리 최적화 완료
                  </div>
                )}
                {optimizeResult.requiresAdmin && !optimizeResult.adminGranted && (
                  <div className="optimize-result-item warning">
                    ⚠ 일부 작업은 관리자 권한이 필요하여 건너뛰었습니다.
                  </div>
                )}
                {optimizeResult.errors && optimizeResult.errors.length > 0 && (
                  <>
                    {optimizeResult.errors.filter(e => e.requiresAdmin).length > 0 && (
                      <div className="optimize-result-item warning">
                        ⚠ 관리자 권한이 필요한 작업:
                        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                          {optimizeResult.errors
                            .filter(e => e.requiresAdmin)
                            .map((error, idx) => (
                              <li key={idx} style={{ margin: '4px 0' }}>
                                {error.operation}: {error.error}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    {optimizeResult.errors.filter(e => !e.requiresAdmin).length > 0 && (
                      <div className="optimize-result-item error">
                        ❌ 오류가 발생한 작업:
                        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                          {optimizeResult.errors
                            .filter(e => !e.requiresAdmin)
                            .map((error, idx) => (
                              <li key={idx} style={{ margin: '4px 0' }}>
                                {error.operation}: {error.error}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {selectedComponent.startsWith('disk-') && optimizeResult && optimizingComponent === selectedComponent && (
              <div className="optimize-results">
                {optimizeResult.operations && optimizeResult.operations.length > 0 && (
                  <>
                    {optimizeResult.operations.map((op, index) => (
                      <div key={index} className="optimize-result-item success">
                        ✓ {op}
                      </div>
                    ))}
                  </>
                )}
                {optimizeResult.tempFilesCleaned && (
                  <div className="optimize-result-item success">
                    ✓ 임시 파일 정리 완료
                  </div>
                )}
                {optimizeResult.diskDefragmented && (
                  <div className="optimize-result-item success">
                    ✓ 디스크 조각 모음/TRIM 완료
                  </div>
                )}
                {optimizeResult.diskChecked && (
                  <div className="optimize-result-item success">
                    ✓ 디스크 검사 완료
                  </div>
                )}
                {optimizeResult.systemFilesCleaned && (
                  <div className="optimize-result-item success">
                    ✓ 시스템 파일 정리 완료
                  </div>
                )}
                {optimizeResult.indexingOptimized && (
                  <div className="optimize-result-item success">
                    ✓ 디스크 인덱싱 최적화 완료
                  </div>
                )}
                {optimizeResult.prefetchCleaned && (
                  <div className="optimize-result-item success">
                    ✓ 프리페치 파일 정리 완료
                  </div>
                )}
                {optimizeResult.freedSpace > 0 && (
                  <div className="optimize-result-item success">
                    ✓ 총 {(optimizeResult.freedSpace / (1024 * 1024 * 1024)).toFixed(2)}GB 공간 확보
                  </div>
                )}
                {optimizeResult.requiresAdmin && !optimizeResult.adminGranted && (
                  <div className="optimize-result-item warning">
                    ⚠ 일부 작업은 관리자 권한이 필요하여 건너뛰었습니다.
                  </div>
                )}
                {optimizeResult.errors && optimizeResult.errors.length > 0 && (
                  <>
                    {optimizeResult.errors.filter(e => e.requiresAdmin).length > 0 && (
                      <div className="optimize-result-item warning">
                        ⚠ 관리자 권한이 필요한 작업:
                        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                          {optimizeResult.errors
                            .filter(e => e.requiresAdmin)
                            .map((error, idx) => (
                              <li key={idx} style={{ margin: '4px 0' }}>
                                {error.operation}: {error.error}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    {optimizeResult.errors.filter(e => !e.requiresAdmin).length > 0 && (
                      <div className="optimize-result-item error">
                        ❌ 오류가 발생한 작업:
                        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                          {optimizeResult.errors
                            .filter(e => !e.requiresAdmin)
                            .map((error, idx) => (
                              <li key={idx} style={{ margin: '4px 0' }}>
                                {error.operation}: {error.error}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {selectedComponent.startsWith('disk-') ? (
              <>
                <div className="chart-container">
                  <div className="chart-header">
                    <span className="chart-label">디스크 활성 시간</span>
                    <span className="chart-max-value">
                      {(() => {
                        const activeTimeKey = `${selectedComponent}-activeTime`;
                        const activeTimeData = historyData[activeTimeKey] || [];
                        const maxDataValue = activeTimeData.length > 0 ? Math.max(...activeTimeData.map(d => d.value || 0)) : 0;
                        const maxValue = Math.max(0.5, Math.ceil(maxDataValue * 1.2));
                        return `${maxValue.toFixed(1)}초`;
                      })()}
                    </span>
                  </div>
                  <canvas
                    ref={diskActiveTimeCanvasRef}
                    width={800}
                    height={300}
                    className="performance-chart"
                  />
                  <div className="chart-footer">
                    <span className="chart-time">60초</span>
                  </div>
                </div>
                <div className="chart-container">
                  <div className="chart-header">
                    <span className="chart-label">읽기 속도</span>
                    <span className="chart-max-value">
                      {(() => {
                        const diskKey = selectedComponent;
                        const readSpeedKey = `${diskKey}-readSpeed`;
                        const readSpeedData = historyData[readSpeedKey] || [];
                        const maxDataValue = readSpeedData.length > 0 ? Math.max(...readSpeedData.map(d => d.value || 0)) : 0;
                        const maxValue = Math.max(1, Math.ceil(maxDataValue * 1.2));
                        return `${maxValue.toFixed(1)}MB/s`;
                      })()}
                    </span>
                  </div>
                  <canvas
                    ref={diskReadSpeedCanvasRef}
                    width={800}
                    height={300}
                    className="performance-chart"
                  />
                  <div className="chart-footer">
                    <span className="chart-time">60초</span>
                  </div>
                </div>
                <div className="chart-container">
                  <div className="chart-header">
                    <span className="chart-label">쓰기 속도</span>
                    <span className="chart-max-value">
                      {(() => {
                        const diskKey = selectedComponent;
                        const writeSpeedKey = `${diskKey}-writeSpeed`;
                        const writeSpeedData = historyData[writeSpeedKey] || [];
                        const maxDataValue = writeSpeedData.length > 0 ? Math.max(...writeSpeedData.map(d => d.value || 0)) : 0;
                        const maxValue = Math.max(1, Math.ceil(maxDataValue * 1.2));
                        return `${maxValue.toFixed(1)}MB/s`;
                      })()}
                    </span>
                  </div>
                  <canvas
                    ref={diskWriteSpeedCanvasRef}
                    width={800}
                    height={300}
                    className="performance-chart"
                  />
                  <div className="chart-footer">
                    <span className="chart-time">60초</span>
                  </div>
                </div>
              </>
            ) : (selectedComponent === 'ethernet' || selectedComponent === 'wifi') ? (
              <>
                <div className="chart-container">
                  <div className="chart-header">
                    <span className="chart-label">보내기 속도</span>
                    <span className="chart-max-value">
                      {(() => {
                        const sendKey = `${selectedComponent}-send`;
                        const sendData = historyData[sendKey] || [];
                        const maxDataValue = sendData.length > 0 ? Math.max(...sendData.map(d => d.value || 0)) : 0;
                        const maxValue = Math.max(1, Math.ceil(maxDataValue * 1.2));
                        return `${maxValue.toFixed(1)}MB/s`;
                      })()}
                    </span>
                  </div>
                  <canvas
                    ref={selectedComponent === 'ethernet' ? ethernetSendCanvasRef : wifiSendCanvasRef}
                    width={800}
                    height={300}
                    className="performance-chart"
                  />
                  <div className="chart-footer">
                    <span className="chart-time">60초</span>
                  </div>
                </div>
                <div className="chart-container">
                  <div className="chart-header">
                    <span className="chart-label">받기 속도</span>
                    <span className="chart-max-value">
                      {(() => {
                        const receiveKey = `${selectedComponent}-receive`;
                        const receiveData = historyData[receiveKey] || [];
                        const maxDataValue = receiveData.length > 0 ? Math.max(...receiveData.map(d => d.value || 0)) : 0;
                        const maxValue = Math.max(1, Math.ceil(maxDataValue * 1.2));
                        return `${maxValue.toFixed(1)}MB/s`;
                      })()}
                    </span>
                  </div>
                  <canvas
                    ref={selectedComponent === 'ethernet' ? ethernetReceiveCanvasRef : wifiReceiveCanvasRef}
                    width={800}
                    height={300}
                    className="performance-chart"
                  />
                  <div className="chart-footer">
                    <span className="chart-time">60초</span>
                  </div>
                </div>
              </>
            ) : (selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) ? (
              <>
                <div className="chart-container">
                  <div className="chart-header">
                    <span className="chart-label">GPU 사용률</span>
                    <span className="chart-max-value">100%</span>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={300}
                    className="performance-chart"
                  />
                  <div className="chart-footer">
                    <span className="chart-time">60초</span>
                  </div>
                </div>
                <div className="gpu-charts-grid">
                  {isValidValue(getCurrentStat()?.memoryUtilization) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">메모리 사용률</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const memData = historyData[`${gpuKey}-MemoryUtil`] || [];
                            const maxDataValue = memData.length > 0 ? Math.max(...memData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue}%`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuMemoryUtilCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.usage3D) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">3D 사용률</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const data3D = historyData[`${gpuKey}-3D`] || [];
                            const maxDataValue = data3D.length > 0 ? Math.max(...data3D.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue}%`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpu3DCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.usageCopy) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">Copy 사용률</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const copyData = historyData[`${gpuKey}-Copy`] || [];
                            const maxDataValue = copyData.length > 0 ? Math.max(...copyData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue}%`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuCopyCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.usageVideoDecode) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">비디오 디코드 사용률</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const decodeData = historyData[`${gpuKey}-VideoDecode`] || [];
                            const maxDataValue = decodeData.length > 0 ? Math.max(...decodeData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue}%`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuVideoDecodeCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.usageVideoProcessing) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">비디오 처리 사용률</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const processingData = historyData[`${gpuKey}-VideoProcessing`] || [];
                            const maxDataValue = processingData.length > 0 ? Math.max(...processingData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue}%`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuVideoProcessingCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.vramUsedPercent) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">VRAM 사용률</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const vramData = historyData[`${gpuKey}-VRAM`] || [];
                            const maxDataValue = vramData.length > 0 ? Math.max(...vramData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue.toFixed(1)}%`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuVramCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.sharedMemoryTotal) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">공유 GPU 메모리</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const sharedData = historyData[`${gpuKey}-SharedMemory`] || [];
                            const gpuArray = Array.isArray(systemStats.gpu) ? systemStats.gpu : (systemStats.gpu ? [systemStats.gpu] : []);
                            const gpuData = gpuArray[0] || null;
                            const sharedMemoryTotal = gpuData?.sharedMemoryTotal || parseFloat((gpuData?.sharedGpuMemory || '0/0GB').split('/')[1]?.replace('GB', '') || '0') || 1;
                            const maxDataValue = sharedData.length > 0 ? Math.max(...sharedData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(sharedMemoryTotal, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue.toFixed(1)}GB`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuSharedMemoryCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.temperature) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">GPU 온도</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const tempData = historyData[`${gpuKey}-Temperature`] || [];
                            const maxDataValue = tempData.length > 0 ? Math.max(...tempData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue}°C`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuTemperatureCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.powerDraw) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">전력 소비</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const powerData = historyData[`${gpuKey}-Power`] || [];
                            const maxDataValue = powerData.length > 0 ? Math.max(...powerData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(50, Math.ceil(maxDataValue * 1.2));
                            return `${maxValue}W`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuPowerCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.graphicsClock) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">그래픽 클럭</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const clockData = historyData[`${gpuKey}-GraphicsClock`] || [];
                            const maxDataValue = clockData.length > 0 ? Math.max(...clockData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(1000, Math.ceil(maxDataValue * 1.1));
                            return `${maxValue}MHz`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuGraphicsClockCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                  {isValidValue(getCurrentStat()?.memoryClock) && (
                    <div className="gpu-chart-item">
                      <div className="chart-header">
                        <span className="chart-label">메모리 클럭</span>
                        <span className="chart-max-value">
                          {(() => {
                            const gpuKey = 'gpu-0';
                            const memClockData = historyData[`${gpuKey}-MemoryClock`] || [];
                            const clockData = historyData[`${gpuKey}-MemoryClock`] || [];
                            const maxDataValue = clockData.length > 0 ? Math.max(...clockData.map(d => d.value || 0)) : 0;
                            const maxValue = Math.max(1000, Math.ceil(maxDataValue * 1.1));
                            return `${maxValue}MHz`;
                          })()}
                        </span>
                      </div>
                      <canvas
                        ref={gpuMemoryClockCanvasRef}
                        width={380}
                        height={200}
                        className="performance-chart"
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="chart-container">
                <div className="chart-header">
                  <span className="chart-label">
                    {selectedComponent === 'memory' ? '메모리 사용률' : 
                     selectedComponent === 'cpu' ? 'CPU 사용률' : 
                     '사용률'}
                  </span>
                  <span className="chart-max-value">100%</span>
                </div>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={300}
                  className="performance-chart"
                />
                <div className="chart-footer">
                  <span className="chart-time">60초</span>
                </div>
              </div>
            )}

            {selectedComponent === 'memory' && (
              <div className="memory-composition-bar">
                <div className="memory-composition-label">메모리 구성</div>
                <div className="memory-composition-visual">
                  <div 
                    className="memory-composition-used" 
                    style={{ width: `${systemStats.memory.usage || 0}%` }}
                  ></div>
                  <div 
                    className="memory-composition-available"
                    style={{ width: `${100 - (systemStats.memory.usage || 0)}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="stats-grid">
              {hasValidStatsForColumn(0) && (
              <div className="stats-column">
                {selectedComponent === 'cpu' && (
                  <>
                    {isValidValue(systemStats.cpu.usage) && (
                      <div className="stat-item">
                        <span className="stat-label">이용률</span>
                        <span className="stat-value">{systemStats.cpu.usage}%</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.speed) && systemStats.cpu.speed !== '0 GHz' && (
                      <div className="stat-item">
                        <span className="stat-label">속도</span>
                        <span className="stat-value">{systemStats.cpu.speed}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.processes) && (
                      <div className="stat-item">
                        <span className="stat-label">프로세스</span>
                        <span className="stat-value">{systemStats.cpu.processes}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.threads) && (
                      <div className="stat-item">
                        <span className="stat-label">스레드</span>
                        <span className="stat-value">{systemStats.cpu.threads}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.handles) && (
                      <div className="stat-item">
                        <span className="stat-label">핸들</span>
                        <span className="stat-value">{systemStats.cpu.handles}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.uptime) && systemStats.cpu.uptime !== '0:0:0:0' && (
                      <div className="stat-item">
                        <span className="stat-label">작동 시간</span>
                        <span className="stat-value">{systemStats.cpu.uptime}</span>
                      </div>
                    )}
                  </>
                )}
                {selectedComponent !== 'cpu' && selectedComponent !== 'ethernet' && selectedComponent !== 'wifi' && isValidValue(getCurrentStat()?.usage) && (
                  <div className="stat-item">
                    <span className="stat-label">이용률</span>
                    <span className="stat-value">{getCurrentStat()?.usage}%</span>
                  </div>
                )}
                {(selectedComponent === 'ethernet' || selectedComponent === 'wifi') && (() => {
                  const sendMB = getCurrentStat()?.sendMB || 0;
                  const receiveMB = getCurrentStat()?.receiveMB || 0;
                  const totalMB = sendMB + receiveMB;
                  return isValidValue(totalMB) && totalMB > 0 ? (
                    <div className="stat-item">
                      <span className="stat-label">처리량</span>
                      <span className="stat-value">{totalMB.toFixed(2)}MB</span>
                    </div>
                  ) : null;
                })()}
                {selectedComponent === 'memory' && (
                  <>
                    {isValidValue(systemStats.memory.used) && (
                      <div className="stat-item">
                        <span className="stat-label">사용 중{isValidValue(systemStats.memory.compressed) ? '(압축)' : ''}</span>
                        <span className="stat-value">
                          {systemStats.memory.used}GB{isValidValue(systemStats.memory.compressed) ? ` (${Math.round(systemStats.memory.compressed)}MB)` : ''}
                        </span>
                      </div>
                    )}
                    {isValidValue(systemStats.memory.committed?.used) && isValidValue(systemStats.memory.committed?.total) && (
                      <div className="stat-item">
                        <span className="stat-label">커밋됨</span>
                        <span className="stat-value">
                          {systemStats.memory.committed.used.toFixed(1)}/{systemStats.memory.committed.total.toFixed(1)}GB
                        </span>
                      </div>
                    )}
                    {isValidValue(systemStats.memory.pagingPool) && (
                      <div className="stat-item">
                        <span className="stat-label">페이징 풀</span>
                        <span className="stat-value">{Math.round(systemStats.memory.pagingPool)}MB</span>
                      </div>
                    )}
                    {isValidValue(systemStats.memory.nonPagingPool) && (
                      <div className="stat-item">
                        <span className="stat-label">비페이징 풀</span>
                        <span className="stat-value">{Math.round(systemStats.memory.nonPagingPool)}MB</span>
                      </div>
                    )}
                  </>
                )}
                {selectedComponent.startsWith('disk-') && (
                  <>
                    {isValidValue(getCurrentStat()?.activeTime) && (() => {
                      const activeTimePercent = getCurrentStat()?.activeTime;
                      const activeTimeSeconds = (activeTimePercent / 100) * 2; // 2초 샘플링 간격 기준
                      return activeTimeSeconds > 0 ? (
                        <div className="stat-item">
                          <span className="stat-label">활성 시간</span>
                          <span className="stat-value">{activeTimeSeconds.toFixed(2)}초</span>
                        </div>
                      ) : null;
                    })()}
                    {isValidValue(getCurrentStat()?.responseTime) && (
                      <div className="stat-item">
                        <span className="stat-label">평균 응답 시간</span>
                        <span className="stat-value">{getCurrentStat().responseTime}ms</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.readSpeed) && (
                      <div className="stat-item">
                        <span className="stat-label">읽기 속도</span>
                        <span className="stat-value">{getCurrentStat().readSpeed}KB/s</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.writeSpeed) && (
                      <div className="stat-item">
                        <span className="stat-label">쓰기 속도</span>
                        <span className="stat-value">{getCurrentStat().writeSpeed}KB/s</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.rIO_sec) && (
                      <div className="stat-item">
                        <span className="stat-label">읽기 IO/초</span>
                        <span className="stat-value">{getCurrentStat().rIO_sec.toFixed(2)}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.wIO_sec) && (
                      <div className="stat-item">
                        <span className="stat-label">쓰기 IO/초</span>
                        <span className="stat-value">{getCurrentStat().wIO_sec.toFixed(2)}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.tIO_sec) && (
                      <div className="stat-item">
                        <span className="stat-label">총 IO/초</span>
                        <span className="stat-value">{getCurrentStat().tIO_sec.toFixed(2)}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.tx_sec) && (
                      <div className="stat-item">
                        <span className="stat-label">전송 속도</span>
                        <span className="stat-value">{((getCurrentStat().tx_sec || 0) / 1024).toFixed(2)}KB/s</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.rWaitTime) && (
                      <div className="stat-item">
                        <span className="stat-label">읽기 대기 시간</span>
                        <span className="stat-value">{(getCurrentStat().rWaitTime * 1000).toFixed(2)}ms</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.wWaitTime) && (
                      <div className="stat-item">
                        <span className="stat-label">쓰기 대기 시간</span>
                        <span className="stat-value">{(getCurrentStat().wWaitTime * 1000).toFixed(2)}ms</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.tWaitTime) && (
                      <div className="stat-item">
                        <span className="stat-label">총 대기 시간</span>
                        <span className="stat-value">{(getCurrentStat().tWaitTime * 1000).toFixed(2)}ms</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.rWaitPercent) && (
                      <div className="stat-item">
                        <span className="stat-label">읽기 대기 비율</span>
                        <span className="stat-value">{getCurrentStat().rWaitPercent.toFixed(2)}%</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.wWaitPercent) && (
                      <div className="stat-item">
                        <span className="stat-label">쓰기 대기 비율</span>
                        <span className="stat-value">{getCurrentStat().wWaitPercent.toFixed(2)}%</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.tWaitPercent) && (
                      <div className="stat-item">
                        <span className="stat-label">총 대기 비율</span>
                        <span className="stat-value">{getCurrentStat().tWaitPercent.toFixed(2)}%</span>
                      </div>
                    )}
                  </>
                )}
                {(selectedComponent === 'ethernet' || selectedComponent === 'wifi') && (
                  <>
                    {isValidValue(getCurrentStat()?.sendMB) && (
                      <div className="stat-item">
                        <span className="stat-label">보내기</span>
                        <span className="stat-value">{getCurrentStat().sendMB.toFixed(2)}MB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.receiveMB) && (
                      <div className="stat-item">
                        <span className="stat-label">받기</span>
                        <span className="stat-value" style={{ color: '#FF00FF' }}>{getCurrentStat().receiveMB.toFixed(2)}MB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.ipv4) && getCurrentStat().ipv4 !== '0.0.0.0' && (
                      <div className="stat-item">
                        <span className="stat-label">IPv4</span>
                        <span className="stat-value">{getCurrentStat().ipv4}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.ipv6) && getCurrentStat().ipv6 !== '::' && (
                      <div className="stat-item">
                        <span className="stat-label">IPv6</span>
                        <span className="stat-value">{getCurrentStat().ipv6}</span>
                      </div>
                    )}
                  </>
                )}
                {(selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) && (
                  <>
                    {isValidValue(getCurrentStat()?.usage) && (
                      <div className="stat-item">
                        <span className="stat-label">사용률</span>
                        <span className="stat-value">{getCurrentStat().usage}%</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.gpuMemory) && getCurrentStat().gpuMemory !== '0/0GB' && getCurrentStat().gpuMemory !== '0/0MB' && (
                      <div className="stat-item">
                        <span className="stat-label">GPU 메모리</span>
                        <span className="stat-value">{getCurrentStat().gpuMemory}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              )}

              {hasValidStatsForColumn(1) && (
              <div className="stats-column">
                {selectedComponent === 'cpu' && (
                  <>
                    {isValidValue(systemStats.cpu.baseSpeed) && systemStats.cpu.baseSpeed !== '0 GHz' && (
                      <div className="stat-item">
                        <span className="stat-label">기본 속도</span>
                        <span className="stat-value">{systemStats.cpu.baseSpeed}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.sockets) && systemStats.cpu.sockets > 0 && (
                      <div className="stat-item">
                        <span className="stat-label">소켓</span>
                        <span className="stat-value">{systemStats.cpu.sockets}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.cores) && (
                      <div className="stat-item">
                        <span className="stat-label">코어</span>
                        <span className="stat-value">{systemStats.cpu.cores}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.threads) && (
                      <div className="stat-item">
                        <span className="stat-label">논리 프로세서</span>
                        <span className="stat-value">{systemStats.cpu.threads}</span>
                      </div>
                    )}
                    {systemStats.cpu.virtualization !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">가상화</span>
                        <span className="stat-value">{systemStats.cpu.virtualization ? '사용' : '사용 안 함'}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.l1Cache) && systemStats.cpu.l1Cache !== '0KB' && (
                      <div className="stat-item">
                        <span className="stat-label">L1 캐시</span>
                        <span className="stat-value">{systemStats.cpu.l1Cache}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.l2Cache) && systemStats.cpu.l2Cache !== '0MB' && (
                      <div className="stat-item">
                        <span className="stat-label">L2 캐시</span>
                        <span className="stat-value">{systemStats.cpu.l2Cache}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.cpu.l3Cache) && systemStats.cpu.l3Cache !== '0MB' && (
                      <div className="stat-item">
                        <span className="stat-label">L3 캐시</span>
                        <span className="stat-value">{systemStats.cpu.l3Cache}</span>
                      </div>
                    )}
                  </>
                )}
                {selectedComponent === 'memory' && (
                  <>
                    {isValidValue(systemStats.memory.available) && (
                      <div className="stat-item">
                        <span className="stat-label">사용 가능</span>
                        <span className="stat-value">{systemStats.memory.available.toFixed(1)}GB</span>
                      </div>
                    )}
                    {isValidValue(systemStats.memory.cached) && (
                      <div className="stat-item">
                        <span className="stat-label">캐시됨</span>
                        <span className="stat-value">{systemStats.memory.cached.toFixed(1)}GB</span>
                      </div>
                    )}
                    {isValidValue(systemStats.memory.speed) && (
                      <div className="stat-item">
                        <span className="stat-label">속도</span>
                        <span className="stat-value">{systemStats.memory.speed}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.memory.slots) && systemStats.memory.slots !== '0/0' && (
                      <div className="stat-item">
                        <span className="stat-label">사용된 슬롯</span>
                        <span className="stat-value">{systemStats.memory.slots}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.memory.formFactor) && (
                      <div className="stat-item">
                        <span className="stat-label">폼 팩터</span>
                        <span className="stat-value">{systemStats.memory.formFactor}</span>
                      </div>
                    )}
                    {isValidValue(systemStats.memory.hardwareReserved) && (
                      <div className="stat-item">
                        <span className="stat-label">하드웨어 예약</span>
                        <span className="stat-value">{Math.round(systemStats.memory.hardwareReserved * 1024)}MB</span>
                      </div>
                    )}
                  </>
                )}
                {selectedComponent.startsWith('disk-') && (
                  <>
                    {isValidValue(getCurrentStat()?.model) && getCurrentStat().model !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">모델</span>
                        <span className="stat-value">{getCurrentStat().model}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.vendor) && getCurrentStat().vendor !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">제조사</span>
                        <span className="stat-value">{getCurrentStat().vendor}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.serialNum) && getCurrentStat().serialNum !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">시리얼 번호</span>
                        <span className="stat-value">{getCurrentStat().serialNum}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.firmwareRevision) && getCurrentStat().firmwareRevision !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">펌웨어 리비전</span>
                        <span className="stat-value">{getCurrentStat().firmwareRevision}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.interfaceType) && getCurrentStat().interfaceType !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">인터페이스 타입</span>
                        <span className="stat-value">{getCurrentStat().interfaceType}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.interface) && getCurrentStat().interface !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">인터페이스</span>
                        <span className="stat-value">{getCurrentStat().interface}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.smartStatus) && getCurrentStat().smartStatus !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">SMART 상태</span>
                        <span className="stat-value">{getCurrentStat().smartStatus}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.temperature) && (
                      <div className="stat-item">
                        <span className="stat-label">온도</span>
                        <span className="stat-value">{getCurrentStat().temperature}°C</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.total) && (
                      <div className="stat-item">
                        <span className="stat-label">용량</span>
                        <span className="stat-value">{getCurrentStat().total}GB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.fsType) && getCurrentStat().fsType !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">파일시스템</span>
                        <span className="stat-value">{getCurrentStat().fsType}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.blockDeviceType) && getCurrentStat().blockDeviceType !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">블록 디바이스 타입</span>
                        <span className="stat-value">{getCurrentStat().blockDeviceType}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.blockDeviceLabel) && (
                      <div className="stat-item">
                        <span className="stat-label">볼륨 레이블</span>
                        <span className="stat-value">{getCurrentStat().blockDeviceLabel}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.blockDeviceProtocol) && (
                      <div className="stat-item">
                        <span className="stat-label">프로토콜</span>
                        <span className="stat-value">{getCurrentStat().blockDeviceProtocol}</span>
                      </div>
                    )}
                    {getCurrentStat()?.blockDeviceRemovable !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">이동식</span>
                        <span className="stat-value">{getCurrentStat().blockDeviceRemovable ? '예' : '아니오'}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.bytesPerSector) && (
                      <div className="stat-item">
                        <span className="stat-label">섹터당 바이트</span>
                        <span className="stat-value">{getCurrentStat().bytesPerSector}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.totalSectors) && (
                      <div className="stat-item">
                        <span className="stat-label">총 섹터</span>
                        <span className="stat-value">{getCurrentStat().totalSectors.toLocaleString()}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.totalCylinders) && (
                      <div className="stat-item">
                        <span className="stat-label">총 실린더</span>
                        <span className="stat-value">{getCurrentStat().totalCylinders.toLocaleString()}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.totalHeads) && (
                      <div className="stat-item">
                        <span className="stat-label">총 헤드</span>
                        <span className="stat-value">{getCurrentStat().totalHeads}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.rIO) && (
                      <div className="stat-item">
                        <span className="stat-label">읽기 IO 수</span>
                        <span className="stat-value">{getCurrentStat().rIO.toLocaleString()}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.wIO) && (
                      <div className="stat-item">
                        <span className="stat-label">쓰기 IO 수</span>
                        <span className="stat-value">{getCurrentStat().wIO.toLocaleString()}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.tIO) && (
                      <div className="stat-item">
                        <span className="stat-label">총 IO 수</span>
                        <span className="stat-value">{getCurrentStat().tIO.toLocaleString()}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.rx) && (
                      <div className="stat-item">
                        <span className="stat-label">누적 읽기</span>
                        <span className="stat-value">{((getCurrentStat().rx || 0) / (1024 * 1024 * 1024)).toFixed(2)}GB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.wx) && (
                      <div className="stat-item">
                        <span className="stat-label">누적 쓰기</span>
                        <span className="stat-value">{((getCurrentStat().wx || 0) / (1024 * 1024 * 1024)).toFixed(2)}GB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.tx) && (
                      <div className="stat-item">
                        <span className="stat-label">누적 총 전송</span>
                        <span className="stat-value">{((getCurrentStat().tx || 0) / (1024 * 1024 * 1024)).toFixed(2)}GB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.ms) && (
                      <div className="stat-item">
                        <span className="stat-label">밀리초</span>
                        <span className="stat-value">{getCurrentStat().ms}ms</span>
                      </div>
                    )}
                    {getCurrentStat()?.systemDisk !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">시스템 디스크</span>
                        <span className="stat-value">{getCurrentStat().systemDisk ? '예' : '아니오'}</span>
                      </div>
                    )}
                    {getCurrentStat()?.pageFile !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">페이지 파일</span>
                        <span className="stat-value">{getCurrentStat().pageFile ? '예' : '아니오'}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.type) && (
                      <div className="stat-item">
                        <span className="stat-label">종류</span>
                        <span className="stat-value">{getCurrentStat().type}</span>
                      </div>
                    )}
                  </>
                )}
                {(selectedComponent === 'gpu' || selectedComponent.startsWith('gpu-')) && (
                  <>
                    {isValidValue(getCurrentStat()?.model) && getCurrentStat().model !== 'Unknown GPU' && (
                      <div className="stat-item">
                        <span className="stat-label">모델</span>
                        <span className="stat-value">{getCurrentStat().model}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.vendor) && getCurrentStat().vendor !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">제조사</span>
                        <span className="stat-value">{getCurrentStat().vendor}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.subVendor) && getCurrentStat().subVendor !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">서브 제조사</span>
                        <span className="stat-value">{getCurrentStat().subVendor}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.vendorId) && getCurrentStat().vendorId !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">벤더 ID</span>
                        <span className="stat-value">{getCurrentStat().vendorId}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.deviceId) && getCurrentStat().deviceId !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">디바이스 ID</span>
                        <span className="stat-value">{getCurrentStat().deviceId}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.bus) && getCurrentStat().bus !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">버스</span>
                        <span className="stat-value">{getCurrentStat().bus}</span>
                      </div>
                    )}
                    {!isValidValue(getCurrentStat()?.bus) && isValidValue(getCurrentStat()?.physicalLocation) && getCurrentStat().physicalLocation !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">버스</span>
                        <span className="stat-value">{getCurrentStat().physicalLocation}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.vramGB) && (
                      <div className="stat-item">
                        <span className="stat-label">VRAM</span>
                        <span className="stat-value">{getCurrentStat().vramGB}GB</span>
                      </div>
                    )}
                    {!isValidValue(getCurrentStat()?.vramGB) && isValidValue(getCurrentStat()?.vram) && (
                      <div className="stat-item">
                        <span className="stat-label">VRAM</span>
                        <span className="stat-value">{getCurrentStat().vram}MB</span>
                      </div>
                    )}
                    {getCurrentStat()?.vramDynamic !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">동적 VRAM</span>
                        <span className="stat-value">{getCurrentStat().vramDynamic ? '예' : '아니오'}</span>
                      </div>
                    )}
                    {getCurrentStat()?.external !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">외부 GPU</span>
                        <span className="stat-value">{getCurrentStat().external ? '예' : '아니오'}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.cores) && getCurrentStat().cores > 0 && (
                      <div className="stat-item">
                        <span className="stat-label">코어</span>
                        <span className="stat-value">{getCurrentStat().cores}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.metalVersion) && getCurrentStat().metalVersion !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">Metal 버전</span>
                        <span className="stat-value">{getCurrentStat().metalVersion}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.sharedGpuMemory) && getCurrentStat().sharedGpuMemory !== '0/0GB' && getCurrentStat().sharedGpuMemory !== '0/0MB' && (
                      <div className="stat-item">
                        <span className="stat-label">공유 GPU 메모리</span>
                        <span className="stat-value">{getCurrentStat().sharedGpuMemory}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.driverVersion) && getCurrentStat().driverVersion !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">드라이버 버전</span>
                        <span className="stat-value">{getCurrentStat().driverVersion}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.driverDate) && getCurrentStat().driverDate !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">드라이버 날짜</span>
                        <span className="stat-value">{getCurrentStat().driverDate}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.directXVersion) && getCurrentStat().directXVersion !== 'Unknown' && (
                      <div className="stat-item">
                        <span className="stat-label">DirectX 버전</span>
                        <span className="stat-value">{getCurrentStat().directXVersion}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.physicalLocation) && getCurrentStat().physicalLocation !== 'Unknown' && !isValidValue(getCurrentStat()?.bus) && (
                      <div className="stat-item">
                        <span className="stat-label">물리적 위치</span>
                        <span className="stat-value">{getCurrentStat().physicalLocation}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.memoryUtilization) && (
                      <div className="stat-item">
                        <span className="stat-label">메모리 사용률</span>
                        <span className="stat-value">{getCurrentStat().memoryUtilization}%</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.temperature) && (
                      <div className="stat-item">
                        <span className="stat-label">온도</span>
                        <span className="stat-value">{getCurrentStat().temperature}°C</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.powerDraw) && (
                      <div className="stat-item">
                        <span className="stat-label">전력 소비</span>
                        <span className="stat-value">{getCurrentStat().powerDraw.toFixed(1)}W</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.graphicsClock) && (
                      <div className="stat-item">
                        <span className="stat-label">그래픽 클럭</span>
                        <span className="stat-value">{getCurrentStat().graphicsClock}MHz</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.memoryClock) && (
                      <div className="stat-item">
                        <span className="stat-label">메모리 클럭</span>
                        <span className="stat-value">{getCurrentStat().memoryClock}MHz</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.vramUsed) && (
                      <div className="stat-item">
                        <span className="stat-label">VRAM 사용량</span>
                        <span className="stat-value">{getCurrentStat().vramUsed.toFixed(0)}MB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.vramUsedPercent) && (
                      <div className="stat-item">
                        <span className="stat-label">VRAM 사용률</span>
                        <span className="stat-value">{getCurrentStat().vramUsedPercent.toFixed(1)}%</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.sharedMemoryUsed) && (
                      <div className="stat-item">
                        <span className="stat-label">공유 메모리 사용량</span>
                        <span className="stat-value">{getCurrentStat().sharedMemoryUsed.toFixed(2)}GB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.sharedMemoryTotal) && (
                      <div className="stat-item">
                        <span className="stat-label">공유 메모리 총량</span>
                        <span className="stat-value">{getCurrentStat().sharedMemoryTotal.toFixed(2)}GB</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.directXVersion) && (
                      <div className="stat-item">
                        <span className="stat-label">DirectX 버전:</span>
                        <span className="stat-value">{getCurrentStat().directXVersion}</span>
                      </div>
                    )}
                    {getCurrentStat()?.displays && Array.isArray(getCurrentStat().displays) && getCurrentStat().displays.length > 0 && (
                      <>
                        {getCurrentStat().displays.map((display, idx) => {
                          // 깨진 문자 감지 함수
                          const hasBrokenChars = (str) => {
                            if (!str || typeof str !== 'string') return true;
                            try {
                              // 유효한 문자 범위: ASCII, 한글, 자모, 호환 자모, 공백, 하이픈, 언더스코어, 점, 영문자, 숫자
                              const validPattern = /^[\x00-\x7F\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\s\-_\.a-zA-Z0-9]*$/;
                              if (!validPattern.test(str)) return true;
                              // 너무 짧거나 의미 없는 문자열
                              if (str.trim().length < 2) return true;
                              // 깨진 문자로 보이는 패턴 (연속된 이상한 문자)
                              if (/[^\x00-\x7F\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]{3,}/.test(str)) return true;
                              return false;
                            } catch (e) {
                              return true;
                            }
                          };
                          
                          // 모델명이 깨져있거나 Unknown인 경우 deviceName 사용
                          let displayModel = display.model || 'Unknown';
                          
                          // 모델이 깨졌거나 유효하지 않은 경우 fallback
                          if (hasBrokenChars(displayModel) || displayModel === 'Unknown' || displayModel.trim() === '' || displayModel === 'Generic PnP Monitor') {
                            if (display.deviceName && !hasBrokenChars(display.deviceName) && display.deviceName !== 'Unknown' && !display.deviceName.includes('\\')) {
                              displayModel = display.deviceName;
                            } else if (display.vendor && !hasBrokenChars(display.vendor) && display.vendor !== 'Unknown') {
                              displayModel = display.vendor;
                            } else {
                              displayModel = `일반 PnP 모니터 ${idx + 1}`;
                            }
                          }
                          
                          return (
                            <React.Fragment key={idx}>
                              <div className="stat-item">
                                <span className="stat-label">디스플레이 {idx + 1} 모델:</span>
                                <span className="stat-value">{displayModel}</span>
                              </div>
                              {isValidValue(display.resolutionX) && isValidValue(display.resolutionY) && (
                                <div className="stat-item">
                                  <span className="stat-label">디스플레이 {idx + 1} 해상도:</span>
                                  <span className="stat-value">{(display.currentResX || display.resolutionX)} x {(display.currentResY || display.resolutionY)}</span>
                                </div>
                              )}
                              {isValidValue(display.currentRefreshRate) && (
                                <div className="stat-item">
                                  <span className="stat-label">디스플레이 {idx + 1} 주사율:</span>
                                  <span className="stat-value">{display.currentRefreshRate}Hz</span>
                                </div>
                              )}
                              {isValidValue(display.connection) && (
                                <div className="stat-item">
                                  <span className="stat-label">디스플레이 {idx + 1} 연결:</span>
                                  <span className="stat-value">{display.connection}</span>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
                {selectedComponent === 'ethernet' && (
                  <>
                    {isValidValue(getCurrentStat()?.adapterName) && (
                      <div className="stat-item">
                        <span className="stat-label">어댑터 이름:</span>
                        <span className="stat-value">{getCurrentStat().adapterName}</span>
                      </div>
                    )}
                  </>
                )}
                {selectedComponent === 'wifi' && (
                  <>
                    {isValidValue(getCurrentStat()?.adapterName) && (
                      <div className="stat-item">
                        <span className="stat-label">어댑터 이름:</span>
                        <span className="stat-value">{getCurrentStat().adapterName}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.ssid) && (
                      <div className="stat-item">
                        <span className="stat-label">SSID:</span>
                        <span className="stat-value">{getCurrentStat().ssid}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.connectionType) && (
                      <div className="stat-item">
                        <span className="stat-label">연결 형식:</span>
                        <span className="stat-value">{getCurrentStat().connectionType}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.ipv4) && getCurrentStat().ipv4 !== '0.0.0.0' && (
                      <div className="stat-item">
                        <span className="stat-label">IPv4 주소:</span>
                        <span className="stat-value">{getCurrentStat().ipv4}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.ipv6) && getCurrentStat().ipv6 !== '::' && (
                      <div className="stat-item">
                        <span className="stat-label">IPv6 주소:</span>
                        <span className="stat-value">{getCurrentStat().ipv6}</span>
                      </div>
                    )}
                    {isValidValue(getCurrentStat()?.signalStrength) && (
                      <div className="stat-item">
                        <span className="stat-label">신호 강도:</span>
                        <span className="stat-value">{getCurrentStat().signalStrength}%</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default SmartOptimization;
