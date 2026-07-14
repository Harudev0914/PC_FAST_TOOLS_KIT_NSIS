import { useState, useEffect } from 'react';

// 토글(Game Mode / Windows Boost)의 ON/OFF 상태를 다룬다.
//
// MainPage가 패널을 조건부 렌더링하므로 메뉴를 옮기면 패널이 통째로 언마운트되고 로컬 state가
// 사라진다. 그래서 마운트할 때마다 메인 프로세스에 저장된 적용 여부를 읽어와 복원한다.
// (저장은 백엔드가 최적화를 실제로 적용/해제할 때 직접 한다 — electron/services/optimizationState.js)
export function useAppliedState(key) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const status = await window.electronAPI?.optimization?.getStatus?.(key);
        if (!cancelled && status?.enabled) setEnabled(true);
      } catch (error) {
        console.error(`Failed to load ${key} status:`, error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return [enabled, setEnabled];
}
