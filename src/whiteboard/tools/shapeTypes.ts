// src/whiteboard/tools/shapeTypes.ts

/**
 * Shape / tool definition interfaces.
 *
 * Step A1 of the refactor: introduce stable interfaces that we can progressively
 * migrate the rest of the codebase to use.
 *
 * IMPORTANT:
 * - This file is intentionally NOT wired into the app yet (no behavior change).
 * - Later steps will build registries around these interfaces (draw/geometry/
 *   interactions/selection/ports) so adding a new shape becomes mostly "add a
 *   folder + register it once".
 */

import type {
  WhiteboardObject,
  WhiteboardObjectType,
  Viewport,
  Point,
  ObjectId,
} from '../../domain/types';

import type { Bounds } from '../geometry/types';
import type { DraftShape } from '../drawing';

export type ObjectPort = { portId: string; point: Point };
import type { SelectionCapabilities } from './selection/types';

/**
 * Extra context that draw() may need.
 * - For example: connectors need access to all objects to resolve endpoints.
 * - Some shapes may use fallbackStrokeColor for text rendering.
 */
export type ShapeDrawEnv = {
  objects?: WhiteboardObject[];
  fallbackStrokeColor?: string;
};

/**
 * Optional extra context for geometry/hit-testing.
 */
export type ShapeGeometryEnv = {
  /**
   * When bounding boxes/hit tests require access to other objects (e.g. connector),
   * provide the full object list or state-derived list.
   */
  objects?: WhiteboardObject[];
};

/**
 * The minimal shape definition:
 * - draw() and getBoundingBox() are the two most load-bearing operations.
 * - other capabilities (ports, hitTest, selectionCaps, draft lifecycle) are optional.
 *
 * We keep this broad and permissive in A1; later steps can tighten types using generics.
 */
export interface ShapeDefinition<TObj extends WhiteboardObject = WhiteboardObject> {
  /** The object discriminator this definition handles (e.g. 'rectangle'). */
  type: WhiteboardObjectType;

  /**
   * Draw a fully-committed object to the canvas.
   */
  draw: (
    ctx: CanvasRenderingContext2D,
    obj: TObj,
    viewport: Viewport,
    env: ShapeDrawEnv
  ) => void;

  /**
   * Compute the object's bounding box in world coordinates.
   * Return null for objects that are not box-addressable.
   */
  getBoundingBox: (obj: TObj, env?: ShapeGeometryEnv) => Bounds | null;

  /**
   * Optional precise hit test in world coords.
   * If omitted, core can fall back to bounding-box hit testing.
   */
  hitTest?: (obj: TObj, worldX: number, worldY: number, env?: ShapeGeometryEnv) => boolean;

  /**
   * Optional list of named ports. Used by connectors for attachments.
   */
  getPorts?: (obj: TObj) => ObjectPort[];

  /**
   * Optional selection capabilities (which properties can be edited in selection UI).
   */
  selectionCaps?: SelectionCapabilities;
}

export type ConnectorAttachmentPolicy = 'free' | 'portsOnly';

export interface ShapeDefinition<TObj extends WhiteboardObject = WhiteboardObject> {
  // ...existing

  /**
   * Controls how connector endpoints may attach while dragging/creating.
   * - 'free'      => can compute continuous attachments (edgeT/perimeterAngle)
   * - 'portsOnly' => always snap to nearest port (type:'port')
   */
  connectorAttachmentPolicy?: ConnectorAttachmentPolicy;
}

/**
 * Tool interaction context (for pointer-driven tools).
 * This mirrors what useCanvasInteractions currently passes around.
 */
export type ToolPointerContext = {
  objects: WhiteboardObject[];
  viewport: Viewport;
  strokeColor: string;
  strokeWidth: number;
  generateObjectId: () => ObjectId;
};

/**
 * A result from completing an interaction (e.g. pointer-up) that produces an object.
 */
export type ToolCreateResult = {
  object: WhiteboardObject;
  selectIds: ObjectId[];
};

/**
 * Optional draft lifecycle hooks that a tool can implement.
 *
 * Note:
 * - In the current codebase, drafts are rendered by drawDraftShape() in drawing.ts.
 * - Later steps may introduce shape.drawDraft() and/or make drafts tool-defined.
 */
export type DraftLifecycle<TDraft extends DraftShape = DraftShape> = {
  startDraft?: (ctx: ToolPointerContext, pos: Point) => TDraft | null;
  updateDraft?: (draft: TDraft, ctx: ToolPointerContext, pos: Point) => TDraft;
  finishDraft?: (draft: TDraft, ctx: ToolPointerContext, pos: Point) => ToolCreateResult | null;
};

/**
 * A combined definition for tools that create objects:
 * - Object behavior (ShapeDefinition)
 * - Optional interaction behavior (DraftLifecycle)
 */
export type ShapeToolDefinition<
  TObj extends WhiteboardObject = WhiteboardObject,
  TDraft extends DraftShape = DraftShape
> = ShapeDefinition<TObj> & {
  /**
   * Optional draft lifecycle for pointer-drag tools (freehand/rectangle/ellipse/connector...).
   */
  draft?: DraftLifecycle<TDraft>;

  /**
   * Optional pointer-down creation hook for "click-to-create" tools (text, sticky notes, ...).
   * If provided, tool dispatch can be 100% table-driven with no special cases.
   */
  pointerDownCreate?: (ctx: ToolPointerContext, pos: Point) => ToolCreateResult | null;
};

