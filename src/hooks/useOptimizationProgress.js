import { useEffect } from 'react';

// 백엔드(gaming / deltaForceCleaner)가 단계마다 보내는 'optimization:progress' 이벤트를
// MainPage 좌하단 진행률 토스트로 중계한다. 토스트는 MainPage가 window.__globalOptimizationProgress를
// 200ms 간격으로 폴링해 렌더하므로, 여기서는 그 전역 객체만 갱신하면 된다.
//
// 토글 패널이 여러 개(Game Mode / Windows Boost)이고 모두 같은 채널을 듣기 때문에,
// payload.component로 자기 것만 골라 반영한다.

export function startOptimizationProgress(component, title, firstTask) {
  window.__globalOptimizationProgress = {
    active: true,
    component,
    title,
    currentTask: firstTask,
    percent: 0,
  };
}

export function updateOptimizationProgress(percent, task) {
  const gp = window.__globalOptimizationProgress;
  if (!gp || !gp.active) return;
  gp.percent = percent;
  gp.currentTask = task;
}

export function endOptimizationProgress() {
  const gp = window.__globalOptimizationProgress;
  if (!gp) return;
  gp.active = false;
  gp.percent = 0;
  gp.currentTask = '';
}

export function useOptimizationProgress(component) {
  useEffect(() => {
    const unsubscribe = window.electronAPI?.optimization?.onProgress?.((payload) => {
      // 여러 패널이 같은 채널을 듣는다 — 자기 것만 반영한다.
      // updateOptimizationProgress가 active=false면 무시하므로, 이미 끝난 작업의
      // 뒤늦은 이벤트로 토스트가 되살아나지 않는다.
      if (!payload || payload.component !== component) return;
      updateOptimizationProgress(payload.percent, payload.task);
    });

    // 앱이 preload 없이 렌더될 때(테스트 등) onProgress가 없으면 unsubscribe도 undefined다.
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      endOptimizationProgress();
    };
  }, [component]);
}
