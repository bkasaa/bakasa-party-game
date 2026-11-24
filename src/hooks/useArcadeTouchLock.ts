import { RefObject, useEffect } from 'react';

/**
 * Prevents browser pinch-to-zoom, accidental pull-to-refresh, and edge-swipe
 * back navigation while a 2D Arcade round is active.
 */
export function useArcadeTouchLock(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!active) return;

    const el = containerRef.current;
    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevTouchAction = document.body.style.touchAction;

    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    const preventMultiTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventViewportScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });
    document.addEventListener('touchstart', preventMultiTouchZoom, { passive: false });
    document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false });

    if (el) {
      el.addEventListener('touchstart', preventMultiTouchZoom, { passive: false });
      el.addEventListener('touchmove', preventViewportScroll, { passive: false });
    }

    return () => {
      document.documentElement.style.overscrollBehavior = prevOverscroll;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.body.style.touchAction = prevTouchAction;

      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchstart', preventMultiTouchZoom);
      document.removeEventListener('touchmove', preventMultiTouchZoom);

      if (el) {
        el.removeEventListener('touchstart', preventMultiTouchZoom);
        el.removeEventListener('touchmove', preventViewportScroll);
      }
    };
  }, [active, containerRef]);
}
