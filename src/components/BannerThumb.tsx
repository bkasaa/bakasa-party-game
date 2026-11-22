import React from 'react';
import {
  Bomb,
  Clapperboard,
  EyeOff,
  Gavel,
  Landmark,
  Palette,
  PawPrint,
  Shirt,
  Sparkles,
  UserCheck,
  Utensils,
} from 'lucide-react';
import { GameId, SpyCategory } from '../types/game';

interface BannerThumbProps {
  type: GameId | SpyCategory['iconType'];
  locked?: boolean;
}

const THUMB_CONFIG: Record<
  GameId | SpyCategory['iconType'],
  { gradient: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  spy: { gradient: 'from-[#2e1065] to-[#be185d]', Icon: EyeOff },
  bomb: { gradient: 'from-[#7f1d1d] to-[#f97316]', Icon: Bomb },
  draw: { gradient: 'from-[#1e3a8a] to-[#06b6d4]', Icon: Palette },
  forger: { gradient: 'from-[#064e3b] to-[#10b981]', Icon: UserCheck },
  court: { gradient: 'from-[#78350f] to-[#f59e0b]', Icon: Gavel },
  food: { gradient: 'from-[#991b1b] to-[#ef4444]', Icon: Utensils },
  movies: { gradient: 'from-[#0f172a] to-[#2563eb]', Icon: Clapperboard },
  places: { gradient: 'from-[#7c2d12] to-[#f59e0b]', Icon: Landmark },
  animals: { gradient: 'from-[#831843] to-[#ec4899]', Icon: PawPrint },
  clothes: { gradient: 'from-[#065f46] to-[#22c55e]', Icon: Shirt },
  girls: { gradient: 'from-[#4c1d95] to-[#a855f7]', Icon: Sparkles },
};

export const BannerThumb: React.FC<BannerThumbProps> = ({ type, locked }) => {
  const { gradient, Icon } = THUMB_CONFIG[type];

  return (
    <div
      className={`relative shrink-0 w-16 h-16 sm:w-[70px] sm:h-[70px] -my-2 rounded-2xl bg-gradient-to-br ${gradient} border-2 border-white/85 shadow-lg flex items-center justify-center overflow-hidden ${
        locked ? 'opacity-75 grayscale-[25%]' : ''
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.28),transparent_60%)]" />
      <Icon className="w-8 h-8 text-white drop-shadow" />
    </div>
  );
};
