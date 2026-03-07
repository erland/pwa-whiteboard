import type { Point, WhiteboardObjectType, WhiteboardObject } from '../../../domain/types';
import type { ShapeToolDefinition, ToolCreateResult, ToolPointerContext, ObjectPort } from '../shapeTypes';
import type { DraftShape } from '../../drawing';

import { drawRectangleObject } from '../rectangle/draw';
import { getRectangleBoundingBox, getRectanglePorts } from '../rectangle/geometry';
import { rectangleSelectionCapabilities } from '../rectangle/selection';
import { startRectangleDraft, updateRectangleDraft, finishRectangleDraft } from '../rectangle/interactions';

import { drawRoundedRectObject, drawRoundedRectDraft } from '../roundedRect/draw';
import { getRoundedRectBoundingBox, getRoundedRectPorts } from '../roundedRect/geometry';
import { roundedRectSelectionCapabilities } from '../roundedRect/selection';
import { startRoundedRectDraft, updateRoundedRectDraft, finishRoundedRectDraft } from '../roundedRect/interactions';

import { drawEllipseObject } from '../ellipse/draw';
import { getEllipseBoundingBox, getEllipsePorts } from '../ellipse/geometry';
import { ellipseSelectionCapabilities } from '../ellipse/selection';
import { startEllipseDraft, updateEllipseDraft, finishEllipseDraft } from '../ellipse/interactions';

import { drawDiamondObject, drawDiamondDraft } from '../diamond/draw';
import { getDiamondBoundingBox, getDiamondPorts, hitTestDiamond } from '../diamond/geometry';
import { diamondSelectionCapabilities } from '../diamond/selection';
import { startDiamondDraft, updateDiamondDraft, finishDiamondDraft } from '../diamond/interactions';

import { resizeBoxObjectByBounds } from '../_shared/resizeByBounds';
import { applyOptionalNumberProp, applyOptionalStringProp } from './common';

function createBoxDraftFinishResult(
  finish: (draft: DraftShape) => { object?: WhiteboardObject; selectIds?: string[] },
  draft: DraftShape,
  ctx: ToolPointerContext,
  options?: { fillColor?: boolean; cornerRadius?: boolean }
): ToolCreateResult | null {
  const { object, selectIds } = finish(draft);
  if (!object || !selectIds) return null;
  let next = object;
  if (options?.fillColor) next = applyOptionalStringProp(next, 'fillColor', ctx.toolProps?.fillColor);
  if (options?.cornerRadius) next = applyOptionalNumberProp(next, 'cornerRadius', ctx.toolProps?.cornerRadius);
  return { object: next, selectIds };
}

export function createBasicShapeDefinitions(): Partial<Record<WhiteboardObjectType, ShapeToolDefinition>> {
  return {
    rectangle: {
      type: 'rectangle',
      draw: (ctx, obj, viewport) => drawRectangleObject(ctx, obj, viewport),
      getBoundingBox: (obj) => getRectangleBoundingBox(obj),
      resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
      getPorts: (obj): ObjectPort[] => getRectanglePorts(obj),
      selectionCaps: rectangleSelectionCapabilities,
      draft: {
        startDraft: (ctx: ToolPointerContext, pos: Point) =>
          startRectangleDraft({
            pos,
            strokeColor: ctx.strokeColor,
            strokeWidth: ctx.strokeWidth,
            generateObjectId: ctx.generateObjectId,
          }),
        updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) => updateRectangleDraft(draft, pos),
        finishDraft: (draft: DraftShape, ctx: ToolPointerContext): ToolCreateResult | null =>
          createBoxDraftFinishResult(finishRectangleDraft, draft, ctx, { fillColor: true }),
      },
    },

    roundedRect: {
      type: 'roundedRect',
      draw: (ctx, obj, viewport) => drawRoundedRectObject(ctx, obj, viewport),
      drawDraft: (ctx, draft, viewport) => drawRoundedRectDraft(ctx, draft, viewport),
      getBoundingBox: (obj) => getRoundedRectBoundingBox(obj),
      resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
      getPorts: (obj): ObjectPort[] => getRoundedRectPorts(obj).map((p) => ({ portId: p.portId, point: p.point })),
      selectionCaps: roundedRectSelectionCapabilities,
      draft: {
        startDraft: (ctx: ToolPointerContext, pos: Point) =>
          startRoundedRectDraft({
            pos,
            strokeColor: ctx.strokeColor,
            strokeWidth: ctx.strokeWidth,
            generateObjectId: ctx.generateObjectId,
          }),
        updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) => updateRoundedRectDraft(draft, pos),
        finishDraft: (draft: DraftShape, ctx: ToolPointerContext): ToolCreateResult | null =>
          createBoxDraftFinishResult(finishRoundedRectDraft, draft, ctx, { fillColor: true, cornerRadius: true }),
      },
    },

    ellipse: {
      type: 'ellipse',
      draw: (ctx, obj, viewport) => drawEllipseObject(ctx, obj, viewport),
      getBoundingBox: (obj) => getEllipseBoundingBox(obj),
      resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
      getPorts: (obj): ObjectPort[] => getEllipsePorts(obj),
      selectionCaps: ellipseSelectionCapabilities,
      draft: {
        startDraft: (ctx: ToolPointerContext, pos: Point) =>
          startEllipseDraft({
            pos,
            strokeColor: ctx.strokeColor,
            strokeWidth: ctx.strokeWidth,
            generateObjectId: ctx.generateObjectId,
          }),
        updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) => updateEllipseDraft(draft, pos),
        finishDraft: (draft: DraftShape, ctx: ToolPointerContext): ToolCreateResult | null =>
          createBoxDraftFinishResult(finishEllipseDraft, draft, ctx, { fillColor: true }),
      },
    },

    diamond: {
      type: 'diamond',
      connectorAttachmentPolicy: 'portsOnly',
      draw: (ctx, obj, viewport) => drawDiamondObject(ctx, obj, viewport),
      drawDraft: (ctx, draft, viewport) => drawDiamondDraft(ctx, draft, viewport),
      getBoundingBox: (obj) => getDiamondBoundingBox(obj),
      resize: (obj, newBounds) => resizeBoxObjectByBounds(obj, newBounds),
      hitTest: (obj, worldX, worldY) => hitTestDiamond(obj, worldX, worldY),
      getPorts: (obj): ObjectPort[] => getDiamondPorts(obj),
      selectionCaps: diamondSelectionCapabilities,
      draft: {
        startDraft: (ctx: ToolPointerContext, pos: Point) =>
          startDiamondDraft({
            pos,
            strokeColor: ctx.strokeColor,
            strokeWidth: ctx.strokeWidth,
            generateObjectId: ctx.generateObjectId,
          }),
        updateDraft: (draft: DraftShape, _ctx: ToolPointerContext, pos: Point) => updateDiamondDraft(draft, pos),
        finishDraft: (draft: DraftShape, ctx: ToolPointerContext): ToolCreateResult | null =>
          createBoxDraftFinishResult(finishDiamondDraft, draft, ctx, { fillColor: true }),
      },
    },
  };
}
