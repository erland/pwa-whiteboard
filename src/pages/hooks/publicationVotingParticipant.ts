const STORAGE_KEY_PREFIX = 'pwa-whiteboard.publicationVotingParticipant.';

function storageKey(publicationId: string): string {
  return `${STORAGE_KEY_PREFIX}${publicationId}`;
}

export function readPersistedPublicationParticipantToken(publicationId: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage || !publicationId) return null;
  try {
    const value = window.localStorage.getItem(storageKey(publicationId));
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

export function createPublicationParticipantToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `participant-${crypto.randomUUID()}`;
  }
  return `participant-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreatePersistedPublicationParticipantToken(publicationId: string): string | null {
  if (!publicationId) return null;
  const existing = readPersistedPublicationParticipantToken(publicationId);
  if (existing) return existing;
  const created = createPublicationParticipantToken();
  persistPublicationParticipantToken(publicationId, created);
  return created;
}

export function persistPublicationParticipantToken(publicationId: string, participantToken: string | null | undefined): void {
  if (typeof window === 'undefined' || !window.localStorage || !publicationId) return;
  try {
    const normalized = typeof participantToken === 'string' ? participantToken.trim() : '';
    if (!normalized) {
      window.localStorage.removeItem(storageKey(publicationId));
      return;
    }
    window.localStorage.setItem(storageKey(publicationId), normalized);
  } catch {
    // ignore persistence failures
  }
}

export function resetPublicationParticipantToken(publicationId: string): string | null {
  if (!publicationId) return null;
  const next = createPublicationParticipantToken();
  persistPublicationParticipantToken(publicationId, next);
  return next;
}
