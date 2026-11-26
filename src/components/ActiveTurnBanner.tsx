import React from 'react';
import { Player } from '../types/game';
import { PlayerAvatar } from './PlayerAvatar';

interface ActiveTurnBannerProps {
  label: string;
  player?: Player;
  playerNameOverride?: string;
  badgeText?: string;
  swatchHex?: string;
  accent?: 'coral' | 'teal' | 'emerald' | 'amber' | 'rose';
  sticky?: boolean;
}

const ACCENT_RING: Record<NonNullable<ActiveTurnBannerProps['accent']>, string> = {
  coral: 'border-[#FF6B4A]/70 bg-[#FFF5F2]/95 dark:bg-[#1E293B]/95',
  teal: 'border-[#14B8A6]/70 bg-[#F0FDFA]/95 dark:bg-[#1E293B]/95',
  emerald: 'border-[#10B981]/70 bg-[#ECFDF5]/95 dark:bg-[#1E293B]/95',
  amber: 'border-[#F59E0B]/70 bg-[#FFFBEB]/95 dark:bg-[#1E293B]/95',
  rose: 'border-[#F43F5E]/70 bg-[#FFF1F2]/95 dark:bg-[#1E293B]/95',
};

const NAME_COLOR: Record<NonNullable<ActiveTurnBannerProps['accent']>, string> = {
  coral: 'text-[#D94E30] dark:text-[#FF8C73]',
  teal: 'text-[#0D9488] dark:text-[#2DD4BF]',
  emerald: 'text-[#059669] dark:text-[#34D399]',
  amber: 'text-[#D97706] dark:text-[#FBBF24]',
  rose: 'text-[#E11D48] dark:text-[#FDA4AF]',
};

export const ActiveTurnBanner: React.FC<ActiveTurnBannerProps> = ({
  label,
  player,
  playerNameOverride,
  badgeText,
  swatchHex,
  accent = 'teal',
  sticky = true,
}) => {
  const displayName = playerNameOverride ?? player?.name ?? '';

  return (
    <div
      className={`${
        sticky ? 'sticky top-2 z-30' : ''
      } w-full rounded-2xl border-2 ${ACCENT_RING[accent]} px-3.5 py-2 shadow-md flex items-center justify-between gap-2.5 mb-2.5`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {player ? (
          <PlayerAvatar avatarId={player.avatarId} name={player.name} size="sm" />
        ) : swatchHex ? (
          <span
            className="w-6 h-6 rounded-full border-2 border-white dark:border-[#334155] shadow shrink-0"
            style={{ backgroundColor: swatchHex }}
          />
        ) : null}

        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-extrabold text-[#475569] dark:text-[#CBD5E1] shrink-0">
            {label}
          </span>
          <span className={`text-sm sm:text-base font-black truncate ${NAME_COLOR[accent]}`}>
            {displayName}
          </span>
          {swatchHex && player && (
            <span
              className="w-3.5 h-3.5 rounded-full border border-black/25 shrink-0"
              style={{ backgroundColor: swatchHex }}
            />
          )}
        </div>
      </div>

      {badgeText && (
        <span className="shrink-0 rounded-xl bg-white/90 dark:bg-[#0F172A] border border-[#E7DEC8] dark:border-[#334155] px-2.5 py-1 text-[11px] font-black text-[#475569] dark:text-[#CBD5E1] tabular-nums">
          {badgeText}
        </span>
      )}
    </div>
  );
};
