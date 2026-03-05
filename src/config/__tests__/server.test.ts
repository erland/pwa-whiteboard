import { getApiBaseUrl, getWsBaseUrl, isWhiteboardServerConfigured, __test__ } from '../server';

describe('server base URL config', () => {
  const originalApi = (globalThis as any).__VITE_API_BASE_URL;
  const originalWs = (globalThis as any).__VITE_WS_BASE_URL;
  const originalLegacy = (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL;
  const originalLocation = (globalThis as any).location;

  afterEach(() => {
    (globalThis as any).__VITE_API_BASE_URL = originalApi;
    (globalThis as any).__VITE_WS_BASE_URL = originalWs;
    (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = originalLegacy;
    (globalThis as any).location = originalLocation;
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

  test('supports relative API base URL by resolving against origin', () => {
    (globalThis as any).location = { origin: 'http://localhost' };
    (globalThis as any).__VITE_API_BASE_URL = '/api';
    expect(getApiBaseUrl()).toBe('http://localhost/api');
  });

  test('derives WS base URL from API by stripping trailing /api and converting scheme', () => {
    (globalThis as any).__VITE_API_BASE_URL = 'https://example.org/api';
    (globalThis as any).__VITE_WS_BASE_URL = undefined;
    expect(getWsBaseUrl()).toBe('wss://example.org');
  });

  test('explicit WS base URL wins (and strips a trailing /ws)', () => {
    (globalThis as any).__VITE_API_BASE_URL = 'https://example.org/api';
    (globalThis as any).__VITE_WS_BASE_URL = ' wss://ws.example.org/ws/ ';
    expect(getWsBaseUrl()).toBe('wss://ws.example.org');
  });

  test('explicit WS base URL can be http(s) and is converted to ws(s)', () => {
    (globalThis as any).__VITE_WS_BASE_URL = 'https://example.org';
    expect(getWsBaseUrl()).toBe('wss://example.org');
  });

  test('legacy var is used as API base URL', () => {
    (globalThis as any).__VITE_API_BASE_URL = undefined;
    (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = 'https://legacy.example.org/api/';
    expect(getApiBaseUrl()).toBe('https://legacy.example.org/api');
    expect(getWsBaseUrl()).toBe('wss://legacy.example.org');
  });

  test('helper functions', () => {
    expect(__test__.normalizeBaseUrl('http://localhost:8080///')).toBe('http://localhost:8080');
    expect(__test__.stripTrailingSegment('http://localhost:8080/api', 'api')).toBe('http://localhost:8080');
    expect(__test__.stripTrailingSegment('http://localhost:8080/Api', 'api')).toBe('http://localhost:8080');
    expect(__test__.toWsOrigin('http://localhost:8080')).toBe('ws://localhost:8080');
    expect(__test__.toWsOrigin('https://localhost')).toBe('wss://localhost');
  });
});
