import React from 'react';
import type { BoardTypeId, WhiteboardMeta } from '../../domain/types';
import { BOARD_TYPE_IDS, getBoardType } from '../../whiteboard/boardTypes';

type BoardInfoPanelProps = {
  meta: WhiteboardMeta;
  objectCount: number;
  eventCount: number;
  onChangeBoardType: (nextType: BoardTypeId) => void;
};

export const BoardInfoPanel: React.FC<BoardInfoPanelProps> = ({
  meta,
  objectCount,
  eventCount,
  onChangeBoardType,
}) => (
  <div className="panel">
    <h2 className="panel-title">Board info</h2>
    <div className="panel-row">
      <span className="field-label-inline">Name</span>
      <span className="field-value">{meta.name}</span>
    </div>
    <div className="panel-row">
      <span className="field-label-inline">Type</span>
      <span className="field-value">
        <select
          value={meta.boardType}
          onChange={(e) => onChangeBoardType(e.target.value as BoardTypeId)}
          aria-label="Board type"
        >
          {BOARD_TYPE_IDS.map((id) => (
            <option key={id} value={id}>
              {getBoardType(id).label}
            </option>
          ))}
        </select>
      </span>
    </div>
    <div className="panel-row">
      <span className="field-label-inline">Objects</span>
      <span className="field-value">{objectCount}</span>
    </div>
    <div className="panel-row">
      <span className="field-label-inline">Events</span>
      <span className="field-value">{eventCount}</span>
    </div>
  </div>
);