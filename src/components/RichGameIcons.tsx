import React, { useId } from 'react';
import { ArcadeGameId, FootballGameId, GameId, SpyIconType } from '../types/game';

export type RichGameIconKind = GameId | FootballGameId | ArcadeGameId | SpyIconType;

interface IconProps {
  className?: string;
}

export const RichTrophyIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_5px_rgba(120,53,15,0.38)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`gold_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id={`cup_${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Handles */}
      <path d="M13 13 H7 C5 13 5 24 12 26" fill="none" stroke={`url(#gold_${uid})`} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M35 13 H41 C43 13 43 24 36 26" fill="none" stroke={`url(#gold_${uid})`} strokeWidth="3.2" strokeLinecap="round" />
      {/* Cup body */}
      <path d="M13 9 H35 V21 C35 28.5 30 33 24 33 C18 33 13 28.5 13 21 Z" fill={`url(#gold_${uid})`} stroke="#78350F" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 11 H23 V22 C23 26 20 29 18 29 C16.5 29 16 25 16 21 Z" fill={`url(#cup_${uid})`} />
      {/* Stem & base */}
      <rect x="21" y="32" width="6" height="6" fill="#D97706" stroke="#78350F" strokeWidth="1.5" />
      <rect x="14" y="38" width="20" height="5" rx="2.5" fill={`url(#gold_${uid})`} stroke="#78350F" strokeWidth="1.6" />
      {/* Star */}
      <path d="M24 14 L25.8 18 L30 18.5 L26.9 21.3 L27.7 25.5 L24 23.4 L20.3 25.5 L21.1 21.3 L18 18.5 L22.2 18 Z" fill="#FFFBEB" />
    </svg>
  );
};

export const RichPartyIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_5px_rgba(0,0,0,0.28)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`maskA_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={`maskB_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFE4E6" />
        </linearGradient>
      </defs>
      {/* Back card / mask */}
      <path d="M21 10 C28 10 38 12 40 15 V25 C40 32 34 37 29 37 C24 37 19 32 19 25 V15 Z" fill={`url(#maskA_${uid})`} stroke="#7C2D12" strokeWidth="1.8" />
      <circle cx="26" cy="21" r="2" fill="#7C2D12" />
      <circle cx="34" cy="21" r="2" fill="#7C2D12" />
      <path d="M26 27 Q30 31 34 27" fill="none" stroke="#7C2D12" strokeWidth="2" strokeLinecap="round" />
      {/* Front mask */}
      <path d="M8 16 C12 13 24 13 28 16 V27 C28 34 23 40 18 40 C13 40 8 34 8 27 Z" fill={`url(#maskB_${uid})`} stroke="#9F1239" strokeWidth="1.9" />
      <circle cx="14" cy="24" r="2.2" fill="#E11D48" />
      <circle cx="22" cy="24" r="2.2" fill="#E11D48" />
      <path d="M13 30 Q18 35 23 30" fill="none" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" />
      {/* Sparkle */}
      <path d="M39 7 L40.5 10.5 L44 12 L40.5 13.5 L39 17 L37.5 13.5 L34 12 L37.5 10.5 Z" fill="#FEF08A" />
    </svg>
  );
};

export const RichArcadeIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_5px_rgba(0,0,0,0.3)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`pad_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <path
        d="M11 16 C15 14 33 14 37 16 L42 30 C43 35 38 39 34 36 L29 31 H19 L14 36 C10 39 5 35 6 30 Z"
        fill={`url(#pad_${uid})`}
        stroke="#0F172A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Gloss rim */}
      <path d="M13 18 H35" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      {/* D-Pad */}
      <rect x="13" y="20" width="4" height="10" rx="1.2" fill="#0F172A" />
      <rect x="10" y="23" width="10" height="4" rx="1.2" fill="#0F172A" />
      {/* Colored ABXY buttons */}
      <circle cx="34" cy="21" r="2.3" fill="#F43F5E" />
      <circle cx="38" cy="25" r="2.3" fill="#F59E0B" />
      <circle cx="30" cy="25" r="2.3" fill="#3B82F6" />
      <circle cx="34" cy="29" r="2.3" fill="#10B981" />
      {/* Center lightning */}
      <circle cx="24" cy="23" r="2" fill="#0D9488" />
    </svg>
  );
};

export const RichFootballBallIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_6px_rgba(0,0,0,0.34)]`} aria-hidden="true">
      <defs>
        <radialGradient id={`ball_${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="68%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#64748B" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill={`url(#ball_${uid})`} stroke="#0F172A" strokeWidth="2.2" />
      <polygon points="24,16 31,21 28,29 20,29 17,21" fill="#0F172A" />
      <path d="M24 16 V7 M31 21 L40 17 M28 29 L34 39 M20 29 L14 39 M17 21 L8 17" stroke="#0F172A" strokeWidth="2" />
      <polygon points="24,6 28,9 20,9" fill="#0F172A" />
      <polygon points="41,17 41,23 37,19" fill="#0F172A" />
      <polygon points="7,17 11,19 7,23" fill="#0F172A" />
      {/* Specular shine */}
      <ellipse cx="17" cy="14" rx="5" ry="2.5" transform="rotate(-25 17 14)" fill="#FFFFFF" opacity="0.7" />
    </svg>
  );
};

export const RichPenSparkIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
      <defs>
        <linearGradient id={`pen_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <path d="M31 7 L41 17 L19 39 L8 40 L9 29 Z" fill={`url(#pen_${uid})`} stroke="#0F172A" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M27 11 L37 21" stroke="#FDE047" strokeWidth="3.5" />
      <path d="M9 29 L19 39 L8 40 Z" fill="#FDE047" stroke="#0F172A" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 9 L14.5 13 L18.5 14.5 L14.5 16 L13 20 L11.5 16 L7.5 14.5 L11.5 13 Z" fill="#F59E0B" />
    </svg>
  );
};

export const RichRulesBookIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
      <defs>
        <linearGradient id={`book_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path d="M6 12 C12 9 20 10 24 14 C28 10 36 9 42 12 V37 C36 34 28 35 24 39 C20 35 12 34 6 37 Z" fill={`url(#book_${uid})`} stroke="#7C2D12" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 14 V39" stroke="#7C2D12" strokeWidth="2" />
      <line x1="11" y1="19" x2="19" y2="19" stroke="#FFFBEB" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="11" y1="25" x2="19" y2="25" stroke="#FFFBEB" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="29" y1="19" x2="37" y2="19" stroke="#FFFBEB" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M31 11 V23 L34 20.5 L37 23 V11 Z" fill="#E11D48" stroke="#7C2D12" strokeWidth="1.2" />
    </svg>
  );
};

export const RichResetBrushIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
      <defs>
        <linearGradient id={`rst_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#FF6B4A" />
        </linearGradient>
      </defs>
      <path d="M12 22 A13 13 0 1 1 16 34" fill="none" stroke={`url(#rst_${uid})`} strokeWidth="4.5" strokeLinecap="round" />
      <polygon points="7,17 17,17 12,26" fill="#FF6B4A" />
      <circle cx="24" cy="24" r="4.5" fill="#F59E0B" />
    </svg>
  );
};

export const RichDicePairIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
      <defs>
        <linearGradient id={`dice_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>
      </defs>
      <rect x="6" y="13" width="22" height="22" rx="6" transform="rotate(-10 17 24)" fill={`url(#dice_${uid})`} stroke="#0F172A" strokeWidth="2" />
      <circle cx="13" cy="19" r="2.2" fill="#E11D48" />
      <circle cx="21" cy="28" r="2.2" fill="#E11D48" />
      <rect x="20" y="15" width="22" height="22" rx="6" transform="rotate(10 31 26)" fill={`url(#dice_${uid})`} stroke="#0F172A" strokeWidth="2" />
      <circle cx="27" cy="21" r="2" fill="#0F172A" />
      <circle cx="35" cy="21" r="2" fill="#0F172A" />
      <circle cx="31" cy="26" r="2" fill="#F59E0B" />
      <circle cx="27" cy="31" r="2" fill="#0F172A" />
      <circle cx="35" cy="31" r="2" fill="#0F172A" />
    </svg>
  );
};

export const RichSoundIcon: React.FC<{ muted: boolean; className?: string }> = ({
  muted,
  className = 'w-5 h-5',
}) => (
  <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
    <path
      d="M8 19 H16 L27 10 V38 L16 29 H8 Z"
      fill={muted ? '#F43F5E' : '#14B8A6'}
      stroke="#0F172A"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    {muted ? (
      <>
        <line x1="32" y1="18" x2="42" y2="30" stroke="#E11D48" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="42" y1="18" x2="32" y2="30" stroke="#E11D48" strokeWidth="3.5" strokeLinecap="round" />
      </>
    ) : (
      <>
        <path d="M32 18 Q37 24 32 30" fill="none" stroke="#0D9488" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 13 Q44 24 36 35" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
      </>
    )}
  </svg>
);

export const RichThemeIcon: React.FC<{ isDark: boolean; className?: string }> = ({
  isDark,
  className = 'w-5 h-5',
}) =>
  isDark ? (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
      <circle cx="24" cy="24" r="10" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
      <circle cx="21" cy="21" r="4" fill="#FEF08A" opacity="0.8" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="24"
          y1="6"
          x2="24"
          y2="10"
          stroke="#F59E0B"
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
    </svg>
  ) : (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
      <path
        d="M31 10 A15 15 0 1 0 38 31 A12 12 0 1 1 31 10 Z"
        fill="#6366F1"
        stroke="#1E293B"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M35 12 L36.5 15 L39.5 16.5 L36.5 18 L35 21 L33.5 18 L30.5 16.5 L33.5 15 Z" fill="#FBBF24" />
    </svg>
  );

export const RichGameVectorIcon: React.FC<{
  kind: RichGameIconKind;
  className?: string;
}> = ({ kind, className = 'w-9 h-9' }) => {
  const uid = useId();

  switch (kind) {
    // ---- Party Games ----
    case 'spy':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`spyHat_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id={`spyLens_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          {/* Fedora Hat */}
          <path d="M13 21 L17 9 C18 7 22 8 24 9.5 C26 8 30 7 31 9 L35 21 Z" fill={`url(#spyHat_${uid})`} stroke="#FFFFFF" strokeWidth="1.5" />
          <rect x="14" y="18" width="20" height="3.2" fill="#EC4899" />
          <ellipse cx="24" cy="22" rx="18" ry="3.2" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.4" />
          {/* Spy Sunglasses */}
          <rect x="9" y="27" width="13" height="9" rx="4" fill={`url(#spyLens_${uid})`} stroke="#FFFFFF" strokeWidth="1.6" />
          <rect x="26" y="27" width="13" height="9" rx="4" fill={`url(#spyLens_${uid})`} stroke="#FFFFFF" strokeWidth="1.6" />
          <line x1="22" y1="30" x2="26" y2="30" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="12" y1="29.5" x2="17" y2="29.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <line x1="29" y1="29.5" x2="34" y2="29.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        </svg>
      );

    case 'bomb_questions':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]`} aria-hidden="true">
          <defs>
            <radialGradient id={`bq_${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="65%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
          </defs>
          <path d="M29 14 Q34 7 40 10" fill="none" stroke="#FDE047" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="40" cy="10" r="4" fill="#F97316" />
          <circle cx="40" cy="10" r="2" fill="#FEF08A" />
          <rect x="20" y="13" width="8" height="5" rx="1.5" fill="#94A3B8" stroke="#0F172A" strokeWidth="1.5" />
          <circle cx="24" cy="29" r="13.5" fill={`url(#bq_${uid})`} stroke="#FFFFFF" strokeWidth="1.6" />
          <ellipse cx="18" cy="23" rx="3.5" ry="2" transform="rotate(-30 18 23)" fill="#FFFFFF" opacity="0.35" />
          <text x="24" y="34" textAnchor="middle" fill="#FDE047" fontSize="15" fontWeight="900">؟</text>
        </svg>
      );

    case 'bomb_classic':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]`} aria-hidden="true">
          <defs>
            <radialGradient id={`bc_${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#7F1D1D" />
            </radialGradient>
          </defs>
          <path d="M27 14 Q32 7 38 11" fill="none" stroke="#FDE047" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M39 5 L40.5 9.5 L45 11 L40.5 12.5 L39 17 L37.5 12.5 L33 11 L37.5 9.5 Z" fill="#FEF08A" />
          <rect x="20" y="13" width="8" height="5" rx="1.5" fill="#FBBF24" stroke="#78350F" strokeWidth="1.5" />
          <circle cx="24" cy="29" r="13.5" fill={`url(#bc_${uid})`} stroke="#FFFFFF" strokeWidth="1.7" />
          <ellipse cx="18" cy="23" rx="4" ry="2.2" transform="rotate(-30 18 23)" fill="#FFFFFF" opacity="0.55" />
          <path d="M18 33 L24 27 L30 33" fill="none" stroke="#FEF08A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'draw':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`pal_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFBEB" />
              <stop offset="100%" stopColor="#FDE68A" />
            </linearGradient>
          </defs>
          <path
            d="M24 8 C14 8 7 15 7 24 C7 33 14 40 23 40 C26.5 40 28 37.5 27 35 C26 32.5 28 30 31 30 H34 C38.5 30 41 27 41 22 C41 14 33 8 24 8 Z"
            fill={`url(#pal_${uid})`}
            stroke="#0F172A"
            strokeWidth="1.8"
          />
          <circle cx="17" cy="19" r="3" fill="#EF4444" />
          <circle cx="25" cy="15" r="3" fill="#3B82F6" />
          <circle cx="33" cy="20" r="3" fill="#10B981" />
          <circle cx="15" cy="28" r="3" fill="#F59E0B" />
          <circle cx="22" cy="33" r="2.6" fill="#EC4899" />
          {/* Brush */}
          <path d="M32 37 L42 14" stroke="#78350F" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="42" cy="13" r="3" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.2" />
        </svg>
      );

    case 'forger':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <circle cx="22" cy="27" r="13" fill="#FEF3C7" stroke="#0F172A" strokeWidth="1.8" />
          {/* Artist beret */}
          <path d="M9 19 C11 11 29 9 34 17 Z" fill="#F43F5E" stroke="#0F172A" strokeWidth="1.6" />
          <line x1="22" y1="9" x2="23" y2="13" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
          {/* Mischief mask */}
          <path d="M12 24 H32 C32 29 27 31 24 27 C21 31 12 29 12 24 Z" fill="#0F172A" />
          <circle cx="18" cy="26" r="1.7" fill="#34D399" />
          <circle cx="27" cy="26" r="1.7" fill="#34D399" />
          {/* Pencil */}
          <path d="M30 39 L41 25" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );

    case 'court':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`scl_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <line x1="24" y1="9" x2="24" y2="37" stroke={`url(#scl_${uid})`} strokeWidth="3.2" strokeLinecap="round" />
          <rect x="15" y="37" width="18" height="4.5" rx="2.2" fill={`url(#scl_${uid})`} />
          <line x1="10" y1="15" x2="38" y2="15" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M10 15 L6 26 H14 Z" fill="none" stroke="#FEF08A" strokeWidth="1.6" />
          <path d="M5 26 A5 5 0 0 0 15 26 Z" fill={`url(#scl_${uid})`} />
          <path d="M38 15 L34 26 H42 Z" fill="none" stroke="#FEF08A" strokeWidth="1.6" />
          <path d="M33 26 A5 5 0 0 0 43 26 Z" fill={`url(#scl_${uid})`} />
          <circle cx="24" cy="15" r="3" fill="#FFFFFF" />
        </svg>
      );

    case 'headsup':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`hu_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#FB7185" />
            </linearGradient>
          </defs>
          {/* Head / forehead card */}
          <circle cx="24" cy="27" r="14" fill="#FFFBEB" stroke="#0F172A" strokeWidth="2" />
          <rect x="11" y="9" width="26" height="14" rx="4" fill={`url(#hu_${uid})`} stroke="#FFFFFF" strokeWidth="1.8" />
          <line x1="17" y1="16" x2="31" y2="16" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="19" cy="29" r="2" fill="#0F172A" />
          <circle cx="29" cy="29" r="2" fill="#0F172A" />
          <path d="M19 34 Q24 38 29 34" fill="none" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // ---- Football Hub Games ----
    case 'football_spy':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <circle cx="24" cy="24" r="16" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <polygon points="24,15 30,19 28,26 20,26 18,19" fill="#0F172A" opacity="0.25" />
          {/* Spy visor */}
          <rect x="8" y="18" width="14" height="9" rx="3.5" fill="#EC4899" stroke="#0F172A" strokeWidth="1.8" />
          <rect x="26" y="18" width="14" height="9" rx="3.5" fill="#EC4899" stroke="#0F172A" strokeWidth="1.8" />
          <line x1="22" y1="21" x2="26" y2="21" stroke="#0F172A" strokeWidth="2.2" />
          <line x1="11" y1="20.5" x2="17" y2="20.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="29" y1="20.5" x2="35" y2="20.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'football_password':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`fp_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="24" r="9.5" fill={`url(#fp_${uid})`} stroke="#78350F" strokeWidth="2" />
          <circle cx="16" cy="24" r="3.5" fill="#065F46" />
          <path d="M25 24 H42 V30 H37 V27 H33 V31 H29 V24" fill={`url(#fp_${uid})`} stroke="#78350F" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );

    case 'football_chain':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`jsy_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <path d="M16 10 L8 15 L11 23 L16 20 V39 H32 V20 L37 23 L40 15 L32 10 Q24 14 16 10 Z" fill={`url(#jsy_${uid})`} stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
          <text x="24" y="30" textAnchor="middle" fill="#FEF08A" fontSize="13" fontWeight="900">10</text>
        </svg>
      );

    case 'football_three':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <path d="M24 7 L26.5 13 L33 13.8 L28.2 18.2 L29.5 24.5 L24 21.3 L18.5 24.5 L19.8 18.2 L15 13.8 L21.5 13 Z" fill="#FEF08A" stroke="#B45309" strokeWidth="1.4" />
          <path d="M12 24 L13.8 28.5 L18.5 29 L15 32.2 L16 37 L12 34.5 L8 37 L9 32.2 L5.5 29 L10.2 28.5 Z" fill="#FDE047" />
          <path d="M36 24 L37.8 28.5 L42.5 29 L39 32.2 L40 37 L36 34.5 L32 37 L33 32.2 L29.5 29 L34.2 28.5 Z" fill="#FDE047" />
          <circle cx="24" cy="34" r="6" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.6" />
        </svg>
      );

    case 'football_charades':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <rect x="17" y="8" width="14" height="20" rx="7" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <line x1="20" y1="15" x2="28" y2="15" stroke="#FB7185" strokeWidth="2" strokeLinecap="round" />
          <line x1="20" y1="20" x2="28" y2="20" stroke="#FB7185" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 22 A12 12 0 0 0 36 22" fill="none" stroke="#FDE047" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="24" y1="34" x2="24" y2="41" stroke="#FDE047" strokeWidth="3" />
          <line x1="17" y1="41" x2="31" y2="41" stroke="#FDE047" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case 'football_penalty':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <path d="M8 34 V12 H40 V34" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="12" x2="16" y2="30" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.55" />
          <line x1="24" y1="12" x2="24" y2="30" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.55" />
          <line x1="32" y1="12" x2="32" y2="30" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.55" />
          <circle cx="24" cy="29" r="7.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.8" />
          <polygon points="24,25 27.5,27.5 26,31.5 22,31.5 20.5,27.5" fill="#0F172A" />
          <path d="M11 38 L18 33" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'football_auction':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`gav_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          <rect x="13" y="10" width="18" height="10" rx="3" transform="rotate(-35 22 15)" fill={`url(#gav_${uid})`} stroke="#78350F" strokeWidth="1.8" />
          <line x1="24" y1="18" x2="39" y2="33" stroke="#FDE68A" strokeWidth="4.2" strokeLinecap="round" />
          <rect x="9" y="35" width="22" height="6" rx="2.5" fill={`url(#gav_${uid})`} stroke="#78350F" strokeWidth="1.6" />
        </svg>
      );

    case 'football_tictactoe':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <rect x="7" y="7" width="34" height="34" rx="7" fill="#FFFFFF" fillOpacity="0.16" stroke="#FFFFFF" strokeWidth="1.8" />
          <line x1="19" y1="9" x2="19" y2="39" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="29" y1="9" x2="29" y2="39" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="9" y1="19" x2="39" y2="19" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="9" y1="29" x2="39" y2="29" stroke="#FFFFFF" strokeWidth="2" />
          {/* X */}
          <line x1="11" y1="11" x2="16.5" y2="16.5" stroke="#FB7185" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="16.5" y1="11" x2="11" y2="16.5" stroke="#FB7185" strokeWidth="2.8" strokeLinecap="round" />
          {/* O */}
          <circle cx="24" cy="24" r="3.4" fill="none" stroke="#FEF08A" strokeWidth="2.6" />
          {/* X */}
          <line x1="31.5" y1="31.5" x2="37" y2="37" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="37" y1="31.5" x2="31.5" y2="37" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );

    // ---- 2D Arcade Games ----
    case 'paint':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`rol_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
          <rect x="8" y="9" width="26" height="12" rx="4" fill={`url(#rol_${uid})`} stroke="#FFFFFF" strokeWidth="1.8" />
          <path d="M12 21 V26 A2 2 0 0 0 16 26 V21 Z" fill="#FDE047" />
          <path d="M34 15 H38 V23 L24 27 V32" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="21" y="31" width="6" height="11" rx="2.5" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.5" />
        </svg>
      );

    case 'knife':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <circle cx="24" cy="24" r="14" fill="#92400E" stroke="#FDE68A" strokeWidth="2.4" />
          <circle cx="24" cy="24" r="8" fill="#B45309" stroke="#FDE68A" strokeWidth="1.5" />
          {/* Blade 1 */}
          <path d="M8 38 L18 28" stroke="#F43F5E" strokeWidth="4" strokeLinecap="round" />
          <path d="M18 28 L34 12 L37 9 L30 10 L15 25 Z" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.4" />
          {/* Blade 2 */}
          <path d="M40 38 L30 28" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
          <path d="M30 28 L14 12 L11 9 L18 10 L33 25 Z" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.4" />
        </svg>
      );

    case 'frog':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <circle cx="24" cy="27" r="14.5" fill="#22C55E" stroke="#0F172A" strokeWidth="2.4" />
          <ellipse cx="24" cy="31" rx="9" ry="6" fill="#86EFAC" />
          <circle cx="16" cy="15" r="5.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.2" />
          <circle cx="32" cy="15" r="5.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.2" />
          <circle cx="16" cy="15" r="2.2" fill="#0F172A" />
          <circle cx="32" cy="15" r="2.2" fill="#0F172A" />
          <path d="M16 28 Q24 34 32 28" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M24 31 L36 22" stroke="#FB7185" strokeWidth="3" strokeLinecap="round" />
          <circle cx="38" cy="20" r="3" fill="#FDE047" stroke="#0F172A" strokeWidth="1.2" />
        </svg>
      );

    case 'birds':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <ellipse cx="23" cy="26" rx="13" ry="11" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M14 25 Q18 17 26 24 Q20 31 14 25 Z" fill="#BAE6FD" />
          <circle cx="29" cy="22" r="3.6" fill="#FFFFFF" />
          <circle cx="30" cy="22" r="1.7" fill="#0F172A" />
          <polygon points="35,23 44,26 35,29" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.4" />
          <path d="M12 12 L13.5 15 L16.5 16.5 L13.5 18 L12 21 L10.5 18 L7.5 16.5 L10.5 15 Z" fill="#FDE047" />
        </svg>
      );

    case 'racing':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <rect x="8" y="13" width="6" height="9" rx="2" fill="#0F172A" />
          <rect x="34" y="13" width="6" height="9" rx="2" fill="#0F172A" />
          <rect x="8" y="29" width="6" height="9" rx="2" fill="#0F172A" />
          <rect x="34" y="29" width="6" height="9" rx="2" fill="#0F172A" />
          <rect x="13" y="8" width="22" height="32" rx="8" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.8" />
          <rect x="17" y="15" width="14" height="10" rx="3" fill="#38BDF8" stroke="#0F172A" strokeWidth="1.4" />
          <rect x="21" y="8" width="6" height="32" fill="#FDE047" opacity="0.85" />
          <circle cx="17" cy="11" r="2" fill="#FEF08A" />
          <circle cx="31" cy="11" r="2" fill="#FEF08A" />
        </svg>
      );

    case 'chicken':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <ellipse cx="23" cy="27" rx="13" ry="11" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
          <path d="M18 16 C18 11 22 10 24 13 C26 10 29 12 28 16 Z" fill="#EF4444" stroke="#0F172A" strokeWidth="1.6" />
          <polygon points="34,24 43,27 34,30" fill="#F97316" stroke="#0F172A" strokeWidth="1.6" />
          <circle cx="28" cy="23.5" r="2.2" fill="#0F172A" />
          <path d="M14 27 Q19 23 23 28" fill="none" stroke="#CBD5E1" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    case 'soccer':
      return <RichFootballBallIcon className={className} />;

    case 'stickman':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]`} aria-hidden="true">
          <line x1="8" y1="38" x2="36" y2="10" stroke="#38BDF8" strokeWidth="4.2" strokeLinecap="round" />
          <line x1="40" y1="38" x2="12" y2="10" stroke="#FB923C" strokeWidth="4.2" strokeLinecap="round" />
          <circle cx="24" cy="14" r="5.5" fill="#FACC15" stroke="#0F172A" strokeWidth="2" />
          <line x1="24" y1="19" x2="24" y2="30" stroke="#FACC15" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="24" y1="30" x2="17" y2="40" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
          <line x1="24" y1="30" x2="31" y2="40" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="24" r="2.8" fill="#FFFFFF" />
        </svg>
      );

    case 'balance':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]`} aria-hidden="true">
          <rect x="7" y="31" width="34" height="6" rx="3" fill="#F59E0B" stroke="#0F172A" strokeWidth="2" transform="rotate(-7 24 34)" />
          <rect x="14" y="15" width="20" height="15" rx="4.5" fill="#60A5FA" stroke="#FFFFFF" strokeWidth="1.8" />
          <circle cx="20" cy="21" r="2" fill="#0F172A" />
          <circle cx="28" cy="21" r="2" fill="#0F172A" />
          <path d="M21 25 Q24 27.5 27 25" fill="none" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 41 Q16 38 24 41 Q32 44 40 41" fill="none" stroke="#BAE6FD" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    // ---- Spy Category Icons ----
    case 'places':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <polygon points="8,36 20,15 32,36" fill="#FDE047" stroke="#0F172A" strokeWidth="1.8" strokeLinejoin="round" />
          <polygon points="22,36 32,20 42,36" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M24 9 C19.5 9 17 12.5 17 16.5 C17 22 24 29 24 29 C24 29 31 22 31 16.5 C31 12.5 28.5 9 24 9 Z" fill="#FB7185" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle cx="24" cy="16.5" r="2.8" fill="#FFFFFF" />
        </svg>
      );

    case 'food':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M10 22 C10 13 38 13 38 22 Z" fill="#FBBF24" stroke="#FFFFFF" strokeWidth="1.6" />
          <path d="M8 26 Q16 22 24 26 Q32 30 40 26" fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="10" y="29" width="28" height="5" rx="2.5" fill="#9A3412" />
          <rect x="11" y="34" width="26" height="5.5" rx="3" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.4" />
        </svg>
      );

    case 'movies':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <rect x="9" y="19" width="30" height="20" rx="4" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.8" />
          <path d="M9 19 L38 11 L36 6 L7 14 Z" fill="#F43F5E" stroke="#FFFFFF" strokeWidth="1.5" />
          <polygon points="21,24 31,29 21,34" fill="#FDE047" />
        </svg>
      );

    case 'sports':
      return <RichFootballBallIcon className={className} />;

    case 'jobs':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M18 14 V10 H30 V14" fill="none" stroke="#FDE047" strokeWidth="2.8" />
          <rect x="8" y="14" width="32" height="24" rx="5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.8" />
          <line x1="8" y1="24" x2="40" y2="24" stroke="#FFFFFF" strokeWidth="1.8" />
          <rect x="21" y="21" width="6" height="6" rx="1.5" fill="#FEF08A" />
        </svg>
      );

    case 'animals':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <ellipse cx="24" cy="30" rx="10" ry="8.5" fill="#FFFFFF" />
          <circle cx="13" cy="20" r="4" fill="#FDE047" />
          <circle cx="20" cy="14" r="4" fill="#FDE047" />
          <circle cx="28" cy="14" r="4" fill="#FDE047" />
          <circle cx="35" cy="20" r="4" fill="#FDE047" />
        </svg>
      );

    case 'countries':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <circle cx="24" cy="24" r="16" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M14 17 Q20 14 23 20 Q20 26 15 24 Z" fill="#4ADE80" />
          <path d="M27 16 Q34 19 32 28 Q27 32 25 25 Z" fill="#4ADE80" />
          <ellipse cx="24" cy="24" rx="16" ry="6" fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.6" />
        </svg>
      );

    case 'cars':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M8 26 L13 16 H35 L40 26 V34 H8 Z" fill="#FB7185" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M15 18 H33 L36 25 H12 Z" fill="#BAE6FD" />
          <circle cx="15" cy="35" r="4.5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle cx="33" cy="35" r="4.5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.6" />
        </svg>
      );

    case 'home':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M7 23 L24 9 L41 23" fill="none" stroke="#FDE047" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="11" y="22" width="26" height="17" rx="3" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.6" />
          <rect x="20" y="28" width="8" height="11" rx="1.5" fill="#A855F7" />
        </svg>
      );

    case 'gaming':
      return <RichArcadeIcon className={className} />;

    case 'fruits':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M24 14 Q28 7 33 10 Q29 15 24 14 Z" fill="#4ADE80" />
          <circle cx="24" cy="27" r="12.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.8" />
          <ellipse cx="19" cy="22" rx="3" ry="1.8" transform="rotate(-30 19 22)" fill="#FFFFFF" opacity="0.65" />
        </svg>
      );

    case 'transport':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <rect x="9" y="11" width="30" height="24" rx="6" fill="#FDE047" stroke="#FFFFFF" strokeWidth="1.8" />
          <rect x="13" y="15" width="22" height="10" rx="2.5" fill="#0EA5E9" />
          <circle cx="15" cy="36" r="4" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="33" cy="36" r="4" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
        </svg>
      );

    case 'daily_life':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M11 20 H32 V30 C32 35.5 27.5 39 21.5 39 C15.5 39 11 35.5 11 30 Z" fill="#FFFBEB" stroke="#0F172A" strokeWidth="1.8" />
          <path d="M32 22 H36 A4 4 0 0 1 36 30 H32" fill="none" stroke="#FFFBEB" strokeWidth="2.8" />
          <path d="M17 15 Q19 11 17 8 M24 15 Q26 11 24 8" fill="none" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
};
