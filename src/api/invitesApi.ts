import { getApiBaseUrl } from '../config/server';
import { getAccessToken } from '../auth/oidc';
import { createHttpClient } from './httpClient';
import type {
  AcceptInviteRequest,
  CreateInviteRequest,
  ServerInviteCreatedResponse,
  ServerInvitePermission,
  ServerInviteValidationResponse,
  ValidateInviteRequest,
} from './javaWhiteboardServerContract';

function normalizePermission(p: InvitePermissionInput): InvitePermission {
  const v = String(p).toLowerCase();
  if (v === 'viewer' || v === 'editor') return v;
  // fallback (should never happen if UI is typed)
  return 'viewer';
}

export type InvitePermission = ServerInvitePermission;
export type InvitePermissionInput = 'VIEWER' | 'EDITOR' | InvitePermission;

export type CreateInviteResponse = Pick<ServerInviteCreatedResponse, 'token' | 'expiresAt'>;

export type ValidateInviteResponse = Pick<ServerInviteValidationResponse, 'valid' | 'permission' | 'expiresAt' | 'boardId'> & {
  reason?: ServerInviteValidationResponse['reason'];
};

function http() {
  return createHttpClient({
    baseUrl: getApiBaseUrl()!,
    getAccessToken,
  });
}

export async function createBoardInvite(args: {
  boardId: string;
  permission: InvitePermissionInput;
}): Promise<CreateInviteResponse> {
  const boardId = encodeURIComponent(args.boardId);
  const req: CreateInviteRequest = { permission: normalizePermission(args.permission) };
  return await http().post<CreateInviteResponse>(`/boards/${boardId}/invites`, {
    json: req,
  });
}

export async function validateInvite(token: string): Promise<ValidateInviteResponse> {
  const req: ValidateInviteRequest = { token };
  return await http().post<ValidateInviteResponse>('/invites/validate', {
    json: req,
  });
}

export async function acceptInvite(token: string): Promise<void> {
  const req: AcceptInviteRequest = { token };
  await http().post<void>('/invites/accept', {
    json: req,
  });
}
