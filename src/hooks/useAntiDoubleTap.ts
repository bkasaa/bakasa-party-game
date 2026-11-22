import { useCallback, useRef } from 'react';

/**
 * Synchronous 400ms anti-double-tap guard so rapid taps never skip a player's turn
 * or trigger duplicate transitions.
 */
export function useTapGuard(delayMs = 400) {
  const lastTapRef = useRef<number>(0);

  const guard = useCallback(
    <T extends unknown[]>(fn: (...args: T) => void) =>
      (...args: T) => {
        const now = Date.now();
        if (now - lastTapRef.current < delayMs) {
          return;
        }
        lastTapRef.current = now;
        fn(...args);
      },
    [delayMs]
  );

  return guard;
}
