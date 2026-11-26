import React from 'react';
import { GameId, SpyIconType } from '../types/game';
import { RichIconBadge, RichPartyOrCategoryIcon } from './RichGameIcons';

interface BannerThumbProps {
  type: GameId | SpyIconType;
  locked?: boolean;
  floatDelay?: number;
}

const THUMB_GRADIENT: Record<GameId | SpyIconType, string> = {
  spy: 'from-[#4c1d95] via-[#9d174d] to-[#be185d]',
  bomb_questions: 'from-[#991b1b] via-[#dc2626] to-[#f97316]',
  bomb_classic: 'from-[#7c2d12] via-[#ea580c] to-[#f59e0b]',
  draw: 'from-[#1e3a8a] via-[#0284c7] to-[#06b6d4]',
  forger: 'from-[#064e3b] via-[#059669] to-[#10b981]',
  court: 'from-[#4c1d95] via-[#6d28d9] to-[#a855f7]',
  headsup: 'from-[#9a3412] via-[#e11d48] to-[#f43f5e]',
  places: 'from-[#7c2d12] via-[#d97706] to-[#f59e0b]',
  food: 'from-[#991b1b] via-[#dc2626] to-[#ef4444]',
  movies: 'from-[#0f172a] via-[#1d4ed8] to-[#3b82f6]',
  sports: 'from-[#065f46] via-[#16a34a] to-[#22c55e]',
  jobs: 'from-[#312e81] via-[#4f46e5] to-[#6366f1]',
  animals: 'from-[#831843] via-[#db2777] to-[#ec4899]',
  countries: 'from-[#164e63] via-[#0891b2] to-[#06b6d4]',
  cars: 'from-[#1e293b] via-[#475569] to-[#64748b]',
  home: 'from-[#581c87] via-[#9333ea] to-[#a855f7]',
  gaming: 'from-[#4c1d95] via-[#9333ea] to-[#ec4899]',
  fruits: 'from-[#14532d] via-[#65a30d] to-[#84cc16]',
  transport: 'from-[#9a3412] via-[#ea580c] to-[#fb923c]',
  daily_life: 'from-[#0369a1] via-[#0ea5e9] to-[#38bdf8]',
};

export const BannerThumb: React.FC<BannerThumbProps> = ({ type, locked, floatDelay = 0 }) => {
  return (
    <RichIconBadge
      gradientClass={THUMB_GRADIENT[type]}
      size="lg"
      floatDelay={floatDelay}
      locked={locked}
      className="-my-2"
    >
      <RichPartyOrCategoryIcon type={type} className="w-10 h-10" />
    </RichIconBadge>
  );
};
