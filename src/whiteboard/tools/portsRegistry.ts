// src/whiteboard/tools/portsRegistry.ts

import type { Point, WhiteboardObject } from '../../domain/types';

import { getEllipsePorts } from './ellipse/geometry';
import { getRectanglePorts } from './rectangle/geometry';
import { getStickyNotePorts } from './stickyNote/geometry';
import { getTextPorts } from './text/geometry';

export type ObjectPort = { portId: string; point: Point };

type PortProvider = (obj: WhiteboardObject) => ObjectPort[];

/**
 * Registry of port providers per object type.
 *
 * Refinement (Step 6b): the connector module should not need a switch statement
 * for every shape type. Adding a new connectable shape becomes:
 * 1) implement get<Shape>Ports in that shape's tool folder
 * 2) register it here
 */
const PORT_PROVIDERS: Partial<Record<WhiteboardObject['type'], PortProvider>> = {
  rectangle: getRectanglePorts as PortProvider,
  ellipse: getEllipsePorts as PortProvider,
  stickyNote: getStickyNotePorts as PortProvider,
  text: getTextPorts as PortProvider,
};

export function getPortsForObject(obj: WhiteboardObject): ObjectPort[] {
  if (!obj) return [];
  const provider = PORT_PROVIDERS[obj.type];
  return provider ? provider(obj) : [];
}

export function isObjectConnectable(obj: WhiteboardObject): boolean {
  return getPortsForObject(obj).length > 0;
}
