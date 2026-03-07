export function getInviteTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const q = url.searchParams.get('invite');
  if (q) return q.trim();

  // Allow #invite=TOKEN (useful when query params are hard to share)
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const m = /(?:^|&)invite=([^&]+)/.exec(hash);
  if (m?.[1]) return decodeURIComponent(m[1]).trim();

  // If invite token was passed as 'invite=TOKEN'
  const raw = url.searchParams.toString();
  if (raw.startsWith('invite=')) return decodeURIComponent(raw.slice('invite='.length)).trim();

  return null;
}

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest';
  const key = 'pwa-whiteboard.guestId';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = 'g_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  window.localStorage.setItem(key, next);
  return next;
}

function decodeJwtSubject(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof payload.sub === 'string' && payload.sub.length) return payload.sub;
    }
  } catch {
    // ignore
  }
  return null;
}

export function deriveSelfUserId(
  guestId: string,
  accessToken: string | null | undefined,
  subject?: string | null
): string {
  const normalizedSubject = typeof subject === 'string' && subject.trim().length > 0 ? subject.trim() : null;
  if (normalizedSubject) return normalizedSubject;
  if (!accessToken) return guestId;
  return decodeJwtSubject(accessToken) ?? guestId;
}
