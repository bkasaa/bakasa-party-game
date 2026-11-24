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
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#F59E0B] border-b-4 px-4 py-2 text-xs font-extrabold text-[#B45309] dark:text-[#FCD34D] shadow-lg whitespace-nowrap"
    >
      <WifiOff className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24] shrink-0" />
      <span>وضع الأوفلاين — اللعبة شغالة بالكامل بدون نت</span>
    </div>
  );
};
