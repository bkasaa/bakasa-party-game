import React from 'react';

interface PlayerAvatarProps {
  avatarId: number;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  rank?: number; // 1, 2, 3 get gold, silver, bronze medals
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

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatarId,
  name,
  size = 'md',
  rank,
  className = '',
}) => {
  const palette = AVATAR_PALETTES[Math.abs(avatarId) % AVATAR_PALETTES.length];
  const badge = rank && rank <= 3 ? RANK_BADGE[rank] : null;

  return (
    <div className={`relative shrink-0 ${SIZE_CLASSES[size]} ${className}`}>
      <div
        className="w-full h-full rounded-full overflow-hidden border-[2.5px] border-white/85 shadow-md flex items-center justify-center"
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

          {/* Eyes */}
          <circle cx="26.5" cy="29" r="2.2" fill="#1e1b2e" />
          <circle cx="37.5" cy="29" r="2.2" fill="#1e1b2e" />
          <circle cx="27.2" cy="28.3" r="0.7" fill="#ffffff" />
          <circle cx="38.2" cy="28.3" r="0.7" fill="#ffffff" />

          {palette.accessory === 'glasses' && (
            <g stroke="#1e293b" strokeWidth="1.8" fill="none">
              <circle cx="26.5" cy="29" r="4.5" />
              <circle cx="37.5" cy="29" r="4.5" />
              <line x1="31" y1="29" x2="33" y2="29" />
            </g>
          )}

          {/* Smile */}
          <path
            d="M27.5 35.5 Q32 39.5 36.5 35.5"
            stroke="#7c2d12"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {badge && (
        <span
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${badge.bg} ${badge.text} text-[11px] font-black flex items-center justify-center shadow ring-2 ring-[#1e0b3a] tabular-nums`}
        >
          {rank}
        </span>
      )}
    </div>
  );
};
