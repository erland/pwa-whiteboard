import type { Point, WhiteboardObjectType } from '../../../domain/types';
import type { ShapeToolDefinition, ToolCreateResult, ToolPointerContext, ObjectPort } from '../shapeTypes';
import type { DraftShape } from '../../drawing';

import { drawFreehandObject } from '../freehand/draw';
import { getFreehandBoundingBox, translateFreehandObject, resizeFreehandObject } from '../freehand/geometry';
import { freehandSelectionCapabilities } from '../freehand/selection';
import { startFreehandDraft, updateFreehandDraft, finishFreehandDraft } from '../freehand/interactions';

import { drawLineObject, drawLineDraft } from '../line/draw';
import { getLineBoundingBox, hitTestLine, translateLineObject } from '../line/geometry';
import { lineSelectionCapabilities } from '../line/selection';
import { startLineDraft, updateLineDraft, finishLineDraft } from '../line/interactions';

import { drawConnectorObject } from '../connector/draw';
import { getConnectorBoundingBox, hitTestConnector } from '../connector/geometry';
import { connectorSelectionCapabilities } from '../connector/selection';
import { startConnectorDraft, updateConnectorDraft, finishConnectorDraft } from '../connector/interactions';

export function createLinearShapeDefinitions(): Partial<Record<WhiteboardObjectType, ShapeToolDefinition>> {
  return {
    freehand: {
      type: 'freehand',
      draw: (ctx, obj, viewport) => drawFreehandObject(ctx, obj, viewport),
      getBoundingBox: (obj) => getFreehandBoundingBox(obj),
      translate: (obj, dx, dy) => translateFreehandObject(obj, dx, dy),
      resize: (obj, newBounds) => resizeFreehandObject(obj, newBounds),
      selectionCaps: freehandSelectionCapabilities,
      draft: {
        startDraft: (ctx: ToolPointerContext, pos: Point) =>
          startFreehandDraft({
            pos,
            strokeColor: ctx.strokeColor,
            strokeWidth: ctx.strokeWidth,
            generateObjectId: ctx.generateObjectId,
          }),
        updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) => updateFreehandDraft(draft, pos),
        finishDraft: (draft: DraftShape): ToolCreateResult | null => {
          const { object, selectIds } = finishFreehandDraft(draft);
          return object && selectIds ? { object, selectIds } : null;
        },
      },
    },

    line: {
      type: 'line',
      draw: (ctx, obj, viewport) => drawLineObject(ctx, obj, viewport),
      drawDraft: (ctx, draft, viewport) => drawLineDraft(ctx, draft, viewport),
      getBoundingBox: (obj) => getLineBoundingBox(obj),
      hitTest: (obj, worldX, worldY) => hitTestLine(obj, worldX, worldY),
      translate: (obj, dx, dy) => translateLineObject(obj, dx, dy),
      selectionCaps: lineSelectionCapabilities,
      draft: {
        startDraft: (ctx: ToolPointerContext, pos: Point) =>
          startLineDraft({
            pos,
            strokeColor: ctx.strokeColor,
            strokeWidth: ctx.strokeWidth,
            arrowStart: (((ctx.toolProps as any)?.arrowStart ?? 'none') as any),
            arrowEnd: (((ctx.toolProps as any)?.arrowEnd ?? 'none') as any),
            generateObjectId: ctx.generateObjectId,
          }),
        updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) => updateLineDraft(draft, pos),
        finishDraft: (draft: DraftShape): ToolCreateResult | null => {
          const { object, selectIds } = finishLineDraft(draft);
          return object && selectIds ? { object, selectIds } : null;
        },
      },
    },

    connector: {
      type: 'connector',
      translate: () => null,
      draw: (ctx, obj, viewport, env) => {
        const objects = env.objects ?? [];
        drawConnectorObject(ctx, obj, objects, viewport);
      },
      getBoundingBox: (obj, env) => {
        const objects = env?.objects ?? [];
        return getConnectorBoundingBox(obj, objects);
      },
      hitTest: (obj, worldX, worldY, env) => {
        const objects = env?.objects ?? [];
        return hitTestConnector(objects, obj, worldX, worldY);
      },
      selectionCaps: connectorSelectionCapabilities,
      draft: {
        startDraft: (ctx: ToolPointerContext, pos: Point) =>
          startConnectorDraft({
            pos,
            objects: ctx.objects,
            viewport: ctx.viewport,
            strokeColor: ctx.strokeColor,
            strokeWidth: ctx.strokeWidth,
            arrowStart: (((ctx.toolProps as any)?.arrowStart ?? 'none') as any),
            arrowEnd: (((ctx.toolProps as any)?.arrowEnd ?? 'none') as any),
            generateObjectId: ctx.generateObjectId,
          }),
        updateDraft: (draft: DraftShape, ctx: ToolPointerContext, pos: Point) =>
          updateConnectorDraft({ draft, pos, objects: ctx.objects, viewport: ctx.viewport }),
        finishDraft: (draft: DraftShape, ctx: ToolPointerContext, pos: Point): ToolCreateResult | null => {
          const { object, selectIds } = finishConnectorDraft({ draft, pos, objects: ctx.objects, viewport: ctx.viewport });
          return object && selectIds ? { object, selectIds } : null;
        },
      },
    },
  };
}
