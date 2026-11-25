export type ArcadeColorId = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

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
  purple: {
    id: 'purple',
    name: 'بنفسجي',
    hex: '#8b5cf6',
    darkHex: '#5b21b6',
    lightHex: '#c4b5fd',
    textOnColor: '#ffffff',
    bgClass: 'bg-[#8b5cf6]',
    borderClass: 'border-[#c4b5fd]/50',
    shadowClass: 'shadow-[0_5px_0_#5b21b6,0_8px_16px_rgba(91,33,182,0.16)]',
  },
  orange: {
    id: 'orange',
    name: 'برتقالي',
    hex: '#f97316',
    darkHex: '#c2410c',
    lightHex: '#fdba74',
    textOnColor: '#ffffff',
    bgClass: 'bg-[#f97316]',
    borderClass: 'border-[#fdba74]/50',
    shadowClass: 'shadow-[0_5px_0_#c2410c,0_8px_16px_rgba(194,65,12,0.16)]',
  },
};

export const ARCADE_COLOR_ORDER: ArcadeColorId[] = ['red', 'blue', 'green', 'yellow'];
export const TURN_ARCADE_COLOR_ORDER: ArcadeColorId[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
];

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
  { id: 'arc_1', name: 'مينا منصور', colorId: 'red', score: 0 },
  { id: 'arc_2', name: 'كيرلس عصام', colorId: 'blue', score: 0 },
  { id: 'arc_3', name: 'مينا عاطف', colorId: 'green', score: 0 },
  { id: 'arc_4', name: 'مينا عماد', colorId: 'yellow', score: 0 },
];
