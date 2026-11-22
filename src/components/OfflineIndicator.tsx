import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-[#271047]/95 border border-amber-400/50 px-4 py-2 text-xs font-extrabold text-amber-200 shadow-xl whitespace-nowrap"
    >
      <WifiOff className="w-4 h-4 text-amber-300 shrink-0" />
      <span>وضع الأوفلاين — اللعبة شغالة بالكامل بدون نت</span>
    </div>
  );
};
