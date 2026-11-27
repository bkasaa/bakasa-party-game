import React, { useId } from 'react';
import { ArcadeGameId, FootballGameId, GameId, SpyIconType } from '../types/game';

interface RichIconProps {
  className?: string;
}

export type RichBadgeTone =
  | 'coral'
  | 'amber'
  | 'teal'
  | 'emerald'
  | 'royal'
  | 'pink'
  | 'crimson'
  | 'slate'
  | 'sky';

const TONE_GRADIENTS: Record<RichBadgeTone, string> = {
  coral: 'from-[#FF8A6B] via-[#FF6B4A] to-[#D94E30]',
  amber: 'from-[#FDE047] via-[#F59E0B] to-[#B45309]',
  teal: 'from-[#5EEAD4] via-[#14B8A6] to-[#0F766E]',
  emerald: 'from-[#4ADE80] via-[#16A34A] to-[#065F46]',
  royal: 'from-[#A78BFA] via-[#7C3AED] to-[#4C1D95]',
  pink: 'from-[#F472B6] via-[#EC4899] to-[#9D174D]',
  crimson: 'from-[#FB7185] via-[#E11D48] to-[#881337]',
  slate: 'from-[#64748B] via-[#334155] to-[#0F172A]',
  sky: 'from-[#7DD3FC] via-[#0EA5E9] to-[#0369A1]',
};

interface RichIconBadgeProps {
  tone?: RichBadgeTone;
  gradientClass?: string;
  size?: 'sm' | 'md' | 'lg';
  floatDelay?: number;
  disableFloat?: boolean;
  locked?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const RichIconBadge: React.FC<RichIconBadgeProps> = ({
  tone = 'coral',
  gradientClass,
  size = 'md',
  floatDelay = 0,
  disableFloat = false,
  locked = false,
  className = '',
  children,
}) => {
  const sizeCls =
    size === 'sm'
      ? 'w-10 h-10 rounded-xl'
      : size === 'lg'
        ? 'w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-2xl'
        : 'w-12 h-12 rounded-2xl';

  return (
    <div
      style={!disableFloat ? { animationDelay: `${floatDelay}s` } : undefined}
      className={`relative shrink-0 ${sizeCls} bg-gradient-to-br ${
        gradientClass ?? TONE_GRADIENTS[tone]
      } border-2 border-white/85 shadow-[0_6px_0_rgba(15,23,42,0.22),0_10px_18px_rgba(15,23,42,0.22),inset_0_2px_3px_rgba(255,255,255,0.55)] flex items-center justify-center overflow-hidden ${
        !disableFloat ? 'animate-float-icon' : ''
      } ${locked ? 'opacity-75 grayscale-[25%]' : ''} ${className}`}
    >
      {/* Top glossy glass sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-1 top-0.5 h-[44%] rounded-t-xl bg-gradient-to-b from-white/45 to-transparent"
      />
      {/* Diagonal specular highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.34),transparent_58%)]"
      />
      <div className="relative z-10 flex items-center justify-center">{children}</div>
    </div>
  );
};

// =====================================================================
// MULTI-LAYERED CUSTOM SVG ICONS
// =====================================================================

export const RichPartyIcon: React.FC<RichIconProps> = ({ className = 'w-7 h-7' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF7ED" />
          <stop offset="100%" stopColor="#FED7AA" />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {/* Back friend mask */}
      <path
        d="M8 15 C8 11 26 11 26 15 V23 C26 30 21 34 17 34 C13 34 8 30 8 23 Z"
        fill={`url(#${uid}-b)`}
        stroke="#7C2D12"
        strokeWidth="2"
      />
      <circle cx="14" cy="20" r="1.8" fill="#7C2D12" />
      <circle cx="20" cy="20" r="1.8" fill="#7C2D12" />
      <path d="M13 26 Q17 29 21 26" fill="none" stroke="#7C2D12" strokeWidth="2" strokeLinecap="round" />
      {/* Front laughing mask */}
      <path
        d="M21 18 C21 14 40 14 40 18 V27 C40 34 35 39 30.5 39 C26 39 21 34 21 27 Z"
        fill={`url(#${uid}-a)`}
        stroke="#1E293B"
        strokeWidth="2"
      />
      <path d="M25 23 Q27 21 29 23" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 23 Q34 21 36 23" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 29 Q30.5 34 35 29 Z" fill="#FB7185" stroke="#1E293B" strokeWidth="1.6" />
      {/* Spark stars */}
      <path d="M38 7 L39.5 10.5 L43 12 L39.5 13.5 L38 17 L36.5 13.5 L33 12 L36.5 10.5 Z" fill="#FEF08A" />
    </svg>
  );
};

export const RichArcadeIcon: React.FC<RichIconProps> = ({ className = 'w-7 h-7' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-pad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>
      <path
        d="M11 16 H37 C41 16 44 21 43 29 L41 35 C40 38 36 39 34 36 L30 31 H18 L14 36 C12 39 8 38 7 35 L5 29 C4 21 7 16 11 16 Z"
        fill={`url(#${uid}-pad)`}
        stroke="#0F172A"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect x="13.5" y="19.5" width="3.5" height="9" rx="1.2" fill="#0F172A" />
      <rect x="10.8" y="22.2" width="9" height="3.5" rx="1.2" fill="#0F172A" />
      <circle cx="33.5" cy="21" r="2.3" fill="#EF4444" stroke="#0F172A" strokeWidth="1.2" />
      <circle cx="37.5" cy="25" r="2.3" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.2" />
      <circle cx="29.5" cy="25" r="2.3" fill="#10B981" stroke="#0F172A" strokeWidth="1.2" />
      <circle cx="33.5" cy="29" r="2.3" fill="#3B82F6" stroke="#0F172A" strokeWidth="1.2" />
      <path d="M24 8 L25.5 11.5 L29 13 L25.5 14.5 L24 18 L22.5 14.5 L19 13 L22.5 11.5 Z" fill="#FDE047" />
    </svg>
  );
};

export const RichFootballHubIcon: React.FC<RichIconProps> = ({ className = 'w-7 h-7' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-ball`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </radialGradient>
      </defs>
      {/* Stadium glow ring */}
      <circle cx="24" cy="24" r="19" fill="#065F46" opacity="0.35" />
      <circle cx="24" cy="24" r="15.5" fill={`url(#${uid}-ball)`} stroke="#0F172A" strokeWidth="2.2" />
      <polygon points="24,16 30,20.5 27.8,27.5 20.2,27.5 18,20.5" fill="#1E293B" />
      <path d="M24 16 V9 M30 20.5 L37 18 M27.8 27.5 L32 35 M20.2 27.5 L16 35 M18 20.5 L11 18" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="18" cy="15" rx="4" ry="2" fill="#FFFFFF" opacity="0.7" transform="rotate(-25 18 15)" />
    </svg>
  );
};

export const RichTrophyIcon: React.FC<RichIconProps> = ({ className = 'w-6 h-6' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.24)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <path d="M14 12 H7 C5.5 12 5 19 9 22 C11 23.5 13 23.5 14.5 23" fill="none" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
      <path d="M34 12 H41 C42.5 12 43 19 39 22 C37 23.5 35 23.5 33.5 23" fill="none" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 9 H35 V21 C35 28 30 33 24 33 C18 33 13 28 13 21 Z" fill={`url(#${uid}-gold)`} stroke="#78350F" strokeWidth="2.2" />
      <rect x="21" y="32" width="6" height="7" fill={`url(#${uid}-gold)`} stroke="#78350F" strokeWidth="1.8" />
      <rect x="15" y="38" width="18" height="5" rx="2.5" fill="#78350F" />
      <path d="M24 14 L25.6 18 L29.8 18.4 L26.6 21.1 L27.6 25.2 L24 23 L20.4 25.2 L21.4 21.1 L18.2 18.4 L22.4 18 Z" fill="#FFFBEB" />
    </svg>
  );
};

export const RichDiceIcon: React.FC<RichIconProps> = ({ className = 'w-6 h-6' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_3px_rgba(0,0,0,0.22)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-die1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id={`${uid}-die2`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF8A6B" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
      </defs>
      <g transform="rotate(-12 17 20)">
        <rect x="6" y="9" width="22" height="22" rx="5" fill={`url(#${uid}-die1)`} stroke="#0F172A" strokeWidth="2.2" />
        <circle cx="12.5" cy="15.5" r="2.2" fill="#0F172A" />
        <circle cx="21.5" cy="24.5" r="2.2" fill="#0F172A" />
        <circle cx="17" cy="20" r="2.2" fill="#E11D48" />
      </g>
      <g transform="rotate(10 31 28)">
        <rect x="20" y="17" width="22" height="22" rx="5" fill={`url(#${uid}-die2)`} stroke="#0F172A" strokeWidth="2.2" />
        <circle cx="26" cy="23" r="2.1" fill="#FFFFFF" />
        <circle cx="36" cy="23" r="2.1" fill="#FFFFFF" />
        <circle cx="26" cy="33" r="2.1" fill="#FFFFFF" />
        <circle cx="36" cy="33" r="2.1" fill="#FFFFFF" />
      </g>
    </svg>
  );
};

export const RichPenIcon: React.FC<RichIconProps> = ({ className = 'w-5 h-5' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-pen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      <path d="M12 36 L14 25 L32 7 L41 16 L23 34 Z" fill={`url(#${uid}-pen)`} stroke="#0F172A" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M28 11 L37 20" stroke="#FDE047" strokeWidth="3.5" />
      <path d="M12 36 L19 34 L14 29 Z" fill="#FDE68A" stroke="#0F172A" strokeWidth="1.6" />
      <path d="M9 11 L11 15 L15 17 L11 19 L9 23 L7 19 L3 17 L7 15 Z" fill="#F59E0B" />
    </svg>
  );
};

export const RichBookRulesIcon: React.FC<RichIconProps> = ({ className = 'w-5 h-5' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-sm`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bk`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path d="M8 11 C15 9 21 11 24 14 C27 11 33 9 40 11 V36 C33 34 27 36 24 39 C21 36 15 34 8 36 Z" fill={`url(#${uid}-bk)`} stroke="#78350F" strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="24" y1="14" x2="24" y2="39" stroke="#78350F" strokeWidth="2.2" />
      <line x1="12" y1="18" x2="20" y2="19" stroke="#FFFBEB" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="12" y1="24" x2="20" y2="25" stroke="#FFFBEB" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M31 12 V24 L34 21 L37 24 V12 Z" fill="#EF4444" stroke="#78350F" strokeWidth="1.4" />
    </svg>
  );
};

export const RichSpyIcon: React.FC<RichIconProps> = ({ className = 'w-9 h-9' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-hat`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id={`${uid}-lens`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#BE185D" />
        </linearGradient>
      </defs>
      {/* Fedora Hat */}
      <path d="M13 18 L17 9 L24 11 L31 9 L35 18 Z" fill={`url(#${uid}-hat)`} stroke="#F8FAFC" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="6" y="17" width="36" height="5" rx="2.5" fill="#1E293B" stroke="#F8FAFC" strokeWidth="1.8" />
      {/* Spy Shades */}
      <rect x="9" y="25" width="13" height="9" rx="4" fill={`url(#${uid}-lens)`} stroke="#FFFFFF" strokeWidth="2" />
      <rect x="26" y="25" width="13" height="9" rx="4" fill={`url(#${uid}-lens)`} stroke="#FFFFFF" strokeWidth="2" />
      <line x1="22" y1="29" x2="26" y2="29" stroke="#FFFFFF" strokeWidth="2.2" />
      <line x1="12" y1="28" x2="16" y2="28" stroke="#FCE7F3" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="29" y1="28" x2="33" y2="28" stroke="#FCE7F3" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 39 Q24 42 29 39" fill="none" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};

export const RichBombQuestionsIcon: React.FC<RichIconProps> = ({ className = 'w-9 h-9' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-bomb`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="60%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
      </defs>
      <path d="M29 12 C32 7 37 7 39 10" fill="none" stroke="#FDBA74" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M39 5 L40.5 8.5 L44 10 L40.5 11.5 L39 15 L37.5 11.5 L34 10 L37.5 8.5 Z" fill="#FDE047" />
      <rect x="21" y="11" width="8" height="5" rx="2" fill="#94A3B8" stroke="#0F172A" strokeWidth="1.8" />
      <circle cx="23" cy="29" r="14" fill={`url(#${uid}-bomb)`} stroke="#F8FAFC" strokeWidth="2" />
      <ellipse cx="17" cy="23" rx="3.5" ry="2" fill="#FFFFFF" opacity="0.45" transform="rotate(-30 17 23)" />
      <text x="23" y="34" textAnchor="middle" fill="#FDE047" fontSize="15" fontWeight="900">؟</text>
    </svg>
  );
};

export const RichBombClassicIcon: React.FC<RichIconProps> = ({ className = 'w-9 h-9' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-fire`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="60%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#DC2626" />
        </radialGradient>
      </defs>
      <path d="M27 12 C31 7 36 8 38 11" fill="none" stroke="#FDE68A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="39" cy="10" r="5" fill={`url(#${uid}-fire)`} />
      <rect x="20" y="11" width="8" height="5" rx="2" fill="#CBD5E1" stroke="#0F172A" strokeWidth="1.8" />
      <circle cx="22" cy="29" r="14" fill="#0F172A" stroke="#FDBA74" strokeWidth="2.2" />
      <path d="M16 25 L20 29 L16 33 M28 25 L24 29 L28 33" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="16" cy="22" rx="3" ry="1.6" fill="#FFFFFF" opacity="0.4" transform="rotate(-30 16 22)" />
    </svg>
  );
};

export const RichDrawIcon: React.FC<RichIconProps> = ({ className = 'w-9 h-9' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-pal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M24 8 C13 8 6 15 6 24 C6 33 13 39 22 39 C26 39 28 36 27 33 C26 31 28 29 31 29 H35 C39 29 42 26 42 22 C42 14 34 8 24 8 Z"
        fill={`url(#${uid}-pal)`}
        stroke="#0F172A"
        strokeWidth="2.2"
      />
      <circle cx="15" cy="20" r="3" fill="#EF4444" stroke="#0F172A" strokeWidth="1.2" />
      <circle cx="23" cy="15" r="3" fill="#3B82F6" stroke="#0F172A" strokeWidth="1.2" />
      <circle cx="32" cy="18" r="3" fill="#10B981" stroke="#0F172A" strokeWidth="1.2" />
      <circle cx="14" cy="29" r="3" fill="#A855F7" stroke="#0F172A" strokeWidth="1.2" />
      {/* Paintbrush */}
      <path d="M29 38 L41 18" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M29 38 L41 18" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="27" cy="40" r="2.5" fill="#EC4899" />
    </svg>
  );
};

export const RichForgerIcon: React.FC<RichIconProps> = ({ className = 'w-9 h-9' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-beret`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* Artist Beret */}
      <path d="M24 7 V11" stroke="#FEF08A" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="24" cy="15" rx="15" ry="6.5" fill={`url(#${uid}-beret)`} stroke="#0F172A" strokeWidth="2.2" />
      {/* Mask / Face */}
      <rect x="11" y="21" width="26" height="17" rx="8" fill="#FFFBEB" stroke="#0F172A" strokeWidth="2.2" />
      <path d="M14 27 Q18 24 22 27 Q26 24 30 27" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="18" cy="28" r="2.1" fill="#0F172A" />
      <circle cx="30" cy="28" r="2.1" fill="#0F172A" />
      <path d="M18 34 Q24 31 30 34" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};

export const RichCourtIcon: React.FC<RichIconProps> = ({ className = 'w-9 h-9' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-scale`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <rect x="22" y="9" width="4" height="29" rx="2" fill={`url(#${uid}-scale)`} />
      <rect x="13" y="37" width="22" height="5" rx="2.5" fill={`url(#${uid}-scale)`} stroke="#451A03" strokeWidth="1.6" />
      <line x1="9" y1="15" x2="39" y2="15" stroke="#FEF08A" strokeWidth="3" strokeLinecap="round" />
      {/* Left pan */}
      <path d="M11 15 L6 27 H16 Z" fill="none" stroke="#FDE68A" strokeWidth="1.8" />
      <path d="M5 27 H17 C17 31 14 33 11 33 C8 33 5 31 5 27 Z" fill={`url(#${uid}-scale)`} />
      {/* Right pan */}
      <path d="M37 15 L32 27 H42 Z" fill="none" stroke="#FDE68A" strokeWidth="1.8" />
      <path d="M31 27 H43 C43 31 40 33 37 33 C34 33 31 31 31 27 Z" fill={`url(#${uid}-scale)`} />
    </svg>
  );
};

export const RichHeadsUpIcon: React.FC<RichIconProps> = ({ className = 'w-9 h-9' }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-card`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>
      </defs>
      {/* Forehead Card */}
      <rect x="10" y="7" width="28" height="16" rx="4" fill={`url(#${uid}-card)`} stroke="#0F172A" strokeWidth="2" />
      <line x1="16" y1="15" x2="32" y2="15" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
      {/* Happy Face below */}
      <circle cx="24" cy="31" r="11" fill="#FDE047" stroke="#0F172A" strokeWidth="2" />
      <circle cx="20" cy="29" r="1.8" fill="#0F172A" />
      <circle cx="28" cy="29" r="1.8" fill="#0F172A" />
      <path d="M19 34 Q24 38.5 29 34" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M40 16 L41.5 19.5 L45 21 L41.5 22.5 L40 26 L38.5 22.5 L35 21 L38.5 19.5 Z" fill="#FDE047" />
    </svg>
  );
};

export const RichFootballGameIcon: React.FC<{ id: FootballGameId; className?: string }> = ({
  id,
  className = 'w-7 h-7',
}) => {
  const uid = useId();
  switch (id) {
    case 'football_spy':
      return <RichSpyIcon className={className} />;
    case 'football_password':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-k`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <circle cx="17" cy="24" r="9" fill={`url(#${uid}-k)`} stroke="#0F172A" strokeWidth="2.2" />
          <circle cx="17" cy="24" r="3.5" fill="#0F172A" />
          <path d="M25 22 H41 V27 H36 V32 H31 V27 H25 Z" fill={`url(#${uid}-k)`} stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case 'football_chain':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-j`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#BFDBFE" />
            </linearGradient>
          </defs>
          <path d="M14 10 L8 16 L12 22 L15 20 V38 H33 V20 L36 22 L40 16 L34 10 L29 12 C27 14 21 14 19 12 Z" fill={`url(#${uid}-j)`} stroke="#0F172A" strokeWidth="2.2" strokeLinejoin="round" />
          <text x="24" y="30" textAnchor="middle" fill="#1D4ED8" fontSize="13" fontWeight="900">10</text>
        </svg>
      );
    case 'football_three':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
          <circle cx="24" cy="14" r="7" fill="#FDE047" stroke="#0F172A" strokeWidth="2" />
          <circle cx="13" cy="31" r="7" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <circle cx="35" cy="31" r="7" fill="#34D399" stroke="#0F172A" strokeWidth="2" />
          <text x="24" y="18" textAnchor="middle" fill="#0F172A" fontSize="10" fontWeight="900">3</text>
        </svg>
      );
    case 'football_charades':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
          <rect x="18" y="8" width="12" height="20" rx="6" fill="#F472B6" stroke="#0F172A" strokeWidth="2.2" />
          <path d="M12 22 C12 30 17 34 24 34 C31 34 36 30 36 22" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="24" y1="34" x2="24" y2="41" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="17" y1="41" x2="31" y2="41" stroke="#FDE047" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'football_penalty':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
          <path d="M8 36 V13 H40 V36" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="13" x2="16" y2="34" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5" />
          <line x1="24" y1="13" x2="24" y2="34" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5" />
          <line x1="32" y1="13" x2="32" y2="34" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5" />
          <circle cx="28" cy="27" r="7.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <polygon points="28,23 31,25.5 29.8,29 26.2,29 25,25.5" fill="#0F172A" />
        </svg>
      );
    case 'football_auction':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-gav`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
          </defs>
          <g transform="rotate(-35 22 20)">
            <rect x="13" y="11" width="18" height="10" rx="3" fill={`url(#${uid}-gav)`} stroke="#0F172A" strokeWidth="2" />
            <rect x="20" y="21" width="4" height="18" rx="2" fill="#FEF3C7" stroke="#0F172A" strokeWidth="1.8" />
          </g>
          <rect x="20" y="36" width="22" height="6" rx="3" fill="#FDE047" stroke="#0F172A" strokeWidth="2" />
        </svg>
      );
    case 'football_tictactoe':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]`} aria-hidden="true">
          <rect x="7" y="7" width="34" height="34" rx="7" fill="rgba(255,255,255,0.2)" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="18.5" y1="9" x2="18.5" y2="39" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="29.5" y1="9" x2="29.5" y2="39" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="9" y1="18.5" x2="39" y2="18.5" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="9" y1="29.5" x2="39" y2="29.5" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M11 11 L16 16 M16 11 L11 16" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="24" cy="24" r="3.4" fill="none" stroke="#6EE7B7" strokeWidth="2.4" />
          <path d="M32 32 L37 37 M37 32 L32 37" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
  }
};

export const RichArcadeGameIcon: React.FC<{ id: ArcadeGameId; className?: string }> = ({
  id,
  className = 'w-10 h-10',
}) => {
  const uid = useId();
  switch (id) {
    case 'paint':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-r`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
          <rect x="9" y="8" width="26" height="12" rx="4" fill={`url(#${uid}-r)`} stroke="#0F172A" strokeWidth="2.2" />
          <path d="M35 14 H39 V23 L24 26 V31" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="20.5" y="30" width="7" height="12" rx="3.5" fill="#FDE047" stroke="#0F172A" strokeWidth="2" />
        </svg>
      );
    case 'knife':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
          <circle cx="24" cy="18" r="10" fill="#B45309" stroke="#FEF3C7" strokeWidth="2.5" />
          <circle cx="24" cy="18" r="4.5" fill="#FDE68A" />
          <path d="M24 27 L27 38 H21 Z" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.8" />
          <rect x="22" y="38" width="4" height="6" rx="1.5" fill="#EF4444" stroke="#0F172A" strokeWidth="1.5" />
          <path d="M9 12 L17 16 L13 20 Z" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.5" />
          <path d="M39 12 L31 16 L35 20 Z" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.5" />
        </svg>
      );
    case 'frog':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-fg`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ADE80" />
              <stop offset="100%" stopColor="#16A34A" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="27" r="15" fill={`url(#${uid}-fg)`} stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="17" cy="15" r="5.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.2" />
          <circle cx="31" cy="15" r="5.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.2" />
          <circle cx="17" cy="15" r="2.3" fill="#0F172A" />
          <circle cx="31" cy="15" r="2.3" fill="#0F172A" />
          <path d="M16 29 Q24 36 32 29" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <circle cx="24" cy="34" r="3" fill="#FB7185" />
        </svg>
      );
    case 'birds':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
          <circle cx="23" cy="25" r="13" fill="#FDE047" stroke="#0F172A" strokeWidth="2.3" />
          <ellipse cx="19" cy="27" rx="6" ry="4" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.8" />
          <circle cx="29" cy="20" r="3.6" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.8" />
          <circle cx="30" cy="20" r="1.5" fill="#0F172A" />
          <polygon points="34,23 43,26 34,29" fill="#F97316" stroke="#0F172A" strokeWidth="1.8" />
          <path d="M15 11 L17 15 L21 16 L17 18 L15 21 L13 18 L9 16 L13 15 Z" fill="#FEF9C3" />
        </svg>
      );
    case 'racing':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
          <path d="M8 28 L13 17 H35 L40 28 V36 H8 Z" fill="#EF4444" stroke="#0F172A" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M15 19 H33 L36 26 H12 Z" fill="#BAE6FD" stroke="#0F172A" strokeWidth="1.8" />
          <rect x="19" y="13" width="10" height="4" rx="1.5" fill="#FDE047" />
          <circle cx="15" cy="36" r="5" fill="#1E293B" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="33" cy="36" r="5" fill="#1E293B" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="13" cy="31" r="2" fill="#FDE047" />
          <circle cx="35" cy="31" r="2" fill="#FDE047" />
        </svg>
      );
    case 'chicken':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
          <ellipse cx="23" cy="27" rx="13" ry="11" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
          <path d="M19 16 C18 11 22 10 24 13 C26 10 29 12 27 16 Z" fill="#EF4444" stroke="#0F172A" strokeWidth="1.8" />
          <polygon points="34,24 42,27 34,30" fill="#F97316" stroke="#0F172A" strokeWidth="1.8" />
          <circle cx="28" cy="24" r="2.2" fill="#0F172A" />
          <ellipse cx="20" cy="29" rx="5.5" ry="3.5" fill="#FEF3C7" stroke="#0F172A" strokeWidth="1.5" />
        </svg>
      );
    case 'soccer':
      return <RichFootballHubIcon className={className} />;
    case 'stickman':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
          <line x1="8" y1="38" x2="36" y2="10" stroke="#38BDF8" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="40" y1="38" x2="12" y2="10" stroke="#FB923C" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="24" cy="14" r="5" fill="#FACC15" stroke="#0F172A" strokeWidth="2" />
          <line x1="24" y1="19" x2="24" y2="30" stroke="#FACC15" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="24" y1="30" x2="18" y2="40" stroke="#FACC15" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="24" y1="30" x2="30" y2="40" stroke="#FACC15" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );
    case 'balance':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]`} aria-hidden="true">
          <rect x="7" y="31" width="34" height="6" rx="3" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.2" transform="rotate(-8 24 34)" />
          <rect x="14" y="15" width="20" height="15" rx="4" fill="#60A5FA" stroke="#0F172A" strokeWidth="2.2" />
          <circle cx="20" cy="22" r="2" fill="#0F172A" />
          <circle cx="28" cy="22" r="2" fill="#0F172A" />
          <circle cx="24" cy="11" r="4" fill="#34D399" stroke="#0F172A" strokeWidth="1.8" />
        </svg>
      );
    case 'khlawis':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.34)]`} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          {/* Flashlight cone beam */}
          <polygon points="15,18 42,8 42,38" fill={`url(#${uid}-beam)`} />
          {/* Flashlight body */}
          <rect x="6" y="15" width="12" height="7" rx="2.5" fill="#F59E0B" stroke="#0F172A" strokeWidth="2" />
          <circle cx="17" cy="18.5" r="3" fill="#FEF9C3" stroke="#0F172A" strokeWidth="1.5" />
          {/* Peeking stealth eyes in the shadow */}
          <rect x="23" y="25" width="18" height="14" rx="5" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
          <circle cx="29" cy="32" r="2.2" fill="#F8FAFC" />
          <circle cx="35" cy="32" r="2.2" fill="#F8FAFC" />
          <circle cx="29.5" cy="32" r="1" fill="#0F172A" />
          <circle cx="35.5" cy="32" r="1" fill="#0F172A" />
        </svg>
      );
  }
};

export const RichPartyOrCategoryIcon: React.FC<{
  type: GameId | SpyIconType;
  className?: string;
}> = ({ type, className = 'w-9 h-9' }) => {
  switch (type) {
    case 'spy':
      return <RichSpyIcon className={className} />;
    case 'bomb_questions':
      return <RichBombQuestionsIcon className={className} />;
    case 'bomb_classic':
      return <RichBombClassicIcon className={className} />;
    case 'draw':
      return <RichDrawIcon className={className} />;
    case 'forger':
      return <RichForgerIcon className={className} />;
    case 'court':
      return <RichCourtIcon className={className} />;
    case 'headsup':
      return <RichHeadsUpIcon className={className} />;
    case 'places':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <polygon points="8,37 20,14 32,37" fill="#FDE047" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="23,37 32,20 41,37" fill="#F59E0B" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="34" cy="13" r="4" fill="#FEF08A" />
        </svg>
      );
    case 'food':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M10 22 C10 13 38 13 38 22 Z" fill="#FDBA74" stroke="#0F172A" strokeWidth="2" />
          <path d="M8 26 Q16 22 24 26 Q32 30 40 26" fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="10" y="29" width="28" height="6" rx="3" fill="#B45309" stroke="#0F172A" strokeWidth="1.8" />
          <rect x="11" y="35" width="26" height="5" rx="2.5" fill="#FDBA74" stroke="#0F172A" strokeWidth="1.8" />
        </svg>
      );
    case 'movies':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <rect x="9" y="19" width="30" height="21" rx="3.5" fill="#1E293B" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M9 19 L38 11 L36 6 L7 14 Z" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.8" />
          <polygon points="21,25 30,30 21,35" fill="#FDE047" />
        </svg>
      );
    case 'sports':
      return <RichTrophyIcon className={className} />;
    case 'jobs':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M18 15 V11 H30 V15" fill="none" stroke="#FDE047" strokeWidth="3" strokeLinecap="round" />
          <rect x="8" y="15" width="32" height="23" rx="5" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.2" />
          <rect x="8" y="24" width="32" height="4" fill="#B45309" />
          <rect x="21" y="22" width="6" height="8" rx="1.5" fill="#FEF08A" stroke="#0F172A" strokeWidth="1.4" />
        </svg>
      );
    case 'animals':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <circle cx="14" cy="17" r="4.2" fill="#FDE047" stroke="#0F172A" strokeWidth="1.8" />
          <circle cx="24" cy="13" r="4.2" fill="#FDE047" stroke="#0F172A" strokeWidth="1.8" />
          <circle cx="34" cy="17" r="4.2" fill="#FDE047" stroke="#0F172A" strokeWidth="1.8" />
          <path d="M14 31 C14 23 34 23 34 31 C34 36 29 39 24 39 C19 39 14 36 14 31 Z" fill="#FDE047" stroke="#0F172A" strokeWidth="2" />
        </svg>
      );
    case 'countries':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <circle cx="24" cy="24" r="15" fill="#38BDF8" stroke="#0F172A" strokeWidth="2.2" />
          <path d="M17 14 C21 15 24 19 21 24 C19 28 24 34 20 37 M29 12 C33 17 31 23 35 28" fill="none" stroke="#4ADE80" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="24" cy="24" rx="7" ry="15" fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.65" />
        </svg>
      );
    case 'cars':
      return <RichArcadeGameIcon id="racing" className={className} />;
    case 'home':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <rect x="8" y="21" width="32" height="14" rx="5" fill="#FDE047" stroke="#0F172A" strokeWidth="2.2" />
          <rect x="13" y="14" width="22" height="10" rx="3" fill="#FB7185" stroke="#0F172A" strokeWidth="2" />
          <line x1="13" y1="35" x2="13" y2="40" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <line x1="35" y1="35" x2="35" y2="40" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'gaming':
      return <RichArcadeIcon className={className} />;
    case 'fruits':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M24 13 C24 8 29 7 31 10" fill="none" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="27" r="13" fill="#EF4444" stroke="#0F172A" strokeWidth="2.2" />
          <ellipse cx="19" cy="22" rx="3" ry="1.8" fill="#FFFFFF" opacity="0.55" transform="rotate(-25 19 22)" />
        </svg>
      );
    case 'transport':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <rect x="9" y="11" width="30" height="24" rx="5" fill="#FDE047" stroke="#0F172A" strokeWidth="2.2" />
          <rect x="13" y="15" width="22" height="10" rx="2" fill="#BAE6FD" stroke="#0F172A" strokeWidth="1.6" />
          <circle cx="15" cy="36" r="3.5" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle cx="33" cy="36" r="3.5" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.6" />
        </svg>
      );
    case 'daily_life':
      return (
        <svg viewBox="0 0 48 48" className={`${className} drop-shadow`} aria-hidden="true">
          <path d="M11 20 H31 V31 C31 36 27 39 21 39 C15 39 11 36 11 31 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.2" />
          <path d="M31 22 H35 C37 22 38 24 38 26 C38 29 36 31 31 31" fill="none" stroke="#FFFFFF" strokeWidth="2.8" />
          <path d="M17 13 Q19 9 17 7 M23 13 Q25 9 23 7" fill="none" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
};
