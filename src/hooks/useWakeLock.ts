import { useEffect, useRef } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

/**
 * Keeps the device screen awake via the Screen Wake Lock API while `active` is true.
 * Safely catches unsupported environments and automatically re-acquires on visibilitychange.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) {
      if (sentinelRef.current && !sentinelRef.current.released) {
        sentinelRef.current.release().catch(() => {});
      }
      sentinelRef.current = null;
      return;
    }

    let cancelled = false;

    const requestWakeLock = async () => {
      if (cancelled || typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      if (sentinelRef.current && !sentinelRef.current.released) {
        return;
      }
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
        };
        if (nav?.wakeLock?.request) {
          const sentinel = await nav.wakeLock.request('screen');
          if (cancelled) {
            sentinel.release().catch(() => {});
          } else {
            sentinelRef.current = sentinel;
          }
        }
      } catch {
        // Safely ignore Wake Lock errors (unsupported browsers, low-power mode, or restricted iframes)
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sentinelRef.current = null;
        requestWakeLock();
      }
    };

    const handlePointerFallback = () => {
      if (!sentinelRef.current || sentinelRef.current.released) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pointerdown', handlePointerFallback, { passive: true });

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointerdown', handlePointerFallback);
      if (sentinelRef.current && !sentinelRef.current.released) {
        sentinelRef.current.release().catch(() => {});
      }
      sentinelRef.current = null;
    };
  }, [active]);
}
