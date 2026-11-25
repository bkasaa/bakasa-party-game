import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [visible, setVisible] = useState<boolean>(() => !isOnline);
  const [fadingOut, setFadingOut] = useState<boolean>(false);

  useEffect(() => {
    if (isOnline) {
      setVisible(false);
      setFadingOut(false);
      return;
    }

    setVisible(true);
    setFadingOut(false);

    const fadeTimer = window.setTimeout(() => {
      setFadingOut(true);
    }, 4650);

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      setFadingOut(false);
    }, 5000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [isOnline]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#F59E0B] border-b-4 px-4 py-2 text-xs font-extrabold text-[#B45309] dark:text-[#FCD34D] shadow-lg whitespace-nowrap transition-opacity duration-350 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <WifiOff className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24] shrink-0" />
      <span>اللعبة شغالة أوفلاين وتمام</span>
    </div>
  );
};
