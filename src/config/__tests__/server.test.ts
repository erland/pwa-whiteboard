import { getWhiteboardServerBaseUrl, isWhiteboardServerConfigured, __test__ } from '../server';

describe('whiteboard server base URL config', () => {
  const original = (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL;

  afterEach(() => {
    (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = original;
  });

  test('returns undefined when not set', () => {
    (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = undefined;
    expect(getWhiteboardServerBaseUrl()).toBeUndefined();
    expect(isWhiteboardServerConfigured()).toBe(false);
  });

  test('normalizes by trimming and removing trailing slashes', () => {
    (globalThis as any).__VITE_WHITEBOARD_SERVER_BASE_URL = '  https://example.org/api/  ';
    expect(getWhiteboardServerBaseUrl()).toBe('https://example.org/api');
    expect(isWhiteboardServerConfigured()).toBe(true);
  });

  test('normalizeBaseUrl removes multiple trailing slashes', () => {
    expect(__test__.normalizeBaseUrl('http://localhost:8080///')).toBe('http://localhost:8080');
  });
});
