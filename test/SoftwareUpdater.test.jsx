import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SoftwareUpdater from '../src/components/SoftwareUpdater.jsx';

describe('SoftwareUpdater', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.electronAPI = {
      updater: {
        checkAllUpdates: vi.fn().mockResolvedValue([
          { id: 'Google.Chrome', name: 'Google Chrome', currentVersion: '1.0', latestVersion: '1.1', source: 'winget' },
        ]),
        update: vi.fn().mockResolvedValue({ success: true }),
      },
      driver: {
        getDrivers: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
    };
  });

  it('renders and lists winget-upgradable software from the backend', async () => {
    render(<SoftwareUpdater />);
    await waitFor(() => expect(window.electronAPI.updater.checkAllUpdates).toHaveBeenCalled());
    expect(await screen.findByText('Google Chrome')).toBeInTheDocument();
    expect(screen.getByText('1.1')).toBeInTheDocument();
  });

  it('does not crash when the updater API is unavailable', () => {
    window.electronAPI = {};
    const { container } = render(<SoftwareUpdater />);
    expect(container).toBeTruthy();
  });
});
