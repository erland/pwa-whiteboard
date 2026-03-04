export type JwtClaims = Record<string, unknown>;

function base64UrlDecodeToString(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadJson = base64UrlDecodeToString(parts[1]!);
    return JSON.parse(payloadJson) as JwtClaims;
  } catch {
    return null;
  }
}

export function getDisplayNameFromClaims(claims: JwtClaims | null): string | null {
  if (!claims) return null;
  const preferred = claims['preferred_username'];
  const name = claims['name'];
  const email = claims['email'];
  const sub = claims['sub'];
  const pick = (v: unknown) => (typeof v === 'string' && v.trim().length ? v.trim() : null);
  return pick(preferred) ?? pick(name) ?? pick(email) ?? pick(sub);
}
