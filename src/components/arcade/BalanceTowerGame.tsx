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

interface AnimalSpec {
  id: AnimalSpeciesId;
  name: string;
  emoji: string;
  parts: ColliderPartRect[];
  density: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  comOffset: { x: number; y: number };
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

function computeComOffset(parts: ColliderPartRect[]): { x: number; y: number } {
  const bodies = parts.map((p) => Matter.Bodies.rectangle(p.x, p.y, p.w, p.h));
  const temp = Matter.Body.create({ parts: bodies });
  return { x: temp.position.x, y: temp.position.y };
}

const RAW_ANIMAL_SPECS: Array<Omit<AnimalSpec, 'comOffset'>> = [
  {
    id: 'lion',
    name: 'أسد',
    emoji: '🦁',
    density: 0.0024,
    primaryColor: '#F59E0B',
    secondaryColor: '#B45309',
    accentColor: '#FDE68A',
    parts: [
      { x: 0, y: -2, w: 66, h: 28 }, // torso
      { x: 26, y: -14, w: 30, h: 30 }, // mane + head
      { x: -22, y: 18, w: 14, h: 16 }, // back leg
      { x: 20, y: 18, w: 14, h: 16 }, // front leg
    ],
  },
  {
    id: 'giraffe',
    name: 'زرافة',
    emoji: '🦒',
    density: 0.0021,
    primaryColor: '#FBBF24',
    secondaryColor: '#92400E',
    accentColor: '#FEF3C7',
    parts: [
      { x: -6, y: 8, w: 50, h: 24 }, // torso
      { x: 14, y: -22, w: 15, h: 48 }, // long neck
      { x: 20, y: -44, w: 24, h: 16 }, // head + snout
      { x: -22, y: 27, w: 12, h: 18 }, // back leg
      { x: 10, y: 27, w: 12, h: 18 }, // front leg
    ],
  },
  {
    id: 'elephant',
    name: 'فيل',
    emoji: '🐘',
    density: 0.0032,
    primaryColor: '#94A3B8',
    secondaryColor: '#64748B',
    accentColor: '#CBD5E1',
    parts: [
      { x: -4, y: -4, w: 74, h: 38 }, // heavy torso + head
      { x: 35, y: 4, w: 14, h: 28 }, // trunk
      { x: -26, y: 22, w: 18, h: 18 }, // back leg
      { x: 16, y: 22, w: 18, h: 18 }, // front leg
    ],
  },
  {
    id: 'bear',
    name: 'دبدوب',
    emoji: '🐻',
    density: 0.0026,
    primaryColor: '#92400E',
    secondaryColor: '#78350F',
    accentColor: '#FDE68A',
    parts: [
      { x: 0, y: 0, w: 58, h: 32 }, // chunky torso
      { x: 22, y: -15, w: 26, h: 24 }, // head
      { x: -18, y: 21, w: 16, h: 14 }, // back paw
      { x: 18, y: 21, w: 16, h: 14 }, // front paw
    ],
  },
  {
    id: 'rhino',
    name: 'وحيد القرن',
    emoji: '🦏',
    density: 0.003,
    primaryColor: '#64748B',
    secondaryColor: '#475569',
    accentColor: '#E2E8F0',
    parts: [
      { x: -4, y: 0, w: 68, h: 30 }, // armored body
      { x: 30, y: -4, w: 22, h: 22 }, // head
      { x: 38, y: -18, w: 10, h: 14 }, // horn
      { x: -24, y: 20, w: 15, h: 14 }, // back leg
      { x: 14, y: 20, w: 15, h: 14 }, // front leg
    ],
  },
  {
    id: 'fox',
    name: 'ثعلب',
    emoji: '🦊',
    density: 0.002,
    primaryColor: '#EA580C',
    secondaryColor: '#9A3412',
    accentColor: '#FFFBEB',
    parts: [
      { x: 0, y: 2, w: 56, h: 22 }, // sleek torso
      { x: -30, y: -4, w: 18, h: 16 }, // bushy tail
      { x: 24, y: -10, w: 22, h: 20 }, // head
      { x: -16, y: 18, w: 11, h: 14 }, // back leg
      { x: 16, y: 18, w: 11, h: 14 }, // front leg
    ],
  },
  {
    id: 'cat',
    name: 'قطة',
    emoji: '🐱',
    density: 0.0019,
    primaryColor: '#FB923C',
    secondaryColor: '#EA580C',
    accentColor: '#FEF3C7',
    parts: [
      { x: 0, y: 4, w: 48, h: 22 }, // body
      { x: 20, y: -10, w: 22, h: 20 }, // head
      { x: -25, y: -8, w: 10, h: 22 }, // upright tail
      { x: -14, y: 19, w: 10, h: 12 }, // back leg
      { x: 14, y: 19, w: 10, h: 12 }, // front leg
    ],
  },
  {
    id: 'eagle',
    name: 'نسر',
    emoji: '🦅',
    density: 0.0021,
    primaryColor: '#78350F',
    secondaryColor: '#451A03',
    accentColor: '#FACC15',
    parts: [
      { x: 0, y: 0, w: 32, h: 32 }, // body
      { x: -26, y: -6, w: 24, h: 14 }, // left wing
      { x: 26, y: -6, w: 24, h: 14 }, // right wing
      { x: 0, y: -18, w: 20, h: 18 }, // white head + beak
    ],
  },
];

const ANIMAL_SPECS: AnimalSpec[] = RAW_ANIMAL_SPECS.map((spec) => ({
  ...spec,
  comOffset: computeComOffset(spec.parts),
}));

function pickRandomAnimal(): AnimalSpec {
  return ANIMAL_SPECS[Math.floor(Math.random() * ANIMAL_SPECS.length)];
}

function createAnimalBody(spec: AnimalSpec, x: number, y: number, angleRad: number): Matter.Body {
  const parts = spec.parts.map((r) =>
    Matter.Bodies.rectangle(r.x, r.y, r.w, r.h, {
      chamfer: { radius: 4 },
      friction: 1.0,
      frictionStatic: 10.0,
      restitution: 0.0,
      slop: 0.01,
      density: spec.density,
    })
  );

  const body = Matter.Body.create({
    parts,
    friction: 1.0,
    frictionStatic: 10.0,
    restitution: 0.0,
    frictionAir: 0.05,
    slop: 0.01,
    sleepThreshold: 30,
  });

  Matter.Body.setPosition(body, { x, y });
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
  blinkSeed = 0
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(-spec.comOffset.x, -spec.comOffset.y);

  // Subtle player tint aura on non-ghost animals
  if (!isGhost) {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
  }

  // Draw compound body parts with rich outlines & dual-tone detailing
  spec.parts.forEach((p, idx) => {
    const rx = p.x - p.w / 2;
    const ry = p.y - p.h / 2;
    drawRoundedRect(ctx, rx, ry, p.w, p.h, 6);
    ctx.fillStyle = idx % 2 === 0 ? spec.primaryColor : spec.secondaryColor;
    ctx.fill();
    ctx.lineWidth = isGhost ? 2 : 2.5;
    ctx.strokeStyle = isGhost ? playerHex : '#1E293B';
    ctx.stroke();

    // Specular highlight strip on upper half + subtle bottom belly shading
    if (!isGhost && idx <= 1) {
      drawRoundedRect(ctx, rx + 3, ry + 2.5, Math.max(4, p.w - 6), Math.max(3, p.h * 0.28), 3);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fill();

      drawRoundedRect(
        ctx,
        rx + 3,
        ry + p.h - Math.max(4, p.h * 0.22) - 2,
        Math.max(4, p.w - 6),
        Math.max(3, p.h * 0.2),
        3
      );
      ctx.fillStyle = 'rgba(15,23,42,0.12)';
      ctx.fill();
    }
  });

  ctx.shadowColor = 'transparent';

  // Deterministic natural blink cycle (~every 3.4 seconds for 130ms)
  const blinkCycle = (now + blinkSeed * 731) % 3400;
  const isBlinking = !isGhost && blinkCycle < 135;

  const drawExpressiveEye = (ex: number, ey: number, radius = 2.6, irisColor = '#0F172A') => {
    if (isBlinking) {
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

  // Characteristic details per animal species
  if (spec.id === 'lion') {
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.arc(26, -14, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = spec.primaryColor;
    ctx.beginPath();
    ctx.arc(27, -14, 11.5, 0, Math.PI * 2);
    ctx.fill();

    drawRosyCheek(29, -9.5);
    drawExpressiveEye(31, -16, 2.4);
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(36, -12, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.id === 'giraffe') {
    ctx.fillStyle = spec.secondaryColor;
    [
      [-14, 4, 4.5],
      [2, 10, 4],
      [14, -14, 3.5],
      [14, -28, 3],
    ].forEach(([sx, sy, sr]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, -52);
    ctx.lineTo(14, -60);
    ctx.moveTo(22, -52);
    ctx.lineTo(24, -60);
    ctx.stroke();
    drawRosyCheek(25, -40);
    drawExpressiveEye(24, -46, 2.3);
  } else if (spec.id === 'elephant') {
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.ellipse(12, -4, 11, 14, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFBEB';
    ctx.beginPath();
    ctx.moveTo(30, 8);
    ctx.quadraticCurveTo(44, 12, 46, 2);
    ctx.quadraticCurveTo(38, 6, 30, 4);
    ctx.fill();

    drawRosyCheek(24, -3);
    drawExpressiveEye(25, -10, 2.5);
  } else if (spec.id === 'bear') {
    ctx.fillStyle = spec.secondaryColor;
    ctx.beginPath();
    ctx.arc(15, -26, 6, 0, Math.PI * 2);
    ctx.arc(29, -26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.ellipse(29, -12, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(32, -13, 2.2, 0, Math.PI * 2);
    ctx.fill();
    drawRosyCheek(23, -12);
    drawExpressiveEye(24, -18, 2.2);
  } else if (spec.id === 'rhino') {
    drawExpressiveEye(31, -7, 2.4);
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.moveTo(34, -13);
    ctx.lineTo(42, -28);
    ctx.lineTo(42, -11);
    ctx.closePath();
    ctx.fill();
  } else if (spec.id === 'fox') {
    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.arc(-36, -6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spec.primaryColor;
    ctx.beginPath();
    ctx.moveTo(17, -19);
    ctx.lineTo(22, -31);
    ctx.lineTo(28, -19);
    ctx.closePath();
    ctx.fill();
    drawRosyCheek(26, -6);
    drawExpressiveEye(28, -11, 2.2);
  } else if (spec.id === 'cat') {
    ctx.fillStyle = spec.primaryColor;
    ctx.beginPath();
    ctx.moveTo(12, -19);
    ctx.lineTo(15, -30);
    ctx.lineTo(21, -19);
    ctx.moveTo(22, -19);
    ctx.lineTo(27, -30);
    ctx.lineTo(30, -19);
    ctx.fill();
    drawRosyCheek(24, -6);
    drawExpressiveEye(24, -11, 2.4, '#10B981');
  } else if (spec.id === 'eagle') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, -18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = spec.accentColor;
    ctx.beginPath();
    ctx.moveTo(8, -19);
    ctx.lineTo(18, -16);
    ctx.lineTo(8, -12);
    ctx.closePath();
    ctx.fill();

    drawExpressiveEye(3, -19, 2.2);
  }

  // Player color badge dot
  if (!isGhost) {
    ctx.fillStyle = playerHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
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
      gravity: { x: 0, y: 1.05, scale: 0.001 },
      enableSleeping: true,
      positionIterations: 12,
      velocityIterations: 10,
    });

    const platform = Matter.Bodies.rectangle(PLATFORM_X, PLATFORM_Y, PLATFORM_W, PLATFORM_H, {
      isStatic: true,
      friction: 1.0,
      frictionStatic: 10.0,
      restitution: 0.0,
      slop: 0.01,
      chamfer: { radius: 8 },
      label: 'platform',
    });

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

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
          body.id
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

    const step = (now: number) => {
      const dt = Math.min(0.032, (now - lastTs) / 1000);
      lastTs = now;
      const engine = engineRef.current;
      if (!engine) return;

      // Smooth 45-degree rotation interpolation during AIMING
      if (turnStageRef.current === 'AIMING') {
        aimAngleRef.current +=
          (aimTargetAngleRef.current - aimAngleRef.current) * Math.min(1, dt * 18);
      }

      // Strong angular damping (equivalent to angularDamping: 0.85) + micro-jitter suppression
      const bodiesPre = Matter.Composite.allBodies(engine.world);
      for (const b of bodiesPre) {
        if (b.isStatic || b.isSleeping) continue;
        const meta = metaMapRef.current.get(b.id);
        const angDamp = Math.pow(0.15, dt * 4.5);
        Matter.Body.setAngularVelocity(b, b.angularVelocity * angDamp);
        if (meta && now - meta.droppedAt > 240) {
          const spd = Math.hypot(b.velocity.x, b.velocity.y);
          if (spd < 0.14 && Math.abs(b.angularVelocity) < 0.025) {
            Matter.Body.setVelocity(b, {
              x: b.velocity.x * 0.45,
              y: b.velocity.y * 0.45,
            });
          }
        }
      }

      // Step Matter.js physics
      Matter.Engine.update(engine, dt * 1000);

      // Smooth rising camera interpolation
      cameraYRef.current += (targetCameraYRef.current - cameraYRef.current) * Math.min(1, dt * 6.5);

      // Check stacked bodies for height & water falls
      let highestY = PLATFORM_Y - PLATFORM_H / 2;
      let maxVel = 0;
      let fellBody: { body: Matter.Body; meta: PlacedBodyMeta } | null = null;
      let stackedCount = 0;

      const bodies = Matter.Composite.allBodies(engine.world);
      for (const b of bodies) {
        if (b.isStatic) continue;
        const meta = metaMapRef.current.get(b.id);
        if (!meta) continue;
        stackedCount++;

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
        }
      }

      highestStackedYRef.current = highestY;
      const meters = Math.max(
        0,
        Math.round(((PLATFORM_Y - PLATFORM_H / 2 - highestY) / 40) * 10) / 10
      );
      setTowerHeightM(meters);
      setPlacedCount(stackedCount);

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

        if (settleTimerRef.current >= 0.4 || settlingElapsedRef.current >= 3.5) {
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

      // Update VFX
      splashesRef.current = splashesRef.current
        .map((s) => ({
          ...s,
          x: s.x + s.vx * dt,
          y: s.y + s.vy * dt,
          vy: s.vy + 460 * dt,
          life: s.life - dt,
        }))
        .filter((s) => s.life > 0);

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

      bannersRef.current = bannersRef.current
        .map((b) => ({ ...b, y: b.y - 26 * dt, life: b.life - dt * 0.9 }))
        .filter((b) => b.life > 0);

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
              · {currentAnimal.emoji} {currentAnimal.name}
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
