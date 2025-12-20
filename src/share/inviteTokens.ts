// src/share/inviteTokens.ts

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

// Generates a URL-safe invite token string. Keep it short-ish for URLs.
export function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url ~ 43 chars for 32 bytes
  return bytesToBase64Url(bytes);
}

export function buildInviteUrl(inviteToken: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('invite', inviteToken);
  url.hash = '';
  return url.toString();
}
