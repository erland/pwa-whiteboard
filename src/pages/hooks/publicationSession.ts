export type BoardAccessMode = 'member' | 'invite' | 'publication';

export type PublicationSession = {
  token: string;
  id: string;
  boardId: string;
  targetType: 'board' | 'snapshot';
  snapshotVersion: number | null;
  allowComments: boolean;
  state: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type BoardAccessContext = {
  mode: BoardAccessMode;
  inviteToken: string | null;
  publicationSession: PublicationSession | null;
  publicationToken: string | null;
  isMemberAccess: boolean;
  isInviteAccess: boolean;
  isPublicationAccess: boolean;
  isReadOnly: boolean;
};

export function createBoardAccessContext(args: {
  inviteToken?: string | null;
  publicationSession?: PublicationSession | null;
}): BoardAccessContext {
  const publicationSession = args.publicationSession ?? null;
  const inviteToken = args.inviteToken ?? null;
  const mode: BoardAccessMode = publicationSession
    ? 'publication'
    : inviteToken
      ? 'invite'
      : 'member';

  return {
    mode,
    inviteToken,
    publicationSession,
    publicationToken: publicationSession?.token ?? null,
    isMemberAccess: mode === 'member',
    isInviteAccess: mode === 'invite',
    isPublicationAccess: mode === 'publication',
    isReadOnly: mode === 'publication',
  };
}
