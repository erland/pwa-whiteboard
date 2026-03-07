import React from 'react';
import { getBoardType } from '../../../whiteboard/boardTypes';
import type { BoardListItem as BoardListItemModel } from '../types';

type Props = {
  item: BoardListItemModel;
  onOpen: (boardId: string) => void;
  onDuplicate: (item: BoardListItemModel) => void;
  onRename: (item: BoardListItemModel) => void;
  onDelete: (item: BoardListItemModel) => void;
};

export const BoardListItem: React.FC<Props> = ({
  item,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
}) => {
  const { board, actions } = item;

  return (
    <li className="board-list-item" data-board-source={item.source}>
      <button type="button" className="board-list-main" onClick={() => onOpen(board.id)}>
        <div className="board-list-name">{board.name}</div>
        <div className="board-list-meta">
          <span>Type: {getBoardType(board.boardType).label}</span>
          <span>Created: {new Date(board.createdAt).toLocaleString()}</span>
          <span>Updated: {new Date(board.updatedAt).toLocaleString()}</span>
        </div>
      </button>
      <div className="board-list-actions">
        {actions.canDuplicate && (
          <button type="button" onClick={() => onDuplicate(item)}>
            Duplicate
          </button>
        )}
        {actions.canRename && (
          <button type="button" onClick={() => onRename(item)}>
            Rename
          </button>
        )}
        {actions.canDelete && (
          <button type="button" onClick={() => onDelete(item)}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
};
