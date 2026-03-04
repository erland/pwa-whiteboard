import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

export type AutoReconnectArgs = {
  enabled: boolean;
  status: 'disabled' | 'idle' | 'connecting' | 'connected' | 'closed' | 'error';
  cooldownUntil: number;
  hasEverConnectedRef: MutableRefObject<boolean>;
  setIsReconnecting: (v: boolean) => void;
  setReconnectNonce: Dispatch<SetStateAction<number>>;
};

/**
 * Best-effort exponential backoff reconnect.
 */
export function useAutoReconnect({
  enabled,
  status,
  cooldownUntil,
  hasEverConnectedRef,
  setIsReconnecting,
  setReconnectNonce,
}: AutoReconnectArgs): void {
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    if (cooldownUntil && now < cooldownUntil) return;

    const shouldReconnect = status === 'closed' || (status === 'error' && hasEverConnectedRef.current);
    if (!shouldReconnect) return;

    // If a reconnect is already scheduled, don't schedule another.
    if (reconnectTimerRef.current) return;

    setIsReconnecting(true);

    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;

    const baseDelay = 750;
    const maxDelay = 15_000;
    const backoff = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
    const jitter = Math.floor(backoff * (0.2 * Math.random()));
    const delay = backoff + jitter;

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      setReconnectNonce((n) => n + 1);
    }, delay) as any;

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [enabled, status, cooldownUntil, hasEverConnectedRef, setIsReconnecting, setReconnectNonce]);
}
