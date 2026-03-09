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
