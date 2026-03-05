import { getApiBaseUrl, getWsBaseUrl, isWhiteboardServerConfigured, __test__ } from '../server';

describe('server base URL config', () => {
  const originalApi = (globalThis as any).__VITE_API_BASE_URL;
  const originalWs = (globalThis as any).__VITE_WS_BASE_URL;
  const originalLegacy = (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL;

  afterEach(() => {
    (globalThis as any).__VITE_API_BASE_URL = originalApi;
    (globalThis as any).__VITE_WS_BASE_URL = originalWs;
    (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = originalLegacy;
  });

  test('returns undefined when not set', () => {
    (globalThis as any).__VITE_API_BASE_URL = undefined;
    (globalThis as any).__VITE_WS_BASE_URL = undefined;
    (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = undefined;

    expect(getApiBaseUrl()).toBeUndefined();
    expect(getWsBaseUrl()).toBeUndefined();
    expect(isWhiteboardServerConfigured()).toBe(false);
  });

  test('normalizes by trimming and removing trailing slashes', () => {
    (globalThis as any).__VITE_API_BASE_URL = '  https://example.org/api/  ';
    expect(getApiBaseUrl()).toBe('https://example.org/api');
    expect(isWhiteboardServerConfigured()).toBe(true);
  });

  test('derives WS base URL from API by stripping trailing /api', () => {
    (globalThis as any).__VITE_API_BASE_URL = 'https://example.org/api';
    (globalThis as any).__VITE_WS_BASE_URL = undefined;
    expect(getWsBaseUrl()).toBe('https://example.org');
  });

  test('explicit WS base URL wins', () => {
    (globalThis as any).__VITE_API_BASE_URL = 'https://example.org/api';
    (globalThis as any).__VITE_WS_BASE_URL = ' wss://ws.example.org/ ';
    expect(getWsBaseUrl()).toBe('wss://ws.example.org');
  });

  test('legacy var is used as API base URL', () => {
    (globalThis as any).__VITE_API_BASE_URL = undefined;
    (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = 'https://legacy.example.org/api/';
    expect(getApiBaseUrl()).toBe('https://legacy.example.org/api');
    expect(getWsBaseUrl()).toBe('https://legacy.example.org');
  });

  test('normalize helpers', () => {
    expect(__test__.normalizeBaseUrl('http://localhost:8080///')).toBe('http://localhost:8080');
    expect(__test__.stripTrailingApiSegment('http://localhost:8080/api')).toBe('http://localhost:8080');
    expect(__test__.stripTrailingApiSegment('http://localhost:8080/Api')).toBe('http://localhost:8080');
  });
});
