# PWA Whiteboard — Architecture & Extension Playbook

_Last generated: 2025-12-15_

This document is a **speed map** of the codebase intended to make future changes faster:
- where things live
- how data flows
- **exact “touchpoints”** you’ll usually need to change for common feature types
- copy/paste-friendly checklists + templates

> Notes about source completeness: some files in the provided zip contain `...` placeholders, so this guide focuses on the **stable structure & extension seams** that are clearly present.

---

## 1) Mental model in 60 seconds

**UI (pages)**
- `src/pages/BoardListPage.tsx` — list/create/rename/delete/duplicate boards
- `src/pages/BoardEditorPage.tsx` — editor route
- `src/pages/boardEditor/*` — editor layout + panels (tools, selection, import/export, history/view)

**State**
- `src/whiteboard/WhiteboardStore.tsx` — React context + reducer, persistence hooks
- `src/domain/whiteboardState.ts` — applies board events to state (`applyEvent`, `createEmptyWhiteboardState`)
- `src/domain/types.ts` — *canonical* types: `WhiteboardObject`, `BoardEvent`, `Viewport`, `BoardTypeId`, etc.

**Canvas engine**
- `src/whiteboard/WhiteboardCanvas.tsx` — canvas rendering entry + delegates to geometry/draw/tool dispatch
- `src/whiteboard/useCanvasInteractions.ts` — pointer state machine (select/move/resize/draw) and tool dispatch
- `src/whiteboard/geometry.ts` + `src/whiteboard/geometry/*` — hit testing, bounding boxes, ports, resizing, coordinate conversions

**Tool system**
- `src/whiteboard/tools/<tool>/` — each shape/tool has:
  - `draw.ts` (render)
  - `geometry.ts` (bbox / hit test / ports)
  - `interactions.ts` (draft lifecycle or click-create)
  - `selection.ts` (selection capability list)
- `src/whiteboard/tools/shapeRegistry.ts` — **table-driven registry** connecting all per-tool modules
- `src/whiteboard/tools/registry.ts` — IDs + labels/icons for tools & object types
- `src/whiteboard/boardTypes.ts` — **board types + tool presets** + hide/lock rules for settings

---

## 2) Key concepts & extension seams

### 2.1 World vs canvas coordinates
The editor uses a `Viewport` with `offsetX/offsetY/zoom`. Many bugs happen when mixing:
- **canvas coords** (pixels)
- **world coords** (model space stored on objects)

The shared helpers in `src/whiteboard/geometry.ts` (e.g. `canvasToWorld`) are the “source of truth”.
When implementing new tool interactions, convert pointer events to **world** early and keep it consistent.

### 2.2 Tool instances (presets)
`src/whiteboard/boardTypes.ts` supports *presets* where multiple toolbox entries can map to the **same base tool**
with different defaults (example: `rect-outline` vs `rect-filled`).

This is the main mechanism for:
- “two rectangles with different defaults”
- simplifying UI per board type
- locking/hiding properties per board type/preset

### 2.3 Selection UI is capability-driven (not hardcoded per object)
- Editable props are defined in:
  - `src/whiteboard/tools/selection/types.ts` (the union `EditablePropKey`)
  - `src/whiteboard/tools/selectionRegistry.ts` (`EDITABLE_PROP_DEFS` describes how to render controls)
- Each tool declares what’s editable via its `selection.ts`, typically using presets in:
  - `src/whiteboard/tools/_shared/selectionCaps.ts`

This makes adding a new “editable property” mostly:
- add it once to the shared prop registry
- opt-in per shape via its selection caps

---

## 3) Touchpoints matrix (the cheat sheet)

### 3.1 Add a new *shape tool* (drag-to-create)
Most common: rectangle-like, ellipse-like, diamond-like, etc.

**You will usually touch:**
1. `src/domain/types.ts`
   - add the new `WhiteboardObjectType` union member
   - add any new object fields (if needed)
2. `src/whiteboard/tools/registry.ts`
   - add tool id to `TOOL_IDS`
   - add object type to `OBJECT_TYPES`
   - add entry to `TOOL_REGISTRY` (label/icon)
3. `src/whiteboard/tools/<newTool>/`
   - add `draw.ts`, `geometry.ts`, `interactions.ts`, `selection.ts`
4. `src/whiteboard/tools/shapeRegistry.ts`
   - import the new tool’s functions
   - register under `SHAPES.<newType>` (draw/bbox/translate/resize + draft lifecycle)
5. `src/whiteboard/boardTypes.ts`
   - decide which board types should show it in toolbox
   - optionally add presets (multiple instances with different defaults)
6. Tests (optional but recommended)
   - add/extend `src/whiteboard/__tests__/geometry.test.ts`
   - add tool-specific tests if you create complex geometry logic

**Checkbox checklist**
- [ ] Domain: `WhiteboardObjectType` includes new type
- [ ] Tool ids/labels: `tools/registry.ts`
- [ ] Tool module folder exists with 4 files
- [ ] `shapeRegistry.ts` maps the type to the module functions
- [ ] Tool appears in at least one board type toolbox (e.g. `advanced`)
- [ ] Selection caps set appropriately (via `_shared/selectionCaps` or custom list)
- [ ] Hit testing + bbox feel correct at different zoom levels

---

### 3.2 Add a new *click-to-create* tool (Text/StickyNote style)
Use `pointerDownCreate` in the shape definition rather than a draft lifecycle.

**Touchpoints**
- same as 3.1, but in `shapeRegistry.ts` define:
  - `pointerDownCreate: (ctx, pos) => ...`

**Tip**
If the tool needs a dialog or “enter text” UX, keep object creation simple first
and enhance the editing UI via selection later.

---

### 3.3 Add a new editable property (e.g. `dashStyle`, `opacity`, `arrowType2`)
This is the second most common extension.

**Touchpoints**
1. `src/whiteboard/tools/selection/types.ts`
   - add a new string literal to `EditablePropKey`
2. `src/whiteboard/tools/selectionRegistry.ts`
   - add an entry in `EDITABLE_PROP_DEFS` describing label + control
   - (controls currently include `range`, `color`, `number`, `boolean`, `select`, `text`, `textarea`)
3. `src/domain/types.ts`
   - add the property to `WhiteboardObject` (usually optional)
4. Per shape/tool:
   - add the key into that tool’s `selection.ts` editableProps (or shared preset)
   - ensure drawing logic reads the property (in `draw.ts`)
5. Optional: board-type UX rules
   - `src/whiteboard/boardTypes.ts`: hide/lock tool props or selection props per board type/preset

**Checkbox checklist**
- [ ] Prop exists on `WhiteboardObject`
- [ ] Prop is in `EditablePropKey`
- [ ] Prop has a UI control in `EDITABLE_PROP_DEFS`
- [ ] At least one shape’s selection caps include it
- [ ] `draw.ts` uses it (or it won’t visually change anything)

---

### 3.4 Add a new board type (e.g. “Flowchart”)
Board types are how you ship “curated” experiences.

**Touchpoints**
1. `src/domain/types.ts`
   - extend `BoardTypeId` union (currently includes `advanced`, `freehand`, `mindmap`)
2. `src/whiteboard/boardTypes.ts`
   - add new entry in `BOARD_TYPES`
   - set `toolbox` to desired tools/presets
   - optionally define:
     - `hiddenToolProps`, `hiddenSelectionProps`
     - `lockedToolProps`, `lockedObjectProps`
3. UI
   - wherever board type is selectable (board creation / board settings)

**Safety rule**
`getBoardType()` ensures a fallback to `advanced`, and tests assert every board type includes `select`.

---

## 4) Adding a new tool: recommended template

Create `src/whiteboard/tools/<toolName>/`:

### `selection.ts`
```ts
import type { SelectionCapabilities } from '../selection/types';

// simplest: reuse a preset from tools/_shared/selectionCaps.ts
export const <toolName>SelectionCapabilities: SelectionCapabilities = {
  editableProps: ['strokeColor', 'strokeWidth'] as const,
};
```

### `draw.ts`
```ts
import type { WhiteboardObject, Viewport } from '../../../domain/types';

export function draw<T extends WhiteboardObject>(
  ctx: CanvasRenderingContext2D,
  obj: T,
  viewport: Viewport
) {
  // draw using viewport (world->canvas mapping is usually done by caller or via helpers)
}
```

### `geometry.ts`
```ts
import type { WhiteboardObject, Point } from '../../../domain/types';
import type { Bounds } from '../../geometry/types';
import type { ObjectPort } from '../shapeTypes';

export function getBoundingBox(obj: WhiteboardObject): Bounds {
  // compute in world coords
  return { x: 0, y: 0, width: 0, height: 0 };
}

export function hitTest(obj: WhiteboardObject, p: Point): boolean {
  return false;
}

export function getPorts(obj: WhiteboardObject): ObjectPort[] {
  return [];
}
```

### `interactions.ts`
```ts
import type { Point } from '../../../domain/types';
import type { DraftShape } from '../../drawing';

// Draft lifecycle example (drag-to-create)
export function startDraft(pos: Point, ctx: any): DraftShape {
  return { kind: '<toolName>', start: pos, end: pos } as any;
}

export function updateDraft(draft: DraftShape, pos: Point): DraftShape {
  return { ...draft, end: pos } as any;
}

export function finishDraft(draft: DraftShape) {
  // return { object, selectIds }
  return { object: null, selectIds: null };
}
```

Then register it in `src/whiteboard/tools/shapeRegistry.ts` under `SHAPES.<type>`.

---

## 5) Where to look first when something “doesn’t show up”

### Tool not visible in the toolbar
- Check `src/whiteboard/boardTypes.ts`:
  - is it included in the active board type toolbox?
  - if you added a new board type, does the board meta actually use it?
- If the toolbox is rendered from tool instances, ensure the instance id is present.

### Tool exists but drawing does nothing
- Verify `shapeRegistry.ts` includes it in `SHAPES`
- Verify `useCanvasInteractions.ts` calls `toolPointerDown/Move/Up` for the active tool
- Verify your draft lifecycle returns a real object in `finishDraft`

### Selection panel doesn’t show a property
- The property must be:
  - in the object’s selection caps (`selection.ts`)
  - in `EditablePropKey`
  - defined in `EDITABLE_PROP_DEFS`
  - not hidden/locked away by the board type rules

---

## 6) Suggested “speed improvements” you can optionally implement later

These are not required, but will make future additions even faster.

1. **Schema versioning for localStorage**
   - Add a `{ version: number }` wrapper and migrate on load
   - Prevents old boards from crashing after model changes

2. **A `createTool` helper**
   - A generator that scaffolds `draw/geometry/interactions/selection` with correct exports

3. **Tool-level unit tests**
   - For each new shape, include a minimal bbox + hit test spec

---

## Appendix A — Files most frequently touched by feature work

- Tool plumbing:
  - `src/whiteboard/tools/shapeRegistry.ts`
  - `src/whiteboard/tools/registry.ts`
  - `src/whiteboard/boardTypes.ts`
- Geometry/hit testing:
  - `src/whiteboard/geometry.ts`
  - `src/whiteboard/geometry/*`
- Interaction engine:
  - `src/whiteboard/useCanvasInteractions.ts`
- Panels/settings:
  - `src/pages/boardEditor/panels/ToolSettingsPanel.tsx`
  - `src/whiteboard/tools/selectionRegistry.ts`

---

If you tell me the *next* feature you want to add (e.g. “flowchart process arrow”, “grouping”, “layers”, “snap-to-grid”),
I can use this playbook to give you a very short, file-by-file patch plan.
