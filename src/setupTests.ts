import '@testing-library/jest-dom';

const originalWarn = console.warn;
let consoleWarnSpy: jest.SpyInstance | null = null;

beforeAll(() => {
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
    const msg = args[0];
    if (
      typeof msg === 'string' &&
      msg.includes('React Router Future Flag Warning')
    ) {
      // Ignore these specific warnings in test output
      return;
    }
    originalWarn(...args);
  });
});

afterAll(() => {
  consoleWarnSpy?.mockRestore();
  consoleWarnSpy = null;
});
