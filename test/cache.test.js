import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cache = require('../electron/services/cache.js');

describe('cache (per-key timestamps)', () => {
  beforeEach(() => cache.clearCache());

  it('stores and retrieves a dynamic value within TTL', () => {
    cache.setDynamicCache('cpuUsage', 42);
    expect(cache.getDynamicCache('cpuUsage')).toBe(42);
  });

  it('keeps keys independent — writing one key does not reset another key freshness', () => {
    // This is the bug the refactor fixed: a single shared dynamic timestamp meant
    // setting cpuUsage reset the freshness clock for networkStats.
    cache.setDynamicCache('networkStats', { a: 1 });
    cache.setDynamicCache('cpuUsage', 7); // must NOT invalidate networkStats
    expect(cache.getDynamicCache('networkStats')).toEqual({ a: 1 });
    expect(cache.getDynamicCache('cpuUsage')).toBe(7);
  });

  it('clearCacheKey removes only the targeted key', () => {
    cache.setDynamicCache('cpuUsage', 1);
    cache.setDynamicCache('gpuUsage', 2);
    cache.clearCacheKey('cpuUsage', 'dynamic');
    expect(cache.getDynamicCache('cpuUsage')).toBeNull();
    expect(cache.getDynamicCache('gpuUsage')).toBe(2);
  });

  it('static and dynamic namespaces do not collide', () => {
    cache.setStaticCache('cpu', { model: 'x' });
    cache.setDynamicCache('cpuUsage', 55);
    expect(cache.getStaticCache('cpu')).toEqual({ model: 'x' });
    expect(cache.getDynamicCache('cpuUsage')).toBe(55);
  });

  it('returns null for an unset key', () => {
    expect(cache.getDynamicCache('memoryUsage')).toBeNull();
    expect(cache.getStaticCache('disk')).toBeNull();
  });
});
