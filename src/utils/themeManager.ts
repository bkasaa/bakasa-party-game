import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'qada_theme_v1';

class ThemeManager {
  private theme: ThemeMode = 'light';
  private listeners: Set<(theme: ThemeMode) => void> = new Set();

  constructor() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        this.theme = saved;
      }
    } catch {
      this.theme = 'light';
    }
    this.applyToDom(this.theme);
  }

  private applyToDom(theme: ThemeMode): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0F172A' : '#FFF9F0');
    }
  }

  public getTheme(): ThemeMode {
    return this.theme;
  }

  public setTheme(theme: ThemeMode): void {
    this.theme = theme;
    this.applyToDom(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures
    }
    this.listeners.forEach((cb) => cb(this.theme));
  }

  public toggleTheme(): ThemeMode {
    const next: ThemeMode = this.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  public subscribe(cb: (theme: ThemeMode) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export const themeManager = new ThemeManager();

export function useTheme(): {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => ThemeMode;
  setTheme: (theme: ThemeMode) => void;
} {
  const [theme, setThemeState] = useState<ThemeMode>(() => themeManager.getTheme());

  useEffect(() => {
    return themeManager.subscribe(setThemeState);
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme: () => themeManager.toggleTheme(),
    setTheme: (t: ThemeMode) => themeManager.setTheme(t),
  };
}
