import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFix } from '@/lib/geo';

const geo = vi.hoisted(() => ({ checkPermissions: vi.fn(), requestPermissions: vi.fn(), getCurrentPosition: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: geo }));

describe('Android location failures', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    geo.checkPermissions.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
  });
  it('maps a rejected native permission request to an unavailable location', async () => {
    geo.requestPermissions.mockRejectedValue(new Error('Location services are not enabled'));
    await expect(getFix()).rejects.toBe('unavailable');
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });
  it('preserves a declined permission without asking for a position', async () => {
    geo.requestPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    await expect(getFix()).rejects.toBe('denied');
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });
});