import React from 'react';
import type { BoardListItem as BoardListItemModel } from '../types';
import { BoardListItem } from './BoardListItem';

type Props = {
  items: BoardListItemModel[];
  onOpen: (boardId: string) => void;
  onDuplicate: (item: BoardListItemModel) => void;
  onRename: (item: BoardListItemModel) => void;
  onDelete: (item: BoardListItemModel) => void;
};

export const BoardList: React.FC<Props> = ({
  items,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
}) => {
  return (
    <ul className="board-list">
      {items.map((item) => (
        <BoardListItem
          key={item.id}
          item={item}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
};
