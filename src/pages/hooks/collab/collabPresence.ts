import type {
  BoardRole,
  PresencePayload,
  PresenceUser,
  ServerJoinedMessage,
  ServerPresenceMessage,
} from '../../../../shared/protocol';

export type CollabPresenceState = {
  role?: BoardRole;
  users: PresenceUser[];
  presenceByUserId: Record<string, PresencePayload>;
};

export function fallbackUsersFromIds(userIds: string[]): PresenceUser[] {
  return userIds.map((userId) => ({
    userId,
    displayName: userId,
    role: 'viewer' as const,
  }));
}

export function resolveJoinedUsers(msg: Pick<ServerJoinedMessage, 'users' | 'presentUserIds'>): PresenceUser[] {
  return msg.users ?? fallbackUsersFromIds(msg.presentUserIds ?? []);
}

export function resolvePresenceUsers(msg: Pick<ServerPresenceMessage, 'users' | 'presentUserIds'>): PresenceUser[] {
  return msg.users ?? fallbackUsersFromIds(msg.presentUserIds ?? []);
}

export function createJoinedPresenceState(msg: Pick<ServerJoinedMessage, 'role' | 'users' | 'presentUserIds'>): CollabPresenceState {
  return {
    role: msg.role,
    users: resolveJoinedUsers(msg),
    presenceByUserId: {},
  };
}

export function createPresenceMessageState(msg: Pick<ServerPresenceMessage, 'users' | 'presentUserIds'>): Pick<CollabPresenceState, 'users' | 'presenceByUserId'> {
  return {
    users: resolvePresenceUsers(msg),
    presenceByUserId: {},
  };
}
