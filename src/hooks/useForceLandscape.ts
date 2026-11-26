import { useEffect, useState } from 'react';

export interface LandscapeState {
  /** True when the browser viewport is physically taller than wide while active */
  isRotatedPortrait: boolean;
  /** Physical viewport width & height */
  viewportW: number;
  viewportH: number;
}

/**
 * Attempts native Screen Orientation API lock('landscape') when active,
 * and reports whether CSS 90deg full-viewport landscape rotation fallback is needed.
 */
export function useForceLandscape(active: boolean): LandscapeState {
  const [state, setState] = useState<LandscapeState>(() => {
    if (typeof window === 'undefined') {
      return { isRotatedPortrait: false, viewportW: 800, viewportH: 420 };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    return { isRotatedPortrait: h > w, viewportW: w, viewportH: h };
  });

  useEffect(() => {
    if (!active) return;

    const orientationApi = screen.orientation as
      | { lock?: (mode: string) => Promise<void>; unlock?: () => void }
      | undefined;

    orientationApi?.lock?.('landscape').catch(() => {
      // Browser/iOS/iframe prevented native orientation lock; CSS rotation fallback handles it seamlessly
    });

    const sync = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setState({
        isRotatedPortrait: h > w,
        viewportW: w,
        viewportH: h,
      });
    };

    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      try {
        orientationApi?.unlock?.();
      } catch {
        // Ignore unlock errors
      }
    };
  }, [active]);

  return state;
}

/**
 * Maps physical screen pointer deltas relative to a joystick center into
 * the rotated landscape container's local (dx, dy) space.
 */
export function mapScreenDeltaToLandscape(
  screenDx: number,
  screenDy: number,
  isRotatedPortrait: boolean
): { dx: number; dy: number } {
  if (!isRotatedPortrait) {
    return { dx: screenDx, dy: screenDy };
  }
  // Container is rotated +90deg clockwise around center:
  // +localX points along +screenY; +localY points along -screenX.
  return {
    dx: screenDy,
    dy: -screenDx,
  };
}
