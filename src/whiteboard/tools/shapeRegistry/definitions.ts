import type { WhiteboardObjectType } from '../../../domain/types';
import type { ShapeToolDefinition } from '../shapeTypes';
import { createBasicShapeDefinitions } from './basicShapes';
import { createLinearShapeDefinitions } from './linearShapes';
import { createTextualShapeDefinitions } from './textualShapes';

export function createShapeDefinitions(): Record<WhiteboardObjectType, ShapeToolDefinition> {
  return {
    ...createLinearShapeDefinitions(),
    ...createBasicShapeDefinitions(),
    ...createTextualShapeDefinitions(),
  } as Record<WhiteboardObjectType, ShapeToolDefinition>;
}
