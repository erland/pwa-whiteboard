import { useCallback, useEffect, useRef, useState } from 'react';

export type CollabNoticesApi = {
  errorText?: string;
  noticeText?: string;
  setFatalError: (error?: string) => void;
  clearFatalError: () => void;
  clearAllNotices: () => void;
  showSoftError: (args: { code: string; message: string; cooldownMs?: number }) => void;
};

export function useCollabNotices(setCooldownUntil: (value: number) => void): CollabNoticesApi {
  const [errorText, setErrorText] = useState<string | undefined>(undefined);
  const [noticeText, setNoticeText] = useState<string | undefined>(undefined);
  const noticeTimerRef = useRef<number | null>(null);

  const clearNoticeTimer = useCallback(() => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  const clearAllNotices = useCallback(() => {
    clearNoticeTimer();
    setErrorText(undefined);
    setNoticeText(undefined);
  }, [clearNoticeTimer]);

  const setFatalError = useCallback((error?: string) => {
    setErrorText(error);
  }, []);

  const clearFatalError = useCallback(() => {
    setErrorText(undefined);
  }, []);

  const showSoftError = useCallback(
    ({ code, message, cooldownMs }: { code: string; message: string; cooldownMs?: number }) => {
      if (cooldownMs && cooldownMs > 0) {
        setCooldownUntil(Date.now() + cooldownMs);
      }

      setNoticeText(message || code);
      clearNoticeTimer();
      noticeTimerRef.current = window.setTimeout(() => setNoticeText(undefined), 6_000) as any;
    },
    [clearNoticeTimer, setCooldownUntil]
  );

  useEffect(() => {
    return () => clearNoticeTimer();
  }, [clearNoticeTimer]);

  return {
    errorText,
    noticeText,
    setFatalError,
    clearFatalError,
    clearAllNotices,
    showSoftError,
  };
}
