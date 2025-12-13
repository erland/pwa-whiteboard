// src/pages/whiteboard/__tests__/geometry.test.ts
import type { WhiteboardObject, WhiteboardState, Attachment } from '../../domain/types';
import {
  isConnectable,
  getPorts,
  resolveAttachmentPoint,
  resolveConnectorEndpoints,
  getBoundingBox,
  hitTest
} from '../geometry';

describe('whiteboard/geometry (Step 2 primitives)', () => {
  describe('isConnectable', () => {
    test('returns false for connector', () => {
      const obj: WhiteboardObject = {
        id: 'c1',
        type: 'connector',
        x: 0,
        y: 0
      };
      expect(isConnectable(obj)).toBe(false);
    });

    test('returns false for freehand (v1 rule)', () => {
      const obj: WhiteboardObject = {
        id: 'f1',
        type: 'freehand',
        x: 0,
        y: 0,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ]
      };
      expect(isConnectable(obj)).toBe(false);
    });

    test('returns true for basic shapes', () => {
      const rect: WhiteboardObject = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 };
      const ell: WhiteboardObject = { id: 'e1', type: 'ellipse', x: 0, y: 0, width: 10, height: 10 };
      const txt: WhiteboardObject = { id: 't1', type: 'text', x: 0, y: 0 };
      const sticky: WhiteboardObject = { id: 's1', type: 'stickyNote', x: 0, y: 0, width: 10, height: 10 };

      expect(isConnectable(rect)).toBe(true);
      expect(isConnectable(ell)).toBe(true);
      expect(isConnectable(txt)).toBe(true);
      expect(isConnectable(sticky)).toBe(true);
    });
  });

  describe('getPorts', () => {
    test('returns default rectangle ports (center + 4 sides)', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 10,
        height: 10
      };
  
      expect(getPorts(rect)).toEqual([
        { portId: 'center', point: { x: 5, y: 5 } },
        { portId: 'top', point: { x: 5, y: 0 } },
        { portId: 'right', point: { x: 10, y: 5 } },
        { portId: 'bottom', point: { x: 5, y: 10 } },
        { portId: 'left', point: { x: 0, y: 5 } }
      ]);
    });
  
    test('returns only center port when rectangle has no meaningful dimensions', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 3,
        y: 7,
        width: 0,
        height: 10
      };
  
      expect(getPorts(rect)).toEqual([
        { portId: 'center', point: { x: 3, y: 7 } }
      ]);
    });
  });

  describe('resolveAttachmentPoint', () => {
    test('edgeT resolves top edge at t=0, 0.5, 1', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 200
      };

      const p0 = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'top', t: 0 });
      const p05 = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'top', t: 0.5 });
      const p1 = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'top', t: 1 });

      expect(p0).toEqual({ x: 0, y: 0 });
      expect(p05).toEqual({ x: 50, y: 0 });
      expect(p1).toEqual({ x: 100, y: 0 });
    });

    test('edgeT resolves right edge and clamps t outside [0..1]', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 200
      };

      const pNeg = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'right', t: -1 });
      const pBig = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'right', t: 2 });

      // right edge x is constant at 100, y should clamp to 0 and 200
      expect(pNeg).toEqual({ x: 100, y: 0 });
      expect(pBig).toEqual({ x: 100, y: 200 });
    });

    test('perimeterAngle resolves ellipse perimeter for angle 0 and PI/2', () => {
      const ellipse: WhiteboardObject = {
        id: 'e1',
        type: 'ellipse',
        x: 10,
        y: 20,
        width: 100, // rx = 50
        height: 50  // ry = 25
      };

      // Center = (10+50, 20+25) = (60, 45)
      const p0 = resolveAttachmentPoint(ellipse, { type: 'perimeterAngle', angleRad: 0 });
      expect(p0.x).toBeCloseTo(110); // 60 + 50
      expect(p0.y).toBeCloseTo(45);  // 45 + 0

      const p90 = resolveAttachmentPoint(ellipse, { type: 'perimeterAngle', angleRad: Math.PI / 2 });
      expect(p90.x).toBeCloseTo(60); // 60 + 0
      expect(p90.y).toBeCloseTo(70); // 45 + 25
    });

    test('fallback anchor resolves common anchors from bounds', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50
      };

      const top = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'top' });
      const right = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'right' });
      const bottom = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'bottom' });
      const left = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'left' });
      const center = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'center' });

      expect(top).toEqual({ x: 60, y: 20 });
      expect(right).toEqual({ x: 110, y: 45 });
      expect(bottom).toEqual({ x: 60, y: 70 });
      expect(left).toEqual({ x: 10, y: 45 });
      expect(center).toEqual({ x: 60, y: 45 });
    });

    test('port attachment falls back to center when port does not exist (Step 2)', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      };

      const p = resolveAttachmentPoint(rect, { type: 'port', portId: 'missing' });
      expect(p).toEqual({ x: 50, y: 50 });
    });
  });

  describe('resolveConnectorEndpoints', () => {
    test('returns null when connector is missing endpoints', () => {
      const rect1: WhiteboardObject = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 };
      const rect2: WhiteboardObject = { id: 'r2', type: 'rectangle', x: 20, y: 0, width: 10, height: 10 };

      const connector: WhiteboardObject = { id: 'c1', type: 'connector', x: 0, y: 0 };

      const state: WhiteboardState = {
        meta: { id: 'b1', name: 'Board', createdAt: 't', updatedAt: 't' },
        objects: [rect1, rect2, connector],
        selectedObjectIds: [],
        viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
        history: { pastEvents: [], futureEvents: [] }
      };

      expect(resolveConnectorEndpoints(state, connector)).toBeNull();
    });

    test('resolves connector endpoints using fallback center attachments', () => {
      const rect1: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      };
      const rect2: WhiteboardObject = {
        id: 'r2',
        type: 'rectangle',
        x: 200,
        y: 0,
        width: 100,
        height: 100
      };

      const fromAtt: Attachment = { type: 'fallback', anchor: 'center' };
      const toAtt: Attachment = { type: 'fallback', anchor: 'center' };

      const connector: WhiteboardObject = {
        id: 'c1',
        type: 'connector',
        x: 0,
        y: 0,
        from: { objectId: 'r1', attachment: fromAtt },
        to: { objectId: 'r2', attachment: toAtt },
        strokeColor: '#000',
        strokeWidth: 2
      };

      const state: WhiteboardState = {
        meta: { id: 'b1', name: 'Board', createdAt: 't', updatedAt: 't' },
        objects: [rect1, rect2, connector],
        selectedObjectIds: [],
        viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
        history: { pastEvents: [], futureEvents: [] }
      };

      const resolved = resolveConnectorEndpoints(state, connector);
      expect(resolved).not.toBeNull();
      expect(resolved!.p1).toEqual({ x: 50, y: 50 });
      expect(resolved!.p2).toEqual({ x: 250, y: 50 });
    });

    test('returns null if referenced object is not connectable (freehand)', () => {
      const freehand: WhiteboardObject = {
        id: 'f1',
        type: 'freehand',
        x: 0,
        y: 0,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ]
      };
      const rect2: WhiteboardObject = {
        id: 'r2',
        type: 'rectangle',
        x: 200,
        y: 0,
        width: 100,
        height: 100
      };

      const connector: WhiteboardObject = {
        id: 'c1',
        type: 'connector',
        x: 0,
        y: 0,
        from: { objectId: 'f1', attachment: { type: 'fallback', anchor: 'center' } },
        to: { objectId: 'r2', attachment: { type: 'fallback', anchor: 'center' } }
      };

      const state: WhiteboardState = {
        meta: { id: 'b1', name: 'Board', createdAt: 't', updatedAt: 't' },
        objects: [freehand, rect2, connector],
        selectedObjectIds: [],
        viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
        history: { pastEvents: [], futureEvents: [] }
      };

      expect(resolveConnectorEndpoints(state, connector)).toBeNull();
    });
  });
});

describe('whiteboard/geometry (Step 2+3 primitives)', () => {
  describe('isConnectable', () => {
    test('returns false for connector', () => {
      const obj: WhiteboardObject = {
        id: 'c1',
        type: 'connector',
        x: 0,
        y: 0
      };
      expect(isConnectable(obj)).toBe(false);
    });

    test('returns false for freehand (v1 rule)', () => {
      const obj: WhiteboardObject = {
        id: 'f1',
        type: 'freehand',
        x: 0,
        y: 0,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ]
      };
      expect(isConnectable(obj)).toBe(false);
    });

    test('returns true for basic shapes', () => {
      const rect: WhiteboardObject = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 };
      const ell: WhiteboardObject = { id: 'e1', type: 'ellipse', x: 0, y: 0, width: 10, height: 10 };
      const txt: WhiteboardObject = { id: 't1', type: 'text', x: 0, y: 0 };
      const sticky: WhiteboardObject = { id: 's1', type: 'stickyNote', x: 0, y: 0, width: 10, height: 10 };

      expect(isConnectable(rect)).toBe(true);
      expect(isConnectable(ell)).toBe(true);
      expect(isConnectable(txt)).toBe(true);
      expect(isConnectable(sticky)).toBe(true);
    });
  });

  describe('getPorts', () => {
    test('returns default rectangle ports (center + 4 sides)', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 10,
        height: 10
      };
  
      expect(getPorts(rect)).toEqual([
        { portId: 'center', point: { x: 5, y: 5 } },
        { portId: 'top', point: { x: 5, y: 0 } },
        { portId: 'right', point: { x: 10, y: 5 } },
        { portId: 'bottom', point: { x: 5, y: 10 } },
        { portId: 'left', point: { x: 0, y: 5 } }
      ]);
    });
  
    test('returns only center port when rectangle has no meaningful dimensions', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 3,
        y: 7,
        width: 0,
        height: 10
      };
  
      expect(getPorts(rect)).toEqual([
        { portId: 'center', point: { x: 3, y: 7 } }
      ]);
    });
  });

  describe('resolveAttachmentPoint', () => {
    test('edgeT resolves top edge at t=0, 0.5, 1', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 200
      };

      const p0 = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'top', t: 0 });
      const p05 = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'top', t: 0.5 });
      const p1 = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'top', t: 1 });

      expect(p0).toEqual({ x: 0, y: 0 });
      expect(p05).toEqual({ x: 50, y: 0 });
      expect(p1).toEqual({ x: 100, y: 0 });
    });

    test('edgeT resolves right edge and clamps t outside [0..1]', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 200
      };

      const pNeg = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'right', t: -1 });
      const pBig = resolveAttachmentPoint(rect, { type: 'edgeT', edge: 'right', t: 2 });

      expect(pNeg).toEqual({ x: 100, y: 0 });
      expect(pBig).toEqual({ x: 100, y: 200 });
    });

    test('perimeterAngle resolves ellipse perimeter for angle 0 and PI/2', () => {
      const ellipse: WhiteboardObject = {
        id: 'e1',
        type: 'ellipse',
        x: 10,
        y: 20,
        width: 100,
        height: 50
      };

      const p0 = resolveAttachmentPoint(ellipse, { type: 'perimeterAngle', angleRad: 0 });
      expect(p0.x).toBeCloseTo(110);
      expect(p0.y).toBeCloseTo(45);

      const p90 = resolveAttachmentPoint(ellipse, { type: 'perimeterAngle', angleRad: Math.PI / 2 });
      expect(p90.x).toBeCloseTo(60);
      expect(p90.y).toBeCloseTo(70);
    });

    test('fallback anchor resolves common anchors from bounds', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50
      };

      const top = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'top' });
      const right = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'right' });
      const bottom = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'bottom' });
      const left = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'left' });
      const center = resolveAttachmentPoint(rect, { type: 'fallback', anchor: 'center' });

      expect(top).toEqual({ x: 60, y: 20 });
      expect(right).toEqual({ x: 110, y: 45 });
      expect(bottom).toEqual({ x: 60, y: 70 });
      expect(left).toEqual({ x: 10, y: 45 });
      expect(center).toEqual({ x: 60, y: 45 });
    });

    test('port attachment falls back to center when port does not exist (Step 2)', () => {
      const rect: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      };

      const p = resolveAttachmentPoint(rect, { type: 'port', portId: 'missing' });
      expect(p).toEqual({ x: 50, y: 50 });
    });
  });

  describe('resolveConnectorEndpoints', () => {
    test('resolves connector endpoints using fallback center attachments', () => {
      const rect1: WhiteboardObject = {
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      };
      const rect2: WhiteboardObject = {
        id: 'r2',
        type: 'rectangle',
        x: 200,
        y: 0,
        width: 100,
        height: 100
      };

      const connector: WhiteboardObject = {
        id: 'c1',
        type: 'connector',
        x: 0,
        y: 0,
        from: { objectId: 'r1', attachment: { type: 'fallback', anchor: 'center' } },
        to: { objectId: 'r2', attachment: { type: 'fallback', anchor: 'center' } },
        strokeWidth: 2
      };

      const state: WhiteboardState = {
        meta: { id: 'b1', name: 'Board', createdAt: 't', updatedAt: 't' },
        objects: [rect1, rect2, connector],
        selectedObjectIds: [],
        viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
        history: { pastEvents: [], futureEvents: [] }
      };

      const resolved = resolveConnectorEndpoints(state, connector);
      expect(resolved).not.toBeNull();
      expect(resolved!.p1).toEqual({ x: 50, y: 50 });
      expect(resolved!.p2).toEqual({ x: 250, y: 50 });
    });
  });

  describe('connectors: bounding box + hitTest (Step 3)', () => {
    test('getBoundingBox(connector, objects) returns padded bounds around endpoints', () => {
      const rect1: WhiteboardObject = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
      const rect2: WhiteboardObject = { id: 'r2', type: 'rectangle', x: 200, y: 0, width: 100, height: 100 };
      const connector: WhiteboardObject = {
        id: 'c1',
        type: 'connector',
        x: 0,
        y: 0,
        strokeWidth: 2,
        from: { objectId: 'r1', attachment: { type: 'fallback', anchor: 'center' } },
        to: { objectId: 'r2', attachment: { type: 'fallback', anchor: 'center' } }
      };

      const box = getBoundingBox(connector, [rect1, rect2, connector]);
      expect(box).not.toBeNull();

      // The raw endpoints are (50,50) and (250,50). Box should include these with padding.
      expect(box!.x).toBeLessThanOrEqual(50);
      expect(box!.y).toBeLessThanOrEqual(50);
      expect(box!.x + box!.width).toBeGreaterThanOrEqual(250);
      expect(box!.y + box!.height).toBeGreaterThanOrEqual(50);
    });

    test('hitTest can select a connector near its line segment', () => {
      const rect1: WhiteboardObject = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
      const rect2: WhiteboardObject = { id: 'r2', type: 'rectangle', x: 200, y: 0, width: 100, height: 100 };
      const connector: WhiteboardObject = {
        id: 'c1',
        type: 'connector',
        x: 0,
        y: 0,
        strokeWidth: 2,
        from: { objectId: 'r1', attachment: { type: 'fallback', anchor: 'center' } },
        to: { objectId: 'r2', attachment: { type: 'fallback', anchor: 'center' } }
      };

      const objects = [rect1, rect2, connector];

      // Midpoint on the connector line (between 50 and 250 at y=50)
      const hit = hitTest(objects, 150, 50);
      expect(hit?.id).toBe('c1');
    });
  });
});