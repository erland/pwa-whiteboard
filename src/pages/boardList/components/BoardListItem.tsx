import React from 'react';
import type { WhiteboardMeta } from '../../../domain/types';
import { getBoardType } from '../../../whiteboard/boardTypes';

type Props = {
  board: WhiteboardMeta;
  onOpen: (boardId: string) => void;
  onDuplicate: (board: WhiteboardMeta) => void;
  onRename: (board: WhiteboardMeta) => void;
  onDelete: (board: WhiteboardMeta) => void;
};

export const BoardListItem: React.FC<Props> = ({
  board,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
}) => {
  return (
    <li className="board-list-item">
      <button type="button" className="board-list-main" onClick={() => onOpen(board.id)}>
        <div className="board-list-name">{board.name}</div>
        <div className="board-list-meta">
          <span>Type: {getBoardType(board.boardType).label}</span>
          <span>Created: {new Date(board.createdAt).toLocaleString()}</span>
          <span>Updated: {new Date(board.updatedAt).toLocaleString()}</span>
        </div>
      </button>
      <div className="board-list-actions">
        <button type="button" onClick={() => onDuplicate(board)}>
          Duplicate
        </button>
        <button type="button" onClick={() => onRename(board)}>
          Rename
        </button>
        <button type="button" onClick={() => onDelete(board)}>
          Delete
        </button>
      </div>
    </li>
  );
};
