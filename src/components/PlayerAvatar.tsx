import React from 'react';
import { ScoreboardMood } from '../utils/scoreboardMood';

interface PlayerAvatarProps {
  avatarId: number;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  rank?: number; // 1, 2, 3 get gold, silver, bronze medals; 4+ if showAllRanks
  showAllRanks?: boolean;
  mood?: ScoreboardMood;
  className?: string;
}

const AVATAR_PALETTES = [
  { bg: '#2c1b47', skin: '#f5c29b', hair: '#2a1612', accent: '#e11d48', accessory: 'bandana' },
  { bg: '#1e3a5f', skin: '#fbd5b8', hair: '#f472b6', accent: '#ec4899', accessory: 'bow' },
  { bg: '#3b1d4a', skin: '#f3be98', hair: '#d946ef', accent: '#7c3aed', accessory: 'buns' },
  { bg: '#1c3b2b', skin: '#e8ae84', hair: '#1e293b', accent: '#059669', accessory: 'fedora' },
  { bg: '#47251d', skin: '#f2be96', hair: '#cbd5e1', accent: '#2563eb', accessory: 'cap' },
  { bg: '#2f294f', skin: '#c98a63', hair: '#0f172a', accent: '#65a30d', accessory: 'helmet' },
  { bg: '#163e4a', skin: '#f6cba8', hair: '#7c2d12', accent: '#0891b2', accessory: 'glasses' },
  { bg: '#42203b', skin: '#eab58d', hair: '#18181b', accent: '#d97706', accessory: 'crown' },
  { bg: '#21374d', skin: '#d89b72', hair: '#92400e', accent: '#dc2626', accessory: 'headband' },
  { bg: '#382a1e', skin: '#f7cfb0', hair: '#312e81', accent: '#0284c7', accessory: 'headphones' },
] as const;

const SIZE_CLASSES = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const RANK_BADGE: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-[#eab308]', text: 'text-[#422006]' },
  2: { bg: 'bg-[#cbd5e1]', text: 'text-[#1e293b]' },
  3: { bg: 'bg-[#d97706]', text: 'text-white' },
};

const MOOD_ANIMATION: Record<ScoreboardMood, string> = {
  winner: 'animate-rank-winner',
  middle: 'animate-rank-middle',
  last: 'animate-rank-cry',
  neutral: '',
};

const MOOD_BADGE: Record<
  Exclude<ScoreboardMood, 'neutral'>,
  { emoji: string; bg: string; label: string }
> = {
  winner: { emoji: '🏆', bg: 'bg-[#FEF08A] border-[#F59E0B]', label: 'المركز الأول' },
  middle: { emoji: '😊', bg: 'bg-[#D1FAE5] border-[#34D399]', label: 'مركز متقدم' },
  last: { emoji: '😰', bg: 'bg-[#FFE4E6] border-[#F43F5E]', label: 'المركز الأخير' },
};

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatarId,
  name,
  size = 'md',
  rank,
  showAllRanks = false,
  mood,
  className = '',
}) => {
  const palette = AVATAR_PALETTES[Math.abs(avatarId) % AVATAR_PALETTES.length];
  const badge =
    rank && rank <= 3
      ? RANK_BADGE[rank]
      : rank && showAllRanks
        ? { bg: 'bg-[#334155]', text: 'text-white' }
        : null;
  const activeMood = mood ?? 'neutral';
  const moodAnimClass = MOOD_ANIMATION[activeMood];
  const moodBadge = activeMood !== 'neutral' ? MOOD_BADGE[activeMood] : null;

  return (
    <div className={`relative shrink-0 ${SIZE_CLASSES[size]} ${moodAnimClass} ${className}`}>
      <div
        className={`w-full h-full rounded-full overflow-hidden border-[2.5px] shadow-md flex items-center justify-center ${
          activeMood === 'winner'
            ? 'border-[#FACC15] ring-2 ring-[#FDE047]/70'
            : activeMood === 'last'
              ? 'border-[#FDA4AF]'
              : 'border-white/85'
        }`}
        style={{ backgroundColor: palette.bg }}
        aria-label={name}
      >
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
          {/* Shoulders / Shirt */}
          <path
            d="M12 64 C14 48, 22 44, 32 44 C42 44, 50 48, 52 64 Z"
            fill={palette.accent}
          />
          <path d="M26 44 L32 51 L38 44 Z" fill="#ffffff" opacity="0.9" />

          {/* Neck & Head */}
          <rect x="27" y="38" width="10" height="8" rx="4" fill={palette.skin} />
          <ellipse cx="32" cy="29" rx="13" ry="14.5" fill={palette.skin} />

          {/* Ears */}
          <circle cx="19" cy="30" r="3" fill={palette.skin} />
          <circle cx="45" cy="30" r="3" fill={palette.skin} />

          {/* Hair back / base */}
          <path
            d="M18 28 C18 14, 46 14, 46 28 C46 20, 40 16, 32 16 C24 16, 18 20, 18 28 Z"
            fill={palette.hair}
          />

          {/* Accessory specifics */}
          {palette.accessory === 'bandana' && (
            <>
              <path d="M18 22 Q32 12 46 22 L44 26 Q32 19 20 26 Z" fill="#ef4444" />
              <circle cx="44" cy="24" r="3" fill="#dc2626" />
            </>
          )}
          {palette.accessory === 'buns' && (
            <>
              <circle cx="20" cy="17" r="6" fill={palette.hair} />
              <circle cx="44" cy="17" r="6" fill={palette.hair} />
            </>
          )}
          {palette.accessory === 'fedora' && (
            <>
              <ellipse cx="32" cy="19" rx="18" ry="4" fill="#6366f1" />
              <path d="M22 19 L25 9 L39 9 L42 19 Z" fill="#4f46e5" />
            </>
          )}
          {palette.accessory === 'cap' && (
            <>
              <path d="M19 21 C19 11, 45 11, 45 21 Z" fill="#2563eb" />
              <rect x="19" y="19" width="26" height="3.5" rx="1.5" fill="#fbbf24" />
            </>
          )}
          {palette.accessory === 'bow' && (
            <circle cx="23" cy="17" r="4" fill="#ef4444" />
          )}
          {palette.accessory === 'helmet' && (
            <>
              <path d="M18 24 C18 11, 46 11, 46 24 Z" fill="#4d7c0f" />
              <rect x="21" y="16" width="9" height="6" rx="2" fill="#facc15" />
              <rect x="34" y="16" width="9" height="6" rx="2" fill="#facc15" />
            </>
          )}
          {palette.accessory === 'headphones' && (
            <>
              <path d="M17 28 C17 12, 47 12, 47 28" stroke="#38bdf8" strokeWidth="3" fill="none" />
              <rect x="15" y="25" width="5" height="10" rx="2.5" fill="#0284c7" />
              <rect x="44" y="25" width="5" height="10" rx="2.5" fill="#0284c7" />
            </>
          )}

          {/* Dynamic Facial Expression by Mood */}
          {activeMood === 'winner' ? (
            <>
              {/* Happy arched eyes */}
              <path
                d="M23.5 29.5 Q26.5 25.5 29.5 29.5"
                stroke="#1e1b2e"
                strokeWidth="2.3"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M34.5 29.5 Q37.5 25.5 40.5 29.5"
                stroke="#1e1b2e"
                strokeWidth="2.3"
                strokeLinecap="round"
                fill="none"
              />
              {/* Rosy cheeks */}
              <circle cx="23" cy="33" r="2.2" fill="#fb7185" opacity="0.55" />
              <circle cx="41" cy="33" r="2.2" fill="#fb7185" opacity="0.55" />
              {/* Big celebrating open smile */}
              <path
                d="M26 34.5 Q32 42 38 34.5 Z"
                fill="#991b1b"
                stroke="#7c2d12"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M29 38.2 Q32 39.8 35 38.2" fill="#fb7185" />
            </>
          ) : activeMood === 'middle' ? (
            <>
              {/* Cheerful bright eyes & rosy cheeks */}
              <circle cx="26.5" cy="29" r="2.2" fill="#1e1b2e" />
              <circle cx="37.5" cy="29" r="2.2" fill="#1e1b2e" />
              <circle cx="27.2" cy="28.3" r="0.7" fill="#ffffff" />
              <circle cx="38.2" cy="28.3" r="0.7" fill="#ffffff" />
              <circle cx="22.8" cy="33" r="1.9" fill="#fb7185" opacity="0.4" />
              <circle cx="41.2" cy="33" r="1.9" fill="#fb7185" opacity="0.4" />
              {/* Warm happy smile */}
              <path
                d="M26.5 34.8 Q32 40.2 37.5 34.8"
                stroke="#7c2d12"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : activeMood === 'last' ? (
            <>
              {/* Sad eyebrows & squeezed desperate eyes */}
              <path
                d="M23 26.2 L29 24.4"
                stroke="#451a03"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M41 26.2 L35 24.4"
                stroke="#451a03"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M24 28 L29 29.8 L24 31.4"
                stroke="#1e1b2e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M40 28 L35 29.8 L40 31.4"
                stroke="#1e1b2e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Desperate sweat drop on temple */}
              <path
                d="M44 21 C45.8 23.8, 45.8 26.2, 44 26.2 C42.2 26.2, 42.2 23.8, 44 21 Z"
                fill="#38bdf8"
                className="animate-sweat-drop"
              />
              {/* Tear streams */}
              <rect x="24.5" y="31.5" width="3" height="6.5" rx="1.5" fill="#38bdf8" opacity="0.85" />
              <rect x="36.5" y="31.5" width="3" height="6.5" rx="1.5" fill="#38bdf8" opacity="0.85" />
              <circle
                cx="26"
                cy="36"
                r="1.7"
                fill="#7dd3fc"
                className="animate-tear-drop"
              />
              <circle
                cx="38"
                cy="36"
                r="1.7"
                fill="#7dd3fc"
                className="animate-tear-drop"
                style={{ animationDelay: '0.45s' }}
              />
              {/* Trembling sad mouth */}
              <path
                d="M27.5 38 Q32 33.8 36.5 38"
                stroke="#7c2d12"
                strokeWidth="2.1"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : (
            <>
              {/* Default Eyes */}
              <circle cx="26.5" cy="29" r="2.2" fill="#1e1b2e" />
              <circle cx="37.5" cy="29" r="2.2" fill="#1e1b2e" />
              <circle cx="27.2" cy="28.3" r="0.7" fill="#ffffff" />
              <circle cx="38.2" cy="28.3" r="0.7" fill="#ffffff" />

              {/* Default Smile */}
              <path
                d="M27.5 35.5 Q32 39.5 36.5 35.5"
                stroke="#7c2d12"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </>
          )}

          {palette.accessory === 'glasses' && (
            <g stroke="#1e293b" strokeWidth="1.8" fill="none">
              <circle cx="26.5" cy="29" r="4.5" />
              <circle cx="37.5" cy="29" r="4.5" />
              <line x1="31" y1="29" x2="33" y2="29" />
            </g>
          )}
        </svg>
      </div>

      {activeMood === 'winner' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 -right-2 text-[11px] leading-none animate-pulse select-none"
        >
          ✨
        </span>
      )}

      {moodBadge && (
        <span
          title={moodBadge.label}
          aria-label={moodBadge.label}
          className={`pointer-events-none absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full border ${moodBadge.bg} text-xs leading-none flex items-center justify-center shadow-sm`}
        >
          {moodBadge.emoji}
        </span>
      )}

      {badge && (
        <span
          className={`pointer-events-none absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${badge.bg} ${badge.text} text-[11px] font-black flex items-center justify-center shadow ring-2 ring-white dark:ring-[#1E293B] tabular-nums`}
        >
          {rank}
        </span>
      )}
    </div>
  );
};
