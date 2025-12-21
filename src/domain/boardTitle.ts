import { getBoardsRepository } from '../infrastructure/localStorageBoardsRepository';

/**
 * Best-effort helper to pick a reasonable board title in places where
 * state/meta may not yet be fully loaded (newly created boards).
 */
export async function getBestLocalBoardTitle(
  boardId: string,
  preferredTitle?: string | null
): Promise<string | null> {
  try {
    const t = preferredTitle?.trim();
    if (t) return t;

    const repo = getBoardsRepository();
    const boards = await repo.listBoards();
    const found = boards.find((b) => b.id === boardId);
    const name = found?.name?.trim();
    if (name) return name;
  } catch {
    // ignore
  }
  return null;
}
