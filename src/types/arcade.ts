export type ArcadeColorId = 'red' | 'blue' | 'green' | 'yellow';

export interface ArcadeColorTheme {
  id: ArcadeColorId;
  name: string;
  hex: string;
  darkHex: string;
  lightHex: string;
  textOnColor: string;
  bgClass: string;
  borderClass: string;
  shadowClass: string;
}

export const ARCADE_COLORS: Record<ArcadeColorId, ArcadeColorTheme> = {
  red: {
    id: 'red',
    name: 'أحمر',
    hex: '#ef4444',
    darkHex: '#991b1b',
    lightHex: '#fca5a5',
    textOnColor: '#ffffff',
    bgClass: 'bg-[#ef4444]',
    borderClass: 'border-[#fca5a5]/50',
    shadowClass: 'shadow-[0_5px_0_#b91c1c,0_8px_16px_rgba(185,28,28,0.16)]',
  },
  blue: {
    id: 'blue',
    name: 'أزرق',
    hex: '#0ea5e9',
    darkHex: '#0369a1',
    lightHex: '#7dd3fc',
    textOnColor: '#ffffff',
    bgClass: 'bg-[#0ea5e9]',
    borderClass: 'border-[#7dd3fc]/50',
    shadowClass: 'shadow-[0_5px_0_#0369a1,0_8px_16px_rgba(3,105,161,0.16)]',
  },
  green: {
    id: 'green',
    name: 'أخضر',
    hex: '#10b981',
    darkHex: '#047857',
    lightHex: '#6ee7b7',
    textOnColor: '#ffffff',
    bgClass: 'bg-[#10b981]',
    borderClass: 'border-[#6ee7b7]/50',
    shadowClass: 'shadow-[0_5px_0_#047857,0_8px_16px_rgba(4,120,87,0.16)]',
  },
  yellow: {
    id: 'yellow',
    name: 'أصفر',
    hex: '#f59e0b',
    darkHex: '#b45309',
    lightHex: '#fde047',
    textOnColor: '#1e293b',
    bgClass: 'bg-[#f59e0b]',
    borderClass: 'border-[#fef08a]/60',
    shadowClass: 'shadow-[0_5px_0_#b45309,0_8px_16px_rgba(180,83,9,0.16)]',
  },
};

export const ARCADE_COLOR_ORDER: ArcadeColorId[] = ['red', 'blue', 'green', 'yellow'];

export interface ArcadePlayer {
  id: string;
  name: string;
  colorId: ArcadeColorId;
  score: number;
}

export interface ArcadeDelta {
  playerId: string;
  delta: number;
}

export type CornerSlot = 'bottom-right' | 'top-left' | 'bottom-left' | 'top-right';

export interface CornerPlacement {
  slot: CornerSlot;
  label: string;
  isTop: boolean;
}

/**
 * Returns physical corner slots (independent of RTL) for 2, 3, or 4 players
 * so opposite/diagonal corners maximize thumb room on a single phone.
 */
export function getCornerPlacements(count: number): CornerPlacement[] {
  if (count === 2) {
    return [
      { slot: 'bottom-right', label: 'أسفل اليمين', isTop: false },
      { slot: 'top-left', label: 'أعلى اليسار', isTop: true },
    ];
  }
  if (count === 3) {
    return [
      { slot: 'bottom-right', label: 'أسفل اليمين', isTop: false },
      { slot: 'top-left', label: 'أعلى اليسار', isTop: true },
      { slot: 'bottom-left', label: 'أسفل اليسار', isTop: false },
    ];
  }
  return [
    { slot: 'bottom-right', label: 'أسفل اليمين', isTop: false },
    { slot: 'top-left', label: 'أعلى اليسار', isTop: true },
    { slot: 'bottom-left', label: 'أسفل اليسار', isTop: false },
    { slot: 'top-right', label: 'أعلى اليمين', isTop: true },
  ];
}

export const DEFAULT_ARCADE_PLAYERS: ArcadePlayer[] = [
  { id: 'arc_1', name: 'لاعب ١', colorId: 'red', score: 0 },
  { id: 'arc_2', name: 'لاعب ٢', colorId: 'blue', score: 0 },
  { id: 'arc_3', name: 'لاعب ٣', colorId: 'green', score: 0 },
  { id: 'arc_4', name: 'لاعب ٤', colorId: 'yellow', score: 0 },
];
