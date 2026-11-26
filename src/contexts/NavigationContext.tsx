import React, { createContext, useContext } from 'react';

interface NavigationContextValue {
  goHome: (() => void) | null;
  openSettings: (() => void) | null;
}

const HomeNavigationContext = createContext<NavigationContextValue>({
  goHome: null,
  openSettings: null,
});

export const HomeNavigationProvider: React.FC<{
  onGoHome: () => void;
  onOpenSettings?: () => void;
  children: React.ReactNode;
}> = ({ onGoHome, onOpenSettings, children }) => {
  return (
    <HomeNavigationContext.Provider
      value={{
        goHome: onGoHome,
        openSettings: onOpenSettings ?? null,
      }}
    >
      {children}
    </HomeNavigationContext.Provider>
  );
};

export function useGoHome(): (() => void) | null {
  return useContext(HomeNavigationContext).goHome;
}

export function useOpenSettings(): (() => void) | null {
  return useContext(HomeNavigationContext).openSettings;
}
