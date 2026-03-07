import type { Point, WhiteboardObjectType } from '../../../domain/types';
import type { ShapeToolDefinition, ToolPointerContext, ObjectPort } from '../shapeTypes';

import { drawTextObject } from '../text/draw';
import { getTextBoundingBox, getTextPorts } from '../text/geometry';
import { textSelectionCapabilities } from '../text/selection';
import { createTextObject } from '../text/interactions';

import { drawStickyNoteObject } from '../stickyNote/draw';
import { getStickyNoteBoundingBox, getStickyNotePorts } from '../stickyNote/geometry';
import { stickyNoteSelectionCapabilities } from '../stickyNote/selection';
import { createStickyNoteObject } from '../stickyNote/interactions';

import { resizeBoxObjectByBounds } from '../_shared/resizeByBounds';

export function createTextualShapeDefinitions(): Partial<Record<WhiteboardObjectType, ShapeToolDefinition>> {
  return {
    text: {
      type: 'text',
      draw: (ctx, obj, viewport, env) => {
        drawTextObject(ctx, obj, viewport, env.fallbackStrokeColor ?? '#000000');
      },
      getBoundingBox: (obj) => getTextBoundingBox(obj),
      resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
      getPorts: (obj): ObjectPort[] => getTextPorts(obj),
      selectionCaps: textSelectionCapabilities,
      pointerDownCreate: (ctx: ToolPointerContext, pos: Point) => {
        const { object, selectIds } = createTextObject({
          pos,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          textColor: (ctx.toolProps?.textColor as any) ?? undefined,
          fontSize: (ctx.toolProps?.fontSize as any) ?? undefined,
          text: (ctx.toolProps?.text as any) ?? undefined,
          generateObjectId: ctx.generateObjectId,
        });
        return object && selectIds ? { object, selectIds } : null;
      },
    },

    stickyNote: {
      type: 'stickyNote',
      draw: (ctx, obj, viewport, env) => drawStickyNoteObject(ctx, obj, viewport, env.fallbackStrokeColor ?? '#000000'),
      getBoundingBox: (obj) => getStickyNoteBoundingBox(obj),
      resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
      getPorts: (obj): ObjectPort[] => getStickyNotePorts(obj),
      selectionCaps: stickyNoteSelectionCapabilities,
      pointerDownCreate: (ctx: ToolPointerContext, pos: Point) => {
        const { object, selectIds } = createStickyNoteObject({
          pos,
          strokeColor: ctx.strokeColor,
          strokeWidth: ctx.strokeWidth,
          fillColor: (ctx.toolProps?.fillColor as any) ?? undefined,
          textColor: (ctx.toolProps?.textColor as any) ?? undefined,
          fontSize: (ctx.toolProps?.fontSize as any) ?? undefined,
          text: (ctx.toolProps?.text as any) ?? undefined,
          generateObjectId: ctx.generateObjectId,
        });
        return object && selectIds ? { object, selectIds } : null;
      },
    },
  };
}
