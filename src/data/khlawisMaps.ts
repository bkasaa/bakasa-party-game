export type MazeMapId = 'apartment' | 'hospital' | 'factory';

export type FurnitureStyle =
  | 'bed'
  | 'wardrobe'
  | 'sofa'
  | 'tv'
  | 'table'
  | 'curtain'
  | 'kitchen'
  | 'bathtub'
  | 'plant'
  | 'hospital_bed'
  | 'medical_curtain'
  | 'medicine_cabinet'
  | 'wheelchair'
  | 'operating_table'
  | 'container'
  | 'crate'
  | 'conveyor'
  | 'locker'
  | 'machinery'
  | 'desk';

export interface MazeWall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MazeFurniture {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: FurnitureStyle;
  label: string;
  hideable: boolean;
  blocksSight: boolean;
  solidCollision: boolean;
  primaryColor: string;
  accentColor: string;
}

export interface RoomZone {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floorColor: string;
  pattern: 'wood' | 'tile' | 'checker' | 'mosaic' | 'hall' | 'concrete' | 'hospital_tile';
  rug?: { x: number; y: number; w: number; h: number; color: string; border: string };
}

export interface DoorFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: 'h' | 'v';
}

export interface MazeMapDefinition {
  id: MazeMapId;
  name: string;
  emoji: string;
  subtitle: string;
  badgeText: string;
  cardGradient: string;
  wallMainColor: string;
  wallTopColor: string;
  doorColor: string;
  ambientBg: string;
  rooms: RoomZone[];
  walls: MazeWall[];
  doors: DoorFrame[];
  furniture: MazeFurniture[];
  seekerSpawn: { x: number; y: number };
  hiderSpots: Array<{ x: number; y: number }>;
  patrolWaypoints: Array<{ x: number; y: number }>;
}

export const KHLAWIS_WORLD_W = 3000;
export const KHLAWIS_WORLD_H = 3000;

const OUTER_WALLS: MazeWall[] = [
  { x: 0, y: 0, w: KHLAWIS_WORLD_W, h: 28 },
  { x: 0, y: KHLAWIS_WORLD_H - 28, w: KHLAWIS_WORLD_W, h: 28 },
  { x: 0, y: 0, w: 28, h: KHLAWIS_WORLD_H },
  { x: KHLAWIS_WORLD_W - 28, y: 0, w: 28, h: KHLAWIS_WORLD_H },
];

// =========================================================================
// MAP 1: الشقة الكبيرة (Luxury 3000x3000 Apartment Maze)
// =========================================================================
const APARTMENT_MAP: MazeMapDefinition = {
  id: 'apartment',
  name: 'الشقة الكبيرة',
  emoji: '🏠',
  subtitle: '٦ غرف وممرات متعرجة، سراير، دواليب، ستائر، ومخزن سري!',
  badgeText: '٣٠٠٠×٣٠٠٠ · دافئة ومليانة مخابئ',
  cardGradient: 'from-[#4C1D95] via-[#7C3AED] to-[#F59E0B]',
  wallMainColor: '#334155',
  wallTopColor: '#475569',
  doorColor: '#B45309',
  ambientBg: '#1E293B',
  rooms: [
    {
      id: 'apt_bedroom',
      name: 'غرفة النوم الرئيسية 🛏️',
      x: 28,
      y: 28,
      w: 1252,
      h: 1012,
      floorColor: '#EAD4B2',
      pattern: 'wood',
      rug: { x: 240, y: 310, w: 520, h: 400, color: '#C084FC', border: '#9333EA' },
    },
    {
      id: 'apt_kids',
      name: 'غرفة الألعاب والأطفال 🧸',
      x: 28,
      y: 1040,
      w: 1252,
      h: 448,
      floorColor: '#FEF3C7',
      pattern: 'wood',
      rug: { x: 460, y: 1150, w: 320, h: 220, color: '#60A5FA', border: '#2563EB' },
    },
    {
      id: 'apt_kitchen',
      name: 'المطبخ الواسع 🍳',
      x: 28,
      y: 1488,
      w: 1252,
      h: 880,
      floorColor: '#F8FAFC',
      pattern: 'checker',
      rug: { x: 160, y: 1920, w: 280, h: 220, color: '#FDBA74', border: '#EA580C' },
    },
    {
      id: 'apt_storage',
      name: 'المخزن المسدود 📦',
      x: 28,
      y: 2368,
      w: 1252,
      h: 604,
      floorColor: '#D6C7B2',
      pattern: 'tile',
    },
    {
      id: 'apt_living',
      name: 'الريسبشن والصالة 🛋️',
      x: 1580,
      y: 28,
      w: 1392,
      h: 1512,
      floorColor: '#F5EDE0',
      pattern: 'tile',
      rug: { x: 1850, y: 420, w: 580, h: 420, color: '#FB7185', border: '#E11D48' },
    },
    {
      id: 'apt_bath',
      name: 'الحمام وغرفة الغسيل 🛁',
      x: 1580,
      y: 1540,
      w: 1392,
      h: 1432,
      floorColor: '#E0F2FE',
      pattern: 'mosaic',
      rug: { x: 2260, y: 1720, w: 340, h: 260, color: '#5EEAD4', border: '#0D9488' },
    },
    {
      id: 'apt_hall',
      name: 'الممر الرئيسي 🚪',
      x: 1280,
      y: 28,
      w: 300,
      h: 2944,
      floorColor: '#E2D5C1',
      pattern: 'hall',
    },
  ],
  walls: [
    ...OUTER_WALLS,
    // Left Hallway Wall (x=1266) — Doors at y:480..680 (Bedroom), y:1820..2020 (Kitchen)
    { x: 1266, y: 28, w: 28, h: 452 },
    { x: 1266, y: 680, w: 28, h: 1140 },
    { x: 1266, y: 2020, w: 28, h: 952 },

    // Right Hallway Wall (x=1566) — Doors at y:520..720 (Living), y:2360..2560 (Bath)
    { x: 1566, y: 28, w: 28, h: 492 },
    { x: 1566, y: 720, w: 28, h: 1640 },
    { x: 1566, y: 2560, w: 28, h: 412 },

    // Central Hallway Pillars (peek & loop cover)
    { x: 1400, y: 980, w: 56, h: 160 },
    { x: 1400, y: 2080, w: 56, h: 160 },

    // Left Interior Room Dividers
    // Bedroom <-> Kids (y=1026), passage at x:260..460
    { x: 28, y: 1026, w: 232, h: 28 },
    { x: 460, y: 1026, w: 806, h: 28 },
    // Bedroom Walk-in Closet Maze Partition (dead-end alcove)
    { x: 680, y: 28, w: 28, h: 440 },
    { x: 708, y: 310, w: 280, h: 28 },

    // Kids <-> Kitchen (y=1474), passage at x:840..1040
    { x: 28, y: 1474, w: 812, h: 28 },
    { x: 1040, y: 1474, w: 226, h: 28 },

    // Kitchen Maze Aisles
    { x: 540, y: 1680, w: 28, h: 440 },
    { x: 568, y: 1890, w: 320, h: 28 },

    // Kitchen <-> Storage Dead-End (y=2354), passage at x:260..460
    { x: 28, y: 2354, w: 232, h: 28 },
    { x: 460, y: 2354, w: 806, h: 28 },
    // Storage Dead-End Shelf Wall
    { x: 740, y: 2560, w: 28, h: 412 },

    // Right Interior Room Dividers
    // Living <-> Bathroom (y=1526), passage at x:2440..2640
    { x: 1594, y: 1526, w: 846, h: 28 },
    { x: 2640, y: 1526, w: 332, h: 28 },
    // Living Room Winding Alcoves
    { x: 2180, y: 28, w: 28, h: 460 },
    { x: 2208, y: 940, w: 460, h: 28 },

    // Bathroom / Laundry Winding Corridor
    { x: 2100, y: 1840, w: 28, h: 720 },
    { x: 2128, y: 2240, w: 500, h: 28 },
  ],
  doors: [
    { x: 1266, y: 480, w: 28, h: 200, orientation: 'v' },
    { x: 1266, y: 1820, w: 28, h: 200, orientation: 'v' },
    { x: 1566, y: 520, w: 28, h: 200, orientation: 'v' },
    { x: 1566, y: 2360, w: 28, h: 200, orientation: 'v' },
    { x: 260, y: 1026, w: 200, h: 28, orientation: 'h' },
    { x: 840, y: 1474, w: 200, h: 28, orientation: 'h' },
    { x: 260, y: 2354, w: 200, h: 28, orientation: 'h' },
    { x: 2440, y: 1526, w: 200, h: 28, orientation: 'h' },
  ],
  furniture: [
    // Bedroom
    { id: 'apt_bed1', x: 90, y: 95, w: 230, h: 170, style: 'bed', label: 'السرير الكبير', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#7C3AED', accentColor: '#DDD6FE' },
    { id: 'apt_ward1', x: 1020, y: 55, w: 210, h: 92, style: 'wardrobe', label: 'دولاب النوم', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#854D0E', accentColor: '#CA8A04' },
    { id: 'apt_ward_nook', x: 730, y: 55, w: 190, h: 90, style: 'wardrobe', label: 'دولاب الركن', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#92400E', accentColor: '#FDE68A' },
    { id: 'apt_curt1', x: 42, y: 520, w: 62, h: 220, style: 'curtain', label: 'ستارة النوم', hideable: true, blocksSight: true, solidCollision: false, primaryColor: '#DB2777', accentColor: '#F9A8D4' },
    { id: 'apt_dresser', x: 920, y: 860, w: 180, h: 90, style: 'table', label: 'التسريحة', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#92400E', accentColor: '#FDE68A' },
    // Kids Room
    { id: 'apt_bed2', x: 90, y: 1180, w: 195, h: 145, style: 'bed', label: 'سرير الأطفال', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#0EA5E9', accentColor: '#BAE6FD' },
    { id: 'apt_ward_kids', x: 960, y: 1085, w: 210, h: 90, style: 'wardrobe', label: 'دولاب اللعب', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#2563EB', accentColor: '#93C5FD' },
    // Kitchen
    { id: 'apt_kitch_cnt', x: 56, y: 1530, w: 340, h: 96, style: 'kitchen', label: 'رخامة المطبخ', hideable: false, blocksSight: true, solidCollision: true, primaryColor: '#475569', accentColor: '#CBD5E1' },
    { id: 'apt_pantry', x: 980, y: 1530, w: 210, h: 92, style: 'wardrobe', label: 'دولاب الخزين', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#B45309', accentColor: '#FDE68A' },
    { id: 'apt_curt_kit', x: 42, y: 1940, w: 62, h: 220, style: 'curtain', label: 'ستارة المطبخ', hideable: true, blocksSight: true, solidCollision: false, primaryColor: '#EA580C', accentColor: '#FED7AA' },
    { id: 'apt_sofa_kit', x: 760, y: 2150, w: 250, h: 110, style: 'sofa', label: 'ركنة المطبخ', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#2563EB', accentColor: '#93C5FD' },
    // Storage Dead-End
    { id: 'apt_crate_st1', x: 90, y: 2660, w: 180, h: 110, style: 'crate', label: 'صناديق المخزن', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#A16207', accentColor: '#FDE047' },
    { id: 'apt_ward_st2', x: 920, y: 2780, w: 240, h: 96, style: 'wardrobe', label: 'خزانة قديمة', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#57534E', accentColor: '#D6D3D1' },
    // Living Room
    { id: 'apt_sofa1', x: 1760, y: 150, w: 300, h: 115, style: 'sofa', label: 'الكنبة الكبيرة', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#0D9488', accentColor: '#99F6E4' },
    { id: 'apt_sofa2', x: 2580, y: 310, w: 120, h: 260, style: 'sofa', label: 'الأنتريه', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#0F766E', accentColor: '#5EEAD4' },
    { id: 'apt_table1', x: 1940, y: 520, w: 200, h: 110, style: 'table', label: 'ترابيزة الصالة', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#78350F', accentColor: '#FCD34D' },
    { id: 'apt_tv', x: 1820, y: 1080, w: 260, h: 76, style: 'tv', label: 'شاشة التلفزيون', hideable: false, blocksSight: true, solidCollision: true, primaryColor: '#1E293B', accentColor: '#38BDF8' },
    { id: 'apt_curt_liv', x: 2890, y: 320, w: 62, h: 240, style: 'curtain', label: 'ستارة البلكونة', hideable: true, blocksSight: true, solidCollision: false, primaryColor: '#F59E0B', accentColor: '#FEF3C7' },
    { id: 'apt_ward_liv', x: 2480, y: 1120, w: 210, h: 92, style: 'wardrobe', label: 'مكتبة الصالة', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#78350F', accentColor: '#FDE68A' },
    { id: 'apt_plant1', x: 2800, y: 1260, w: 84, h: 84, style: 'plant', label: 'زرعة الصالة', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#16A34A', accentColor: '#86EFAC' },
    // Bathroom & Laundry
    { id: 'apt_tub', x: 2520, y: 1620, w: 320, h: 150, style: 'bathtub', label: 'البانيو الكبير', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#0284C7', accentColor: '#E0F2FE' },
    { id: 'apt_curt_bath', x: 2890, y: 2040, w: 62, h: 220, style: 'curtain', label: 'ستارة الحمام', hideable: true, blocksSight: true, solidCollision: false, primaryColor: '#14B8A6', accentColor: '#99F6E4' },
    { id: 'apt_ward_laundry', x: 2240, y: 2740, w: 240, h: 96, style: 'wardrobe', label: 'دولاب الغسيل', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#334155', accentColor: '#94A3B8' },
    { id: 'apt_sink', x: 1680, y: 1700, w: 200, h: 88, style: 'kitchen', label: 'حوض الحمام', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#0369A1', accentColor: '#BAE6FD' },
    // Hallway Accent
    { id: 'apt_plant_h', x: 1386, y: 180, w: 84, h: 84, style: 'plant', label: 'زرعة الممر', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#15803D', accentColor: '#86EFAC' },
  ],
  seekerSpawn: { x: 1430, y: 1500 },
  hiderSpots: [
    { x: 460, y: 520 },
    { x: 960, y: 520 },
    { x: 560, y: 1260 },
    { x: 280, y: 1740 },
    { x: 1020, y: 1880 },
    { x: 360, y: 2740 },
    { x: 1020, y: 2540 },
    { x: 1960, y: 740 },
    { x: 2560, y: 720 },
    { x: 1920, y: 1340 },
    { x: 1840, y: 2140 },
    { x: 2440, y: 2020 },
    { x: 2660, y: 2520 },
    { x: 1430, y: 580 },
  ],
  patrolWaypoints: [
    { x: 1430, y: 580 },
    { x: 1430, y: 1500 },
    { x: 1430, y: 2450 },
    { x: 560, y: 580 },
    { x: 360, y: 1040 },
    { x: 560, y: 1280 },
    { x: 940, y: 1480 },
    { x: 940, y: 1920 },
    { x: 360, y: 2360 },
    { x: 1940, y: 620 },
    { x: 2540, y: 1530 },
    { x: 2460, y: 2460 },
  ],
};

// =========================================================================
// MAP 2: المستشفى المهجورة (Abandoned Hospital 3000x3000 Maze)
// =========================================================================
const HOSPITAL_MAP: MazeMapDefinition = {
  id: 'hospital',
  name: 'المستشفى المهجورة',
  emoji: '🏥',
  subtitle: 'عنابر مرضى، غرفة عمليات، صيدلية، ممرات طويلة، وأشعة مسدودة!',
  badgeText: '٣٠٠٠×٣٠٠٠ · ستائر طبية وسراير',
  cardGradient: 'from-[#0F172A] via-[#0369A1] to-[#14B8A6]',
  wallMainColor: '#1E3A5F',
  wallTopColor: '#335C81',
  doorColor: '#0EA5E9',
  ambientBg: '#0B1324',
  rooms: [
    {
      id: 'hosp_ward1',
      name: 'عنبر المرضى ١ 🏥',
      x: 28,
      y: 28,
      w: 1312,
      h: 1292,
      floorColor: '#E2E8F0',
      pattern: 'hospital_tile',
    },
    {
      id: 'hosp_or',
      name: 'غرفة العمليات 🩺',
      x: 1640,
      y: 28,
      w: 1332,
      h: 1292,
      floorColor: '#CCFBF1',
      pattern: 'mosaic',
    },
    {
      id: 'hosp_pharmacy',
      name: 'الصيدلية وغرفة الأشعة 💊',
      x: 28,
      y: 1620,
      w: 1312,
      h: 1352,
      floorColor: '#F1F5F9',
      pattern: 'tile',
    },
    {
      id: 'hosp_isolation',
      name: 'عنبر العزل والطوارئ 🚨',
      x: 1640,
      y: 1620,
      w: 1332,
      h: 1352,
      floorColor: '#E0F2FE',
      pattern: 'checker',
    },
    {
      id: 'hosp_corridor',
      name: 'البهو والممر الطبي 🚪',
      x: 1340,
      y: 28,
      w: 300,
      h: 2944,
      floorColor: '#CBD5E1',
      pattern: 'hall',
    },
    {
      id: 'hosp_cross',
      name: 'ممر الاستقبال الرئيسي 🏥',
      x: 28,
      y: 1320,
      w: 2944,
      h: 300,
      floorColor: '#CBD5E1',
      pattern: 'hall',
    },
  ],
  walls: [
    ...OUTER_WALLS,
    // Vertical Corridor Walls (x=1326, x=1626)
    // Doors Top-Left at y:460..660, Bottom-Left at y:2120..2320
    { x: 1326, y: 28, w: 28, h: 432 },
    { x: 1326, y: 660, w: 28, h: 660 },
    { x: 1326, y: 1620, w: 28, h: 500 },
    { x: 1326, y: 2320, w: 28, h: 652 },

    // Doors Top-Right at y:440..640, Bottom-Right at y:2140..2340
    { x: 1626, y: 28, w: 28, h: 412 },
    { x: 1626, y: 640, w: 28, h: 680 },
    { x: 1626, y: 1620, w: 28, h: 520 },
    { x: 1626, y: 2340, w: 28, h: 632 },

    // Horizontal Cross Corridor Walls (y=1306, y=1606)
    // Doors Top-Left at x:520..740, Top-Right at x:2120..2340
    { x: 28, y: 1306, w: 492, h: 28 },
    { x: 740, y: 1306, w: 586, h: 28 },
    { x: 1654, y: 1306, w: 466, h: 28 },
    { x: 2340, y: 1306, w: 632, h: 28 },

    // Doors Bottom-Left at x:480..700, Bottom-Right at x:2480..2700
    { x: 28, y: 1606, w: 452, h: 28 },
    { x: 700, y: 1606, w: 626, h: 28 },
    { x: 1654, y: 1606, w: 826, h: 28 },
    { x: 2700, y: 1606, w: 272, h: 28 },

    // Top-Left Ward Winding Partitions (dead-end + bay maze)
    { x: 640, y: 28, w: 28, h: 540 },
    { x: 28, y: 740, w: 460, h: 28 },
    { x: 668, y: 540, w: 360, h: 28 },

    // Top-Right Operating Room & Sterilization Dead-End
    { x: 2280, y: 28, w: 28, h: 560 },
    { x: 2308, y: 820, w: 440, h: 28 },
    { x: 1860, y: 820, w: 28, h: 280 },

    // Bottom-Left Pharmacy Aisles & X-Ray Dead-End
    { x: 520, y: 1840, w: 28, h: 640 },
    { x: 920, y: 2100, w: 28, h: 872 },
    { x: 28, y: 2452, w: 320, h: 28 }, // X-ray doorway at x:348..520

    // Bottom-Right Isolation Cubicle Maze
    { x: 2140, y: 1634, w: 28, h: 560 },
    { x: 2168, y: 2166, w: 540, h: 28 },
    { x: 2480, y: 2460, w: 28, h: 512 },

    // Hallway Intersection Pillars
    { x: 960, y: 1418, w: 72, h: 72 },
    { x: 1960, y: 1418, w: 72, h: 72 },
  ],
  doors: [
    { x: 1326, y: 460, w: 28, h: 200, orientation: 'v' },
    { x: 1326, y: 2120, w: 28, h: 200, orientation: 'v' },
    { x: 1626, y: 440, w: 28, h: 200, orientation: 'v' },
    { x: 1626, y: 2140, w: 28, h: 200, orientation: 'v' },
    { x: 520, y: 1306, w: 220, h: 28, orientation: 'h' },
    { x: 2120, y: 1306, w: 220, h: 28, orientation: 'h' },
    { x: 480, y: 1606, w: 220, h: 28, orientation: 'h' },
    { x: 2480, y: 1606, w: 220, h: 28, orientation: 'h' },
  ],
  furniture: [
    // Ward 1
    { id: 'hosp_bed1', x: 95, y: 110, w: 210, h: 120, style: 'hospital_bed', label: 'سرير ١', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#0284C7', accentColor: '#E0F2FE' },
    { id: 'hosp_curt1', x: 340, y: 70, w: 54, h: 200, style: 'medical_curtain', label: 'ستارة طبية', hideable: true, blocksSight: true, solidCollision: false, primaryColor: '#14B8A6', accentColor: '#CCFBF1' },
    { id: 'hosp_bed2', x: 95, y: 420, w: 210, h: 120, style: 'hospital_bed', label: 'سرير ٢', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#0284C7', accentColor: '#E0F2FE' },
    { id: 'hosp_cab1', x: 740, y: 60, w: 200, h: 86, style: 'medicine_cabinet', label: 'دولاب أدوية', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#E2E8F0', accentColor: '#EF4444' },
    { id: 'hosp_wheel1', x: 1080, y: 1080, w: 86, h: 86, style: 'wheelchair', label: 'كرسي متحرك', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#475569', accentColor: '#38BDF8' },
    { id: 'hosp_curt2', x: 42, y: 920, w: 56, h: 200, style: 'medical_curtain', label: 'ستارة العنبر', hideable: true, blocksSight: true, solidCollision: false, primaryColor: '#0EA5E9', accentColor: '#BAE6FD' },
    // Operating Room
    { id: 'hosp_op1', x: 1860, y: 260, w: 220, h: 120, style: 'operating_table', label: 'ترابيزة العمليات', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#0F766E', accentColor: '#99F6E4' },
    { id: 'hosp_cab2', x: 2560, y: 60, w: 210, h: 88, style: 'medicine_cabinet', label: 'خزانة التعقيم', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#CBD5E1', accentColor: '#0D9488' },
    { id: 'hosp_curt_or', x: 2890, y: 380, w: 58, h: 210, style: 'medical_curtain', label: 'ستارة العمليات', hideable: true, blocksSight: true, solidCollision: false, primaryColor: '#14B8A6', accentColor: '#99F6E4' },
    { id: 'hosp_bed3', x: 2480, y: 1040, w: 210, h: 120, style: 'hospital_bed', label: 'سرير الإفاقة', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#0369A1', accentColor: '#BAE6FD' },
    // Pharmacy & X-Ray
    { id: 'hosp_cab3', x: 90, y: 1700, w: 220, h: 90, style: 'medicine_cabinet', label: 'رفوف الصيدلية', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#FFFFFF', accentColor: '#EF4444' },
    { id: 'hosp_cab4', x: 640, y: 1700, w: 220, h: 90, style: 'medicine_cabinet', label: 'دولاب المحاليل', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#E2E8F0', accentColor: '#0284C7' },
    { id: 'hosp_xray', x: 100, y: 2680, w: 230, h: 130, style: 'operating_table', label: 'جهاز الأشعة', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#334155', accentColor: '#38BDF8' },
    { id: 'hosp_desk1', x: 1040, y: 2740, w: 200, h: 96, style: 'desk', label: 'مكتب التحاليل', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#475569', accentColor: '#CBD5E1' },
    // Isolation Ward
    { id: 'hosp_bed4', x: 1740, y: 1720, w: 210, h: 120, style: 'hospital_bed', label: 'سرير العزل ١', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#DC2626', accentColor: '#FECACA' },
    { id: 'hosp_bed5', x: 2680, y: 2340, w: 210, h: 120, style: 'hospital_bed', label: 'سرير العزل ٢', hideable: true, blocksSight: false, solidCollision: true, primaryColor: '#DC2626', accentColor: '#FECACA' },
    { id: 'hosp_curt_iso', x: 2890, y: 1780, w: 58, h: 210, style: 'medical_curtain', label: 'ستارة العزل', hideable: true, blocksSight: true, solidCollision: false, primaryColor: '#F43F5E', accentColor: '#FFE4E6' },
    { id: 'hosp_cab_iso', x: 1760, y: 2760, w: 220, h: 92, style: 'medicine_cabinet', label: 'خزانة الطوارئ', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#94A3B8', accentColor: '#FACC15' },
    { id: 'hosp_wheel2', x: 2240, y: 2760, w: 86, h: 86, style: 'wheelchair', label: 'ترولي إسعاف', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#334155', accentColor: '#38BDF8' },
    // Corridor Desk & Plants
    { id: 'hosp_recept', x: 1410, y: 1060, w: 160, h: 88, style: 'desk', label: 'الاستقبال', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#0F766E', accentColor: '#99F6E4' },
    { id: 'hosp_plant1', x: 1448, y: 180, w: 80, h: 80, style: 'plant', label: 'زرعة الممر', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#15803D', accentColor: '#86EFAC' },
  ],
  seekerSpawn: { x: 1490, y: 1470 },
  hiderSpots: [
    { x: 480, y: 300 },
    { x: 980, y: 320 },
    { x: 420, y: 1040 },
    { x: 2040, y: 540 },
    { x: 2620, y: 420 },
    { x: 2040, y: 1120 },
    { x: 300, y: 2040 },
    { x: 740, y: 2340 },
    { x: 340, y: 2740 },
    { x: 1120, y: 2240 },
    { x: 1880, y: 2240 },
    { x: 2680, y: 1860 },
    { x: 2740, y: 2740 },
    { x: 1490, y: 540 },
  ],
  patrolWaypoints: [
    { x: 1490, y: 1470 },
    { x: 1490, y: 540 },
    { x: 640, y: 1470 },
    { x: 2340, y: 1470 },
    { x: 1490, y: 2240 },
    { x: 480, y: 560 },
    { x: 2040, y: 540 },
    { x: 740, y: 2140 },
    { x: 340, y: 2200 },
    { x: 1920, y: 2240 },
    { x: 2590, y: 1880 },
    { x: 2680, y: 2700 },
  ],
};

// =========================================================================
// MAP 3: المصنع القديم (Old Industrial Factory 3000x3000 Maze)
// =========================================================================
const FACTORY_MAP: MazeMapDefinition = {
  id: 'factory',
  name: 'المصنع القديم',
  emoji: '🏭',
  subtitle: 'خطوط إنتاج، حاويات شحن، صناديق خشب، ماكينات، وزوايا عمياء!',
  badgeText: '٣٠٠٠×٣٠٠٠ · حاويات وصناديق',
  cardGradient: 'from-[#7C2D12] via-[#EA580C] to-[#F59E0B]',
  wallMainColor: '#3F3F46',
  wallTopColor: '#52525B',
  doorColor: '#F59E0B',
  ambientBg: '#18181B',
  rooms: [
    {
      id: 'fac_assembly',
      name: 'خط الإنتاج الرئيسي ⚙️',
      x: 28,
      y: 28,
      w: 1312,
      h: 1332,
      floorColor: '#D4D4D8',
      pattern: 'concrete',
    },
    {
      id: 'fac_shipping',
      name: 'ساحة الحاويات والشحن 🚢',
      x: 1640,
      y: 28,
      w: 1332,
      h: 1332,
      floorColor: '#E4E4E7',
      pattern: 'concrete',
    },
    {
      id: 'fac_warehouse',
      name: 'مخزن الصناديق الخشبية 📦',
      x: 28,
      y: 1640,
      w: 1312,
      h: 1332,
      floorColor: '#D6D3D1',
      pattern: 'tile',
    },
    {
      id: 'fac_control',
      name: 'غرفة التحكم والمولدات ⚡',
      x: 1640,
      y: 1640,
      w: 1332,
      h: 1332,
      floorColor: '#CBD5E1',
      pattern: 'checker',
    },
    {
      id: 'fac_alley_v',
      name: 'الممر الصناعي الطولي 🚧',
      x: 1340,
      y: 28,
      w: 300,
      h: 2944,
      floorColor: '#A1A1AA',
      pattern: 'hall',
    },
    {
      id: 'fac_alley_h',
      name: 'ممر الرافعات العرضي 🚧',
      x: 28,
      y: 1360,
      w: 2944,
      h: 280,
      floorColor: '#A1A1AA',
      pattern: 'hall',
    },
  ],
  walls: [
    ...OUTER_WALLS,
    // Vertical Spine Walls (x=1326, x=1626)
    { x: 1326, y: 28, w: 28, h: 482 },
    { x: 1326, y: 720, w: 28, h: 640 },
    { x: 1326, y: 1640, w: 28, h: 520 },
    { x: 1326, y: 2380, w: 28, h: 592 },

    { x: 1626, y: 28, w: 28, h: 482 },
    { x: 1626, y: 720, w: 28, h: 640 },
    { x: 1626, y: 1640, w: 28, h: 520 },
    { x: 1626, y: 2380, w: 28, h: 592 },

    // Horizontal Spine Walls (y=1346, y=1626)
    { x: 28, y: 1346, w: 502, h: 28 },
    { x: 750, y: 1346, w: 576, h: 28 },
    { x: 1654, y: 1346, w: 516, h: 28 },
    { x: 2390, y: 1346, w: 582, h: 28 },

    { x: 28, y: 1626, w: 462, h: 28 },
    { x: 710, y: 1626, w: 616, h: 28 },
    { x: 1654, y: 1626, w: 556, h: 28 },
    { x: 2430, y: 1626, w: 542, h: 28 },

    // Assembly Line Internal Maze Walls
    { x: 560, y: 28, w: 28, h: 540 },
    { x: 260, y: 840, w: 720, h: 28 },

    // Shipping Yard Container Maze Walls
    { x: 2180, y: 28, w: 28, h: 620 },
    { x: 2208, y: 860, w: 540, h: 28 },

    // Warehouse Storage Maze Walls + Dead-End Corner
    { x: 620, y: 1920, w: 28, h: 740 },
    { x: 28, y: 2340, w: 380, h: 28 },

    // Control Room & Generator Dead-End
    { x: 2240, y: 1654, w: 28, h: 620 },
    { x: 1920, y: 2560, w: 660, h: 28 },

    // Industrial Pillars in Cross Alleys
    { x: 960, y: 1455, w: 76, h: 76 },
    { x: 1980, y: 1455, w: 76, h: 76 },
  ],
  doors: [
    { x: 1326, y: 510, w: 28, h: 210, orientation: 'v' },
    { x: 1326, y: 2160, w: 28, h: 220, orientation: 'v' },
    { x: 1626, y: 510, w: 28, h: 210, orientation: 'v' },
    { x: 1626, y: 2160, w: 28, h: 220, orientation: 'v' },
    { x: 530, y: 1346, w: 220, h: 28, orientation: 'h' },
    { x: 2170, y: 1346, w: 220, h: 28, orientation: 'h' },
    { x: 490, y: 1626, w: 220, h: 28, orientation: 'h' },
    { x: 2210, y: 1626, w: 220, h: 28, orientation: 'h' },
  ],
  furniture: [
    // Assembly Line
    { id: 'fac_conv1', x: 90, y: 170, w: 340, h: 96, style: 'conveyor', label: 'خط سير ١', hideable: false, blocksSight: true, solidCollision: true, primaryColor: '#3F3F46', accentColor: '#FACC15' },
    { id: 'fac_mach1', x: 760, y: 120, w: 220, h: 140, style: 'machinery', label: 'ماكينة الكبس', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#EA580C', accentColor: '#FED7AA' },
    { id: 'fac_crate1', x: 120, y: 500, w: 160, h: 120, style: 'crate', label: 'صندوق قطع غيار', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#B45309', accentColor: '#FDE68A' },
    { id: 'fac_lock1', x: 1040, y: 1040, w: 210, h: 92, style: 'locker', label: 'لوكر العمال', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#2563EB', accentColor: '#DBEAFE' },
    { id: 'fac_crate2', x: 110, y: 1040, w: 170, h: 120, style: 'crate', label: 'صندوق أدوات', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#92400E', accentColor: '#FCD34D' },
    // Shipping Yard
    { id: 'fac_cont1', x: 1760, y: 120, w: 290, h: 145, style: 'container', label: 'حاوية زرقاء', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#1D4ED8', accentColor: '#93C5FD' },
    { id: 'fac_cont2', x: 2520, y: 160, w: 300, h: 145, style: 'container', label: 'حاوية حمراء', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#DC2626', accentColor: '#FCA5A5' },
    { id: 'fac_cont3', x: 1740, y: 980, w: 300, h: 145, style: 'container', label: 'حاوية خضراء', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#15803D', accentColor: '#86EFAC' },
    { id: 'fac_crate3', x: 2580, y: 1080, w: 170, h: 120, style: 'crate', label: 'صندوق شحن', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#B45309', accentColor: '#FDE047' },
    // Warehouse
    { id: 'fac_crate4', x: 120, y: 1740, w: 180, h: 125, style: 'crate', label: 'صناديق كبيرة', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#A16207', accentColor: '#FEF08A' },
    { id: 'fac_crate5', x: 860, y: 1860, w: 180, h: 125, style: 'crate', label: 'صناديق التغليف', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#B45309', accentColor: '#FDE68A' },
    { id: 'fac_cont4', x: 120, y: 2660, w: 300, h: 140, style: 'container', label: 'حاوية المخزن', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#CA8A04', accentColor: '#FEF08A' },
    { id: 'fac_lock2', x: 960, y: 2740, w: 220, h: 92, style: 'locker', label: 'لوكر المخزن', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#475569', accentColor: '#CBD5E1' },
    // Control Room & Generators
    { id: 'fac_mach2', x: 1760, y: 1760, w: 250, h: 140, style: 'machinery', label: 'المولد العملاق', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#B91C1C', accentColor: '#FDE047' },
    { id: 'fac_desk1', x: 2560, y: 1760, w: 220, h: 96, style: 'desk', label: 'لوحة التحكم', hideable: false, blocksSight: false, solidCollision: true, primaryColor: '#1E293B', accentColor: '#38BDF8' },
    { id: 'fac_lock3', x: 2620, y: 2740, w: 220, h: 92, style: 'locker', label: 'لوكر الصيانة', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#0F766E', accentColor: '#99F6E4' },
    { id: 'fac_crate6', x: 1760, y: 2740, w: 170, h: 115, style: 'crate', label: 'صندوق كابلات', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#92400E', accentColor: '#FCD34D' },
    { id: 'fac_conv2', x: 1410, y: 1080, w: 160, h: 88, style: 'crate', label: 'صندوق الممر', hideable: true, blocksSight: true, solidCollision: true, primaryColor: '#B45309', accentColor: '#FDE68A' },
  ],
  seekerSpawn: { x: 1490, y: 1500 },
  hiderSpots: [
    { x: 360, y: 660 },
    { x: 1020, y: 540 },
    { x: 540, y: 1120 },
    { x: 1940, y: 540 },
    { x: 2580, y: 560 },
    { x: 2280, y: 1140 },
    { x: 380, y: 2040 },
    { x: 960, y: 2340 },
    { x: 460, y: 2540 },
    { x: 1940, y: 2140 },
    { x: 2620, y: 2140 },
    { x: 2180, y: 2780 },
    { x: 1490, y: 620 },
    { x: 1490, y: 2280 },
  ],
  patrolWaypoints: [
    { x: 1490, y: 1500 },
    { x: 1490, y: 610 },
    { x: 640, y: 1490 },
    { x: 2280, y: 1490 },
    { x: 1490, y: 2270 },
    { x: 380, y: 680 },
    { x: 1960, y: 560 },
    { x: 860, y: 2260 },
    { x: 380, y: 2140 },
    { x: 1920, y: 2240 },
    { x: 2580, y: 2140 },
    { x: 2220, y: 2780 },
  ],
};

export const KHLAWIS_MAPS: Record<MazeMapId, MazeMapDefinition> = {
  apartment: APARTMENT_MAP,
  hospital: HOSPITAL_MAP,
  factory: FACTORY_MAP,
};

export const KHLAWIS_MAP_ORDER: MazeMapId[] = ['apartment', 'hospital', 'factory'];
