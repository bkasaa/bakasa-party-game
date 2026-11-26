import React from 'react';
import { ScoreboardMood } from '../utils/scoreboardMood';

export interface AvatarOption {
  id: number;
  label: string;
  bg: string;
  skin: string;
  hair: string;
  accent: string;
  accessory:
    | 'bandana'
    | 'bow'
    | 'buns'
    | 'fedora'
    | 'cap'
    | 'helmet'
    | 'glasses'
    | 'crown'
    | 'headband'
    | 'headphones'
    | 'ninja'
    | 'robot'
    | 'cat'
    | 'footballer'
    | 'tiara'
    | 'pirate'
    | 'wizard'
    | 'chef'
    | 'astronaut'
    | 'pharaoh'
    | 'mohawk'
    | 'beret'
    | 'samurai'
    | 'aviator';
}

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
  { id: 0, label: 'شاب بعصابة', bg: '#2c1b47', skin: '#f5c29b', hair: '#2a1612', accent: '#e11d48', accessory: 'bandana' },
  { id: 1, label: 'بنت بفيونكة', bg: '#1e3a5f', skin: '#fbd5b8', hair: '#f472b6', accent: '#ec4899', accessory: 'bow' },
  { id: 2, label: 'بنت بكعكتين', bg: '#3b1d4a', skin: '#f3be98', hair: '#d946ef', accent: '#7c3aed', accessory: 'buns' },
  { id: 3, label: 'محقق سري', bg: '#1c3b2b', skin: '#e8ae84', hair: '#1e293b', accent: '#059669', accessory: 'fedora' },
  { id: 4, label: 'كاب كاجوال', bg: '#47251d', skin: '#f2be96', hair: '#cbd5e1', accent: '#2563eb', accessory: 'cap' },
  { id: 5, label: 'مقاتل بخوذة', bg: '#2f294f', skin: '#c98a63', hair: '#0f172a', accent: '#65a30d', accessory: 'helmet' },
  { id: 6, label: 'نظارة ذكي', bg: '#163e4a', skin: '#f6cba8', hair: '#7c2d12', accent: '#0891b2', accessory: 'glasses' },
  { id: 7, label: 'ملك القعدة', bg: '#42203b', skin: '#eab58d', hair: '#18181b', accent: '#d97706', accessory: 'crown' },
  { id: 8, label: 'رياضي نشيط', bg: '#21374d', skin: '#d89b72', hair: '#92400e', accent: '#dc2626', accessory: 'headband' },
  { id: 9, label: 'جيمر محترف', bg: '#382a1e', skin: '#f7cfb0', hair: '#312e81', accent: '#0284c7', accessory: 'headphones' },
  { id: 10, label: 'نينجا الظل', bg: '#0f172a', skin: '#f3c6a5', hair: '#0f172a', accent: '#ef4444', accessory: 'ninja' },
  { id: 11, label: 'روبوت مستقبلي', bg: '#1e293b', skin: '#94a3b8', hair: '#38bdf8', accent: '#0ea5e9', accessory: 'robot' },
  { id: 12, label: 'قطة كيوت', bg: '#4c1d45', skin: '#fde2c8', hair: '#fb923c', accent: '#f43f5e', accessory: 'cat' },
  { id: 13, label: 'نجم الكورة', bg: '#064e3b', skin: '#e8af87', hair: '#1c1917', accent: '#10b981', accessory: 'footballer' },
  { id: 14, label: 'ملكة القعدة', bg: '#4a154b', skin: '#fce0ca', hair: '#7c2d12', accent: '#db2777', accessory: 'tiara' },
  { id: 15, label: 'قرصان البحر', bg: '#27272a', skin: '#dfb18b', hair: '#18181b', accent: '#b91c1c', accessory: 'pirate' },
  { id: 16, label: 'ساحر العجائب', bg: '#1e1b4b', skin: '#f4c7a1', hair: '#e2e8f0', accent: '#7c3aed', accessory: 'wizard' },
  { id: 17, label: 'شيف المطعم', bg: '#3f2e1e', skin: '#efc09b', hair: '#451a03', accent: '#f97316', accessory: 'chef' },
  { id: 18, label: 'رائد فضاء', bg: '#0c1b33', skin: '#f8d2b4', hair: '#1e293b', accent: '#38bdf8', accessory: 'astronaut' },
  { id: 19, label: 'فرعون مصري', bg: '#422006', skin: '#d89b6e', hair: '#0f172a', accent: '#f59e0b', accessory: 'pharaoh' },
  { id: 20, label: 'روك ستار', bg: '#3b0764', skin: '#f3be98', hair: '#ec4899', accent: '#a855f7', accessory: 'mohawk' },
  { id: 21, label: 'رسام فرنسي', bg: '#3b1c2a', skin: '#fbe0cb', hair: '#78350f', accent: '#e11d48', accessory: 'beret' },
  { id: 22, label: 'محارب ساموراي', bg: '#2b1215', skin: '#e8b38b', hair: '#18181b', accent: '#dc2626', accessory: 'samurai' },
  { id: 23, label: 'كابتن طيار', bg: '#172554', skin: '#f1c29d', hair: '#451a03', accent: '#0284c7', accessory: 'aviator' },
] as const;

interface PlayerAvatarProps {
  avatarId: number;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  rank?: number;
  showAllRanks?: boolean;
  mood?: ScoreboardMood;
  className?: string;
}

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
  const palette = AVATAR_OPTIONS[Math.abs(avatarId) % AVATAR_OPTIONS.length];
  const badge =
    rank && rank <= 3
      ? RANK_BADGE[rank]
      : rank && showAllRanks
        ? { bg: 'bg-[#334155]', text: 'text-white' }
        : null;
  const activeMood = mood ?? 'neutral';
  const moodAnimClass = MOOD_ANIMATION[activeMood];
  const moodBadge = activeMood !== 'neutral' ? MOOD_BADGE[activeMood] : null;
  const isRobot = palette.accessory === 'robot';

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
          {palette.accessory === 'footballer' ? (
            <>
              <path d="M27 44 V64 M37 44 V64" stroke="#ffffff" strokeWidth="2.5" opacity="0.85" />
              <circle cx="32" cy="54" r="3" fill="#fde047" />
            </>
          ) : (
            <path d="M26 44 L32 51 L38 44 Z" fill="#ffffff" opacity="0.9" />
          )}

          {/* Neck & Head */}
          <rect x="27" y="38" width="10" height="8" rx="4" fill={palette.skin} />
          {isRobot ? (
            <rect x="18" y="16" width="28" height="26" rx="7" fill={palette.skin} stroke="#475569" strokeWidth="1.5" />
          ) : (
            <ellipse cx="32" cy="29" rx="13" ry="14.5" fill={palette.skin} />
          )}

          {/* Ears */}
          {!isRobot && (
            <>
              <circle cx="19" cy="30" r="3" fill={palette.skin} />
              <circle cx="45" cy="30" r="3" fill={palette.skin} />
            </>
          )}

          {/* Hair back / base */}
          {!isRobot && palette.accessory !== 'astronaut' && (
            <path
              d="M18 28 C18 14, 46 14, 46 28 C46 20, 40 16, 32 16 C24 16, 18 20, 18 28 Z"
              fill={palette.hair}
            />
          )}

          {/* Long hair extras for feminine avatars */}
          {(palette.accessory === 'bow' || palette.accessory === 'tiara') && (
            <path
              d="M18 26 C15 36 16 44 20 46 M46 26 C49 36 48 44 44 46"
              stroke={palette.hair}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* Accessories */}
          {palette.accessory === 'bandana' && (
            <>
              <path d="M18 22 Q32 12 46 22 L44 26 Q32 19 20 26 Z" fill="#ef4444" />
              <circle cx="44" cy="24" r="3" fill="#dc2626" />
            </>
          )}
          {palette.accessory === 'headband' && (
            <rect x="18.5" y="19" width="27" height="4" rx="2" fill="#facc15" />
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
            <>
              <polygon points="20,17 26,14 26,20" fill="#ef4444" />
              <polygon points="30,17 24,14 24,20" fill="#ef4444" />
              <circle cx="25" cy="17" r="2.2" fill="#fbbf24" />
            </>
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
          {palette.accessory === 'crown' && (
            <path
              d="M21 19 L23 10 L28 15 L32 8 L36 15 L41 10 L43 19 Z"
              fill="#facc15"
              stroke="#b45309"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          )}
          {palette.accessory === 'tiara' && (
            <path
              d="M22 18 L26 11 L32 15 L38 11 L42 18 Z"
              fill="#f472b6"
              stroke="#fde047"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          )}
          {palette.accessory === 'ninja' && (
            <>
              <path d="M19 20 C19 13, 45 13, 45 20 L45 25 L19 25 Z" fill="#1e293b" />
              <path d="M19 32 L45 32 L44 42 Q32 45 20 42 Z" fill="#1e293b" />
              <rect x="19" y="20" width="26" height="3" fill="#ef4444" />
            </>
          )}
          {palette.accessory === 'robot' && (
            <>
              <line x1="32" y1="8" x2="32" y2="16" stroke="#38bdf8" strokeWidth="2.5" />
              <circle cx="32" cy="7" r="3" fill="#facc15" />
              <rect x="21" y="24" width="22" height="8" rx="3" fill="#0f172a" />
            </>
          )}
          {palette.accessory === 'cat' && (
            <>
              <polygon points="19,21 21,9 28,17" fill="#fb923c" stroke="#1e293b" strokeWidth="1.2" />
              <polygon points="45,21 43,9 36,17" fill="#fb923c" stroke="#1e293b" strokeWidth="1.2" />
            </>
          )}
          {palette.accessory === 'footballer' && (
            <path d="M19 20 Q32 15 45 20" stroke="#10b981" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          )}
          {palette.accessory === 'pirate' && (
            <>
              <path d="M17 19 C17 9, 47 9, 47 19 Z" fill="#18181b" />
              <circle cx="32" cy="14" r="2.3" fill="#f8fafc" />
              <line x1="21" y1="24" x2="43" y2="33" stroke="#18181b" strokeWidth="1.8" />
              <circle cx="37" cy="29" r="3.6" fill="#18181b" />
            </>
          )}
          {palette.accessory === 'wizard' && (
            <>
              <ellipse cx="32" cy="19" rx="19" ry="3.5" fill="#4c1d95" />
              <polygon points="21,19 32,4 43,19" fill="#6d28d9" />
              <circle cx="32" cy="12" r="1.8" fill="#fde047" />
            </>
          )}
          {palette.accessory === 'chef' && (
            <>
              <path d="M21 19 C16 11, 26 7, 32 9 C38 7, 48 11, 43 19 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
              <rect x="22" y="16" width="20" height="4" rx="1" fill="#f8fafc" />
            </>
          )}
          {palette.accessory === 'astronaut' && (
            <circle cx="32" cy="28" r="17" fill="none" stroke="#e2e8f0" strokeWidth="3.2" />
          )}
          {palette.accessory === 'pharaoh' && (
            <>
              <path d="M16 38 L20 15 Q32 10 44 15 L48 38 L42 38 L42 20 Q32 16 22 20 L22 38 Z" fill="#f59e0b" />
              <path d="M20 22 H44 M18 28 H22 M42 28 H46" stroke="#1d4ed8" strokeWidth="2.2" />
            </>
          )}
          {palette.accessory === 'mohawk' && (
            <path d="M29 17 L32 6 L35 17 Z" fill="#ec4899" stroke="#facc15" strokeWidth="1.2" />
          )}
          {palette.accessory === 'beret' && (
            <>
              <ellipse cx="30" cy="15" rx="15" ry="5.5" fill="#e11d48" transform="rotate(-10 30 15)" />
              <line x1="31" y1="8" x2="32" y2="11" stroke="#881337" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          {palette.accessory === 'samurai' && (
            <>
              <path d="M17 20 C17 11, 47 11, 47 20 Z" fill="#7f1d1d" />
              <path d="M24 14 L32 7 L40 14" stroke="#facc15" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </>
          )}
          {palette.accessory === 'aviator' && (
            <>
              <path d="M18 19 C18 11, 46 11, 46 19 Z" fill="#1e3a8a" />
              <rect x="20" y="18" width="24" height="3" fill="#facc15" />
            </>
          )}

          {/* Facial Expression by Mood */}
          {isRobot ? (
            <>
              <circle cx="26.5" cy="28" r="2.6" fill={activeMood === 'last' ? '#fb7185' : '#38bdf8'} />
              <circle cx="37.5" cy="28" r="2.6" fill={activeMood === 'last' ? '#fb7185' : '#38bdf8'} />
              <rect x="25" y="35" width="14" height="3" rx="1.5" fill="#0f172a" />
            </>
          ) : activeMood === 'winner' ? (
            <>
              <path d="M23.5 29.5 Q26.5 25.5 29.5 29.5" stroke="#1e1b2e" strokeWidth="2.3" strokeLinecap="round" fill="none" />
              <path d="M34.5 29.5 Q37.5 25.5 40.5 29.5" stroke="#1e1b2e" strokeWidth="2.3" strokeLinecap="round" fill="none" />
              <circle cx="23" cy="33" r="2.2" fill="#fb7185" opacity="0.55" />
              <circle cx="41" cy="33" r="2.2" fill="#fb7185" opacity="0.55" />
              {palette.accessory !== 'ninja' && (
                <>
                  <path d="M26 34.5 Q32 42 38 34.5 Z" fill="#991b1b" stroke="#7c2d12" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M29 38.2 Q32 39.8 35 38.2" fill="#fb7185" />
                </>
              )}
            </>
          ) : activeMood === 'middle' ? (
            <>
              <circle cx="26.5" cy="29" r="2.2" fill="#1e1b2e" />
              <circle cx="37.5" cy="29" r="2.2" fill="#1e1b2e" />
              <circle cx="27.2" cy="28.3" r="0.7" fill="#ffffff" />
              <circle cx="38.2" cy="28.3" r="0.7" fill="#ffffff" />
              <circle cx="22.8" cy="33" r="1.9" fill="#fb7185" opacity="0.4" />
              <circle cx="41.2" cy="33" r="1.9" fill="#fb7185" opacity="0.4" />
              {palette.accessory !== 'ninja' && (
                <path d="M26.5 34.8 Q32 40.2 37.5 34.8" stroke="#7c2d12" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              )}
            </>
          ) : activeMood === 'last' ? (
            <>
              <path d="M23 26.2 L29 24.4" stroke="#451a03" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M41 26.2 L35 24.4" stroke="#451a03" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M24 28 L29 29.8 L24 31.4" stroke="#1e1b2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M40 28 L35 29.8 L40 31.4" stroke="#1e1b2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M44 21 C45.8 23.8, 45.8 26.2, 44 26.2 C42.2 26.2, 42.2 23.8, 44 21 Z" fill="#38bdf8" className="animate-sweat-drop" />
              <rect x="24.5" y="31.5" width="3" height="6.5" rx="1.5" fill="#38bdf8" opacity="0.85" />
              <rect x="36.5" y="31.5" width="3" height="6.5" rx="1.5" fill="#38bdf8" opacity="0.85" />
              <circle cx="26" cy="36" r="1.7" fill="#7dd3fc" className="animate-tear-drop" />
              <circle cx="38" cy="36" r="1.7" fill="#7dd3fc" className="animate-tear-drop" style={{ animationDelay: '0.45s' }} />
              {palette.accessory !== 'ninja' && (
                <path d="M27.5 38 Q32 33.8 36.5 38" stroke="#7c2d12" strokeWidth="2.1" strokeLinecap="round" fill="none" />
              )}
            </>
          ) : (
            <>
              <circle cx="26.5" cy="29" r="2.2" fill="#1e1b2e" />
              <circle cx="37.5" cy="29" r="2.2" fill="#1e1b2e" />
              <circle cx="27.2" cy="28.3" r="0.7" fill="#ffffff" />
              <circle cx="38.2" cy="28.3" r="0.7" fill="#ffffff" />
              {palette.accessory !== 'ninja' && (
                <path d="M27.5 35.5 Q32 39.5 36.5 35.5" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" fill="none" />
              )}
            </>
          )}

          {(palette.accessory === 'glasses' || palette.accessory === 'aviator') && (
            <g stroke="#1e293b" strokeWidth="1.8" fill={palette.accessory === 'aviator' ? 'rgba(15,23,42,0.55)' : 'none'}>
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
