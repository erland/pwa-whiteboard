import { getLocalBoardsRepository, getRemoteBoardsRepository } from '../../infrastructure/localStorageBoardsRepository';
import type { BoardsRepository } from '../../domain/boardsIndex';
import type { BoardListSource } from './types';

export function getBoardRepositoryForSource(source: BoardListSource): BoardsRepository {
  return source === 'local' ? getLocalBoardsRepository() : getRemoteBoardsRepository();
}

export function getEditableBoardsRepository(serverConfigured: boolean): BoardsRepository {
  return serverConfigured ? getRemoteBoardsRepository() : getLocalBoardsRepository();
}
