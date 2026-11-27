import { useEffect, useRef } from 'react';

interface GuardEntry {
  id: number;
  blockUnload: boolean;
  onBackAttempt: () => void;
}

interface GuardState {
  appGuard?: boolean;
  depth?: number;
  screen?: string;
}

const activeGuards: GuardEntry[] = [];
let nextGuardId = 1;
let isExitingApp = false;
let rootBackHandler: (() => boolean) | null = null;
let globalPopAttached = false;
let globalBeforeUnloadAttached = false;

function getGuardState(): GuardState | null {
  try {
    return (window.history.state as GuardState | null) ?? null;
  } catch {
    return null;
  }
}

export function isAppGuardActive(): boolean {
  return Boolean(getGuardState()?.appGuard);
}

export function getCurrentGuardDepth(): number {
  const state = getGuardState();
  if (state?.appGuard && typeof state.depth === 'number' && Number.isFinite(state.depth)) {
    return Math.max(1, state.depth);
  }
  return 0;
}

export function pushAppGuardState(screenTag?: string): void {
  try {
    const nextDepth = getCurrentGuardDepth() + 1;
    window.history.pushState(
      {
        appGuard: true,
        depth: nextDepth,
        ...(screenTag ? { screen: screenTag } : {}),
      },
      '',
      window.location.href
    );
  } catch {
    // Ignore history API restrictions in sandboxed frames
  }
}

export function ensureAppGuardState(screenTag?: string): void {
  if (!isAppGuardActive()) {
    pushAppGuardState(screenTag);
  }
}

export function allowAppExit(): void {
  isExitingApp = true;
  const steps = Math.max(1, getCurrentGuardDepth());
  try {
    window.history.go(-steps);
  } catch {
    try {
      window.history.back();
    } catch {
      // Ignore
    }
  }
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      // Ignore if browser blocks script close
    }
    window.setTimeout(() => {
      isExitingApp = false;
    }, 600);
  }, 220);
}

function handleGlobalBeforeUnload(e: BeforeUnloadEvent): string | undefined {
  if (isExitingApp) return undefined;
  const shouldBlock = activeGuards.some((g) => g.blockUnload);
  if (!shouldBlock) return undefined;
  e.preventDefault();
  e.returnValue = 'في جولة شغالة حالياً، متأكد إنك عايز تخرج؟';
  return e.returnValue;
}

function handleGlobalPopState(): void {
  if (isExitingApp) return;

  // Priority 1: Active game round or open modal guard
  if (activeGuards.length > 0) {
    pushAppGuardState();
    const topGuard = activeGuards[activeGuards.length - 1];
    topGuard.onBackAttempt();
    return;
  }

  // Priority 2: Root app navigation handler (back 1 screen or Main Menu exit modal)
  if (rootBackHandler) {
    const navigatedBack = rootBackHandler();
    if (!navigatedBack || !isAppGuardActive()) {
      pushAppGuardState();
    }
    return;
  }

  // Fallback: always keep guard state active
  pushAppGuardState();
}

function syncGlobalListeners(): void {
  const needsPop = rootBackHandler !== null || activeGuards.length > 0;
  if (needsPop && !globalPopAttached) {
    window.addEventListener('popstate', handleGlobalPopState);
    globalPopAttached = true;
  } else if (!needsPop && globalPopAttached) {
    window.removeEventListener('popstate', handleGlobalPopState);
    globalPopAttached = false;
  }

  const needsUnload = activeGuards.some((g) => g.blockUnload);
  if (needsUnload && !globalBeforeUnloadAttached) {
    window.addEventListener('beforeunload', handleGlobalBeforeUnload);
    globalBeforeUnloadAttached = true;
  } else if (!needsUnload && globalBeforeUnloadAttached) {
    window.removeEventListener('beforeunload', handleGlobalBeforeUnload);
    globalBeforeUnloadAttached = false;
  }
}

/**
 * Installs the app-wide Android edge-swipe / browser back trap.
 * Must be mounted once in the root App component.
 * `onBackAttempt` returns `true` if it navigated back one screen,
 * or `false` if it handled the back gesture in-place (e.g., opened exit modal).
 */
export function useRootNavigationTrap(onBackAttempt: () => boolean): void {
  const handlerRef = useRef(onBackAttempt);
  handlerRef.current = onBackAttempt;

  useEffect(() => {
    ensureAppGuardState('HOME');
    const wrapper = () => handlerRef.current();
    rootBackHandler = wrapper;
    syncGlobalListeners();

    return () => {
      if (rootBackHandler === wrapper) {
        rootBackHandler = null;
        syncGlobalListeners();
      }
    };
  }, []);
}

export interface NavigationGuardOptions {
  blockUnload?: boolean;
}

/**
 * Intercepts browser refresh/tab close (beforeunload) and back navigation (popstate)
 * while an active round or modal is open so players don't accidentally lose progress.
 */
export function useNavigationGuard(
  isActive: boolean,
  onBackAttempt: () => void,
  options?: NavigationGuardOptions
): void {
  const onBackAttemptRef = useRef(onBackAttempt);
  onBackAttemptRef.current = onBackAttempt;
  const blockUnload = options?.blockUnload ?? true;

  useEffect(() => {
    if (!isActive) return;

    ensureAppGuardState();

    const id = nextGuardId++;
    const entry: GuardEntry = {
      id,
      blockUnload,
      onBackAttempt: () => onBackAttemptRef.current(),
    };
    activeGuards.push(entry);
    syncGlobalListeners();

    return () => {
      const idx = activeGuards.findIndex((g) => g.id === id);
      if (idx !== -1) {
        activeGuards.splice(idx, 1);
      }
      syncGlobalListeners();
    };
  }, [isActive, blockUnload]);
}
