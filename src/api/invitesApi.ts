import { getApiBaseUrl } from '../config/server';
import { getAccessToken } from '../auth/oidc';
import { createHttpClient } from './httpClient';
import type {
  AcceptInviteRequest,
  CreateInviteRequest,
  ServerInviteCreatedResponse,
  ServerInvitePermission,
  ServerInviteResponse,
  ServerInviteValidationResponse,
  ValidateInviteRequest,
} from './javaWhiteboardServerContract';

function normalizePermission(p: InvitePermissionInput): InvitePermission {
  const v = String(p).toLowerCase();
  if (v === 'viewer' || v === 'editor') return v;
  return 'viewer';
}

export type InvitePermission = ServerInvitePermission;
export type InvitePermissionInput = 'VIEWER' | 'EDITOR' | InvitePermission;

export type BoardInvite = {
  id: string;
  boardId: string;
  permission: InvitePermission;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  revokedAt: string | null;
  createdAt: string;
};

export type CreateInviteResponse = BoardInvite & {
  token: string;
};

export type ValidateInviteResponse = Pick<ServerInviteValidationResponse, 'valid' | 'permission' | 'expiresAt' | 'boardId'> & {
  reason?: ServerInviteValidationResponse['reason'];
};

function mapInvite(value: ServerInviteResponse): BoardInvite {
  return {
    id: String(value.id),
    boardId: String(value.boardId),
    permission: normalizePermission(value.permission),
    expiresAt: value.expiresAt ?? null,
    maxUses: value.maxUses ?? null,
    uses: Number(value.uses ?? 0),
    revokedAt: value.revokedAt ?? null,
    createdAt: String(value.createdAt),
  };
}

function mapCreatedInvite(value: ServerInviteCreatedResponse): CreateInviteResponse {
  return {
    ...mapInvite(value),
    token: String(value.token),
  };
}

function http() {
  return createHttpClient({
    baseUrl: getApiBaseUrl()!,
    getAccessToken,
  });
}

export async function createBoardInvite(args: {
  boardId: string;
  permission: InvitePermissionInput;
  expiresAt?: string;
  maxUses?: number;
}): Promise<CreateInviteResponse> {
  const boardId = encodeURIComponent(args.boardId);
  const req: CreateInviteRequest = {
    permission: normalizePermission(args.permission),
    expiresAt: args.expiresAt,
    maxUses: args.maxUses,
  };
  const res = await http().post<ServerInviteCreatedResponse>(`/boards/${boardId}/invites`, {
    json: req,
  });
  return mapCreatedInvite(res);
}

export async function listBoardInvites(boardId: string): Promise<BoardInvite[]> {
  const res = await http().get<ServerInviteResponse[]>(`/boards/${encodeURIComponent(boardId)}/invites`);
  return Array.isArray(res) ? res.map(mapInvite) : [];
}

export async function revokeBoardInvite(boardId: string, inviteId: string): Promise<void> {
  await http().del<void>(`/boards/${encodeURIComponent(boardId)}/invites/${encodeURIComponent(inviteId)}`);
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
