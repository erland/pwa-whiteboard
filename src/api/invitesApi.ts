import { getApiBaseUrl } from '../config/server';
import { getAccessToken } from '../auth/oidc';
import { createHttpClient } from './httpClient';

export type InvitePermission = 'VIEWER' | 'EDITOR';

export type CreateInviteResponse = {
  token: string;
  expiresAt?: string;
};

export type ValidateInviteResponse = {
  valid: boolean;
  permission?: InvitePermission;
  expiresAt?: string;
  boardId?: string;
};

function http() {
  return createHttpClient({
    baseUrl: getApiBaseUrl()!,
    getAccessToken,
  });
}

export async function createBoardInvite(args: {
  boardId: string;
  permission: InvitePermission;
}): Promise<CreateInviteResponse> {
  const boardId = encodeURIComponent(args.boardId);
  return await http().post<CreateInviteResponse>(`/boards/${boardId}/invites`, {
    json: { permission: args.permission },
  });
}

export async function validateInvite(token: string): Promise<ValidateInviteResponse> {
  return await http().post<ValidateInviteResponse>('/invites/validate', {
    json: { token },
  });
}

export async function acceptInvite(token: string): Promise<void> {
  await http().post<void>('/invites/accept', {
    json: { token },
  });
}
