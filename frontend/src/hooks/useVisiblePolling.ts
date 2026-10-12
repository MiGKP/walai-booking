"use client";

import { useEffect, useRef } from 'react';

/** One background request at a time; resume immediately after returning to a tab. */
export function useVisiblePolling(refresh: () => Promise<void>, enabled: boolean, eventName?: string): void {
  const callback = useRef(refresh);
  useEffect(() => { callback.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let disposed = false;
    const refreshVisible = async (): Promise<void> => {
      if (disposed || running || document.visibilityState === 'hidden') return;
      running = true;
      try { await callback.current(); } finally { running = false; }
    };
    // Mutations must reach the store even during polling; it queues a fresh read
    // after any older response, so an approval cannot leave a stale badge.
    const refreshAfterChange = (): void => {
      if (!disposed) void callback.current();
    };
    const interval = window.setInterval(() => { void refreshVisible(); }, 15000);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    if (eventName) window.addEventListener(eventName, refreshAfterChange);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      if (eventName) window.removeEventListener(eventName, refreshAfterChange);
    };
  }, [enabled, eventName]);
}
