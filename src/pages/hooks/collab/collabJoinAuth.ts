import type { AuthState } from '../../../auth/AuthContext';
import { deriveSelfUserId } from './collabIdentity';

export type ResolvedCollabJoinAuthArgs = {
  auth: Pick<AuthState, 'accessToken' | 'displayName' | 'subject'>;
  guestId: string;
  inviteParam: string | null;
  boardId?: string;
  apiBaseUrl?: string;
  wsBaseUrl?: string;
};

export type ResolvedCollabJoinAuth = {
  accessToken: string | null;
  isAuthenticated: boolean;
  inviteToken: string | null;
  displayName: string;
  initialSelfUserId: string;
  wsEnabled: boolean;
  restEnabled: boolean;
  enabled: boolean;
  boardEnsured: boolean;
  authKey: string;
};

export function normalizeQueryToken(t: string | null | undefined, key: string): string | null {
  const s = (t ?? '').trim();
  if (!s) return null;
  const idx = s.lastIndexOf(`${key}=`);
  if (idx >= 0) return s.substring(idx + key.length + 1).replace(/^[?&]/, '').trim();
  return s.replace(/^[?&]/, '').trim();
}

export function resolveCollabJoinAuth({
  auth,
  guestId,
  inviteParam,
  boardId,
  apiBaseUrl,
  wsBaseUrl,
}: ResolvedCollabJoinAuthArgs): ResolvedCollabJoinAuth {
  const rawAccessToken = auth.accessToken;
  const accessToken = normalizeQueryToken(rawAccessToken, 'access_token') ?? rawAccessToken;
  const isAuthenticated = Boolean(accessToken);
  const inviteToken = isAuthenticated ? null : inviteParam;
  const displayName = isAuthenticated ? auth.displayName?.trim() || 'User' : 'Guest';
  const initialSelfUserId = inviteToken
    ? guestId
    : deriveSelfUserId(guestId, accessToken, auth.subject);

  const wsEnabled =
    Boolean(apiBaseUrl) &&
    Boolean(wsBaseUrl) &&
    Boolean(boardId) &&
    (Boolean(accessToken) || Boolean(inviteToken));
  const restEnabled = Boolean(apiBaseUrl) && Boolean(boardId) && Boolean(accessToken);
  const boardEnsured = Boolean(boardId) && (Boolean(accessToken) || Boolean(inviteToken));
  const authKey = accessToken ? `token:${accessToken}` : `invite:${inviteToken}`;

  return {
    accessToken,
    isAuthenticated,
    inviteToken,
    displayName,
    initialSelfUserId,
    wsEnabled,
    restEnabled,
    enabled: wsEnabled,
    boardEnsured,
    authKey,
  };
}
