import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  Eye,
  EyeOff,
  Flashlight,
  Map as MapIcon,
  Play,
  Search,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
import {
  KHLAWIS_MAP_ORDER,
  KHLAWIS_MAPS,
  KHLAWIS_WORLD_H,
  KHLAWIS_WORLD_W,
  MazeFurniture,
  MazeMapDefinition,
  MazeMapId,
} from '../../data/khlawisMaps';
import { useTapGuard } from '../../hooks/useAntiDoubleTap';
import { useArcadeTouchLock } from '../../hooks/useArcadeTouchLock';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import {
  ARCADE_COLORS,
  ArcadePlayer,
  TURN_ARCADE_COLOR_ORDER,
} from '../../types/arcade';
import { Player, RoundDelta } from '../../types/game';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ConfirmModal } from '../ConfirmModal';
import { HomeLogoBadge } from '../HomeLogoBadge';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { ArcadeWinnerSpotlight } from './ArcadeWinnerSpotlight';

interface KhlawisGameProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToArcadeHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
  onEditPlayers?: () => void;
}

type KhlawisMode = 'normal' | 'dark' | 'zombie';
type KhlawisPhase =
  | 'SETUP'
  | 'HIDE_HANDOFF'
  | 'HIDE_ACTIVE'
  | 'SEEK_HANDOFF'
  | 'SEEK_ACTIVE'
  | 'WINNER_SPOTLIGHT'
  | 'LEADERBOARD';

interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

interface HiderState {
  playerIdx: number;
  x: number;
  y: number;
  angle: number;
  walkPhase: number;
  hiddenInId: string | null;
  caught: boolean;
  caughtAtSec: number | null;
}

interface ZombieState {
  id: number;
  x: number;
  y: number;
  angle: number;
  walkPhase: number;
  waypointIdx: number;
  stuckTimer: number;
  color: string;
}

interface HunterEntity {
  slotIdx: number;
  playerIdx: number;
  role: 'seeker' | 'zombie';
  name: string;
  hex: string;
  x: number;
  y: number;
  angle: number;
  walkPhase: number;
  camX: number;
  camY: number;
  catches: number;
}

interface FootstepMark {
  x: number;
  y: number;
  angle: number;
  side: -1 | 1;
  color: string;
  life: number;
}

interface BurstEffect {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const WORLD_W = KHLAWIS_WORLD_W;
const WORLD_H = KHLAWIS_WORLD_H;
const PLAYER_R = 20;
const HIDE_SECONDS = 25;
const HIDER_SPEED = 310;
const SEEKER_SPEED = 325;
const ZOMBIE_SPEED = 295;

// Softer twilight dark mode with wider, clearer wall-occluded flashlight
const DARK_FLASHLIGHT_HALF_FOV = 0.56;
const DARK_FLASHLIGHT_RANGE = 430;
const NORMAL_SIGHT_RANGE = 560;
const HIDE_INTERACT_DIST = 96;
const INSPECT_INTERACT_DIST = 112;
const MAX_ZOMBIES = 3; // 1 Seeker + up to 3 human Zombie players = max 4 live split-screen viewports

const SEARCH_TIME_OPTIONS = [180, 240, 300];

const MODE_CONFIG: Record<
  KhlawisMode,
  { title: string; subtitle: string; badge: string; emoji: string }
> = {
  normal: {
    title: 'الوضع العادي',
    subtitle: 'اتحرك في الخريطة الواسعة واستخبى جوه الدواليب، السراير، أو الحاويات!',
    badge: 'كشاف ومجال رؤية كامل',
    emoji: '🕵️‍♂️',
  },
  dark: {
    title: 'مود الضلمة 🔦',
    subtitle: 'إضاءة خافتة في المكان! الباحث معاه كشاف واسع وواضح بيتحجب بالحيطان والزوايا.',
    badge: 'ظلام خفيف + كشاف واضح',
    emoji: '🔦',
  },
  zombie: {
    title: 'مود الزومبي 🧟‍♂️',
    subtitle: 'اللي يتمسك بيتحول لزومبي بشري والشاشة بتتقسم تلقائياً (حتى ٤ لاعبين) يطاردوا مع الباحث!',
    badge: 'شاشة مقسمة حتى ٤ لاعبين',
    emoji: '🧟‍♂️',
  },
};

function buildOccluderSegments(map: MazeMapDefinition): Segment[] {
  const segs: Segment[] = [];
  const pushRect = (x: number, y: number, w: number, h: number) => {
    segs.push({ ax: x, ay: y, bx: x + w, by: y });
    segs.push({ ax: x + w, ay: y, bx: x + w, by: y + h });
    segs.push({ ax: x + w, ay: y + h, bx: x, by: y + h });
    segs.push({ ax: x, ay: y + h, bx: x, by: y });
  };
  for (const w of map.walls) pushRect(w.x, w.y, w.w, w.h);
  for (const f of map.furniture) {
    if (f.blocksSight) pushRect(f.x, f.y, f.w, f.h);
  }
  return segs;
}

function raySegmentIntersectDist(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  seg: Segment
): number | null {
  const sx = seg.bx - seg.ax;
  const sy = seg.by - seg.ay;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-6) return null;
  const qx = seg.ax - ox;
  const qy = seg.ay - oy;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * dy - qy * dx) / denom;
  if (t >= 0 && t <= maxDist && u >= 0 && u <= 1) {
    return t;
  }
  return null;
}

function castRay(
  ox: number,
  oy: number,
  angle: number,
  maxDist: number,
  segments: Segment[]
): { x: number; y: number } {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let bestT = maxDist;
  for (let i = 0; i < segments.length; i++) {
    const t = raySegmentIntersectDist(ox, oy, dx, dy, bestT, segments[i]);
    if (t !== null && t < bestT) bestT = t;
  }
  return { x: ox + dx * bestT, y: oy + dy * bestT };
}

function hasLineOfSight(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  segments: Segment[]
): boolean {
  const vx = bx - ax;
  const vy = by - ay;
  const dist = Math.hypot(vx, vy);
  if (dist < 1) return true;
  const dx = vx / dist;
  const dy = vy / dist;
  for (let i = 0; i < segments.length; i++) {
    const t = raySegmentIntersectDist(ax, ay, dx, dy, dist - 2, segments[i]);
    if (t !== null && t < dist - 2) return false;
  }
  return true;
}

function resolveCircleRect(
  nx: number,
  ny: number,
  r: number,
  rect: { x: number; y: number; w: number; h: number }
): { x: number; y: number } {
  const closestX = Math.max(rect.x, Math.min(nx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(ny, rect.y + rect.h));
  const dx = nx - closestX;
  const dy = ny - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= r * r) return { x: nx, y: ny };

  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    const push = r - dist;
    return { x: nx + (dx / dist) * push, y: ny + (dy / dist) * push };
  }
  const leftD = Math.abs(nx - rect.x);
  const rightD = Math.abs(rect.x + rect.w - nx);
  const topD = Math.abs(ny - rect.y);
  const botD = Math.abs(rect.y + rect.h - ny);
  const minD = Math.min(leftD, rightD, topD, botD);
  if (minD === leftD) return { x: rect.x - r, y: ny };
  if (minD === rightD) return { x: rect.x + rect.w + r, y: ny };
  if (minD === topD) return { x: nx, y: rect.y - r };
  return { x: nx, y: rect.y + rect.h + r };
}

function resolveMapCollision(
  x: number,
  y: number,
  r: number,
  map: MazeMapDefinition,
  ignoreFurnitureCollision = false
): { x: number; y: number } {
  let nx = Math.max(28 + r, Math.min(WORLD_W - 28 - r, x));
  let ny = Math.max(28 + r, Math.min(WORLD_H - 28 - r, y));

  for (let pass = 0; pass < 3; pass++) {
    for (const wall of map.walls) {
      const res = resolveCircleRect(nx, ny, r, wall);
      nx = res.x;
      ny = res.y;
    }
    if (!ignoreFurnitureCollision) {
      for (const furn of map.furniture) {
        if (!furn.solidCollision) continue;
        const res = resolveCircleRect(nx, ny, r, furn);
        nx = res.x;
        ny = res.y;
      }
    }
  }
  return { x: nx, y: ny };
}

function getCurrentRoomName(x: number, y: number, map: MazeMapDefinition): string {
  for (const room of map.rooms) {
    if (
      !room.id.includes('hall') &&
      !room.id.includes('corridor') &&
      !room.id.includes('alley') &&
      !room.id.includes('cross') &&
      x >= room.x &&
      x <= room.x + room.w &&
      y >= room.y &&
      y <= room.y + room.h
    ) {
      return room.name;
    }
  }
  for (const room of map.rooms) {
    if (x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h) {
      return room.name;
    }
  }
  return map.name;
}

function findNearestHideableFurniture(
  x: number,
  y: number,
  maxDist: number,
  map: MazeMapDefinition
): MazeFurniture | null {
  let best: MazeFurniture | null = null;
  let bestDist = maxDist;
  for (const f of map.furniture) {
    if (!f.hideable) continue;
    const cx = Math.max(f.x, Math.min(x, f.x + f.w));
    const cy = Math.max(f.y, Math.min(y, f.y + f.h));
    const d = Math.hypot(x - cx, y - cy);
    if (d <= bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

function getFurnitureHideAnchor(f: MazeFurniture): { x: number; y: number } {
  return { x: f.x + f.w / 2, y: f.y + f.h / 2 };
}

function getSafeExitSpotNearFurniture(
  f: MazeFurniture,
  map: MazeMapDefinition
): { x: number; y: number } {
  const candidates = [
    { x: f.x + f.w / 2, y: f.y + f.h + 36 },
    { x: f.x + f.w / 2, y: f.y - 36 },
    { x: f.x + f.w + 36, y: f.y + f.h / 2 },
    { x: f.x - 36, y: f.y + f.h / 2 },
  ];
  for (const c of candidates) {
    const res = resolveMapCollision(c.x, c.y, PLAYER_R, map, false);
    if (Math.hypot(res.x - c.x, res.y - c.y) < 16) return res;
  }
  return resolveMapCollision(f.x + f.w / 2, f.y + f.h + 40, PLAYER_R, map, false);
}

function normalizeAngleDiff(target: number, current: number): number {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function drawExpressiveCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  walkPhase: number,
  bodyHex: string,
  name: string,
  options?: { isSeeker?: boolean; isZombie?: boolean }
) {
  const swing = Math.sin(walkPhase) * 6;
  const footSwing = Math.sin(walkPhase) * 5;

  ctx.save();

  // Ground drop shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 17, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Stepping shoes/feet
  ctx.fillStyle = options?.isZombie ? '#14532D' : '#1E293B';
  ctx.beginPath();
  ctx.ellipse(4 + footSwing, -10, 6.5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(4 - footSwing, 10, 6.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Swinging arms & hands
  ctx.fillStyle = options?.isZombie ? '#4ADE80' : '#FDE68A';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(8 + swing, -16, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8 - swing, 16, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (options?.isSeeker) {
    ctx.fillStyle = '#334155';
    ctx.fillRect(10, -19, 13, 6);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(21, -20, 4, 8);
  }

  // Colored shirt/torso
  ctx.fillStyle = bodyHex;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 14, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = options?.isZombie ? '#84CC16' : '#FCD34D';
  ctx.beginPath();
  ctx.arc(4, 0, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Expressive eyes
  ctx.fillStyle = options?.isZombie ? '#DC2626' : '#FFFFFF';
  ctx.beginPath();
  ctx.arc(10, -4.2, 3.2, 0, Math.PI * 2);
  ctx.arc(10, 4.2, 3.2, 0, Math.PI * 2);
  ctx.fill();

  if (!options?.isZombie) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(11.4, -4.2, 1.6, 0, Math.PI * 2);
    ctx.arc(11.4, 4.2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (options?.isSeeker) {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(2, 0, 11.5, Math.PI * 0.6, Math.PI * 1.4);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(1, -4, 4, 8);
  }

  ctx.restore();

  // Name badge pill above head
  ctx.font = '900 12px Cairo, sans-serif';
  ctx.textAlign = 'center';
  const labelW = Math.max(46, ctx.measureText(name).width + 14);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x - labelW / 2, y - 38, labelW, 20, 10);
  ctx.fill();
  ctx.strokeStyle = bodyHex;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(name, x, y - 24);

  ctx.restore();
}

function drawFurnitureItem(
  ctx: CanvasRenderingContext2D,
  f: MazeFurniture,
  highlighted: boolean,
  searchedRecently: boolean,
  now: number,
  hiderInsideSelfBadge?: string | null
) {
  ctx.save();

  // Deep two-layer soft floor shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
  ctx.beginPath();
  ctx.roundRect(f.x + 8, f.y + 11, f.w, f.h, 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.roundRect(f.x + 4, f.y + 6, f.w, f.h, 12);
  ctx.fill();

  if (highlighted) {
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(f.x - 5, f.y - 5, f.w + 10, f.h + 10, 15);
    ctx.stroke();
  }

  switch (f.style) {
    case 'bed':
    case 'hospital_bed': {
      ctx.fillStyle = f.style === 'hospital_bed' ? '#94A3B8' : '#78350F';
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 12);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(f.x + 8, f.y + 8, f.w - 16, f.h - 16, 8);
      ctx.fill();

      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x + 8, f.y + f.h * 0.36, f.w - 16, f.h * 0.56, 8);
      ctx.fill();

      ctx.fillStyle = f.accentColor;
      ctx.beginPath();
      ctx.roundRect(f.x + 16, f.y + 12, f.w * 0.36, 30, 7);
      ctx.roundRect(f.x + f.w - 16 - f.w * 0.36, f.y + 12, f.w * 0.36, 30, 7);
      ctx.fill();

      if (f.style === 'hospital_bed') {
        // Side rails
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.strokeRect(f.x + 4, f.y + 14, f.w - 8, f.h - 28);
      }
      break;
    }
    case 'wardrobe':
    case 'medicine_cabinet':
    case 'locker': {
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 10);
      ctx.fill();
      ctx.strokeStyle = f.style === 'medicine_cabinet' ? '#64748B' : '#1E293B';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (f.style === 'locker') {
        // 4 locker bay doors + vents
        const cols = 4;
        const cw = f.w / cols;
        ctx.strokeStyle = f.accentColor;
        ctx.lineWidth = 2;
        for (let i = 1; i < cols; i++) {
          ctx.beginPath();
          ctx.moveTo(f.x + cw * i, f.y + 6);
          ctx.lineTo(f.x + cw * i, f.y + f.h - 6);
          ctx.stroke();
        }
      } else if (f.style === 'medicine_cabinet') {
        // Medical cross icon on top
        const cx = f.x + f.w / 2;
        const cy = f.y + f.h / 2;
        ctx.fillStyle = f.accentColor;
        ctx.fillRect(cx - 12, cy - 4, 24, 8);
        ctx.fillRect(cx - 4, cy - 12, 8, 24);
      } else {
        ctx.strokeStyle = f.accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x + f.w / 2, f.y + 6);
        ctx.lineTo(f.x + f.w / 2, f.y + f.h - 6);
        ctx.stroke();
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(f.x + f.w / 2 - 10, f.y + f.h / 2, 4, 0, Math.PI * 2);
        ctx.arc(f.x + f.w / 2 + 10, f.y + f.h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'sofa': {
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 16);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = f.accentColor;
      if (f.w >= f.h) {
        const cW = (f.w - 32) / 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.roundRect(f.x + 10 + i * (cW + 6), f.y + 14, cW, f.h - 24, 8);
          ctx.fill();
        }
      } else {
        const cH = (f.h - 32) / 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.roundRect(f.x + 12, f.y + 10 + i * (cH + 6), f.w - 24, cH, 8);
          ctx.fill();
        }
      }
      break;
    }
    case 'curtain':
    case 'medical_curtain': {
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 12);
      ctx.fill();
      ctx.strokeStyle = f.accentColor;
      ctx.lineWidth = 3;
      for (let cy = f.y + 18; cy < f.y + f.h - 14; cy += 22) {
        ctx.beginPath();
        ctx.moveTo(f.x + 8, cy);
        ctx.quadraticCurveTo(f.x + f.w / 2, cy + 9, f.x + f.w - 8, cy);
        ctx.stroke();
      }
      break;
    }
    case 'container': {
      // Ribbed shipping container
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 10);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = f.accentColor;
      ctx.lineWidth = 2.5;
      for (let rx = f.x + 22; rx < f.x + f.w - 14; rx += 26) {
        ctx.beginPath();
        ctx.moveTo(rx, f.y + 10);
        ctx.lineTo(rx, f.y + f.h - 10);
        ctx.stroke();
      }
      break;
    }
    case 'crate': {
      // Wooden crate with X bracing
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 8);
      ctx.fill();
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = f.accentColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(f.x + 10, f.y + 10, f.w - 20, f.h - 20);
      ctx.beginPath();
      ctx.moveTo(f.x + 12, f.y + 12);
      ctx.lineTo(f.x + f.w - 12, f.y + f.h - 12);
      ctx.moveTo(f.x + f.w - 12, f.y + 12);
      ctx.lineTo(f.x + 12, f.y + f.h - 12);
      ctx.stroke();
      break;
    }
    case 'conveyor': {
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 12);
      ctx.fill();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = f.accentColor;
      ctx.lineWidth = 2.5;
      for (let cx = f.x + 24; cx < f.x + f.w - 20; cx += 34) {
        ctx.beginPath();
        ctx.moveTo(cx, f.y + 14);
        ctx.lineTo(cx + 12, f.y + f.h / 2);
        ctx.lineTo(cx, f.y + f.h - 14);
        ctx.stroke();
      }
      break;
    }
    case 'machinery': {
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 12);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Hazard stripes & gear circles
      ctx.fillStyle = f.accentColor;
      ctx.beginPath();
      ctx.arc(f.x + f.w * 0.3, f.y + f.h / 2, 22, 0, Math.PI * 2);
      ctx.arc(f.x + f.w * 0.7, f.y + f.h / 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
      break;
    }
    case 'operating_table': {
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 14);
      ctx.fill();
      ctx.fillStyle = f.accentColor;
      ctx.beginPath();
      ctx.roundRect(f.x + 14, f.y + 14, f.w - 28, f.h - 28, 10);
      ctx.fill();
      break;
    }
    case 'wheelchair': {
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x + 12, f.y + 12, f.w - 24, f.h - 24, 12);
      ctx.fill();
      ctx.strokeStyle = f.accentColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx - 24, cy, 18, 0, Math.PI * 2);
      ctx.arc(cx + 24, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'tv': {
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 10);
      ctx.fill();
      ctx.fillStyle = f.accentColor;
      ctx.fillRect(f.x + 26, f.y + 12, f.w - 52, 14);
      break;
    }
    case 'bathtub': {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 24);
      ctx.fill();
      ctx.strokeStyle = f.primaryColor;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#7DD3FC';
      ctx.beginPath();
      ctx.roundRect(f.x + 20, f.y + 20, f.w - 40, f.h - 40, 18);
      ctx.fill();
      break;
    }
    case 'plant': {
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.arc(cx, cy, f.w * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = f.primaryColor;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18, 16, 8, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = f.accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'hospital_monitor': {
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 9);
      ctx.fill();
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Glowing dark screen + animated ECG pulse waveform
      const sx = f.x + 6;
      const sy = f.y + 6;
      const sw = f.w - 12;
      const sh = f.h - 14;
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 5);
      ctx.fill();

      const midY = sy + sh * 0.55;
      const scan = ((now * 0.05) % sw);
      ctx.strokeStyle = f.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 2, midY);
      ctx.lineTo(sx + sw * 0.28, midY);
      ctx.lineTo(sx + sw * 0.36, midY - sh * 0.32);
      ctx.lineTo(sx + sw * 0.44, midY + sh * 0.26);
      ctx.lineTo(sx + sw * 0.52, midY - sh * 0.14);
      ctx.lineTo(sx + sw * 0.62, midY);
      ctx.lineTo(sx + sw - 2, midY);
      ctx.stroke();

      // Blinking pulse dot sweeping across ECG line
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sx + scan, midY, 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Status LED
      ctx.fillStyle = Math.floor(now / 450) % 2 === 0 ? f.accentColor : '#334155';
      ctx.beginPath();
      ctx.arc(f.x + f.w - 9, f.y + f.h - 5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      // Table / Kitchen counter / Desk
      ctx.fillStyle = f.primaryColor;
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 12);
      ctx.fill();
      ctx.fillStyle = f.accentColor;
      ctx.beginPath();
      ctx.roundRect(f.x + 12, f.y + 12, f.w - 24, f.h - 24, 8);
      ctx.fill();
      break;
    }
  }

  // Label badge on furniture (if Hider is hidden inside during HIDE_ACTIVE, show tucked badge)
  ctx.font = '800 13px Cairo, sans-serif';
  ctx.textAlign = 'center';
  const badgeText = hiderInsideSelfBadge
    ? hiderInsideSelfBadge
    : searchedRecently
      ? `${f.label} ✓`
      : f.hideable
        ? `🫣 ${f.label}`
        : f.label;
  ctx.strokeStyle = hiderInsideSelfBadge ? '#065F46' : 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 3.5;
  ctx.strokeText(badgeText, f.x + f.w / 2, f.y + f.h / 2 + 5);
  ctx.fillStyle = hiderInsideSelfBadge ? '#86EFAC' : '#0F172A';
  ctx.fillText(badgeText, f.x + f.w / 2, f.y + f.h / 2 + 5);

  ctx.restore();
}

export const KhlawisGame: React.FC<KhlawisGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
  onTournamentFinish,
  onEditPlayers,
}) => {
  const guard = useTapGuard(350);
  const goHome = useGoHome();

  const [phase, setPhase] = useState<KhlawisPhase>('SETUP');
  const [selectedMapId, setSelectedMapId] = useState<MazeMapId>('apartment');
  const [mode, setMode] = useState<KhlawisMode>('normal');
  const [huntSeconds, setHuntSeconds] = useState<number>(180);
  const [seekerPlayerIdx, setSeekerPlayerIdx] = useState<number>(() =>
    Math.floor(Math.random() * players.length)
  );
  const [hiderQueue, setHiderQueue] = useState<number[]>([]);
  const [hideStep, setHideStep] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(HIDE_SECONDS);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const [caughtCountUI, setCaughtCountUI] = useState<number>(0);
  const [totalHidersUI, setTotalHidersUI] = useState<number>(Math.max(1, players.length - 1));
  const [nearbyFurn, setNearbyFurn] = useState<{ id: string; label: string } | null>(null);
  const [hunterNearbyFurns, setHunterNearbyFurns] = useState<Array<{ id: string; label: string } | null>>([
    null,
    null,
    null,
    null,
  ]);
  const [activeHunterCount, setActiveHunterCount] = useState<number>(1);
  const [hunterBadges, setHunterBadges] = useState<
    Array<{ name: string; hex: string; role: 'seeker' | 'zombie'; room: string }>
  >([]);
  const [isCurrentHidden, setIsCurrentHidden] = useState<boolean>(false);
  const [currentRoomLabel, setCurrentRoomLabel] = useState<string>('الممر الرئيسي 🚪');

  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [winnerPlayers, setWinnerPlayers] = useState<ArcadePlayer[]>([]);
  const [summaryHeadline, setSummaryHeadline] = useState<string>('');
  const [joyVisuals, setJoyVisuals] = useState<Array<{ kx: number; ky: number; active: boolean }>>([
    { kx: 0, ky: 0, active: false },
    { kx: 0, ky: 0, active: false },
    { kx: 0, ky: 0, active: false },
    { kx: 0, ky: 0, active: false },
  ]);

  const activeMap = useMemo<MazeMapDefinition>(() => KHLAWIS_MAPS[selectedMapId], [selectedMapId]);
  const occluderSegments = useMemo<Segment[]>(() => buildOccluderSegments(activeMap), [activeMap]);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewSizeRef = useRef<{ w: number; h: number }>({ w: 390, h: 760 });
  const cameraRef = useRef<{ x: number; y: number }>({ x: 1000, y: 1000 });

  const huntersRef = useRef<HunterEntity[]>([]);
  const hidersRef = useRef<HiderState[]>([]);
  const zombiesRef = useRef<ZombieState[]>([]);
  const footstepsRef = useRef<FootstepMark[]>([]);
  const burstsRef = useRef<BurstEffect[]>([]);
  const searchedUntilMapRef = useRef<Record<string, number>>({});

  // Strictly fixed base multi-touch joystick slots (up to 4 isolated pointerIds for dynamic split-screen)
  const hunterJoysRef = useRef<
    Array<{
      pointerId: number | null;
      cx: number;
      cy: number;
      dx: number;
      dy: number;
      active: boolean;
    }>
  >([
    { pointerId: null, cx: 0, cy: 0, dx: 0, dy: 0, active: false },
    { pointerId: null, cx: 0, cy: 0, dx: 0, dy: 0, active: false },
    { pointerId: null, cx: 0, cy: 0, dx: 0, dy: 0, active: false },
    { pointerId: null, cx: 0, cy: 0, dx: 0, dy: 0, active: false },
  ]);

  const secondsLeftRef = useRef<number>(secondsLeft);
  const roundEndedRef = useRef<boolean>(false);

  // Keep seekerPlayerIdx within bounds if players were edited
  useEffect(() => {
    if (seekerPlayerIdx >= players.length) {
      setSeekerPlayerIdx(0);
    }
  }, [players.length, seekerPlayerIdx]);

  const isGameActive =
    phase === 'HIDE_HANDOFF' ||
    phase === 'HIDE_ACTIVE' ||
    phase === 'SEEK_HANDOFF' ||
    phase === 'SEEK_ACTIVE';

  useArcadeTouchLock(phase === 'HIDE_ACTIVE' || phase === 'SEEK_ACTIVE', arenaRef);
  useNavigationGuard(isGameActive, () => setShowExitConfirm(true));

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  const playerHexes = useMemo(
    () =>
      players.map((_, idx) => {
        const cId = TURN_ARCADE_COLOR_ORDER[idx % TURN_ARCADE_COLOR_ORDER.length];
        return ARCADE_COLORS[cId].hex;
      }),
    [players]
  );

  const arcadePlayersAdapter = useMemo<ArcadePlayer[]>(
    () =>
      players.map((p, idx) => ({
        id: p.id,
        name: p.name,
        colorId: TURN_ARCADE_COLOR_ORDER[idx % TURN_ARCADE_COLOR_ORDER.length],
        score: p.score,
      })),
    [players]
  );

  const clearJoystick = useCallback(() => {
    hunterJoysRef.current.forEach((slot) => {
      slot.pointerId = null;
      slot.dx = 0;
      slot.dy = 0;
      slot.active = false;
    });
    setJoyVisuals([
      { kx: 0, ky: 0, active: false },
      { kx: 0, ky: 0, active: false },
      { kx: 0, ky: 0, active: false },
      { kx: 0, ky: 0, active: false },
    ]);
  }, []);

  const currentHiderPlayerIdx = hiderQueue[hideStep] ?? 0;

  const finalizeRound = useCallback(
    (seekerWonAll: boolean) => {
      if (roundEndedRef.current) return;
      roundEndedRef.current = true;
      clearJoystick();

      const caughtCount = hidersRef.current.filter((h) => h.caught).length;
      const totalH = hidersRef.current.length;
      const deltas: RoundDelta[] = players.map((p, idx) => {
        if (idx === seekerPlayerIdx) {
          const pts = seekerWonAll ? caughtCount * 45 + 60 : caughtCount * 35;
          return { playerId: p.id, delta: pts };
        }
        const hState = hidersRef.current.find((h) => h.playerIdx === idx);
        if (!hState) return { playerId: p.id, delta: 0 };
        if (!hState.caught) {
          return { playerId: p.id, delta: 100 };
        }
        const zombieHunter = huntersRef.current.find(
          (ht) => ht.role === 'zombie' && ht.playerIdx === idx
        );
        const zombieAssistBonus = zombieHunter ? zombieHunter.catches * 15 : 0;
        const survived = Math.max(0, huntSeconds - (hState.caughtAtSec ?? 0));
        return {
          playerId: p.id,
          delta: Math.min(75, Math.round(survived * 0.45) + zombieAssistBonus),
        };
      });

      onApplyDeltas(deltas);
      setRoundDeltas(deltas);

      const survivors = hidersRef.current.filter((h) => !h.caught);
      let winners: ArcadePlayer[] = [];
      let headline = '';

      if (seekerWonAll || survivors.length === 0) {
        winners = [arcadePlayersAdapter[seekerPlayerIdx]].filter(Boolean);
        headline = `الباحث ${players[seekerPlayerIdx]?.name ?? ''} مسك الكل في ${activeMap.name}! 🕵️‍♂️🔥`;
      } else {
        winners = survivors
          .map((s) => arcadePlayersAdapter[s.playerIdx])
          .filter(Boolean);
        headline =
          survivors.length === 1
            ? `الناجي الوحيد في ${activeMap.name}: ${players[survivors[0].playerIdx]?.name ?? ''}! 🏆`
            : `الوقت خلص! ${survivors.length} من ${totalH} لاعبين استخبوا بنجاح! 🥷`;
      }

      setWinnerPlayers(winners);
      setSummaryHeadline(headline);
      soundManager.play('victory');
      setPhase('WINNER_SPOTLIGHT');
    },
    [clearJoystick, players, seekerPlayerIdx, huntSeconds, onApplyDeltas, arcadePlayersAdapter, activeMap.name]
  );

  // Start a new match from SETUP
  const handleStartGame = guard(() => {
    soundManager.unlock();
    soundManager.play('next');
    roundEndedRef.current = false;
    clearJoystick();

    const q = players
      .map((_, idx) => idx)
      .filter((idx) => idx !== seekerPlayerIdx);

    // Shuffle initial hider spots so 2 to 20 players start spread across rooms cleanly
    const spots = activeMap.hiderSpots;
    hidersRef.current = q.map((pIdx, i) => {
      const baseSpot = spots[i % spots.length];
      const ring = Math.floor(i / spots.length);
      const jitterX = ring > 0 ? Math.cos(i * 2.1) * 44 : 0;
      const jitterY = ring > 0 ? Math.sin(i * 2.1) * 44 : 0;
      const safePos = resolveMapCollision(
        baseSpot.x + jitterX,
        baseSpot.y + jitterY,
        PLAYER_R,
        activeMap,
        false
      );
      return {
        playerIdx: pIdx,
        x: safePos.x,
        y: safePos.y,
        angle: 0,
        walkPhase: 0,
        hiddenInId: null,
        caught: false,
        caughtAtSec: null,
      };
    });

    const safeSeeker = resolveMapCollision(
      activeMap.seekerSpawn.x,
      activeMap.seekerSpawn.y,
      PLAYER_R,
      activeMap,
      false
    );
    const seekerEntity: HunterEntity = {
      slotIdx: 0,
      playerIdx: seekerPlayerIdx,
      role: 'seeker',
      name: players[seekerPlayerIdx]?.name ?? 'الباحث',
      hex: playerHexes[seekerPlayerIdx] ?? '#EF4444',
      x: safeSeeker.x,
      y: safeSeeker.y,
      angle: -Math.PI / 2,
      walkPhase: 0,
      camX: Math.max(0, safeSeeker.x - 200),
      camY: Math.max(0, safeSeeker.y - 300),
      catches: 0,
    };
    huntersRef.current = [seekerEntity];
    zombiesRef.current = [];
    footstepsRef.current = [];
    burstsRef.current = [];
    searchedUntilMapRef.current = {};

    setActiveHunterCount(1);
    setHunterBadges([
      {
        name: seekerEntity.name,
        hex: seekerEntity.hex,
        role: 'seeker',
        room: getCurrentRoomName(seekerEntity.x, seekerEntity.y, activeMap),
      },
    ]);
    setHunterNearbyFurns([null, null, null, null]);
    setHiderQueue(q);
    setHideStep(0);
    setCaughtCountUI(0);
    setTotalHidersUI(q.length);
    setNearbyFurn(null);
    setIsCurrentHidden(false);
    setSecondsLeft(HIDE_SECONDS);
    setPhase('HIDE_HANDOFF');
  });

  // Countdown timer for HIDE_ACTIVE & SEEK_ACTIVE
  useEffect(() => {
    if (phase !== 'HIDE_ACTIVE' && phase !== 'SEEK_ACTIVE') return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (phase === 'HIDE_ACTIVE') {
            clearJoystick();
            soundManager.play('next');
            if (hideStep + 1 < hiderQueue.length) {
              setHideStep((s) => s + 1);
              setPhase('HIDE_HANDOFF');
            } else {
              setPhase('SEEK_HANDOFF');
            }
          } else {
            finalizeRound(false);
          }
          return 0;
        }
        if (prev <= 6) {
          soundManager.play('tickUrgent');
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, hideStep, hiderQueue.length, clearJoystick, finalizeRound]);

  // Size DPR canvas
  useEffect(() => {
    if (phase !== 'HIDE_ACTIVE' && phase !== 'SEEK_ACTIVE') return;
    const syncSize = () => {
      const container = arenaRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      viewSizeRef.current = { w: rect.width, h: rect.height };
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    if (arenaRef.current) ro.observe(arenaRef.current);
    window.addEventListener('resize', syncSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncSize);
    };
  }, [phase]);

  // Hider Toggle Hide Inside / Step Out of Nearby Furniture
  const handleToggleHideInFurniture = useCallback(() => {
    if (phase !== 'HIDE_ACTIVE') return;
    const activeHider = hidersRef.current.find((h) => h.playerIdx === currentHiderPlayerIdx);
    if (!activeHider) return;

    if (activeHider.hiddenInId) {
      const f = activeMap.furniture.find((item) => item.id === activeHider.hiddenInId);
      const exitPos = f
        ? getSafeExitSpotNearFurniture(f, activeMap)
        : { x: activeHider.x, y: activeHider.y };
      activeHider.x = exitPos.x;
      activeHider.y = exitPos.y;
      activeHider.hiddenInId = null;
      setIsCurrentHidden(false);
      soundManager.play('pop');
      triggerHaptic(18);
      burstsRef.current.push({
        x: exitPos.x,
        y: exitPos.y - 24,
        text: 'خرجت برا!',
        color: '#FDE047',
        life: 0.9,
      });
      return;
    }

    const near = findNearestHideableFurniture(
      activeHider.x,
      activeHider.y,
      HIDE_INTERACT_DIST,
      activeMap
    );
    if (!near) return;
    // Snap directly into the exact center of the furniture piece and mark hidden inside
    const anchor = getFurnitureHideAnchor(near);
    activeHider.x = anchor.x;
    activeHider.y = anchor.y;
    activeHider.hiddenInId = near.id;
    setIsCurrentHidden(true);
    clearJoystick();
    soundManager.play('catch');
    triggerHaptic([20, 30, 20]);
    burstsRef.current.push({
      x: anchor.x,
      y: anchor.y - 26,
      text: `استخبيت جوه ${near.label}! 🫣`,
      color: '#86EFAC',
      life: 1.3,
    });
  }, [phase, currentHiderPlayerIdx, activeMap, clearJoystick]);

  // Helper: Infect caught hider into playable human Zombie hunter (dynamic 1->2->3->4 split-screen)
  const infectHiderToSplitZombie = useCallback(
    (h: HiderState, spawnX: number, spawnY: number) => {
      if (mode !== 'zombie') return;
      if (huntersRef.current.length >= 1 + MAX_ZOMBIES) return;
      if (huntersRef.current.some((ht) => ht.playerIdx === h.playerIdx)) return;

      const slotIdx = huntersRef.current.length;
      const pName = players[h.playerIdx]?.name ?? `زومبي ${slotIdx}`;
      const newHunter: HunterEntity = {
        slotIdx,
        playerIdx: h.playerIdx,
        role: 'zombie',
        name: pName,
        hex: '#84CC16',
        x: spawnX,
        y: spawnY,
        angle: 0,
        walkPhase: 0,
        camX: Math.max(0, spawnX - 180),
        camY: Math.max(0, spawnY - 180),
        catches: 0,
      };
      huntersRef.current.push(newHunter);
      setActiveHunterCount(huntersRef.current.length);
      burstsRef.current.push({
        x: spawnX,
        y: spawnY - 36,
        text: `${pName} تحول لزومبي! الشاشة اتقسمت 🧟‍♂️`,
        color: '#84CC16',
        life: 1.7,
      });
    },
    [mode, players]
  );

  // Hunter Inspect Nearby Furniture Action (per-viewport in split-screen!)
  const handleInspectFurniture = useCallback(
    (hunterSlotIdx = 0) => {
      if (phase !== 'SEEK_ACTIVE' || roundEndedRef.current) return;
      const hunter = huntersRef.current[hunterSlotIdx];
      if (!hunter) return;

      const near = findNearestHideableFurniture(
        hunter.x,
        hunter.y,
        INSPECT_INTERACT_DIST,
        activeMap
      );
      if (!near) return;

      const now = performance.now();
      searchedUntilMapRef.current[near.id] = now + 2600;
      const hiddenInside = hidersRef.current.filter(
        (h) => !h.caught && h.hiddenInId === near.id
      );

      if (hiddenInside.length > 0) {
        hiddenInside.forEach((h) => {
          h.caught = true;
          h.hiddenInId = null;
          h.caughtAtSec = secondsLeftRef.current;
          hunter.catches += 1;
          const exitPos = getSafeExitSpotNearFurniture(near, activeMap);
          h.x = exitPos.x;
          h.y = exitPos.y;

          soundManager.play('catch');
          triggerHaptic([35, 30, 45]);
          burstsRef.current.push({
            x: near.x + near.w / 2,
            y: near.y - 10,
            text: `مسكت ${players[h.playerIdx]?.name ?? ''}! 😱`,
            color: '#FACC15',
            life: 1.5,
          });

          infectHiderToSplitZombie(h, exitPos.x, exitPos.y);
        });

        const totalCaught = hidersRef.current.filter((h) => h.caught).length;
        setCaughtCountUI(totalCaught);
        if (totalCaught >= hidersRef.current.length) {
          window.setTimeout(() => finalizeRound(true), 650);
        }
      } else {
        soundManager.play('whoosh');
        triggerHaptic(18);
        burstsRef.current.push({
          x: near.x + near.w / 2,
          y: near.y - 14,
          text: 'المكان فاضي! 😅',
          color: '#BAE6FD',
          life: 1.25,
        });
      }
    },
    [phase, activeMap, players, infectHiderToSplitZombie, finalizeRound]
  );

  // Main Simulation + Dynamic Split-Screen Camera + Rich Maze Renderer Loop
  useEffect(() => {
    if (phase !== 'HIDE_ACTIVE' && phase !== 'SEEK_ACTIVE') return;

    let rafId = 0;
    let lastTs = performance.now();
    let lastUiSync = 0;

    // Snap camera immediately on entering HIDE_ACTIVE or SEEK_ACTIVE
    const vw0 = viewSizeRef.current.w;
    const vh0 = viewSizeRef.current.h;
    const scale0 = Math.max(0.72, Math.min(1.05, Math.min(vw0, vh0) / 520));
    const vww0 = vw0 / scale0;
    const vwh0 = vh0 / scale0;

    if (phase === 'HIDE_ACTIVE') {
      const initTarget =
        hidersRef.current.find((h) => h.playerIdx === currentHiderPlayerIdx) ??
        activeMap.seekerSpawn;
      cameraRef.current = {
        x: Math.max(0, Math.min(WORLD_W - vww0, initTarget.x - vww0 / 2)),
        y: Math.max(0, Math.min(WORLD_H - vwh0, initTarget.y - vwh0 / 2)),
      };
    } else {
      huntersRef.current.forEach((ht) => {
        ht.camX = Math.max(0, Math.min(WORLD_W - vww0, ht.x - vww0 / 2));
        ht.camY = Math.max(0, Math.min(WORLD_H - vwh0, ht.y - vwh0 / 2));
      });
    }

    const computeViewports = (count: number, vw: number, vh: number) => {
      if (count <= 1) {
        return [{ x: 0, y: 0, w: vw, h: vh }];
      }
      if (count === 2) {
        return [
          { x: 0, y: 0, w: vw, h: vh / 2 },
          { x: 0, y: vh / 2, w: vw, h: vh / 2 },
        ];
      }
      if (count === 3) {
        return [
          { x: 0, y: 0, w: vw / 2, h: vh / 2 },
          { x: vw / 2, y: 0, w: vw / 2, h: vh / 2 },
          { x: 0, y: vh / 2, w: vw, h: vh / 2 },
        ];
      }
      return [
        { x: 0, y: 0, w: vw / 2, h: vh / 2 },
        { x: vw / 2, y: 0, w: vw / 2, h: vh / 2 },
        { x: 0, y: vh / 2, w: vw / 2, h: vh / 2 },
        { x: vw / 2, y: vh / 2, w: vw / 2, h: vh / 2 },
      ];
    };

    const renderSingleViewport = (
      ctx: CanvasRenderingContext2D,
      now: number,
      vp: { x: number; y: number; w: number; h: number },
      focusTarget: { x: number; y: number },
      camState: { camX: number; camY: number },
      viewerHunter: HunterEntity | null,
      isSplit: boolean
    ) => {
      const baseScale = Math.max(0.68, Math.min(1.02, Math.min(vp.w, vp.h) / (isSplit ? 380 : 520)));
      const viewWorldW = vp.w / baseScale;
      const viewWorldH = vp.h / baseScale;

      const targetCamX = Math.max(
        0,
        Math.min(WORLD_W - viewWorldW, focusTarget.x - viewWorldW / 2)
      );
      const targetCamY = Math.max(
        0,
        Math.min(WORLD_H - viewWorldH, focusTarget.y - viewWorldH / 2)
      );
      camState.camX += (targetCamX - camState.camX) * 0.16;
      camState.camY += (targetCamY - camState.camY) * 0.16;

      const camX = camState.camX;
      const camY = camState.camY;

      ctx.save();
      ctx.beginPath();
      ctx.rect(vp.x, vp.y, vp.w, vp.h);
      ctx.clip();

      ctx.fillStyle = activeMap.ambientBg;
      ctx.fillRect(vp.x, vp.y, vp.w, vp.h);

      ctx.translate(vp.x, vp.y);
      ctx.scale(baseScale, baseScale);
      ctx.translate(-camX, -camY);

      // 1. Room Floors + Theme Patterns + Fringed Rugs + Plaques
      for (const room of activeMap.rooms) {
        if (
          room.x + room.w < camX - 40 ||
          room.x > camX + viewWorldW + 40 ||
          room.y + room.h < camY - 40 ||
          room.y > camY + viewWorldH + 40
        ) {
          continue;
        }
        ctx.fillStyle = room.floorColor;
        ctx.fillRect(room.x, room.y, room.w, room.h);

        ctx.save();
        ctx.beginPath();
        ctx.rect(room.x, room.y, room.w, room.h);
        ctx.clip();

        if (room.pattern === 'wood') {
          ctx.strokeStyle = 'rgba(146, 64, 14, 0.13)';
          ctx.lineWidth = 2;
          for (let py = room.y; py < room.y + room.h; py += 44) {
            ctx.beginPath();
            ctx.moveTo(room.x, py);
            ctx.lineTo(room.x + room.w, py);
            ctx.stroke();
          }
          for (let px = room.x; px < room.x + room.w; px += 110) {
            ctx.beginPath();
            ctx.moveTo(px, room.y);
            ctx.lineTo(px, room.y + room.h);
            ctx.stroke();
          }
        } else if (room.pattern === 'checker') {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
          const sz = 60;
          for (let py = room.y; py < room.y + room.h; py += sz) {
            for (let px = room.x; px < room.x + room.w; px += sz) {
              if (((Math.floor(px / sz) + Math.floor(py / sz)) & 1) === 0) {
                ctx.fillRect(px, py, sz, sz);
              }
            }
          }
        } else if (room.pattern === 'hospital_tile') {
          ctx.strokeStyle = 'rgba(14, 116, 144, 0.13)';
          ctx.lineWidth = 2;
          for (let py = room.y; py < room.y + room.h; py += 64) {
            ctx.beginPath();
            ctx.moveTo(room.x, py);
            ctx.lineTo(room.x + room.w, py);
            ctx.stroke();
          }
          for (let px = room.x; px < room.x + room.w; px += 64) {
            ctx.beginPath();
            ctx.moveTo(px, room.y);
            ctx.lineTo(px, room.y + room.h);
            ctx.stroke();
          }
        } else if (room.pattern === 'concrete') {
          ctx.strokeStyle = 'rgba(39, 39, 42, 0.14)';
          ctx.lineWidth = 2;
          for (let py = room.y; py < room.y + room.h; py += 96) {
            ctx.beginPath();
            ctx.moveTo(room.x, py);
            ctx.lineTo(room.x + room.w, py);
            ctx.stroke();
          }
          for (let px = room.x; px < room.x + room.w; px += 96) {
            ctx.beginPath();
            ctx.moveTo(px, room.y);
            ctx.lineTo(px, room.y + room.h);
            ctx.stroke();
          }
        } else if (room.pattern === 'mosaic') {
          ctx.strokeStyle = 'rgba(14, 165, 233, 0.14)';
          ctx.lineWidth = 2;
          for (let py = room.y; py < room.y + room.h; py += 52) {
            ctx.beginPath();
            ctx.moveTo(room.x, py);
            ctx.lineTo(room.x + room.w, py);
            ctx.stroke();
          }
          for (let px = room.x; px < room.x + room.w; px += 52) {
            ctx.beginPath();
            ctx.moveTo(px, room.y);
            ctx.lineTo(px, room.y + room.h);
            ctx.stroke();
          }
        } else {
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.12)';
          ctx.lineWidth = 2;
          for (let py = room.y; py < room.y + room.h; py += 76) {
            ctx.beginPath();
            ctx.moveTo(room.x, py);
            ctx.lineTo(room.x + room.w, py);
            ctx.stroke();
          }
          for (let px = room.x; px < room.x + room.w; px += 76) {
            ctx.beginPath();
            ctx.moveTo(px, room.y);
            ctx.lineTo(px, room.y + room.h);
            ctx.stroke();
          }
        }

        // Fringed patterned carpet
        if (room.rug) {
          const r = room.rug;
          ctx.fillStyle = r.color;
          ctx.beginPath();
          ctx.roundRect(r.x, r.y, r.w, r.h, 24);
          ctx.fill();
          ctx.strokeStyle = r.border;
          ctx.lineWidth = 6;
          ctx.stroke();

          // Inner stitched border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.strokeRect(r.x + 14, r.y + 14, r.w - 28, r.h - 28);
          ctx.setLineDash([]);

          // Fringe tassels on left and right edges
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.lineWidth = 2.4;
          for (let fy = r.y + 22; fy <= r.y + r.h - 22; fy += 14) {
            ctx.beginPath();
            ctx.moveTo(r.x - 10, fy);
            ctx.lineTo(r.x, fy);
            ctx.moveTo(r.x + r.w, fy);
            ctx.lineTo(r.x + r.w + 10, fy);
            ctx.stroke();
          }
        }

        // Subtle glowing room sign plaque
        ctx.font = '900 22px Cairo, sans-serif';
        ctx.textAlign = 'center';
        const plaqueW = Math.min(room.w - 40, Math.max(180, ctx.measureText(room.name).width + 36));
        const px = room.x + room.w / 2 - plaqueW / 2;
        const py = room.y + room.h / 2 - 22;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
        ctx.beginPath();
        ctx.roundRect(px, py, plaqueW, 38, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fillText(room.name, room.x + room.w / 2, room.y + room.h / 2 + 4);

        ctx.restore();
      }

      // 1b. Factory Yellow/Black Warning Stripe Zones
      if (activeMap.hazardZones) {
        for (const hz of activeMap.hazardZones) {
          if (
            hz.x + hz.w < camX - 20 ||
            hz.x > camX + viewWorldW + 20 ||
            hz.y + hz.h < camY - 20 ||
            hz.y > camY + viewWorldH + 20
          ) {
            continue;
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(hz.x, hz.y, hz.w, hz.h);
          ctx.clip();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.38)';
          ctx.lineWidth = 10;
          for (let sx = hz.x - hz.h; sx < hz.x + hz.w + hz.h; sx += 28) {
            ctx.beginPath();
            ctx.moveTo(sx, hz.y + hz.h);
            ctx.lineTo(sx + hz.h, hz.y);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(24, 24, 27, 0.35)';
          ctx.lineWidth = 3;
          ctx.strokeRect(hz.x + 1.5, hz.y + 1.5, hz.w - 3, hz.h - 3);
          ctx.restore();
        }
      }

      // 2. Door Frames
      activeMap.doors.forEach((d) => {
        ctx.fillStyle = '#78350F';
        if (d.orientation === 'v') {
          ctx.fillRect(d.x - 4, d.y - 6, d.w + 8, 12);
          ctx.fillRect(d.x - 4, d.y + d.h - 6, d.w + 8, 12);
          ctx.fillStyle = activeMap.doorColor;
          ctx.fillRect(d.x + 8, d.y + 4, 84, 10);
        } else {
          ctx.fillRect(d.x - 6, d.y - 4, 12, d.h + 8);
          ctx.fillRect(d.x + d.w - 6, d.y - 4, 12, d.h + 8);
          ctx.fillStyle = activeMap.doorColor;
          ctx.fillRect(d.x + 4, d.y + 8, 10, 84);
        }
      });

      // 2b. Animated Fading Footsteps on floor
      footstepsRef.current.forEach((fp) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fp.life * 0.45);
        ctx.translate(fp.x, fp.y);
        ctx.rotate(fp.angle);
        ctx.fillStyle = fp.color;
        ctx.beginPath();
        ctx.ellipse(0, fp.side * 6, 4.5, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 3. Detailed Furniture / Props
      const activeHiderObj =
        phase === 'HIDE_ACTIVE'
          ? hidersRef.current.find((h) => h.playerIdx === currentHiderPlayerIdx) ?? null
          : null;
      const nearCheck = findNearestHideableFurniture(
        focusTarget.x,
        focusTarget.y,
        phase === 'HIDE_ACTIVE' ? HIDE_INTERACT_DIST : INSPECT_INTERACT_DIST,
        activeMap
      );
      activeMap.furniture.forEach((f) => {
        if (
          f.x + f.w < camX - 40 ||
          f.x > camX + viewWorldW + 40 ||
          f.y + f.h < camY - 40 ||
          f.y > camY + viewWorldH + 40
        ) {
          return;
        }
        const searchedRecently = (searchedUntilMapRef.current[f.id] ?? 0) > now;
        const selfHiddenHere =
          phase === 'HIDE_ACTIVE' && activeHiderObj?.hiddenInId === f.id
            ? '🫣 أنت مستخبي جوه!'
            : null;
        drawFurnitureItem(
          ctx,
          f,
          nearCheck?.id === f.id || Boolean(selfHiddenHere),
          searchedRecently,
          now,
          selfHiddenHere
        );
      });

      // 4. Crisp 2.5D Maze Walls with Baseboard Trims
      activeMap.walls.forEach((w) => {
        if (
          w.x + w.w < camX - 30 ||
          w.x > camX + viewWorldW + 30 ||
          w.y + w.h < camY - 30 ||
          w.y > camY + viewWorldH + 30
        ) {
          return;
        }
        ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.fillRect(w.x + 6, w.y + 8, w.w, w.h);
        ctx.fillStyle = activeMap.wallMainColor;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = activeMap.wallTopColor;
        ctx.fillRect(w.x + 3, w.y + 3, Math.max(2, w.w - 6), Math.max(2, w.h - 6));
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(w.x + 3, w.y + 3, Math.max(2, w.w - 6), Math.max(2, w.h - 6));
      });

      // 5. Players & Hunters
      if (phase === 'HIDE_ACTIVE') {
        if (activeHiderObj && !activeHiderObj.hiddenInId) {
          drawExpressiveCharacter(
            ctx,
            activeHiderObj.x,
            activeHiderObj.y,
            activeHiderObj.angle,
            activeHiderObj.walkPhase,
            playerHexes[activeHiderObj.playerIdx] ?? '#F97316',
            players[activeHiderObj.playerIdx]?.name ?? 'لاعب'
          );
        }
      } else if (viewerHunter) {
        if (mode === 'dark') {
          const rayPts: Array<{ x: number; y: number }> = [{ x: viewerHunter.x, y: viewerHunter.y }];
          const rays = 44;
          for (let r = 0; r <= rays; r++) {
            const ang =
              viewerHunter.angle -
              DARK_FLASHLIGHT_HALF_FOV +
              (r / rays) * (DARK_FLASHLIGHT_HALF_FOV * 2);
            rayPts.push(
              castRay(viewerHunter.x, viewerHunter.y, ang, DARK_FLASHLIGHT_RANGE, occluderSegments)
            );
          }

          // Visible unhidden hiders inside wide flashlight OR close ambient halo with LOS
          hidersRef.current.forEach((h) => {
            if (h.caught || h.hiddenInId !== null) return;
            const dist = Math.hypot(h.x - viewerHunter.x, h.y - viewerHunter.y);
            if (dist > DARK_FLASHLIGHT_RANGE) return;
            const angToH = Math.atan2(h.y - viewerHunter.y, h.x - viewerHunter.x);
            const inBeam =
              Math.abs(normalizeAngleDiff(angToH, viewerHunter.angle)) <= DARK_FLASHLIGHT_HALF_FOV ||
              dist < 95;
            if (!inBeam) return;
            if (!hasLineOfSight(viewerHunter.x, viewerHunter.y, h.x, h.y, occluderSegments)) return;
            drawExpressiveCharacter(
              ctx,
              h.x,
              h.y,
              h.angle,
              h.walkPhase,
              playerHexes[h.playerIdx] ?? '#F97316',
              players[h.playerIdx]?.name ?? 'لاعب'
            );
          });

          // Softer twilight dimness overlay so walls/doorways stay faintly visible around Seeker
          ctx.save();
          ctx.beginPath();
          ctx.rect(camX - 20, camY - 20, viewWorldW + 40, viewWorldH + 40);
          ctx.moveTo(rayPts[0].x, rayPts[0].y);
          for (let i = 1; i < rayPts.length; i++) {
            ctx.lineTo(rayPts[i].x, rayPts[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(8, 15, 34, 0.72)';
          ctx.fill('evenodd');

          // Soft ambient lantern glow right around Seeker
          const ambientGrad = ctx.createRadialGradient(
            viewerHunter.x,
            viewerHunter.y,
            12,
            viewerHunter.x,
            viewerHunter.y,
            135
          );
          ambientGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
          ambientGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
          ctx.fillStyle = ambientGrad;
          ctx.beginPath();
          ctx.arc(viewerHunter.x, viewerHunter.y, 135, 0, Math.PI * 2);
          ctx.fill();

          // Wide crisp flashlight beam gradient
          const beamGrad = ctx.createRadialGradient(
            viewerHunter.x,
            viewerHunter.y,
            16,
            viewerHunter.x,
            viewerHunter.y,
            DARK_FLASHLIGHT_RANGE
          );
          beamGrad.addColorStop(0, 'rgba(254, 249, 195, 0.36)');
          beamGrad.addColorStop(0.7, 'rgba(254, 240, 138, 0.16)');
          beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0.02)');
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.moveTo(rayPts[0].x, rayPts[0].y);
          for (let i = 1; i < rayPts.length; i++) {
            ctx.lineTo(rayPts[i].x, rayPts[i].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // Normal / Zombie Mode: Forward sight cone + unobstructed LOS unhidden hiders ONLY
          ctx.save();
          ctx.fillStyle =
            viewerHunter.role === 'zombie'
              ? 'rgba(163, 230, 53, 0.16)'
              : 'rgba(254, 240, 138, 0.16)';
          ctx.beginPath();
          ctx.moveTo(viewerHunter.x, viewerHunter.y);
          for (let r = 0; r <= 20; r++) {
            const ang = viewerHunter.angle - 0.54 + (r / 20) * 1.08;
            const pt = castRay(viewerHunter.x, viewerHunter.y, ang, 270, occluderSegments);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          hidersRef.current.forEach((h) => {
            if (h.caught || h.hiddenInId !== null) return;
            const dist = Math.hypot(h.x - viewerHunter.x, h.y - viewerHunter.y);
            if (
              dist <= NORMAL_SIGHT_RANGE &&
              hasLineOfSight(viewerHunter.x, viewerHunter.y, h.x, h.y, occluderSegments)
            ) {
              drawExpressiveCharacter(
                ctx,
                h.x,
                h.y,
                h.angle,
                h.walkPhase,
                playerHexes[h.playerIdx] ?? '#F97316',
                players[h.playerIdx]?.name ?? 'لاعب'
              );
            }
          });
        }

        // Draw all active human hunters (Seeker + converted Zombie players)
        huntersRef.current.forEach((ht) => {
          drawExpressiveCharacter(ctx, ht.x, ht.y, ht.angle, ht.walkPhase, ht.hex, ht.name, {
            isSeeker: ht.role === 'seeker',
            isZombie: ht.role === 'zombie',
          });
        });
      }

      // 6. Floating Bursts & Alerts
      burstsRef.current.forEach((b) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, b.life));
        ctx.font = '900 18px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 4.5;
        ctx.strokeText(b.text, b.x, b.y);
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, b.x, b.y);
        ctx.restore();
      });

      ctx.restore();
    };

    const drawWorld = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { w: vw, h: vh } = viewSizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (phase === 'HIDE_ACTIVE') {
        const focusTarget =
          hidersRef.current.find((h) => h.playerIdx === currentHiderPlayerIdx) ??
          activeMap.seekerSpawn;
        const camProxy = {
          camX: cameraRef.current.x,
          camY: cameraRef.current.y,
        };
        renderSingleViewport(
          ctx,
          now,
          { x: 0, y: 0, w: vw, h: vh },
          focusTarget,
          camProxy,
          null,
          false
        );
        cameraRef.current.x = camProxy.camX;
        cameraRef.current.y = camProxy.camY;
      } else {
        const activeHunters = huntersRef.current;
        const vps = computeViewports(activeHunters.length, vw, vh);
        const isSplit = vps.length > 1;

        vps.forEach((vp, i) => {
          const ht = activeHunters[i];
          if (!ht) return;
          renderSingleViewport(ctx, now, vp, ht, ht, ht, isSplit);
        });

        // Crisp glowing dividers + mini corner nameplates when split-screen is active
        if (isSplit) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.lineWidth = 3;
          if (vps.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(0, vh / 2);
            ctx.lineTo(vw, vh / 2);
            ctx.stroke();
          }
          if (vps.length === 3) {
            ctx.beginPath();
            ctx.moveTo(vw / 2, 0);
            ctx.lineTo(vw / 2, vh / 2);
            ctx.stroke();
          } else if (vps.length >= 4) {
            ctx.beginPath();
            ctx.moveTo(vw / 2, 0);
            ctx.lineTo(vw / 2, vh);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    };

    const pushFootstep = (x: number, y: number, angle: number, walkPhase: number, color: string) => {
      const side: -1 | 1 = Math.sin(walkPhase) >= 0 ? 1 : -1;
      footstepsRef.current.push({ x, y, angle, side, color, life: 1.0 });
      if (footstepsRef.current.length > 96) {
        footstepsRef.current.shift();
      }
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      if (phase === 'HIDE_ACTIVE') {
        const jv = hunterJoysRef.current[0];
        const mag = Math.hypot(jv.dx, jv.dy);
        const activeH = hidersRef.current.find((h) => h.playerIdx === currentHiderPlayerIdx);
        if (activeH && activeH.hiddenInId === null && jv.active && mag > 0.05) {
          const prevPhase = activeH.walkPhase;
          const nx = jv.dx / mag;
          const ny = jv.dy / mag;
          const spd = HIDER_SPEED * Math.min(1, mag);
          const next = resolveMapCollision(
            activeH.x + nx * spd * dt,
            activeH.y + ny * spd * dt,
            PLAYER_R,
            activeMap
          );
          activeH.x = next.x;
          activeH.y = next.y;
          activeH.angle = Math.atan2(ny, nx);
          activeH.walkPhase += dt * 15;
          if (Math.floor(prevPhase / Math.PI) !== Math.floor(activeH.walkPhase / Math.PI)) {
            pushFootstep(
              activeH.x,
              activeH.y,
              activeH.angle,
              activeH.walkPhase,
              playerHexes[activeH.playerIdx] ?? '#F97316'
            );
          }
        }
      } else if (phase === 'SEEK_ACTIVE' && !roundEndedRef.current) {
        let caughtNew = false;

        for (let hSlot = 0; hSlot < huntersRef.current.length; hSlot++) {
          const ht = huntersRef.current[hSlot];
          const jv = hunterJoysRef.current[hSlot];
          const mag = jv ? Math.hypot(jv.dx, jv.dy) : 0;

          if (jv && jv.active && mag > 0.05) {
            const prevPhase = ht.walkPhase;
            const nx = jv.dx / mag;
            const ny = jv.dy / mag;
            const baseSpd = ht.role === 'seeker' ? SEEKER_SPEED : ZOMBIE_SPEED;
            const spd = baseSpd * Math.min(1, mag);
            const next = resolveMapCollision(
              ht.x + nx * spd * dt,
              ht.y + ny * spd * dt,
              PLAYER_R,
              activeMap
            );
            ht.x = next.x;
            ht.y = next.y;
            ht.angle = Math.atan2(ny, nx);
            ht.walkPhase += dt * 15;
            if (Math.floor(prevPhase / Math.PI) !== Math.floor(ht.walkPhase / Math.PI)) {
              pushFootstep(
                ht.x,
                ht.y,
                ht.angle,
                ht.walkPhase,
                ht.role === 'zombie' ? '#65A30D' : ht.hex
              );
            }
          }

          // Direct touch catches ONLY unhidden hiders (hiddenInId !== null requires "فتّش 🔍")
          for (const h of hidersRef.current) {
            if (h.caught || h.hiddenInId !== null) continue;
            if (Math.hypot(h.x - ht.x, h.y - ht.y) < PLAYER_R * 2.15) {
              h.caught = true;
              h.caughtAtSec = secondsLeftRef.current;
              ht.catches += 1;
              caughtNew = true;
              soundManager.play('catch');
              triggerHaptic([35, 30, 45]);
              burstsRef.current.push({
                x: h.x,
                y: h.y - 16,
                text:
                  ht.role === 'zombie'
                    ? `الزومبي ${ht.name} مسك ${players[h.playerIdx]?.name ?? ''}! 🧟`
                    : `تم القبض على ${players[h.playerIdx]?.name ?? ''}! 🚨`,
                color: ht.role === 'zombie' ? '#84CC16' : '#FACC15',
                life: 1.5,
              });

              infectHiderToSplitZombie(h, h.x, h.y);
            }
          }
        }

        if (caughtNew) {
          const totalCaught = hidersRef.current.filter((h) => h.caught).length;
          setCaughtCountUI(totalCaught);
          if (totalCaught >= hidersRef.current.length) {
            drawWorld(now);
            window.setTimeout(() => finalizeRound(true), 600);
            return;
          }
        }
      }

      // Sync contextual room + nearby hideable/inspectable furniture labels cleanly
      if (now - lastUiSync > 90) {
        lastUiSync = now;
        if (phase === 'HIDE_ACTIVE') {
          const focus = hidersRef.current.find((h) => h.playerIdx === currentHiderPlayerIdx);
          if (focus) {
            const near = findNearestHideableFurniture(
              focus.x,
              focus.y,
              HIDE_INTERACT_DIST,
              activeMap
            );
            setNearbyFurn(near ? { id: near.id, label: near.label } : null);
            setCurrentRoomLabel(getCurrentRoomName(focus.x, focus.y, activeMap));
            setIsCurrentHidden(Boolean(focus.hiddenInId));
          }
        } else {
          const nearList = [0, 1, 2, 3].map((slot) => {
            const ht = huntersRef.current[slot];
            if (!ht) return null;
            const near = findNearestHideableFurniture(
              ht.x,
              ht.y,
              INSPECT_INTERACT_DIST,
              activeMap
            );
            return near ? { id: near.id, label: near.label } : null;
          });
          setHunterNearbyFurns(nearList);
          setHunterBadges(
            huntersRef.current.map((ht) => ({
              name: ht.name,
              hex: ht.hex,
              role: ht.role,
              room: getCurrentRoomName(ht.x, ht.y, activeMap),
            }))
          );
          if (huntersRef.current[0]) {
            setCurrentRoomLabel(
              getCurrentRoomName(huntersRef.current[0].x, huntersRef.current[0].y, activeMap)
            );
          }
        }
      }

      footstepsRef.current = footstepsRef.current
        .map((fp) => ({ ...fp, life: fp.life - dt * 0.45 }))
        .filter((fp) => fp.life > 0);

      burstsRef.current = burstsRef.current
        .map((b) => ({ ...b, y: b.y - 30 * dt, life: b.life - dt }))
        .filter((b) => b.life > 0);

      drawWorld(now);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    phase,
    currentHiderPlayerIdx,
    playerHexes,
    players,
    mode,
    activeMap,
    occluderSegments,
    seekerPlayerIdx,
    infectHiderToSplitZombie,
    finalizeRound,
  ]);

  // Strictly Fixed Virtual Multi-Touch Joystick Handlers (up to 4 simultaneous corners)
  const getJoyMaxR = () => (phase === 'SEEK_ACTIVE' && activeHunterCount > 1 ? 30 : 38);

  const updateJoyFromClient = (slotIdx: number, clientX: number, clientY: number) => {
    const slot = hunterJoysRef.current[slotIdx];
    if (!slot) return;
    const maxR = getJoyMaxR();
    const vx = clientX - slot.cx;
    const vy = clientY - slot.cy;
    const dist = Math.hypot(vx, vy);
    const clamped = Math.min(maxR, dist);
    const ang = Math.atan2(vy, vx);
    const kx = dist > 0.5 ? (Math.cos(ang) * clamped) / maxR : 0;
    const ky = dist > 0.5 ? (Math.sin(ang) * clamped) / maxR : 0;
    slot.dx = kx;
    slot.dy = ky;
    slot.active = dist > 0.5;
    setJoyVisuals((prev) =>
      prev.map((item, idx) => (idx === slotIdx ? { kx, ky, active: true } : item))
    );
  };

  const handleJoyDown = (slotIdx: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const slot = hunterJoysRef.current[slotIdx];
    if (!slot || slot.pointerId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    soundManager.unlock();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }
    const rect = e.currentTarget.getBoundingClientRect();
    slot.cx = rect.left + rect.width / 2;
    slot.cy = rect.top + rect.height / 2;
    slot.pointerId = e.pointerId;
    triggerHaptic(12);
    updateJoyFromClient(slotIdx, e.clientX, e.clientY);
  };

  const handleJoyMove = (slotIdx: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const slot = hunterJoysRef.current[slotIdx];
    if (!slot || slot.pointerId !== e.pointerId) return;
    e.preventDefault();
    updateJoyFromClient(slotIdx, e.clientX, e.clientY);
  };

  const handleJoyEnd = (slotIdx: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const slot = hunterJoysRef.current[slotIdx];
    if (!slot || slot.pointerId !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
    slot.pointerId = null;
    slot.dx = 0;
    slot.dy = 0;
    slot.active = false;
    setJoyVisuals((prev) =>
      prev.map((item, idx) => (idx === slotIdx ? { kx: 0, ky: 0, active: false } : item))
    );
  };

  const activePlayer =
    phase === 'HIDE_HANDOFF' || phase === 'HIDE_ACTIVE'
      ? players[currentHiderPlayerIdx]
      : players[seekerPlayerIdx];
  const activeHex =
    phase === 'HIDE_HANDOFF' || phase === 'HIDE_ACTIVE'
      ? playerHexes[currentHiderPlayerIdx]
      : playerHexes[seekerPlayerIdx];

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] flex flex-col select-none overflow-hidden bg-[#FFF9F0] dark:bg-[#0F172A]">
      {/* SETUP SCREEN */}
      {phase === 'SETUP' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10">
          <div className="w-full max-w-md mx-auto flex items-center justify-between gap-2 mb-4">
            <button
              type="button"
              onClick={onExitToArcadeHub}
              className="min-h-[44px] px-3 rounded-2xl bg-white dark:bg-[#1E293B] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#090F1E] text-sm font-extrabold text-[#1E293B] dark:text-white flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع</span>
            </button>
            <h1 className="text-xl font-black text-[#1E293B] dark:text-white">خلاويص 🕵️‍♂️</h1>
            <div className="w-20 flex justify-end">
              {goHome && <HomeLogoBadge onClick={goHome} />}
            </div>
          </div>

          <div className="w-full max-w-md mx-auto flex flex-col gap-4">
            <div
              className={`rounded-3xl bg-gradient-to-br ${activeMap.cardGradient} p-5 text-white text-center shadow-xl`}
            >
              <div className="text-4xl mb-1.5">
                {activeMap.emoji} 🕵️‍♂️🔦
              </div>
              <h2 className="text-2xl font-black mb-1">{activeMap.name}</h2>
              <p className="text-xs sm:text-sm font-bold text-white/90 leading-relaxed">
                {activeMap.subtitle}
              </p>
            </div>

            {/* Map Selection (3 Large 3000x3000px Maze Maps) */}
            <div className="rounded-3xl qada-card p-4 flex flex-col gap-2.5">
              <div className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 mb-0.5">
                <MapIcon className="w-4 h-4 text-[#0EA5E9]" />
                <span>اختر خريطة المتاهة (٣٠٠٠×٣٠٠٠):</span>
              </div>
              {KHLAWIS_MAP_ORDER.map((mId) => {
                const m = KHLAWIS_MAPS[mId];
                const selected = selectedMapId === mId;
                return (
                  <button
                    key={mId}
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setSelectedMapId(mId);
                    }}
                    className={`w-full rounded-2xl p-3 text-right border-2 transition-all ${
                      selected
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-[#0EA5E9] shadow-sm'
                        : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-black text-sm text-[#1E293B] dark:text-white">
                        {m.emoji} {m.name}
                      </span>
                      <span className="text-[11px] font-black text-[#0284C7] dark:text-sky-300 bg-white/80 dark:bg-slate-900 px-2 py-0.5 rounded-lg">
                        {m.badgeText}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                      {m.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Mode Selection */}
            <div className="rounded-3xl qada-card p-4 flex flex-col gap-2.5">
              <div className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 mb-0.5">
                <Flashlight className="w-4 h-4 text-[#8B5CF6]" />
                <span>اختر وضع اللعب:</span>
              </div>
              {(['normal', 'dark', 'zombie'] as KhlawisMode[]).map((m) => {
                const cfg = MODE_CONFIG[m];
                const selected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setMode(m);
                    }}
                    className={`w-full rounded-2xl p-3 text-right border-2 transition-all ${
                      selected
                        ? 'bg-[#F5F3FF] dark:bg-violet-950/60 border-[#7C3AED] shadow-sm'
                        : 'bg-[#FFF9F0] dark:bg-[#0F172A] border-[#E7DEC8] dark:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-black text-sm text-[#1E293B] dark:text-white">
                        {cfg.emoji} {cfg.title}
                      </span>
                      <span className="text-[11px] font-black text-[#7C3AED] dark:text-violet-300 bg-white/80 dark:bg-slate-900 px-2 py-0.5 rounded-lg">
                        {cfg.badge}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                      {cfg.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Hunt Duration Selector (90s / 120s / 150s) */}
            <div className="rounded-3xl qada-card p-4">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#10B981]" />
                  <span>وقت البحث للباحث:</span>
                </span>
                <span className="text-xs font-extrabold text-[#059669] dark:text-emerald-400 tabular-nums">
                  {huntSeconds} ثانية
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SEARCH_TIME_OPTIONS.map((secs) => {
                  const active = huntSeconds === secs;
                  return (
                    <button
                      key={secs}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setHuntSeconds(secs);
                      }}
                      className={`min-h-[44px] rounded-xl text-sm font-black tabular-nums border-2 transition-all ${
                        active
                          ? 'bg-[#10B981] text-white border-[#059669] shadow-sm'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#475569] dark:text-[#94A3B8] border-[#E7DEC8] dark:border-[#334155]'
                      }`}
                    >
                      {secs} ثانية
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seeker Picker (Supports 2–20 players cleanly) */}
            <div className="rounded-3xl qada-card p-4">
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#F59E0B]" />
                  <span>مين الباحث؟ ({players.length} لاعبين)</span>
                </span>
                <div className="flex items-center gap-2">
                  {onEditPlayers && (
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        onEditPlayers();
                      }}
                      className="text-xs font-black text-[#0D9488] dark:text-[#2DD4BF] px-2 py-0.5 rounded-lg bg-[#F0FDFA] dark:bg-teal-950/50 border border-[#99F6E4] dark:border-teal-800"
                    >
                      تعديل اللاعبين
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setSeekerPlayerIdx(Math.floor(Math.random() * players.length));
                    }}
                    className="text-xs font-black text-[#7C3AED] dark:text-violet-300"
                  >
                    🎲 عشوائي
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-0.5">
                {players.map((p, idx) => {
                  const active = seekerPlayerIdx === idx;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setSeekerPlayerIdx(idx);
                      }}
                      className={`min-h-[42px] px-2.5 rounded-xl text-xs font-black flex items-center gap-2 border-2 transition-all ${
                        active
                          ? 'bg-rose-500 text-white border-rose-300 shadow-sm'
                          : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#1E293B] dark:text-white border-[#E7DEC8] dark:border-[#334155]'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: playerHexes[idx] }}
                        className="w-3 h-3 rounded-full border border-white shrink-0"
                      />
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartGame}
              className="w-full min-h-[58px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ابدأ خلاويص! 🕵️‍♂️</span>
            </button>
          </div>
        </div>
      )}

      {/* HANDOFF SCREENS */}
      {(phase === 'HIDE_HANDOFF' || phase === 'SEEK_HANDOFF') && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <div className="w-full max-w-md rounded-3xl qada-card p-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-950/60 border-2 border-violet-300 flex items-center justify-center text-3xl">
              {phase === 'HIDE_HANDOFF' ? '🫣' : '🕵️‍♂️'}
            </div>

            {phase === 'HIDE_HANDOFF' ? (
              <>
                <span className="text-xs font-black text-[#7C3AED] dark:text-violet-300">
                  مرحلة الاختباء ({hideStep + 1} من {hiderQueue.length}) · {activeMap.emoji}{' '}
                  {activeMap.name}
                </span>
                <h2 className="text-2xl font-black text-[#1E293B] dark:text-white">
                  ادي الموبايل لـ{' '}
                  <span style={{ color: activeHex }}>{activePlayer?.name}</span>
                </h2>
                <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                  محدش يبص! قدّامك {HIDE_SECONDS} ثانية تتجول في {activeMap.name} وتستخبى جوه
                  أي مخبأ (لما تضغط استخبى جوه بتختفي تماماً من عين الباحث!).
                </p>
              </>
            ) : (
              <>
                <span className="text-xs font-black text-rose-600 dark:text-rose-300">
                  جاهز يا باحث؟ خلاويص! · {activeMap.emoji} {activeMap.name}
                </span>
                <h2 className="text-2xl font-black text-[#1E293B] dark:text-white">
                  ادي الموبايل للباحث{' '}
                  <span style={{ color: playerHexes[seekerPlayerIdx] }}>
                    {players[seekerPlayerIdx]?.name}
                  </span>
                </h2>
                <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                  اتجول في المتاهة وقرّب من الدواليب والحاويات والسراير واضغط &quot;فتّش
                  المكان 🔍&quot; عشان تكشف اللي مستخبين جواها! قدّامك {huntSeconds} ثانية.
                </p>
              </>
            )}

            <button
              type="button"
              onClick={guard(() => {
                soundManager.play('next');
                clearJoystick();
                if (phase === 'HIDE_HANDOFF') {
                  setIsCurrentHidden(false);
                  setSecondsLeft(HIDE_SECONDS);
                  setPhase('HIDE_ACTIVE');
                } else {
                  setSecondsLeft(huntSeconds);
                  setPhase('SEEK_ACTIVE');
                }
              })}
              className="w-full min-h-[54px] rounded-2xl bakasa-btn-green text-white text-xl font-black"
            >
              {phase === 'HIDE_HANDOFF' ? 'جاهز، هدخل أستخبى! 🏃‍♂️' : 'لَصّ! ابدأ البحث 🔍'}
            </button>
          </div>
        </div>
      )}

      {/* FULL-SCREEN ACTIVE MAZE CANVAS */}
      {(phase === 'HIDE_ACTIVE' || phase === 'SEEK_ACTIVE') && (
        <div
          ref={arenaRef}
          dir="ltr"
          style={{ touchAction: 'none' }}
          className="relative w-full h-full overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            style={{ touchAction: 'none' }}
            className="w-full h-full block bg-[#0F172A]"
          />

          {/* Compact Floating Top HUD */}
          <div
            dir="rtl"
            className="fixed top-3 inset-x-3 z-30 flex items-center justify-between gap-2 pointer-events-none"
          >
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="min-h-[38px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-300/60 text-white text-xs font-black shadow-lg flex items-center gap-1"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = soundManager.toggleMute();
                  setMuted(next);
                }}
                aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
                className="w-[38px] h-[38px] rounded-xl bg-slate-900/85 border border-white/25 text-white flex items-center justify-center shadow-lg"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Active Role + Room Location Pill */}
            <div className="rounded-2xl bg-slate-950/85 border border-white/25 px-3 py-1.5 text-center shadow-lg backdrop-blur-md max-w-[52%]">
              <div className="text-[11px] font-black text-white truncate">
                {phase === 'HIDE_ACTIVE' ? (
                  <>
                    🫣 <span style={{ color: activeHex }}>{activePlayer?.name}</span>
                  </>
                ) : (
                  <>
                    🕵️‍♂️ <span style={{ color: activeHex }}>{activePlayer?.name}</span> · مسك{' '}
                    {caughtCountUI}/{totalHidersUI}
                  </>
                )}
              </div>
              <div className="text-[10px] font-bold text-amber-300 truncate">
                📍 {currentRoomLabel}
              </div>
            </div>

            {/* Countdown Timer */}
            <div
              className={`min-w-[62px] min-h-[38px] px-2.5 rounded-xl border font-black text-sm tabular-nums flex items-center justify-center shadow-lg ${
                secondsLeft <= 8
                  ? 'bg-rose-600 border-rose-300 text-white animate-pulse'
                  : 'bg-slate-950/85 border-white/25 text-white'
              }`}
            >
              ⏱ {secondsLeft}ث
            </div>
          </div>

          {/* Bottom-Left Fixed Joystick for HIDE_ACTIVE or single-hunter SEEK_ACTIVE */}
          {(phase === 'HIDE_ACTIVE' || activeHunterCount === 1) && (
            <div
              style={{ touchAction: 'none' }}
              onPointerDown={handleJoyDown(0)}
              onPointerMove={handleJoyMove(0)}
              onPointerUp={handleJoyEnd(0)}
              onPointerCancel={handleJoyEnd(0)}
              onLostPointerCapture={handleJoyEnd(0)}
              className="absolute bottom-5 left-5 z-30 w-[114px] h-[114px] rounded-full cursor-pointer select-none flex items-center justify-center"
            >
              <div
                style={{
                  borderColor: activeHex,
                  backgroundColor: joyVisuals[0]?.active
                    ? 'rgba(15, 23, 42, 0.52)'
                    : 'rgba(15, 23, 42, 0.34)',
                }}
                className="pointer-events-none relative w-full h-full rounded-full border-[3.5px] backdrop-blur-[2px] shadow-[0_4px_0_rgba(0,0,0,0.4)] flex items-center justify-center"
              >
                <span className="pointer-events-none absolute -top-5 px-2.5 py-0.5 rounded-full bg-black/75 text-[10px] font-black text-white whitespace-nowrap">
                  {isCurrentHidden && phase === 'HIDE_ACTIVE' ? '🫣 مستخبي جوه' : 'حرّك هنا'}
                </span>
                <div
                  style={{
                    backgroundColor: activeHex,
                    transform: `translate3d(${(joyVisuals[0]?.kx ?? 0) * 38}px, ${(joyVisuals[0]?.ky ?? 0) * 38}px, 0) scale(${joyVisuals[0]?.active ? 1.08 : 1})`,
                  }}
                  className={`pointer-events-none w-11 h-11 rounded-full border-[3px] border-white shadow-lg ${
                    joyVisuals[0]?.active ? '' : 'transition-transform duration-150'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Dynamic Multi-Player Split-Screen Corner Joysticks & Inspect Buttons (Zombie Mode 2–4 Viewports) */}
          {phase === 'SEEK_ACTIVE' &&
            activeHunterCount > 1 &&
            Array.from({ length: Math.min(4, activeHunterCount) }, (_, slotIdx) => {
              const badge = hunterBadges[slotIdx];
              const jVis = joyVisuals[slotIdx] ?? { kx: 0, ky: 0, active: false };
              const nearFurnForSlot = hunterNearbyFurns[slotIdx];
              const hex = badge?.hex ?? (slotIdx === 0 ? playerHexes[seekerPlayerIdx] : '#84CC16');

              // Map each viewport's joystick & inspect button strictly inside its own quadrant
              const joyPosClass =
                activeHunterCount === 2
                  ? slotIdx === 0
                    ? 'top-14 left-3'
                    : 'bottom-3 right-3'
                  : activeHunterCount === 3
                    ? slotIdx === 0
                      ? 'top-14 left-3'
                      : slotIdx === 1
                        ? 'top-14 right-3'
                        : 'bottom-3 left-3'
                    : slotIdx === 0
                      ? 'top-14 left-2.5'
                      : slotIdx === 1
                        ? 'top-14 right-2.5'
                        : slotIdx === 2
                          ? 'bottom-3 left-2.5'
                          : 'bottom-3 right-2.5';

              const inspectPosClass =
                activeHunterCount === 2
                  ? slotIdx === 0
                    ? 'top-14 right-3'
                    : 'bottom-3 left-3'
                  : activeHunterCount === 3
                    ? slotIdx === 0
                      ? 'top-[calc(50%-52px)] left-2.5'
                      : slotIdx === 1
                        ? 'top-[calc(50%-52px)] right-2.5'
                        : 'bottom-3 right-3'
                    : slotIdx === 0
                      ? 'top-[calc(50%-48px)] left-2.5'
                      : slotIdx === 1
                        ? 'top-[calc(50%-48px)] right-2.5'
                        : slotIdx === 2
                          ? 'top-[calc(50%+10px)] left-2.5'
                          : 'top-[calc(50%+10px)] right-2.5';

              return (
                <React.Fragment key={slotIdx}>
                  <div
                    style={{ touchAction: 'none' }}
                    onPointerDown={handleJoyDown(slotIdx)}
                    onPointerMove={handleJoyMove(slotIdx)}
                    onPointerUp={handleJoyEnd(slotIdx)}
                    onPointerCancel={handleJoyEnd(slotIdx)}
                    onLostPointerCapture={handleJoyEnd(slotIdx)}
                    className={`absolute ${joyPosClass} z-30 w-[92px] h-[92px] rounded-full cursor-pointer select-none flex items-center justify-center`}
                  >
                    <div
                      style={{
                        borderColor: hex,
                        backgroundColor: jVis.active
                          ? 'rgba(15, 23, 42, 0.56)'
                          : 'rgba(15, 23, 42, 0.36)',
                      }}
                      className="pointer-events-none relative w-full h-full rounded-full border-[3px] backdrop-blur-[2px] shadow-[0_3px_0_rgba(0,0,0,0.4)] flex items-center justify-center"
                    >
                      <span
                        dir="rtl"
                        className="pointer-events-none absolute -top-5 px-2 py-0.5 rounded-full bg-slate-950/85 border border-white/20 text-[10px] font-black text-white whitespace-nowrap max-w-[120px] truncate"
                      >
                        {badge?.role === 'zombie' ? '🧟' : '🕵️‍♂️'} {badge?.name ?? ''}
                      </span>
                      <div
                        style={{
                          backgroundColor: hex,
                          transform: `translate3d(${jVis.kx * 30}px, ${jVis.ky * 30}px, 0) scale(${jVis.active ? 1.08 : 1})`,
                        }}
                        className={`pointer-events-none w-9 h-9 rounded-full border-[2.5px] border-white shadow-lg ${
                          jVis.active ? '' : 'transition-transform duration-150'
                        }`}
                      />
                    </div>
                  </div>

                  {nearFurnForSlot && (
                    <button
                      dir="rtl"
                      type="button"
                      onClick={() => handleInspectFurniture(slotIdx)}
                      className={`absolute ${inspectPosClass} z-30 min-h-[40px] px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 border-2 border-amber-200 border-b-4 border-b-amber-800 text-slate-950 font-black text-[11px] shadow-xl flex items-center gap-1 animate-pulse transition-transform`}
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>فتّش 🔍</span>
                    </button>
                  )}
                </React.Fragment>
              );
            })}

          {/* Bottom-Right Contextual Action Buttons (HIDE_ACTIVE or 1-viewport SEEK_ACTIVE) */}
          <div dir="rtl" className="absolute bottom-5 right-5 z-30 flex flex-col items-end gap-2.5">
            {phase === 'HIDE_ACTIVE' && (nearbyFurn || isCurrentHidden) && (
              <button
                type="button"
                onClick={handleToggleHideInFurniture}
                className={`min-h-[54px] px-4 rounded-2xl border-2 border-b-4 font-black text-sm text-white shadow-xl active:scale-95 transition-transform flex items-center gap-2 ${
                  isCurrentHidden
                    ? 'bg-amber-500 border-amber-200 border-b-amber-700 text-slate-950'
                    : 'bg-violet-600 border-violet-300 border-b-violet-900 animate-pulse'
                }`}
              >
                {isCurrentHidden ? (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>اخرج من هنا 🚪</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>استخبى جوه {nearbyFurn?.label} 🫣</span>
                  </>
                )}
              </button>
            )}

            {phase === 'HIDE_ACTIVE' && (
              <button
                type="button"
                onClick={guard(() => {
                  soundManager.play('next');
                  clearJoystick();
                  if (hideStep + 1 < hiderQueue.length) {
                    setHideStep((s) => s + 1);
                    setPhase('HIDE_HANDOFF');
                  } else {
                    setPhase('SEEK_HANDOFF');
                  }
                })}
                className="min-h-[48px] px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 border-2 border-emerald-200 border-b-4 border-b-emerald-800 text-white font-black text-sm shadow-xl flex items-center gap-1.5 transition-transform"
              >
                <Check className="w-4 h-4" />
                <span>استخبيت! ✅</span>
              </button>
            )}

            {phase === 'SEEK_ACTIVE' && activeHunterCount === 1 && hunterNearbyFurns[0] && (
              <button
                type="button"
                onClick={() => handleInspectFurniture(0)}
                className="min-h-[56px] px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 border-2 border-amber-200 border-b-4 border-b-amber-800 text-slate-950 font-black text-sm shadow-xl flex items-center gap-2 animate-pulse transition-transform"
              >
                <Search className="w-5 h-5" />
                <span>فتّش {hunterNearbyFurns[0].label} 🔍</span>
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'WINNER_SPOTLIGHT' && (
        <ArcadeWinnerSpotlight
          winners={winnerPlayers}
          seriesScores={Object.fromEntries(roundDeltas.map((d) => [d.playerId, d.delta]))}
          headline={summaryHeadline}
          onContinueToLeaderboard={() => setPhase('LEADERBOARD')}
        />
      )}

      {phase === 'LEADERBOARD' && (
        <div className="flex-1 overflow-y-auto pt-4">
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={summaryHeadline}
            isTournamentMode={Boolean(onTournamentFinish)}
            onNewRound={() => setPhase('SETUP')}
            onFinishGame={() => {
              if (onTournamentFinish) {
                onTournamentFinish(roundDeltas);
              } else {
                onExitToArcadeHub();
              }
            }}
          />
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="متأكد إنك عايز تخرج من خلاويص؟"
        message="الجولة لسه شغالة، لو خرجت دلوقتي النتيجة مش هتتحسب."
        cancelLabel="كمل لعب"
        confirmLabel="نعم، اخرج"
        onConfirm={() => {
          clearJoystick();
          setShowExitConfirm(false);
          onExitToArcadeHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
