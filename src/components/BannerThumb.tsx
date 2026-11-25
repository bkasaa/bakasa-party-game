import React from 'react';
import {
  Apple,
  Bomb,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  EyeOff,
  Flame,
  Gamepad2,
  Globe,
  Landmark,
  Palette,
  PawPrint,
  Scale,
  Smile,
  Sofa,
  Trophy,
  UserCheck,
  Utensils,
} from 'lucide-react';
import { GameId, SpyIconType } from '../types/game';

interface BannerThumbProps {
  type: GameId | SpyIconType;
  locked?: boolean;
  floatDelay?: number;
}

const THUMB_CONFIG: Record<
  GameId | SpyIconType,
  { gradient: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  spy: { gradient: 'from-[#2e1065] to-[#be185d]', Icon: EyeOff },
  bomb_questions: { gradient: 'from-[#7f1d1d] to-[#ef4444]', Icon: Flame },
  bomb_classic: { gradient: 'from-[#7c2d12] to-[#f97316]', Icon: Bomb },
  draw: { gradient: 'from-[#1e3a8a] to-[#06b6d4]', Icon: Palette },
  forger: { gradient: 'from-[#064e3b] to-[#10b981]', Icon: UserCheck },
  court: { gradient: 'from-[#4c1d95] to-[#7c3aed]', Icon: Scale },
  headsup: { gradient: 'from-[#9a3412] to-[#f43f5e]', Icon: Smile },
  places: { gradient: 'from-[#7c2d12] to-[#f59e0b]', Icon: Landmark },
  food: { gradient: 'from-[#991b1b] to-[#ef4444]', Icon: Utensils },
  movies: { gradient: 'from-[#0f172a] to-[#2563eb]', Icon: Clapperboard },
  sports: { gradient: 'from-[#065f46] to-[#22c55e]', Icon: Trophy },
  jobs: { gradient: 'from-[#312e81] to-[#6366f1]', Icon: Briefcase },
  animals: { gradient: 'from-[#831843] to-[#ec4899]', Icon: PawPrint },
  countries: { gradient: 'from-[#164e63] to-[#06b6d4]', Icon: Globe },
  cars: { gradient: 'from-[#1e293b] to-[#64748b]', Icon: Car },
  home: { gradient: 'from-[#581c87] to-[#a855f7]', Icon: Sofa },
  gaming: { gradient: 'from-[#4c1d95] to-[#ec4899]', Icon: Gamepad2 },
  fruits: { gradient: 'from-[#14532d] to-[#84cc16]', Icon: Apple },
  transport: { gradient: 'from-[#9a3412] to-[#fb923c]', Icon: Bus },
  daily_life: { gradient: 'from-[#0369a1] to-[#38bdf8]', Icon: Coffee },
};

export const BannerThumb: React.FC<BannerThumbProps> = ({ type, locked, floatDelay = 0 }) => {
  const { gradient, Icon } = THUMB_CONFIG[type];

  return (
    <div
      className={`relative shrink-0 w-16 h-16 sm:w-[70px] sm:h-[70px] -my-2 rounded-2xl bg-gradient-to-br ${gradient} border-2 border-white/85 shadow-lg flex items-center justify-center overflow-hidden ${
        locked ? 'opacity-75 grayscale-[25%]' : ''
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.28),transparent_60%)]" />
      <div
        className="animate-icon-float flex items-center justify-center"
        style={{ animationDelay: `${floatDelay}s` }}
      >
        <Icon className="w-8 h-8 text-white drop-shadow" />
      </div>
    </div>
  );
};
