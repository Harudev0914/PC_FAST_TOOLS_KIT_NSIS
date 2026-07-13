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
      },
    };
  });

  it('renders without crashing', () => {
    const { container } = render(<WindowsBoost />);
    expect(container).toBeTruthy();
  });

  it('invokes the optimize IPC when the apply button is clicked', async () => {
    render(<WindowsBoost />);
    // 첫 버튼은 ON/OFF 토글 → 적용 버튼은 텍스트로 정확히 지정한다.
    const applyButton = screen.getByRole('button', { name: '설정 적용' });
    fireEvent.click(applyButton);
    await waitFor(() =>
      expect(window.electronAPI.deltaForceCleaner.optimizeWithWindowsAPI).toHaveBeenCalled()
    );
  });
});
