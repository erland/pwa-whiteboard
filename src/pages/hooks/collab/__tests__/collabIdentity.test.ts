import { deriveSelfUserId } from '../collabIdentity';

describe('collabIdentity', () => {
  it('prefers auth subject when available', () => {
    const token = 'header.payload.signature';
    expect(deriveSelfUserId('guest-1', token, 'auth-subject')).toBe('auth-subject');
  });

  it('falls back to JWT subject when auth subject is missing', () => {
    const payload = btoa(JSON.stringify({ sub: 'jwt-subject' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const token = `header.${payload}.signature`;

    expect(deriveSelfUserId('guest-1', token, null)).toBe('jwt-subject');
  });

  it('falls back to guest id when no authenticated identity is available', () => {
    expect(deriveSelfUserId('guest-1', null, null)).toBe('guest-1');
    expect(deriveSelfUserId('guest-1', 'not-a-jwt', null)).toBe('guest-1');
  });
});
