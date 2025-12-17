import React from 'react';
import type { WhiteboardMeta } from '../../../domain/types';
import { BoardListItem } from './BoardListItem';

type Props = {
  boards: WhiteboardMeta[];
  onOpen: (boardId: string) => void;
  onDuplicate: (board: WhiteboardMeta) => void;
  onRename: (board: WhiteboardMeta) => void;
  onDelete: (board: WhiteboardMeta) => void;
};

export const BoardList: React.FC<Props> = ({
  boards,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
}) => {
  return (
    <ul className="board-list">
      {boards.map((board) => (
        <BoardListItem
          key={board.id}
          board={board}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
};
