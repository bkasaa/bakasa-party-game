import React, { createContext, useContext } from 'react';

const HomeNavigationContext = createContext<(() => void) | null>(null);

export const HomeNavigationProvider: React.FC<{
  onGoHome: () => void;
  children: React.ReactNode;
}> = ({ onGoHome, children }) => {
  return (
    <HomeNavigationContext.Provider value={onGoHome}>
      {children}
    </HomeNavigationContext.Provider>
  );
};

export function useGoHome(): (() => void) | null {
  return useContext(HomeNavigationContext);
}
