import { toWsUrl } from '../collabUrl';

describe('toWsUrl + access_token handling', () => {
  test('builds ws url and allows caller to set access_token exactly once', () => {
    const base = 'http://localhost';
    const url0 = toWsUrl(base, '/ws/boards/abc');
    const u = new URL(url0);
    u.searchParams.set('access_token', 't1');
    u.searchParams.set('access_token', 't1'); // set twice should still be single key
    expect(u.toString()).toBe('ws://localhost/ws/boards/abc?access_token=t1');
  });

  test('overwrites any access_token already present in baseUrl query', () => {
    const base = 'http://localhost?access_token=old';
    const url0 = toWsUrl(base, '/ws/boards/abc');
    const u = new URL(url0);
    u.searchParams.set('access_token', 'new');
    expect(u.searchParams.getAll('access_token')).toEqual(['new']);
  });
});
