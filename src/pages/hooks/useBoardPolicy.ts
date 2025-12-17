// src/pages/hooks/useBoardPolicy.ts
import React, { useEffect, useMemo, useState } from 'react';
import type { WhiteboardObject } from '../../domain/types';
import type { DrawingTool } from '../../whiteboard/WhiteboardCanvas';
import {
  getBoardType,
  getLockedEditableKeys,
  getLockedToolProps,
  isEditablePropLocked,
} from '../../whiteboard/boardTypes';

export type UseBoardPolicyArgs = {
  boardType: string | undefined;
};

/**
 * Encapsulates board-type/toolbox policy:
 * - toolbox + active tool instance
 * - stroke settings + tool props per tool instance
 * - locked props based on board type
 */
export function useBoardPolicy({ boardType }: UseBoardPolicyArgs) {
  const boardTypeDef = getBoardType((boardType as any) ?? 'advanced');
  const toolbox = boardTypeDef.toolbox;
  const toolboxKey = useMemo(() => toolbox.map((t) => t.id).join('|'), [toolbox]);

  const toolInstanceById = useMemo(() => {
    const map: Record<string, (typeof toolbox)[number]> = {};
    toolbox.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [toolboxKey]);

  const defaultToolInstanceId = useMemo(() => {
    const firstNonSelect = toolbox.find((t) => t.baseToolId !== 'select');
    return (firstNonSelect ?? toolbox[0] ?? { id: 'select' }).id;
  }, [toolboxKey]);

  const [activeToolInstanceId, setActiveToolInstanceId] = useState<string>(() => defaultToolInstanceId);

  // Stroke settings are tracked per tool instance (enables presets like filled/outline later).
  const [strokeByToolInstance, setStrokeByToolInstance] = useState<
    Record<string, { strokeColor: string; strokeWidth: number }>
  >({});

  // Per-tool-instance settings beyond strokeColor/strokeWidth.
  // These drive both tool UI and defaults applied when creating new objects.
  const [toolPropsByToolInstance, setToolPropsByToolInstance] = useState<Record<string, Partial<WhiteboardObject>>>({});

  // Ensure presets/tool-instance defaults are available even before the user touches settings.
  // We intentionally only seed missing entries (never overwrite user-changed values).
  useEffect(() => {
    setToolPropsByToolInstance((prev) => {
      let next = prev;
      for (const ti of toolbox) {
        if (!ti.defaults) continue;
        if (prev[ti.id] !== undefined) continue;
        if (next === prev) next = { ...prev };
        next[ti.id] = { ...(ti.defaults as any) };
      }
      return next;
    });
  }, [toolboxKey]);

  // Ensure the active tool instance is valid for the current board type.
  useEffect(() => {
    if (!toolInstanceById[activeToolInstanceId]) {
      setActiveToolInstanceId(defaultToolInstanceId);
    }
  }, [toolInstanceById, activeToolInstanceId, defaultToolInstanceId, toolboxKey]);

  const activeTool: DrawingTool =
    (toolInstanceById[activeToolInstanceId]?.baseToolId ?? 'select') as DrawingTool;

  // ---- Board type policy: locked tool props ----
  const lockedForActiveTool = useMemo(() => {
    // DrawingTool is a superset; boardTypes helpers accept ToolId.
    return getLockedToolProps(boardTypeDef, activeTool as any);
  }, [boardTypeDef, activeTool]);
  const lockedEditableKeys = useMemo(() => getLockedEditableKeys(lockedForActiveTool), [lockedForActiveTool]);

  const rawStrokeColor = strokeByToolInstance[activeToolInstanceId]?.strokeColor ?? '#38bdf8';
  const rawStrokeWidth = strokeByToolInstance[activeToolInstanceId]?.strokeWidth ?? 3;

  const strokeColor =
    isEditablePropLocked(lockedForActiveTool, 'strokeColor') && typeof lockedForActiveTool.strokeColor === 'string'
      ? lockedForActiveTool.strokeColor
      : rawStrokeColor;
  const strokeWidth =
    isEditablePropLocked(lockedForActiveTool, 'strokeWidth') && typeof lockedForActiveTool.strokeWidth === 'number'
      ? lockedForActiveTool.strokeWidth
      : rawStrokeWidth;

  const setStrokeColor = (color: string) => {
    if (lockedEditableKeys.has('strokeColor')) return;
    setStrokeByToolInstance((prev) => {
      const current = prev[activeToolInstanceId] ?? { strokeColor: '#38bdf8', strokeWidth: 3 };
      return { ...prev, [activeToolInstanceId]: { ...current, strokeColor: color } };
    });
  };

  const setStrokeWidth = (value: number) => {
    if (lockedEditableKeys.has('strokeWidth')) return;
    setStrokeByToolInstance((prev) => {
      const current = prev[activeToolInstanceId] ?? { strokeColor: '#38bdf8', strokeWidth: 3 };
      return { ...prev, [activeToolInstanceId]: { ...current, strokeWidth: value } };
    });
  };

  const handleStrokeWidthChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = Number(e.target.value);
    if (!Number.isNaN(value) && value > 0 && value <= 20) {
      setStrokeWidth(value);
    }
  };

  const updateStrokeWidth = (value: number) => {
    if (!Number.isNaN(value) && value > 0 && value <= 20) {
      setStrokeWidth(value);
    }
  };

  const updateActiveToolProp = <K extends keyof WhiteboardObject>(key: K, value: WhiteboardObject[K]) => {
    if (lockedEditableKeys.has(key as any)) return;
    setToolPropsByToolInstance((prev) => {
      const seededDefaults = (toolInstanceById[activeToolInstanceId]?.defaults ?? {}) as Partial<WhiteboardObject>;
      const current = prev[activeToolInstanceId] ?? seededDefaults;
      return {
        ...prev,
        [activeToolInstanceId]: {
          ...current,
          [key]: value,
        },
      };
    });
  };

  const activeToolProps: Partial<WhiteboardObject> = {
    ...((toolInstanceById[activeToolInstanceId]?.defaults ?? {}) as any),
    ...(toolPropsByToolInstance[activeToolInstanceId] ?? {}),
    ...lockedForActiveTool,
  };

  return {
    boardTypeDef,
    toolbox,
    activeTool,
    activeToolInstanceId,
    setActiveToolInstanceId,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    handleStrokeWidthChange,
    updateStrokeWidth,
    toolProps: activeToolProps,
    updateActiveToolProp,
  };
}
