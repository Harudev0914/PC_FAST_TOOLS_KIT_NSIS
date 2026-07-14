import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WindowsBoost from '../src/components/WindowsBoost.jsx';

// 렌더러 컴포넌트의 스모크 테스트. window.electronAPI를 모킹해 IPC 없이도 렌더/상호작용을 검증한다.
describe('WindowsBoost', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.electronAPI = {
      deltaForceCleaner: {
        optimizeWithWindowsAPI: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
        restoreWindowsDefaults: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
      },
    };
  });

  it('renders without crashing', () => {
    const { container } = render(<WindowsBoost />);
    expect(container).toBeTruthy();
  });

  it('OFF → ON 토글 시 최적화를 즉시 적용한다', async () => {
    render(<WindowsBoost />);
    fireEvent.click(screen.getByRole('button', { name: 'OFF' }));
    await waitFor(() =>
      expect(window.electronAPI.deltaForceCleaner.optimizeWithWindowsAPI).toHaveBeenCalled()
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'ON' })).toBeTruthy());
    expect(window.electronAPI.deltaForceCleaner.restoreWindowsDefaults).not.toHaveBeenCalled();
  });

  it('ON → OFF 토글 시 설정을 기본값으로 되돌린다', async () => {
    render(<WindowsBoost />);
    fireEvent.click(screen.getByRole('button', { name: 'OFF' }));
    const onButton = await screen.findByRole('button', { name: 'ON' });

    fireEvent.click(onButton);
    await waitFor(() =>
      expect(window.electronAPI.deltaForceCleaner.restoreWindowsDefaults).toHaveBeenCalled()
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'OFF' })).toBeTruthy());
  });

  // 적용이 실패하면 UI가 실제 시스템 상태와 어긋나지 않도록 토글이 원위치로 돌아와야 한다.
  it('적용이 실패하면 토글을 OFF로 되돌린다', async () => {
    window.electronAPI.deltaForceCleaner.optimizeWithWindowsAPI = vi
      .fn()
      .mockResolvedValue({ success: false, error: '실패' });

    render(<WindowsBoost />);
    fireEvent.click(screen.getByRole('button', { name: 'OFF' }));

    await waitFor(() =>
      expect(window.electronAPI.deltaForceCleaner.optimizeWithWindowsAPI).toHaveBeenCalled()
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'OFF' })).toBeTruthy());
  });
});
