import { useEffect, useRef } from 'react';

/**
 * Intercepts browser refresh/tab close (beforeunload) and back navigation (popstate)
 * while an active round is in progress so players don't accidentally lose progress.
 */
export function useNavigationGuard(isActive: boolean, onBackAttempt: () => void) {
  const onBackAttemptRef = useRef(onBackAttempt);
  onBackAttemptRef.current = onBackAttempt;

  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      pushedRef.current = false;
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'في جولة شغالة حالياً، متأكد إنك عايز تخرج؟';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    if (!pushedRef.current) {
      try {
        window.history.pushState({ bakasaGuard: true }, '', window.location.href);
        pushedRef.current = true;
      } catch {
        // Ignore history API restrictions in sandboxed frames
      }
    }

    const handlePopState = () => {
      try {
        window.history.pushState({ bakasaGuard: true }, '', window.location.href);
      } catch {
        // Ignore
      }
      onBackAttemptRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isActive]);
}
