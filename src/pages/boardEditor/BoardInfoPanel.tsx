import React from 'react';
import type { WhiteboardMeta } from '../../domain/types';

type BoardInfoPanelProps = {
  meta: WhiteboardMeta;
  objectCount: number;
};

export const BoardInfoPanel: React.FC<BoardInfoPanelProps> = ({
  meta,
  objectCount
}) => (
  <div className="panel">
    <h2 className="panel-title">Board info</h2>
    <div className="panel-row">
      <span className="field-label-inline">Name</span>
      <span className="field-value">{meta.name}</span>
    </div>
    <div className="panel-row">
      <span className="field-label-inline">Objects</span>
      <span className="field-value">{objectCount}</span>
    </div>
  </div>
);