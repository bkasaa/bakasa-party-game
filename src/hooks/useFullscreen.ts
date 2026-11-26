import { useCallback, useEffect, useState } from 'react';

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(getFullscreenElement()));

  const isSupported =
    typeof document !== 'undefined' &&
    Boolean(
      document.documentElement?.requestFullscreen ||
        (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
          ?.webkitRequestFullscreen
    );

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<boolean> => {
    if (typeof document === 'undefined') return false;
    try {
      if (getFullscreenElement()) {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void>;
        };
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        setIsFullscreen(false);
        return false;
      }

      const root = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (root.requestFullscreen) {
        await root.requestFullscreen();
        setIsFullscreen(true);
        return true;
      }
      if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
        setIsFullscreen(true);
        return true;
      }
    } catch {
      // Ignore browser gesture/iframe fullscreen restrictions gracefully
    }
    return Boolean(getFullscreenElement());
  }, []);

  return { isFullscreen, isSupported, toggleFullscreen };
}
