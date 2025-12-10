// src/pages/hooks/boardEvents.ts

export function generateEventId(): string {
  return 'evt_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
}