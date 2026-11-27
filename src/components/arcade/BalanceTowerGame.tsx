import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Matter from 'matter-js';
import { ArrowLeft, Layers } from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
import { useArcadeTouchLock } from '../../hooks/useArcadeTouchLock';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import {
  ARCADE_COLORS,
  ArcadeDelta,
  ArcadePlayer,
  TURN_ARCADE_COLOR_ORDER,
} from '../../types/arcade';
import { Player, RoundDelta } from '../../types/game';
import { recordArcadeWin } from '../../utils/sessionStats';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ConfirmModal } from '../ConfirmModal';
import { HomeLogoBadge } from '../HomeLogoBadge';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { ArcadeFloatingHud } from './ArcadeFloatingHud';
import { ArcadeLeaderboardScreen } from './ArcadeLeaderboardScreen';
import { ArcadePreGameSetup } from './ArcadePreGameSetup';
import { ArcadeSeriesOverlay } from './ArcadeSeriesOverlay';
import { ArcadeWinnerSpotlight } from './ArcadeWinnerSpotlight';

interface BalanceTowerGameProps {
  players: Array<Player | ArcadePlayer>;
  onApplyDeltas: (deltas: ArcadeDelta[]) => void;
  onExitToArcadeHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
  onEditPlayers?: () => void;
}

type MatchPhase =
  | 'SETUP'
  | 'PLAYING'
  | 'INTER_ROUND'
  | 'WINNER_SPOTLIGHT'
  | 'LEADERBOARD';

type TurnStage = 'AIMING' | 'SETTLING' | 'COLLAPSED';

type AnimalSpeciesId =
  | 'lion'
  | 'giraffe'
  | 'elephant'
  | 'bear'
  | 'rhino'
  | 'fox'
  | 'cat'
  | 'eagle';

interface ColliderPartRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ConvexHitboxSpec {
  kind: 'rectangle' | 'trapezoid';
  w: number;
  h: number;
  slope?: number;
}

type WeightTier = 'heavy' | 'medium' | 'light';

interface AnimalSpec {
  id: AnimalSpeciesId;
  name: string;
  emoji: string;
  weightTier: WeightTier;
  parts: ColliderPartRect[];
  hitbox: ConvexHitboxSpec;
  density: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  visualOffset: { x: number; y: number };
}

interface PlacedBodyMeta {
  spec: AnimalSpec;
  playerIdx: number;
  playerHex: string;
  playerName: string;
  droppedAt: number;
  highestY: number;
}

interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

interface FloatingBanner {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const WORLD_W = 420;
const PLATFORM_X = WORLD_W / 2;
const PLATFORM_Y = 530;
// ~82% of mobile screen width, leaving ~9% water drop-off gap on left and right edges
const PLATFORM_W = Math.round(WORLD_W * 0.82);
const PLATFORM_H = 30;
const WATER_Y = PLATFORM_Y + 115;
const DROP_CLEARANCE = 310;
const MIN_AIM_X = 34;
const MAX_AIM_X = WORLD_W - 34;

function getStageMetrics(vw: number, vh: number) {
  // Portrait fullscreen optimization: full mobile width on phones, vertical portrait pillar on wide viewports
  const portraitW = Math.min(vw, vh * 0.62);
  const scale = Math.max(0.58, portraitW / WORLD_W);
  const offsetX = (vw - WORLD_W * scale) / 2;
  const baseGroundScreenY = vh - 108;
  const topSpawnScreenY = Math.min(176, Math.max(132, vh * 0.21));
  const initialHoverY = PLATFORM_Y - (baseGroundScreenY - topSpawnScreenY) / scale;
  return { scale, offsetX, baseGroundScreenY, topSpawnScreenY, initialHoverY };
}

const WEIGHT_TIER_DENSITY: Record<WeightTier, number> = {
  heavy: 0.012,
  medium: 0.006,
  light: 0.003,
};

const WEIGHT_TIER_LABEL: Record<WeightTier, string> = {
  heavy: 'ثقيل ⚖️',
  medium: 'متوسط',
  light: 'خفيف 🪶',
};

function makeConvexHitboxBody(
  hitbox: ConvexHitboxSpec,
  density: number,
  x: number,
  y: number
): Matter.Body {
  const opts: Matter.IChamferableBodyDefinition = {
    chamfer: { radius: 6 },
    friction: 0.65,
    frictionStatic: 1.2,
    restitution: 0.05,
    frictionAir: 0.018,
    slop: 0.02,
    density,
    sleepThreshold: 45,
  };
  if (hitbox.kind === 'trapezoid') {
    return Matter.Bodies.trapezoid(x, y, hitbox.w, hitbox.h, hitbox.slope ?? 0.18, opts);
  }
  return Matter.Bodies.rectangle(x, y, hitbox.w, hitbox.h, opts);
}

function computeVisualOffset(
  parts: ColliderPartRect[],
  hitbox: ConvexHitboxSpec,
  density: number
): { x: number; y: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of parts) {
    minX = Math.min(minX, p.x - p.w / 2);
    maxX = Math.max(maxX, p.x + p.w / 2);
    maxY = Math.max(maxY, p.y + p.h / 2);
  }
  const temp = makeConvexHitboxBody(hitbox, density, 0, 0);
  const physicsBottom = temp.bounds.max.y - temp.position.y;
  const visualCenterX = (minX + maxX) / 2;
  return {
    x: visualCenterX,
    y: maxY - physicsBottom,
  };
}

const RAW_ANIMAL_SPECS: Array<Omit<AnimalSpec, 'visualOffset'>> = [
  // HEAVY TIER (Density 0.012) - visibly larger & heavy
  {
    id: 'elephant',
    name: 'فيل',
    emoji: '🐘',
    weightTier: 'heavy',
    density: WEIGHT_TIER_DENSITY.heavy,
    hitbox: { kind: 'rectangle', w: 84, h: 56 },
    primaryColor: '#94A3B8',
    secondaryColor: '#64748B',
    accentColor: '#E2E8F0',
    parts: [
      { x: -4, y: -5, w: 82, h: 42 }, // large heavy torso + head
      { x: 40, y: 4, w: 15, h: 31 }, // trunk
      { x: -29, y: 24, w: 20, h: 20 }, // back leg
      { x: 18, y: 24, w: 20, h: 20 }, // front leg
    ],
  },
  {
    id: 'rhino',
    name: 'وحيد القرن',
    emoji: '🦏',
    weightTier: 'heavy',
    density: WEIGHT_TIER_DENSITY.heavy,
    hitbox: { kind: 'rectangle', w: 80, h: 52 },
    primaryColor: '#64748B',
    secondaryColor: '#475569',
    accentColor: '#F1F5F9',
    parts: [
      { x: -4, y: 0, w: 76, h: 34 }, // large armored body
      { x: 34, y: -4, w: 24, h: 24 }, // head
      { x: 43, y: -19, w: 11, h: 15 }, // horn
      { x: -27, y: 22, w: 17, h: 16 }, // back leg
      { x: 16, y: 22, w: 17, h: 16 }, // front leg
    ],
  },
  {
    id: 'bear',
    name: 'دب',
    emoji: '🐻',
    weightTier: 'heavy',
    density: WEIGHT_TIER_DENSITY.heavy,
    hitbox: { kind: 'rectangle', w: 68, h: 54 },
    primaryColor: '#92400E',
    secondaryColor: '#78350F',
    accentColor: '#FDE68A',
    parts: [
      { x: 0, y: 0, w: 66, h: 36 }, // chunky heavy torso
      { x: 25, y: -17, w: 29, h: 27 }, // big head
      { x: -21, y: 23, w: 18, h: 16 }, // back paw
      { x: 21, y: 23, w: 18, h: 16 }, // front paw
    ],
  },

  // MEDIUM TIER (Density 0.006)
  {
    id: 'lion',
    name: 'أسد',
    emoji: '🦁',
    weightTier: 'medium',
    density: WEIGHT_TIER_DENSITY.medium,
    hitbox: { kind: 'rectangle', w: 66, h: 48 },
    primaryColor: '#F59E0B',
    secondaryColor: '#B45309',
    accentColor: '#FDE68A',
    parts: [
      { x: 0, y: -2, w: 64, h: 28 }, // torso
      { x: 25, y: -14, w: 29, h: 29 }, // mane + head
      { x: -21, y: 18, w: 14, h: 16 }, // back leg
      { x: 19, y: 18, w: 14, h: 16 }, // front leg
    ],
  },
  {
    id: 'giraffe',
    name: 'زرافة',
    emoji: '🦒',
    weightTier: 'medium',
    density: WEIGHT_TIER_DENSITY.medium,
    hitbox: { kind: 'trapezoid', w: 56, h: 82, slope: 0.34 },
    primaryColor: '#FBBF24',
    secondaryColor: '#92400E',
    accentColor: '#FEF3C7',
    parts: [
      { x: -6, y: 10, w: 48, h: 24 }, // torso
      { x: 14, y: -22, w: 15, h: 52 }, // tall neck
      { x: 21, y: -48, w: 24, h: 16 }, // head + snout
      { x: -21, y: 29, w: 12, h: 20 }, // back leg
      { x: 10, y: 29, w: 12, h: 20 }, // front leg
    ],
  },
  {
    id: 'fox',
    name: 'ثعلب',
    emoji: '🦊',
    weightTier: 'medium',
    density: WEIGHT_TIER_DENSITY.medium,
    hitbox: { kind: 'trapezoid', w: 60, h: 38, slope: 0.16 },
    primaryColor: '#EA580C',
    secondaryColor: '#9A3412',
    accentColor: '#FFFBEB',
    parts: [
      { x: 0, y: 2, w: 52, h: 20 }, // sleek torso
      { x: -28, y: -4, w: 18, h: 15 }, // bushy tail
      { x: 22, y: -10, w: 21, h: 19 }, // head
      { x: -15, y: 17, w: 10, h: 13 }, // back leg
      { x: 15, y: 17, w: 10, h: 13 }, // front leg
    ],
  },

  // LIGHT TIER (Density 0.003) - smaller & light
  {
    id: 'cat',
    name: 'قطة',
    emoji: '🐱',
    weightTier: 'light',
    density: WEIGHT_TIER_DENSITY.light,
    hitbox: { kind: 'trapezoid', w: 44, h: 32, slope: 0.16 },
    primaryColor: '#FB923C',
    secondaryColor: '#EA580C',
    accentColor: '#FEF3C7',
    parts: [
      { x: 0, y: 3, w: 38, h: 17 }, // petite body
      { x: 16, y: -8, w: 18, h: 16 }, // head
      { x: -20, y: -6, w: 8, h: 18 }, // upright tail
      { x: -11, y: 15, w: 8, h: 10 }, // back leg
      { x: 11, y: 15, w: 8, h: 10 }, // front leg
    ],
  },
  {
    id: 'eagle',
    name: 'نسر',
    emoji: '🦅',
    weightTier: 'light',
    density: WEIGHT_TIER_DENSITY.light,
    hitbox: { kind: 'rectangle', w: 48, h: 30 },
    primaryColor: '#78350F',
    secondaryColor: '#451A03',
    accentColor: '#FACC15',
    parts: [
      { x: 0, y: 0, w: 25, h: 25 }, // compact body
      { x: -20, y: -4, w: 19, h: 11 }, // left wing
      { x: 20, y: -4, w: 19, h: 11 }, // right wing
      { x: 0, y: -14, w: 16, h: 14 }, // white head + beak
    ],
  },
];

const ANIMAL_SPECS: AnimalSpec[] = RAW_ANIMAL_SPECS.map((spec) => ({
  ...spec,
  visualOffset: computeVisualOffset(spec.parts, spec.hitbox, spec.density),
}));

function pickRandomAnimal(): AnimalSpec {
  return ANIMAL_SPECS[Math.floor(Math.random() * ANIMAL_SPECS.length)];
}

function createAnimalBody(spec: AnimalSpec, x: number, y: number, angleRad: number): Matter.Body {
  const body = makeConvexHitboxBody(spec.hitbox, spec.density, x, y);
  Matter.Body.setAngle(body, angleRad);
  return body;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawAnimalSilhouette(
  ctx: CanvasRenderingContext2D,
  spec: AnimalSpec,
  playerHex: string,
  x: number,
  y: number,
  angle: number,
  alpha = 1,
  isGhost = false,
  now = 0,
  blinkSeed = 0,
  isPanicking = false
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(-spec.visualOffset.x, -spec.visualOffset.y);

  // 2.5D depth extrusion underside layer (zero shadowBlur for 60fps mobile)
  if (!isGhost) {
    spec.parts.forEach((p) => {
      const rx = p.x - p.w / 2;
      const ry = p.y - p.h / 2 + 3.2;
      drawRoundedRect(ctx, rx, ry, p.w, p.h, 6);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      ctx.fill();
    });
  }

  // Draw body parts with crisp outlines, 2.5D bevels, highlights & underside shading
  spec.parts.forEach((p, idx) => {
    const rx = p.x - p.w / 2;
    const ry = p.y - p.h / 2;
    drawRoundedRect(ctx, rx, ry, p.w, p.h, 6);
    ctx.fillStyle = idx % 2 === 0 ? spec.primaryColor : spec.secondaryColor;
    ctx.fill();
    ctx.lineWidth = isGhost ? 2 : 2.4;
    ctx.strokeStyle = isGhost ? playerHex : '#1E293B';
    ctx.stroke();

    // Specular highlight strip on upper half + deep 2.5D belly shading
    if (!isGhost && idx <= 1) {
      drawRoundedRect(ctx, rx + 3, ry + 2.5, Math.max(4, p.w - 6), Math.max(3, p.h * 0.26), 3);
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fill();

      drawRoundedRect(
        ctx,
        rx + 3,
        ry + p.h - Math.max(4, p.h * 0.24) - 2,
        Math.max(4, p.w - 6),
        Math.max(3, p.h * 0.22),
        3
      );
      ctx.fillStyle = 'rgba(15,23,42,0.16)';
      ctx.fill();
    }
  });

  // Deterministic natural blink cycle (~every 3.4 seconds for 130ms)
  const blinkCycle = (now + blinkSeed * 731) % 3400;
  const isBlinking = !isGhost && !isPanicking && blinkCycle < 135;

  const drawExpressiveEye = (ex: number, ey: number, radius = 2.6, irisColor = '#0F172A') => {
    if (isPanicking) {
      // Wide-eyed worried expression when tilting fast
      const panicR = radius * 1.45;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ex, ey, panicR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const jitterX = Math.sin(now * 0.04 + blinkSeed) * 0.8;
      const jitterY = Math.cos(now * 0.05 + blinkSeed) * 0.6;
      ctx.fillStyle = irisColor;
      ctx.beginPath();
      ctx.arc(ex + jitterX, ey + jitterY, Math.max(1.2, radius * 0.55), 0, Math.PI * 2);
      ctx.fill();

      // Worried angled brow
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - panicR, ey - panicR - 2.2);
      ctx.lineTo(ex + panicR * 0.7, ey - panicR - 0.5);
      ctx.stroke();
    } else if (isBlinking) {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, ey + 0.5, radius, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex, ey, radius + 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = irisColor;
      ctx.beginPath();
      ctx.arc(ex + 0.4, ey, radius, 0, Math.PI * 2);
      ctx.fill();
      // Catchlight sparkle
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 0.5, ey - 0.8, Math.max(0.8, radius * 0.36), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawRosyCheek = (cx: number, cy: number) => {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.34)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 4.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawPanicSweat = (sx: number, sy: number) => {
    if (!isPanicking) return;
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4);
    ctx.quadraticCurveTo(sx + 3.5, sy + 1, sx, sy + 4);
    ctx.quadraticCurveTo(sx - 3.5, sy + 1, sx, sy - 4);
    ctx.fill();
  };

  // Rich 2.5D characteristic details per animal species
  if (spec.id === 'lion') {
    // Curved tufted tail
    ctx.strokeStyle = spec.secondaryColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-31, -4);
    ctx.quadraticCurveTo(-42, -16, -34, -22);
    ctx.stroke();
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(-34, -22, 4, 0, Math.PI * 2);
    ctx.fill();

    // Fluffy mane with layered rim
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.arc(25, -14, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Lion ears
    ctx.fillStyle = spec.primaryColor;
    ctx.beginPath();
    ctx.arc(17, -26, 4.5, 0, Math.PI * 2);
    ctx.arc(33, -26, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Face
    ctx.fillStyle = spec.primaryColor;
    ctx.beginPath();
    ctx.arc(26, -14, 11.5, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle & whiskers
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.ellipse(32, -10, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    drawRosyCheek(28, -8);
    drawExpressiveEye(30, -16, 2.4);
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(36, -12, 2.4, 0, Math.PI * 2);
    ctx.fill();
    drawPanicSweat(16, -24);
  } else if (spec.id === 'giraffe') {
    // Swishing tail
    ctx.strokeStyle = spec.secondaryColor;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-29, 4);
    ctx.quadraticCurveTo(-36, 12, -32, 20);
    ctx.stroke();

    // Textured spots along body & tall neck
    ctx.fillStyle = spec.secondaryColor;
    [
      [-15, 6, 4.5],
      [0, 12, 4],
      [14, -10, 3.6],
      [14, -24, 3.2],
      [14, -37, 2.8],
    ].forEach(([sx, sy, sr]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    });
    // Ossicones (horns) + tufts + ears
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, -55);
    ctx.lineTo(14, -63);
    ctx.moveTo(22, -55);
    ctx.lineTo(24, -63);
    ctx.stroke();
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(14, -64, 2.6, 0, Math.PI * 2);
    ctx.arc(24, -64, 2.6, 0, Math.PI * 2);
    ctx.fill();

    drawRosyCheek(26, -44);
    drawExpressiveEye(24, -50, 2.3);
    drawPanicSweat(10, -56);
  } else if (spec.id === 'elephant') {
    // Tiny tail
    ctx.strokeStyle = spec.secondaryColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-44, -8);
    ctx.quadraticCurveTo(-51, 0, -47, 8);
    ctx.stroke();

    // Layered big ear + pink inner
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.ellipse(12, -5, 13, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(244, 114, 182, 0.35)';
    ctx.beginPath();
    ctx.ellipse(11, -4, 7, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Trunk ridge lines
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    [0, 6, 12].forEach((ty) => {
      ctx.beginPath();
      ctx.moveTo(35, ty);
      ctx.lineTo(43, ty);
      ctx.stroke();
    });

    // Ivory tusk
    ctx.fillStyle = '#FFFBEB';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(32, 9);
    ctx.quadraticCurveTo(49, 14, 52, 2);
    ctx.quadraticCurveTo(42, 7, 32, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawRosyCheek(27, -4);
    drawExpressiveEye(28, -12, 2.6);
    drawPanicSweat(18, -22);
  } else if (spec.id === 'bear') {
    // Fuzzy ears + inner cream pads
    ctx.fillStyle = spec.secondaryColor;
    ctx.beginPath();
    ctx.arc(16, -29, 7, 0, Math.PI * 2);
    ctx.arc(32, -29, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.arc(16, -29, 3.8, 0, Math.PI * 2);
    ctx.arc(32, -29, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Belly patch
    ctx.fillStyle = 'rgba(253, 230, 138, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-2, 4, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle + glossy nose
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.ellipse(32, -14, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(35, -15, 2.6, 0, Math.PI * 2);
    ctx.fill();

    drawRosyCheek(26, -14);
    drawExpressiveEye(27, -21, 2.4);
    drawPanicSweat(14, -28);
  } else if (spec.id === 'rhino') {
    // Armored skin plate folds
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-14, -15);
    ctx.quadraticCurveTo(-10, 0, -14, 15);
    ctx.moveTo(14, -15);
    ctx.quadraticCurveTo(18, 0, 14, 15);
    ctx.stroke();

    // Rhino ear
    ctx.fillStyle = spec.secondaryColor;
    ctx.beginPath();
    ctx.ellipse(27, -17, 3.5, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Twin curved horns (big front + small rear)
    ctx.fillStyle = spec.accentColor;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(37, -14);
    ctx.quadraticCurveTo(46, -24, 46, -32);
    ctx.lineTo(45, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(31, -14);
    ctx.lineTo(35, -22);
    ctx.lineTo(37, -14);
    ctx.closePath();
    ctx.fill();

    drawRosyCheek(32, -3);
    drawExpressiveEye(33, -9, 2.5);
    drawPanicSweat(22, -20);
  } else if (spec.id === 'fox') {
    // Fluffy white tail tip
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.arc(-34, -6, 6.2, 0, Math.PI * 2);
    ctx.fill();

    // White chest fur
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.ellipse(15, 2, 7, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Pointed dark-tipped ears
    ctx.fillStyle = spec.primaryColor;
    ctx.beginPath();
    ctx.moveTo(15, -19);
    ctx.lineTo(20, -31);
    ctx.lineTo(26, -19);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(18, -26);
    ctx.lineTo(20, -31);
    ctx.lineTo(23, -26);
    ctx.closePath();
    ctx.fill();

    // Cute nose
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(32, -9, 2.1, 0, Math.PI * 2);
    ctx.fill();

    drawRosyCheek(24, -6);
    drawExpressiveEye(26, -11, 2.2);
    drawPanicSweat(14, -22);
  } else if (spec.id === 'cat') {
    // Tail tip stripe
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.arc(-20, -13, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Pointed ears + pink inner triangles
    ctx.fillStyle = spec.primaryColor;
    ctx.beginPath();
    ctx.moveTo(9, -15);
    ctx.lineTo(12, -24);
    ctx.lineTo(17, -15);
    ctx.moveTo(18, -15);
    ctx.lineTo(22, -24);
    ctx.lineTo(25, -15);
    ctx.fill();
    ctx.fillStyle = '#FDA4AF';
    ctx.beginPath();
    ctx.moveTo(11, -16);
    ctx.lineTo(12, -21);
    ctx.lineTo(15, -16);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(22, -7);
    ctx.lineTo(28, -8);
    ctx.moveTo(22, -5);
    ctx.lineTo(28, -4);
    ctx.stroke();

    drawRosyCheek(19, -5);
    drawExpressiveEye(20, -9, 2.1, '#10B981');
    drawPanicSweat(9, -18);
  } else if (spec.id === 'eagle') {
    // Wing feather scallops
    ctx.strokeStyle = spec.accentColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-25, -2);
    ctx.lineTo(-14, -2);
    ctx.moveTo(14, -2);
    ctx.lineTo(25, -2);
    ctx.stroke();

    // White feathered head
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, -14, 8.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Hooked golden beak
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.moveTo(6, -15);
    ctx.lineTo(15, -12);
    ctx.lineTo(6, -9);
    ctx.closePath();
    ctx.fill();

    // Talons
    ctx.fillStyle = spec.accentColor;
    ctx.fillRect(-7, 11, 4, 3);
    ctx.fillRect(3, 11, 4, 3);

    drawExpressiveEye(2.5, -15, 1.9);
    drawPanicSweat(-8, -20);
  }

  // Player color badge dot
  if (!isGhost) {
    ctx.fillStyle = playerHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export const BalanceTowerGame: React.FC<BalanceTowerGameProps> = ({
  players: rawPlayers,
  onApplyDeltas,
  onExitToArcadeHub,
  onTournamentFinish,
  onEditPlayers,
}) => {
  const players = useMemo<ArcadePlayer[]>(
    () =>
      rawPlayers.map((p, idx) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        colorId:
          'colorId' in p && p.colorId
            ? p.colorId
            : TURN_ARCADE_COLOR_ORDER[idx % TURN_ARCADE_COLOR_ORDER.length],
      })),
    [rawPlayers]
  );

  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [roundNum, setRoundNum] = useState<number>(1);
  const [seriesScores, setSeriesScores] = useState<Record<string, number>>({});
  const [roundDeltas, setRoundDeltas] = useState<ArcadeDelta[]>([]);
  const [finalSeriesDeltas, setFinalSeriesDeltas] = useState<ArcadeDelta[]>([]);
  const [seriesWinners, setSeriesWinners] = useState<ArcadePlayer[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());

  const [turnIdx, setTurnIdx] = useState<number>(0);
  const [turnStage, setTurnStage] = useState<TurnStage>('AIMING');
  const [currentAnimal, setCurrentAnimal] = useState<AnimalSpec>(() => pickRandomAnimal());
  const [towerHeightM, setTowerHeightM] = useState<number>(0);
  const [placedCount, setPlacedCount] = useState<number>(0);
  const [eliminatedSet, setEliminatedSet] = useState<Record<number, boolean>>({});
  const [roundPointsMap, setRoundPointsMap] = useState<Record<string, number>>({});

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewSizeRef = useRef<{ w: number; h: number }>({ w: 420, h: 720 });

  // Matter.js refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const metaMapRef = useRef<Map<number, PlacedBodyMeta>>(new Map());

  // Interactive aiming / camera refs
  const aimXRef = useRef<number>(PLATFORM_X);
  const aimAngleRef = useRef<number>(0);
  const aimTargetAngleRef = useRef<number>(0);
  const cameraYRef = useRef<number>(0);
  const targetCameraYRef = useRef<number>(0);
  const highestStackedYRef = useRef<number>(PLATFORM_Y - PLATFORM_H / 2);

  // Direct touch-drag + tap-to-rotate refs
  const dragRef = useRef<{
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    lastClientX: number;
    totalMove: number;
    tappedAnimal: boolean;
  }>({
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    lastClientX: 0,
    totalMove: 0,
    tappedAnimal: false,
  });
  const lastSkyTapAtRef = useRef<number>(0);

  // Turn & round synchronization refs
  const turnIdxRef = useRef<number>(0);
  const turnStageRef = useRef<TurnStage>('AIMING');
  const currentAnimalRef = useRef<AnimalSpec>(currentAnimal);
  const eliminatedRef = useRef<Record<number, boolean>>({});
  const roundPointsRef = useRef<Record<string, number>>({});
  const settleTimerRef = useRef<number>(0);
  const settlingElapsedRef = useRef<number>(0);
  const collapseTimerRef = useRef<number | null>(null);
  const lastDropBodyIdRef = useRef<number | null>(null);
  const roundEndedRef = useRef<boolean>(false);
  const lastMetersRef = useRef<number>(0);
  const lastPlacedCountRef = useRef<number>(0);

  // VFX
  const splashesRef = useRef<SplashParticle[]>([]);
  const confettiRef = useRef<ConfettiPiece[]>([]);
  const bannersRef = useRef<FloatingBanner[]>([]);

  const isRoundActive = phase === 'PLAYING';
  useArcadeTouchLock(isRoundActive, arenaRef);
  useNavigationGuard(isRoundActive || phase === 'INTER_ROUND', () => setShowExitConfirm(true));
  const goHome = useGoHome();

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  const disposePhysics = useCallback(() => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (engineRef.current) {
      Matter.Events.off(engineRef.current, 'collisionStart');
      Matter.World.clear(engineRef.current.world, false);
      Matter.Engine.clear(engineRef.current);
      engineRef.current = null;
    }
    metaMapRef.current.clear();
    dragRef.current.pointerId = null;
  }, []);

  useEffect(() => {
    return () => {
      disposePhysics();
    };
  }, [disposePhysics]);

  const finishRound = useCallback(
    (survivorIndices: number[], loserIdx: number | null) => {
      if (roundEndedRef.current) return;
      roundEndedRef.current = true;
      disposePhysics();

      const updatedPoints: Record<string, number> = { ...roundPointsRef.current };
      if (survivorIndices.length === 1 && players[survivorIndices[0]]) {
        updatedPoints[players[survivorIndices[0]].id] =
          (updatedPoints[players[survivorIndices[0]].id] ?? 0) + 60;
      } else if (survivorIndices.length > 1) {
        survivorIndices.forEach((sIdx) => {
          const sp = players[sIdx];
          if (sp) {
            updatedPoints[sp.id] = (updatedPoints[sp.id] ?? 0) + 25;
          }
        });
      }

      const deltas: ArcadeDelta[] = players.map((p) => ({
        playerId: p.id,
        delta: Math.max(0, updatedPoints[p.id] ?? 0),
      }));

      const nextSeries: Record<string, number> = { ...seriesScores };
      deltas.forEach((d) => {
        nextSeries[d.playerId] = (nextSeries[d.playerId] ?? 0) + d.delta;
      });
      setSeriesScores(nextSeries);
      setRoundDeltas(deltas);

      const soleWinnerName =
        survivorIndices.length === 1 && players[survivorIndices[0]]
          ? players[survivorIndices[0]].name
          : null;
      const loserName = loserIdx !== null && players[loserIdx] ? players[loserIdx].name : null;

      if (roundNum >= totalRounds) {
        const finalDeltas: ArcadeDelta[] = players.map((p) => ({
          playerId: p.id,
          delta: nextSeries[p.id] ?? 0,
        }));
        const topScore = Math.max(...finalDeltas.map((d) => d.delta));
        const winners = players.filter((p) => (nextSeries[p.id] ?? 0) === topScore);
        winners.forEach((w) => recordArcadeWin(w.id));
        onApplyDeltas(finalDeltas);
        setFinalSeriesDeltas(finalDeltas);
        setSeriesWinners(winners);
        setSummaryText(
          winners.length === 1
            ? `بطل برج التوازن: ${winners[0].name} 🦁🏆`
            : `تعادل في برج التوازن: ${winners.map((w) => w.name).join(' و ')}!`
        );
        soundManager.play('victory');
        setPhase('WINNER_SPOTLIGHT');
      } else {
        setSummaryText(
          soleWinnerName
            ? `الجولة ${roundNum}: صمد ${soleWinnerName} وكسب +٦٠ نقطة!`
            : loserName
              ? `الجولة ${roundNum}: وقع برج ${loserName}! الناجون كسبوا نقاط الصمود 💦`
              : `انتهت الجولة ${roundNum}!`
        );
        soundManager.play('next');
        setPhase('INTER_ROUND');
      }
    },
    [disposePhysics, players, seriesScores, roundNum, totalRounds, onApplyDeltas]
  );

  // Inter-round overlay progression
  useEffect(() => {
    if (phase !== 'INTER_ROUND') return;
    const t = window.setTimeout(() => {
      setRoundNum((r) => r + 1);
      setPhase('PLAYING');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Initialize fresh Matter.js world each round
  const initRoundWorld = useCallback(() => {
    disposePhysics();
    roundEndedRef.current = false;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.85, scale: 0.001 },
      enableSleeping: true,
      positionIterations: 6,
      velocityIterations: 4,
    });

    const platformColliderH = 300;
    const platformTopY = PLATFORM_Y - PLATFORM_H / 2;
    const platform = Matter.Bodies.rectangle(
      PLATFORM_X,
      platformTopY + platformColliderH / 2,
      PLATFORM_W,
      platformColliderH,
      {
        isStatic: true,
        friction: 0.65,
        frictionStatic: 1.5,
        restitution: 0.05,
        slop: 0.02,
        chamfer: { radius: 8 },
        label: 'platform',
      }
    );

    Matter.World.add(engine.world, platform);

    // Subtle dust puffs on landing impacts (capped at <= 60 active particles)
    Matter.Events.on(engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const dyn = pair.bodyA.isStatic ? pair.bodyB : pair.bodyA;
        const speed = Math.hypot(dyn.velocity.x, dyn.velocity.y);
        if (speed < 1.35) continue;
        const contact = pair.collision.supports?.[0];
        const cx = contact?.x ?? dyn.position.x;
        const cy = contact?.y ?? dyn.bounds.max.y;
        for (let i = 0; i < 4; i++) {
          if (splashesRef.current.length + confettiRef.current.length >= 60) {
            splashesRef.current.shift();
          }
          splashesRef.current.push({
            x: cx + (Math.random() - 0.5) * 18,
            y: cy,
            vx: (Math.random() - 0.5) * 90,
            vy: -20 - Math.random() * 65,
            color: 'rgba(255, 255, 255, 0.85)',
            size: 2.5 + Math.random() * 3,
            life: 0.45 + Math.random() * 0.2,
          });
        }
      }
    });

    engineRef.current = engine;
    metaMapRef.current.clear();

    const firstTurn = (roundNum - 1) % players.length;
    turnIdxRef.current = firstTurn;
    turnStageRef.current = 'AIMING';
    const nextSpec = pickRandomAnimal();
    currentAnimalRef.current = nextSpec;
    eliminatedRef.current = {};
    roundPointsRef.current = {};
    aimXRef.current = PLATFORM_X;
    aimAngleRef.current = 0;
    aimTargetAngleRef.current = 0;
    cameraYRef.current = 0;
    targetCameraYRef.current = 0;
    highestStackedYRef.current = PLATFORM_Y - PLATFORM_H / 2;
    settleTimerRef.current = 0;
    settlingElapsedRef.current = 0;
    lastDropBodyIdRef.current = null;
    lastMetersRef.current = 0;
    lastPlacedCountRef.current = 0;
    splashesRef.current = [];
    confettiRef.current = [];
    bannersRef.current = [];

    setTurnIdx(firstTurn);
    setTurnStage('AIMING');
    setCurrentAnimal(nextSpec);
    setEliminatedSet({});
    setRoundPointsMap({});
    setTowerHeightM(0);
    setPlacedCount(0);
  }, [disposePhysics, players.length, roundNum]);

  useEffect(() => {
    if (phase === 'PLAYING') {
      initRoundWorld();
    }
  }, [phase, initRoundWorld]);

  // Keep canvas DPR sized to full viewport
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const syncSize = () => {
      const container = arenaRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

  // Main Matter.js simulation + canvas renderer
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    let rafId = 0;
    let lastTs = performance.now();

    const advanceToNextPlayer = () => {
      if (roundEndedRef.current) return;
      const aliveIndices = players
        .map((_, idx) => idx)
        .filter((idx) => !eliminatedRef.current[idx]);

      if (aliveIndices.length <= 1) {
        finishRound(aliveIndices, null);
        return;
      }

      let nextIdx = (turnIdxRef.current + 1) % players.length;
      let guardCount = 0;
      while (eliminatedRef.current[nextIdx] && guardCount < players.length) {
        nextIdx = (nextIdx + 1) % players.length;
        guardCount++;
      }

      const nextSpec = pickRandomAnimal();
      turnIdxRef.current = nextIdx;
      turnStageRef.current = 'AIMING';
      currentAnimalRef.current = nextSpec;
      aimXRef.current = PLATFORM_X;
      aimAngleRef.current = 0;
      aimTargetAngleRef.current = 0;

      // Update camera to rise comfortably so active animal spawns high below the HUD with generous drop room
      const { initialHoverY } = getStageMetrics(viewSizeRef.current.w, viewSizeRef.current.h);
      const desiredHoverY = highestStackedYRef.current - DROP_CLEARANCE;
      targetCameraYRef.current = Math.min(0, desiredHoverY - initialHoverY);

      setTurnIdx(nextIdx);
      setTurnStage('AIMING');
      setCurrentAnimal(nextSpec);
    };

    const drawScene = (now: number) => {
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      if (!canvas || !engine) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const { w: vw, h: vh } = viewSizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Portrait Fullscreen mapping: fills full mobile width & leaves ~9% water gap on left/right
      const { scale: safeScale, offsetX, baseGroundScreenY, initialHoverY } = getStageMetrics(
        vw,
        vh
      );
      const worldOriginY =
        baseGroundScreenY - PLATFORM_Y * safeScale - cameraYRef.current * safeScale;

      // Sky gradient (shifts slightly deeper blue with altitude!)
      const altRatio = Math.min(1, Math.abs(cameraYRef.current) / 900);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, vh);
      skyGrad.addColorStop(0, altRatio > 0.4 ? '#0284C7' : '#38BDF8');
      skyGrad.addColorStop(0.58, '#7DD3FC');
      skyGrad.addColorStop(1, '#BAE6FD');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, vw, vh);

      // Multi-layered parallax clouds
      const cloudParallax = -cameraYRef.current * 0.25 * safeScale;
      for (let i = 0; i < 7; i++) {
        const layerAlpha = i % 2 === 0 ? 0.8 : 0.55;
        const speed = i % 2 === 0 ? 0.013 : 0.008;
        const cx = ((i * 195 + now * speed) % (vw + 180)) - 90;
        const cy = ((82 + i * 112 + cloudParallax) % (vh + 120)) - 40;
        ctx.fillStyle = `rgba(255, 255, 255, ${layerAlpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.arc(cx + 22, cy - 8, 28, 0, Math.PI * 2);
        ctx.arc(cx + 46, cy, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      // Distant gliding birds in the sky
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.36)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let b = 0; b < 4; b++) {
        const bx = ((b * 170 + now * (0.022 + b * 0.004)) % (vw + 120)) - 60;
        const by = 95 + b * 68 + Math.sin(now * 0.002 + b) * 10;
        const wingFlap = Math.sin(now * 0.009 + b * 1.7) * 5;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by - wingFlap);
        ctx.quadraticCurveTo(bx - 4, by - 5, bx, by);
        ctx.quadraticCurveTo(bx + 4, by - 5, bx + 10, by - wingFlap);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(offsetX, worldOriginY);
      ctx.scale(safeScale, safeScale);

      // Height meter lines every 80 world units (spanning all the way to the top of the screen)
      const topVisibleWorldY = -worldOriginY / safeScale;
      const maxH = Math.max(8, Math.ceil((PLATFORM_Y - topVisibleWorldY + 120) / 80));
      ctx.font = '800 11px Cairo, sans-serif';
      ctx.textAlign = 'left';
      for (let step = 1; step <= maxH; step++) {
        const lineY = PLATFORM_Y - PLATFORM_H / 2 - step * 80;
        ctx.strokeStyle = 'rgba(255,255,255,0.34)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(16, lineY);
        ctx.lineTo(WORLD_W - 16, lineY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fillText(`${step * 2}م`, 18, lineY - 4);
      }

      // Supporting ancient stone pillar beneath platform
      const pillarGrad = ctx.createLinearGradient(PLATFORM_X - 45, 0, PLATFORM_X + 45, 0);
      pillarGrad.addColorStop(0, '#94A3B8');
      pillarGrad.addColorStop(0.5, '#CBD5E1');
      pillarGrad.addColorStop(1, '#64748B');
      ctx.fillStyle = pillarGrad;
      ctx.fillRect(PLATFORM_X - 38, PLATFORM_Y + PLATFORM_H / 2 - 4, 76, 260);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(PLATFORM_X - 38, PLATFORM_Y + PLATFORM_H / 2 - 4, 76, 260);

      // Wide stable wooden platform with wood grain lines & knots
      const platLeft = PLATFORM_X - PLATFORM_W / 2;
      const platTop = PLATFORM_Y - PLATFORM_H / 2;
      drawRoundedRect(ctx, platLeft, platTop, PLATFORM_W, PLATFORM_H, 10);
      ctx.fillStyle = '#92400E';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#451A03';
      ctx.stroke();

      // Wood grain planks & knots
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, platLeft, platTop, PLATFORM_W, PLATFORM_H, 10);
      ctx.clip();
      ctx.strokeStyle = 'rgba(69, 26, 3, 0.4)';
      ctx.lineWidth = 1.6;
      for (let gx = platLeft + 26; gx < platLeft + PLATFORM_W - 10; gx += 46) {
        ctx.beginPath();
        ctx.moveTo(gx, platTop + 12);
        ctx.lineTo(gx + 12, platTop + PLATFORM_H);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(PLATFORM_X - 65, platTop + 21, 9, 3.5, 0.1, 0, Math.PI * 2);
      ctx.ellipse(PLATFORM_X + 75, platTop + 20, 7, 3, -0.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Lush grassy top strip on platform
      drawRoundedRect(ctx, platLeft - 2, platTop - 2, PLATFORM_W + 4, 13, 8);
      ctx.fillStyle = '#22C55E';
      ctx.fill();
      ctx.strokeStyle = '#14532D';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Individual lush grass blades & tiny swaying wildflowers
      ctx.strokeStyle = '#16A34A';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let bx = platLeft + 8; bx < platLeft + PLATFORM_W - 8; bx += 16) {
        const sway = Math.sin(now * 0.003 + bx * 0.1) * 1.8;
        ctx.beginPath();
        ctx.moveTo(bx, platTop - 1);
        ctx.quadraticCurveTo(bx + sway, platTop - 7, bx + sway * 1.4, platTop - 10);
        ctx.stroke();
        if (Math.round(bx) % 48 === 0) {
          ctx.fillStyle = (Math.round(bx / 48) & 1) === 0 ? '#FDE047' : '#F472B6';
          ctx.beginPath();
          ctx.arc(bx + sway * 1.4, platTop - 11, 2.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Animated Water Hazard at bottom of world
      const waterWave = Math.sin(now * 0.004) * 5;
      const waterGrad = ctx.createLinearGradient(0, WATER_Y, 0, WATER_Y + 260);
      waterGrad.addColorStop(0, 'rgba(14, 165, 233, 0.85)');
      waterGrad.addColorStop(1, 'rgba(3, 105, 161, 0.98)');
      ctx.fillStyle = waterGrad;
      ctx.beginPath();
      ctx.moveTo(-400, WATER_Y + 300);
      for (let wx = -400; wx <= WORLD_W + 400; wx += 28) {
        const wy = WATER_Y + Math.sin(wx * 0.04 + now * 0.004) * 4 + waterWave * 0.3;
        ctx.lineTo(wx, wy);
      }
      ctx.lineTo(WORLD_W + 400, WATER_Y + 300);
      ctx.closePath();
      ctx.fill();

      // Stacked Matter.js rigid bodies
      const bodies = Matter.Composite.allBodies(engine.world);
      for (const body of bodies) {
        if (body.isStatic) continue;
        const meta = metaMapRef.current.get(body.id);
        if (!meta) continue;
        const spd = body.isSleeping ? 0 : Math.hypot(body.velocity.x, body.velocity.y);
        const isPanicking =
          !body.isSleeping && (Math.abs(body.angularVelocity) > 0.045 || spd > 2.6);
        drawAnimalSilhouette(
          ctx,
          meta.spec,
          meta.playerHex,
          body.position.x,
          body.position.y,
          body.angle,
          1,
          false,
          now,
          body.id,
          isPanicking
        );
      }

      // Active Aiming Ghost + Laser Drop Guide (high near top of viewport below HUD)
      if (turnStageRef.current === 'AIMING' && !roundEndedRef.current) {
        const activeP = players[turnIdxRef.current];
        const pHex = activeP ? ARCADE_COLORS[activeP.colorId].hex : '#F97316';
        const hoverY = Math.min(initialHoverY, highestStackedYRef.current - DROP_CLEARANCE);

        // Crisp vertical dotted drop-guide line down to the platform/tower top
        ctx.save();
        ctx.strokeStyle = `${pHex}CC`;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 7]);
        ctx.beginPath();
        ctx.moveTo(aimXRef.current, hoverY + 22);
        ctx.lineTo(aimXRef.current, Math.max(hoverY + 50, highestStackedYRef.current + 12));
        ctx.stroke();
        ctx.restore();

        // Target ring on drop origin
        ctx.fillStyle = pHex;
        ctx.beginPath();
        ctx.arc(aimXRef.current, hoverY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Solid active animal bobbing subtly with blinking eyes
        const bob = Math.sin(now * 0.006) * 2.5;
        drawAnimalSilhouette(
          ctx,
          currentAnimalRef.current,
          pHex,
          aimXRef.current,
          hoverY + bob,
          aimAngleRef.current,
          0.95,
          false,
          now,
          turnIdxRef.current + 1
        );
      }

      // Water splash & dust particles
      splashesRef.current.forEach((sp) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.life);
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Celebratory confetti bursts on clean settle
      confettiRef.current.forEach((cf) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, cf.life));
        ctx.translate(cf.x, cf.y);
        ctx.rotate(cf.rot);
        ctx.fillStyle = cf.color;
        ctx.fillRect(-cf.w / 2, -cf.h / 2, cf.w, cf.h);
        ctx.restore();
      });

      // Floating banners
      bannersRef.current.forEach((bn) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, bn.life));
        ctx.font = '900 17px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 4;
        ctx.strokeText(bn.text, bn.x, bn.y);
        ctx.fillStyle = bn.color;
        ctx.fillText(bn.text, bn.x, bn.y);
        ctx.restore();
      });

      ctx.restore();
    };

    let accumulatorMs = 0;
    const FIXED_STEP_MS = 1000 / 60;

    const step = (now: number) => {
      const rawDtMs = Math.min(33.33, Math.max(0, now - lastTs));
      const dt = rawDtMs / 1000;
      lastTs = now;
      const engine = engineRef.current;
      if (!engine) return;

      // Smooth 45-degree rotation interpolation during AIMING
      if (turnStageRef.current === 'AIMING') {
        aimAngleRef.current +=
          (aimTargetAngleRef.current - aimAngleRef.current) * Math.min(1, dt * 18);
      }

      // Fixed-timestep Matter.js update (always 1000/60 ms per step, max 2 steps per frame)
      // Gentle natural angular damping (0.15 -> ~0.96 retention per step) with zero magnetic edge sticking
      accumulatorMs += rawDtMs;
      let physicsSteps = 0;
      while (accumulatorMs >= FIXED_STEP_MS && physicsSteps < 2) {
        const bodiesPre = Matter.Composite.allBodies(engine.world);
        for (const b of bodiesPre) {
          if (b.isStatic || b.isSleeping) continue;
          Matter.Body.setAngularVelocity(b, b.angularVelocity * 0.96);
        }
        Matter.Engine.update(engine, FIXED_STEP_MS);
        accumulatorMs -= FIXED_STEP_MS;
        physicsSteps++;
      }

      // Check stacked bodies for height & water falls
      let highestY = PLATFORM_Y - PLATFORM_H / 2;
      let maxVel = 0;
      let fellBody: { body: Matter.Body; meta: PlacedBodyMeta } | null = null;
      let activeDropBody: Matter.Body | null = null;
      let lowestMovingBody: Matter.Body | null = null;
      let stackedCount = 0;

      const bodies = Matter.Composite.allBodies(engine.world);
      for (const b of bodies) {
        if (b.isStatic) continue;
        const meta = metaMapRef.current.get(b.id);
        if (!meta) continue;
        stackedCount++;

        if (b.id === lastDropBodyIdRef.current) {
          activeDropBody = b;
        }

        if (b.position.y > WATER_Y || b.position.x < -140 || b.position.x > WORLD_W + 140) {
          fellBody = { body: b, meta };
          break;
        }

        if (b.bounds.min.y < highestY) {
          highestY = b.bounds.min.y;
        }

        if (!b.isSleeping) {
          const spd = Math.hypot(b.velocity.x, b.velocity.y);
          maxVel = Math.max(maxVel, spd, Math.abs(b.angularVelocity) * 14);
          if (b.velocity.y > 0.65 && (!lowestMovingBody || b.position.y > lowestMovingBody.position.y)) {
            lowestMovingBody = b;
          }
        }
      }

      // Dynamic Drop-Tracking Camera: follow falling animals down to platform/water, then back up on next turn
      const stageMetrics = getStageMetrics(viewSizeRef.current.w, viewSizeRef.current.h);
      const topCameraY = Math.min(
        0,
        highestY - DROP_CLEARANCE - stageMetrics.initialHoverY
      );
      if (turnStageRef.current === 'SETTLING' || turnStageRef.current === 'COLLAPSED') {
        const trackedBody = fellBody?.body ?? lowestMovingBody ?? activeDropBody;
        if (trackedBody) {
          const desiredFollowCamY =
            (stageMetrics.baseGroundScreenY - viewSizeRef.current.h * 0.5) / stageMetrics.scale +
            (trackedBody.position.y - PLATFORM_Y);
          // Clamp between tower top and slightly past platform so both base & water splash stay visible
          targetCameraYRef.current = Math.min(36, Math.max(topCameraY, desiredFollowCamY));
        }
      }

      const camSpeed =
        turnStageRef.current === 'SETTLING' || turnStageRef.current === 'COLLAPSED' ? 8.5 : 6.5;
      cameraYRef.current += (targetCameraYRef.current - cameraYRef.current) * Math.min(1, dt * camSpeed);

      highestStackedYRef.current = highestY;
      const meters = Math.max(
        0,
        Math.round(((PLATFORM_Y - PLATFORM_H / 2 - highestY) / 40) * 10) / 10
      );
      if (meters !== lastMetersRef.current) {
        lastMetersRef.current = meters;
        setTowerHeightM(meters);
      }
      if (stackedCount !== lastPlacedCountRef.current) {
        lastPlacedCountRef.current = stackedCount;
        setPlacedCount(stackedCount);
      }

      if (fellBody && !roundEndedRef.current && turnStageRef.current !== 'COLLAPSED') {
        const culpritIdx = turnIdxRef.current;
        turnStageRef.current = 'COLLAPSED';
        setTurnStage('COLLAPSED');
        soundManager.play('splash');
        triggerHaptic([60, 40, 90]);

        // Spawn water splash at fall point (capped at <= 60 active particles)
        const splashX = Math.max(30, Math.min(WORLD_W - 30, fellBody.body.position.x));
        for (let i = 0; i < 18; i++) {
          if (splashesRef.current.length + confettiRef.current.length >= 60) {
            splashesRef.current.shift();
          }
          const ang = -Math.PI * Math.random();
          const spd = 90 + Math.random() * 210;
          splashesRef.current.push({
            x: splashX,
            y: WATER_Y - 4,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 40,
            color: i % 2 === 0 ? '#E0F2FE' : '#38BDF8',
            size: 3 + Math.random() * 4.5,
            life: 0.9 + Math.random() * 0.4,
          });
        }

        const loserPlayer = players[culpritIdx];
        bannersRef.current.push({
          x: PLATFORM_X,
          y: highestY - 30,
          text: `وقع برج ${loserPlayer?.name ?? ''}! 💦`,
          color: '#FCA5A5',
          life: 1.8,
        });

        // Mark player eliminated & either continue or end round
        const nextElim = { ...eliminatedRef.current, [culpritIdx]: true };
        eliminatedRef.current = nextElim;
        setEliminatedSet(nextElim);

        // Give survival bonus to remaining alive players
        players.forEach((p, idx) => {
          if (!nextElim[idx]) {
            roundPointsRef.current[p.id] = (roundPointsRef.current[p.id] ?? 0) + 30;
          }
        });
        setRoundPointsMap({ ...roundPointsRef.current });

        const alive = players.map((_, idx) => idx).filter((idx) => !nextElim[idx]);
        collapseTimerRef.current = window.setTimeout(() => {
          finishRound(alive, culpritIdx);
        }, 1100);
      }

      // Check settle completion during SETTLING
      if (turnStageRef.current === 'SETTLING' && !roundEndedRef.current) {
        settlingElapsedRef.current += dt;
        if (maxVel < 0.24) {
          settleTimerRef.current += dt;
        } else {
          settleTimerRef.current = 0;
        }

        if (settleTimerRef.current >= 0.4 || settlingElapsedRef.current >= 4.2) {
          // Safe placement! Award player points + confetti/dust burst (capped at <= 60 active particles)
          const activeP = players[turnIdxRef.current];
          const confettiPalette = ['#FACC15', '#34D399', '#38BDF8', '#F472B6', '#FB923C'];
          for (let i = 0; i < 14; i++) {
            if (splashesRef.current.length + confettiRef.current.length >= 60) {
              confettiRef.current.shift();
            }
            const ang = -Math.PI * Math.random();
            const spd = 70 + Math.random() * 140;
            confettiRef.current.push({
              x: aimXRef.current,
              y: highestY + 12,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - 35,
              rot: Math.random() * Math.PI * 2,
              vRot: (Math.random() - 0.5) * 14,
              w: 6 + Math.random() * 4,
              h: 4 + Math.random() * 3,
              color: confettiPalette[i % confettiPalette.length],
              life: 0.95 + Math.random() * 0.35,
            });
          }

          if (activeP) {
            const pts = 20 + Math.min(20, Math.floor(meters * 2));
            roundPointsRef.current[activeP.id] = (roundPointsRef.current[activeP.id] ?? 0) + pts;
            setRoundPointsMap({ ...roundPointsRef.current });
            bannersRef.current.push({
              x: aimXRef.current,
              y: highestY - 26,
              text: `+${pts} توازن بطل!`,
              color: '#86EFAC',
              life: 1.15,
            });
          }
          soundManager.play('catch');
          triggerHaptic(20);
          advanceToNextPlayer();
        }
      }

      // Update VFX only when active
      if (splashesRef.current.length > 0) {
        splashesRef.current = splashesRef.current
          .map((s) => ({
            ...s,
            x: s.x + s.vx * dt,
            y: s.y + s.vy * dt,
            vy: s.vy + 460 * dt,
            life: s.life - dt,
          }))
          .filter((s) => s.life > 0);
      }

      if (confettiRef.current.length > 0) {
        confettiRef.current = confettiRef.current
          .map((c) => ({
            ...c,
            x: c.x + c.vx * dt,
            y: c.y + c.vy * dt,
            vy: c.vy + 290 * dt,
            rot: c.rot + c.vRot * dt,
            life: c.life - dt,
          }))
          .filter((c) => c.life > 0);
      }

      if (bannersRef.current.length > 0) {
        bannersRef.current = bannersRef.current
          .map((b) => ({ ...b, y: b.y - 26 * dt, life: b.life - dt * 0.9 }))
          .filter((b) => b.life > 0);
      }

      drawScene(now);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [phase, players, finishRound]);

  // Direct Touch-Drag Aiming & Tap-to-Rotate Controls
  const rotateAnimal = () => {
    if (turnStageRef.current !== 'AIMING') return;
    aimTargetAngleRef.current += Math.PI / 4;
    soundManager.play('pop');
    triggerHaptic(15);
  };

  const handlePlayfieldPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (turnStageRef.current !== 'AIMING' || roundEndedRef.current) return;
    if (dragRef.current.pointerId !== null) return;
    e.preventDefault();
    soundManager.unlock();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const { scale: safeScale, offsetX, baseGroundScreenY, initialHoverY } = getStageMetrics(
      viewSizeRef.current.w,
      viewSizeRef.current.h
    );
    const worldOriginY =
      baseGroundScreenY - PLATFORM_Y * safeScale - cameraYRef.current * safeScale;
    const worldX = (localX - offsetX) / safeScale;
    const worldY = (localY - worldOriginY) / safeScale;
    const hoverY = Math.min(initialHoverY, highestStackedYRef.current - DROP_CLEARANCE);
    const tappedAnimal = Math.hypot(worldX - aimXRef.current, worldY - hoverY) < 76;

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      totalMove: 0,
      tappedAnimal,
    };
  };

  const handlePlayfieldPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    if (turnStageRef.current !== 'AIMING') return;
    e.preventDefault();

    const { scale: safeScale } = getStageMetrics(viewSizeRef.current.w, viewSizeRef.current.h);
    const dx = e.clientX - dragRef.current.lastClientX;
    const stepTotal = Math.hypot(e.clientX - dragRef.current.startClientX, e.clientY - dragRef.current.startClientY);
    dragRef.current.lastClientX = e.clientX;
    dragRef.current.totalMove = Math.max(dragRef.current.totalMove, stepTotal);

    aimXRef.current = Math.max(
      MIN_AIM_X,
      Math.min(MAX_AIM_X, aimXRef.current + dx / safeScale)
    );
  };

  const handlePlayfieldPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }

    const { totalMove, tappedAnimal } = dragRef.current;
    dragRef.current.pointerId = null;

    if (turnStageRef.current === 'AIMING' && totalMove < 12) {
      const now = performance.now();
      if (tappedAnimal) {
        rotateAnimal();
        lastSkyTapAtRef.current = 0;
      } else if (now - lastSkyTapAtRef.current < 320) {
        rotateAnimal();
        lastSkyTapAtRef.current = 0;
      } else {
        lastSkyTapAtRef.current = now;
      }
    }
  };

  const dropAnimal = () => {
    if (turnStageRef.current !== 'AIMING' || !engineRef.current || roundEndedRef.current) return;
    soundManager.unlock();
    soundManager.play('whoosh');
    triggerHaptic(22);

    const activeP = players[turnIdxRef.current];
    const pHex = activeP ? ARCADE_COLORS[activeP.colorId].hex : '#F97316';
    const { initialHoverY } = getStageMetrics(viewSizeRef.current.w, viewSizeRef.current.h);
    const spawnY = Math.min(initialHoverY, highestStackedYRef.current - DROP_CLEARANCE);

    const body = createAnimalBody(
      currentAnimalRef.current,
      aimXRef.current,
      spawnY,
      aimTargetAngleRef.current
    );

    metaMapRef.current.set(body.id, {
      spec: currentAnimalRef.current,
      playerIdx: turnIdxRef.current,
      playerHex: pHex,
      playerName: activeP?.name ?? 'لاعب',
      droppedAt: performance.now(),
      highestY: spawnY,
    });
    lastDropBodyIdRef.current = body.id;
    Matter.World.add(engineRef.current.world, body);

    dragRef.current.pointerId = null;
    settleTimerRef.current = 0;
    settlingElapsedRef.current = 0;
    turnStageRef.current = 'SETTLING';
    setTurnStage('SETTLING');
  };

  const activePlayer = players[turnIdx] ?? players[0];
  const activeColor = activePlayer ? ARCADE_COLORS[activePlayer.colorId] : ARCADE_COLORS.red;

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] flex flex-col select-none overflow-hidden">
      {phase === 'SETUP' && (
        <div className="flex-1 overflow-y-auto">
          <ArcadePreGameSetup
            title="برج التوازن"
            subtitle="حرّك ودوّر الحيوانات بفيزياء واقعية وأسقطها فوق المنصة من غير ما توقع في الميّة!"
            players={players}
            accentBgClass="bg-gradient-to-br from-[#0284c7] to-[#10b981]"
            icon={<Layers className="w-12 h-12 text-white" />}
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            onEditPlayers={onEditPlayers}
            onStartSeries={(rounds) => {
              setTotalRounds(rounds);
              setRoundNum(1);
              setSeriesScores({});
              setPhase('PLAYING');
            }}
            onBack={onExitToArcadeHub}
          />
        </div>
      )}

      {isRoundActive && (
        <ArcadeFloatingHud
          secondsLeft={null}
          stageLabel={`جولة ${roundNum}/${totalRounds} · 📏 ${towerHeightM}م (${placedCount} 🐾)`}
          muted={muted}
          onRequestExit={() => setShowExitConfirm(true)}
        />
      )}

      {isRoundActive && (
        <div
          ref={arenaRef}
          dir="ltr"
          style={{ touchAction: 'none' }}
          className="relative w-full h-full overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePlayfieldPointerDown}
            onPointerMove={handlePlayfieldPointerMove}
            onPointerUp={handlePlayfieldPointerEnd}
            onPointerCancel={handlePlayfieldPointerEnd}
            onLostPointerCapture={handlePlayfieldPointerEnd}
            style={{ touchAction: 'none' }}
            className="w-full h-full block bg-[#38BDF8]"
          />

          {/* Active Turn Banner */}
          <div
            dir="rtl"
            className="pointer-events-none fixed top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-2xl bg-slate-950/90 border-2 border-white/25 px-3.5 py-1.5 shadow-xl max-w-[92%]"
          >
            <span
              style={{ backgroundColor: activeColor.hex }}
              className="w-3.5 h-3.5 rounded-full border border-white shrink-0"
            />
            <span className="text-xs sm:text-sm font-black text-white truncate">
              دور: <span style={{ color: activeColor.hex }}>{activePlayer?.name}</span>
            </span>
            <span className="text-xs font-extrabold text-amber-300 shrink-0">
              · {currentAnimal.emoji} {currentAnimal.name} ({WEIGHT_TIER_LABEL[currentAnimal.weightTier]})
            </span>
            {Object.keys(eliminatedSet).length > 0 && (
              <span className="text-[11px] font-bold text-rose-300 shrink-0">
                · ({players.length - Object.keys(eliminatedSet).length} صامدين)
              </span>
            )}
          </div>

          {/* Compact Single-Row Scrollable Score Strip (supports 2–20 players cleanly) */}
          <div
            dir="rtl"
            className="fixed top-[98px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 flex-nowrap overflow-x-auto max-w-[95%] px-2 py-0.5"
          >
            {players.map((p, idx) => {
              const c = ARCADE_COLORS[p.colorId];
              const isTurn = idx === turnIdx;
              const isOut = Boolean(eliminatedSet[idx]);
              return (
                <div
                  key={p.id}
                  style={{ borderColor: isTurn ? c.hex : 'rgba(255,255,255,0.2)' }}
                  className={`shrink-0 flex items-center gap-1 rounded-full bg-slate-950/88 border-2 px-2 py-0.5 text-[11px] font-black text-white ${
                    isOut ? 'opacity-40 line-through' : ''
                  }`}
                >
                  <span
                    style={{ backgroundColor: c.hex }}
                    className="w-2 h-2 rounded-full shrink-0"
                  />
                  <span className="truncate max-w-[54px]">{p.name}</span>
                  <span className="tabular-nums text-emerald-300">
                    {roundPointsMap[p.id] ?? 0}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Subtle Drag / Tap Hint + Single Centered Glowing Drop Button */}
          <div
            dir="rtl"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none"
          >
            {turnStage === 'AIMING' && (
              <div className="px-3 py-1 rounded-full bg-slate-950/85 border border-white/20 text-[11px] font-extrabold text-white/95 whitespace-nowrap">
                اسحب يمين/شمال للتحريك · المس الحيوان أو نقرتين للتدوير 🔄
              </div>
            )}
            <button
              type="button"
              disabled={turnStage !== 'AIMING'}
              onClick={dropAnimal}
              className="pointer-events-auto min-w-[210px] min-h-[62px] px-8 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 active:scale-95 disabled:opacity-45 border-2 border-emerald-100 border-b-[5px] border-b-emerald-900 text-white font-black text-lg flex items-center justify-center gap-2 shadow-[0_0_26px_rgba(16,185,129,0.65)] transition-transform"
            >
              <span>إسقاط ⬇️</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'INTER_ROUND' && (
        <ArcadeSeriesOverlay
          players={players}
          seriesScores={seriesScores}
          roundDeltas={roundDeltas}
          roundNum={roundNum}
          totalRounds={totalRounds}
          headline={summaryText}
          durationMs={3000}
        />
      )}

      {phase === 'WINNER_SPOTLIGHT' && (
        <ArcadeWinnerSpotlight
          winners={seriesWinners}
          seriesScores={seriesScores}
          headline={summaryText}
          onContinueToLeaderboard={() => setPhase('LEADERBOARD')}
        />
      )}

      {phase === 'LEADERBOARD' && (
        <div className="flex-1 flex flex-col pt-4 overflow-y-auto">
          {onTournamentFinish ? (
            <LeaderboardScreen
              players={rawPlayers as Player[]}
              deltas={finalSeriesDeltas}
              summaryHeadline={summaryText}
              isTournamentMode
              onNewRound={() => {
                setRoundNum(1);
                setSeriesScores({});
                setPhase('SETUP');
              }}
              onFinishGame={() => onTournamentFinish(finalSeriesDeltas)}
            />
          ) : (
            <>
              <div className="w-full max-w-xl mx-auto px-4 pb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onExitToArcadeHub}
                  className="min-h-[44px] px-3 rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#090F1E] text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                  <span>ألعاب 2D</span>
                </button>
                <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC]">نتيجة التحدي</h1>
                <div className="w-20 flex justify-end">
                  {goHome && <HomeLogoBadge onClick={goHome} />}
                </div>
              </div>

              <ArcadeLeaderboardScreen
                players={players}
                deltas={finalSeriesDeltas}
                summaryHeadline={summaryText}
                onNewRound={() => {
                  setRoundNum(1);
                  setSeriesScores({});
                  setPhase('SETUP');
                }}
                onBackToArcadeHub={onExitToArcadeHub}
              />
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="متأكد إنك عايز تخرج من اللعبة؟"
        message="الجولة لسه شغالة، لو خرجت دلوقتي النتيجة مش هتتحسب."
        cancelLabel="كمل لعب"
        confirmLabel="نعم، اخرج"
        onConfirm={() => {
          disposePhysics();
          setShowExitConfirm(false);
          onExitToArcadeHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
