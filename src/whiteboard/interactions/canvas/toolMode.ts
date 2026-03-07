import { toolPointerDown, toolPointerMove, toolPointerUp } from '../../tools/shapeRegistry';
import type { Point } from '../../../domain/types';
import type { CanvasInteractionsDeps } from './types';

export function handleToolPointerDown(deps: CanvasInteractionsDeps, pos: Point): boolean {
  if (deps.activeTool === 'select') return false;

  const res = toolPointerDown(deps.activeTool, deps.toolCtx, pos);
  if (res.kind === 'draft') {
    deps.setDraft(res.draft);
  } else if (res.kind === 'create') {
    deps.onCreateObject(res.object);
    deps.onSelectionChange(res.selectIds);
  }
  return true;
}

export function handleToolPointerMove(deps: CanvasInteractionsDeps, pos: Point): boolean {
  if (!deps.draft) return false;
  const res = toolPointerMove(deps.draft, deps.toolCtx, pos);
  deps.setDraft(res.draft);
  return true;
}

export function finishToolInteraction(deps: CanvasInteractionsDeps, pos: Point): boolean {
  if (!deps.draft) return false;

  const res = toolPointerUp(deps.draft, deps.toolCtx, pos);
  if (res.kind === 'create') {
    deps.onCreateObject(res.object);
    deps.onSelectionChange(res.selectIds);
  }
  deps.setDraft(null);
  return true;
}

export function leaveToolInteraction(deps: CanvasInteractionsDeps, pos: Point): boolean {
  if (!deps.draft) return false;

  if (deps.draft.kind === 'connector') {
    deps.setDraft(null);
    return true;
  }

  return finishToolInteraction(deps, pos);
}
