import type { BoardTypeId, WhiteboardId, WhiteboardMeta } from '../domain/types';
import { DEFAULT_BOARD_TYPE, SERVER_WHITEBOARD_KIND } from '../domain/boardType';
import { getApiBaseUrl } from '../config/server';
import { getAccessToken } from '../auth/oidc';
import { createHttpClient } from './httpClient';
import type { CreateBoardRequest, ServerBoard, UpdateBoardRequest } from './javaWhiteboardServerContract';
import { deletePersistedBoardType, getPersistedBoardType, setPersistedBoardType } from '../infrastructure/boardTypePersistence';

function serverBoardToMeta(b: ServerBoard, fallbackBoardType?: BoardTypeId): WhiteboardMeta {
  const persisted = getPersistedBoardType(b.id);
  return {
    id: b.id,
    name: b.name,
    boardType: persisted ?? fallbackBoardType ?? DEFAULT_BOARD_TYPE,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function http() {
  return createHttpClient({
    baseUrl: getApiBaseUrl()!,
    getAccessToken,
  });
}

export async function listBoards(): Promise<WhiteboardMeta[]> {
  // Server returns a bare JSON array (List<BoardResponse>)
  const boards = await http().get<ServerBoard[]>('/boards');
  // Hide archived boards on the front page.
  // Server uses status values like "ACTIVE" / "ARCHIVED".
  const activeBoards = boards.filter((b) => String(b.status ?? '').toUpperCase() !== 'ARCHIVED');
  return activeBoards.map((board) => serverBoardToMeta(board));
}

export async function createBoard(args: { name: string; boardType: BoardTypeId }): Promise<WhiteboardMeta> {
  const req: CreateBoardRequest = { name: args.name, type: SERVER_WHITEBOARD_KIND };
  const created = await http().post<ServerBoard>('/boards', {
    json: req,
  });
  // Persist client boardType locally until server supports it.
  setPersistedBoardType(created.id as WhiteboardId, args.boardType);
  return serverBoardToMeta(created, args.boardType);
}

export async function renameBoard(boardId: WhiteboardId, name: string): Promise<WhiteboardMeta> {
  const req: UpdateBoardRequest = { name, type: SERVER_WHITEBOARD_KIND };
  const existingBoardType = getPersistedBoardType(boardId);
  const updated = await http().patch<ServerBoard>(`/boards/${encodeURIComponent(boardId)}`, {
    json: req,
  });
  return serverBoardToMeta(updated, existingBoardType ?? undefined);
}

export async function deleteBoard(boardId: WhiteboardId): Promise<void> {
  await http().del<void>(`/boards/${encodeURIComponent(boardId)}`);
  deletePersistedBoardType(boardId);
}

export { getPersistedBoardType, setPersistedBoardType, deletePersistedBoardType } from '../infrastructure/boardTypePersistence';
