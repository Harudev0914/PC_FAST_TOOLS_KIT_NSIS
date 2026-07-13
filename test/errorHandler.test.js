import { describe, it, expect } from 'vitest';
import {
  isNetworkError,
  getUserFriendlyErrorMessage,
} from '../src/utils/errorHandler.js';

describe('isNetworkError', () => {
  it('detects known network error patterns (case-insensitive)', () => {
    expect(isNetworkError({ message: 'ECONNREFUSED 127.0.0.1' })).toBe(true);
    expect(isNetworkError({ message: 'Request timeout' })).toBe(true);
    expect(isNetworkError({ message: 'fetch failed' })).toBe(true);
  });

  it('returns false for non-network errors and falsy input', () => {
    expect(isNetworkError({ message: 'permission denied' })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe('getUserFriendlyErrorMessage', () => {
  it('maps network errors to a connection message', () => {
    expect(getUserFriendlyErrorMessage({ message: 'ETIMEDOUT' })).toContain('네트워크');
  });

  it('maps fs error codes to friendly messages', () => {
    expect(getUserFriendlyErrorMessage({ code: 'ENOENT' })).toContain('찾을 수 없');
    expect(getUserFriendlyErrorMessage({ code: 'EACCES' })).toContain('권한');
  });

  it('handles missing error gracefully', () => {
    expect(getUserFriendlyErrorMessage(null)).toContain('알 수 없는 오류');
  });
});
