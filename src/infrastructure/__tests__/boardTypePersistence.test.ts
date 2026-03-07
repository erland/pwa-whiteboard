import {
  deletePersistedBoardType,
  getPersistedBoardType,
  readBoardTypeMap,
  setPersistedBoardType,
} from '../boardTypePersistence';

describe('boardTypePersistence', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    jest.restoreAllMocks();
  });

  test('normalizes invalid persisted values to the default board type', () => {
    const localStorage = {
      getItem: jest.fn(() => JSON.stringify({ a: 'mindmap', b: 'bogus' })),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });

    expect(readBoardTypeMap()).toEqual({ a: 'mindmap', b: 'advanced' });
  });

  test('set/get/delete persists board types through the shared local map', () => {
    let store: Record<string, string> = {};
    const localStorage = {
      getItem: jest.fn((key: string) => store[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
    };
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });

    setPersistedBoardType('b-1', 'freehand');
    expect(getPersistedBoardType('b-1')).toBe('freehand');

    deletePersistedBoardType('b-1');
    expect(getPersistedBoardType('b-1')).toBeNull();
  });
});
