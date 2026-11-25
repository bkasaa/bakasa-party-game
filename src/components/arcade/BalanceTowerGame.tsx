import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowRight,
  Check,
  Play,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
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
import { ActiveTurnBanner } from '../ActiveTurnBanner';
import { ConfirmModal } from '../ConfirmModal';
import { HomeLogoBadge } from '../HomeLogoBadge';
import { LeaderboardScreen } from '../LeaderboardScreen';
import { ArcadeWinnerSpotlight } from './ArcadeWinnerSpotlight';

interface BalanceTowerGameProps {
  players: Player[];
  onApplyDeltas: (deltas: RoundDelta[]) => void;
  onExitToArcadeHub: () => void;
  onTournamentFinish?: (deltas: RoundDelta[]) => void;
}

type BalancePhase = 'SETUP' | 'PLAYING' | 'WINNER_SPOTLIGHT' | 'LEADERBOARD';
type StabilityLevel = 'calm' | 'medium' | 'wild';
type AnimalKind = 'elephant' | 'bear' | 'panda' | 'cat' | 'penguin' | 'frog';

interface AnimalSpec {
  kind: AnimalKind;
  name: string;
  emoji: string;
  w: number;
  h: number;
  baseHalfW: number;
  mass: number;
  roundness: number; // 0 = wide flat base, 1 = roly-poly rolling shape
  topHeavy: number;  // 0 = low center of gravity, 1 = tall narrow tips easily
  color: string;
  accent: string;
}

const ANIMALS: AnimalSpec[] = [
  {
    kind: 'elephant',
    name: 'فيل',
    emoji: '🐘',
    w: 72,
    h: 50,
    baseHalfW: 31,
    mass: 1.65,
    roundness: 0.08,
    topHeavy: 0.12,
    color: '#60A5FA',
    accent: '#1D4ED8',
  },
  {
    kind: 'bear',
    name: 'دبدوب',
    emoji: '🐻',
    w: 58,
    h: 50,
    baseHalfW: 20,
    mass: 1.32,
    roundness: 0.72,
    topHeavy: 0.3,
    color: '#D97706',
    accent: '#92400E',
  },
  {
    kind: 'panda',
    name: 'باندا',
    emoji: '🐼',
    w: 56,
    h: 48,
    baseHalfW: 19,
    mass: 1.22,
    roundness: 0.88,
    topHeavy: 0.34,
    color: '#F8FAFC',
    accent: '#0F172A',
  },
  {
    kind: 'penguin',
    name: 'بطريق',
    emoji: '🐧',
    w: 42,
    h: 54,
    baseHalfW: 14,
    mass: 0.9,
    roundness: 0.25,
    topHeavy: 0.9,
    color: '#334155',
    accent: '#F59E0B',
  },
  {
    kind: 'cat',
    name: 'قطة',
    emoji: '🐱',
    w: 46,
    h: 50,
    baseHalfW: 15,
    mass: 0.84,
    roundness: 0.22,
    topHeavy: 0.8,
    color: '#FB923C',
    accent: '#C2410C',
  },
  {
    kind: 'frog',
    name: 'ضفدع',
    emoji: '🐸',
    w: 54,
    h: 36,
    baseHalfW: 23,
    mass: 0.78,
    roundness: 0.32,
    topHeavy: 0.08,
    color: '#22C55E',
    accent: '#15803D',
  },
];

const STABILITY_CONFIG: Record<
  StabilityLevel,
  { label: string; maxAngle: number; springK: number; torqueScale: number }
> = {
  calm: { label: 'هادي', maxAngle: 0.56, springK: 16.0, torqueScale: 0.0082 },
  medium: { label: 'متوسط', maxAngle: 0.44, springK: 11.8, torqueScale: 0.0112 },
  wild: { label: 'مجنون 🔥', maxAngle: 0.34, springK: 8.8, torqueScale: 0.0148 },
};

const WORLD_W = 460;
const WORLD_H = 740;
const BEAM_Y = 615;
const BEAM_W = 248;
const BEAM_H = 18;
const WATER_Y = 692;
const CRANE_HOVER_Y = 66;
const CRANE_MARGIN_X = 96;

interface StackedBlock {
  id: number;
  supportId: number | null;
  spec: AnimalSpec;
  localX: number; // offset from beam center along beam
  localY: number; // height above beam top (positive up)
  localRot: number;
  rotVel: number;
  vy: number;
  vx: number;
  fallingOff: boolean;
  worldX: number;
  worldY: number;
  rot: number;
  ownerColor: string;
}

interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  color: string;
}

function drawAnimalBody(
  ctx: CanvasRenderingContext2D,
  spec: AnimalSpec,
  x: number,
  y: number,
  rot: number,
  ringColor?: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  const hw = spec.w / 2;
  const hh = spec.h / 2;
  const outline = '#0F172A';

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (spec.kind === 'elephant') {
    // Elephant: wide sturdy legs, rounded domed back, floppy ears, curved trunk
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, hh - 2, hw * 0.88, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears behind head
    ctx.fillStyle = '#93C5FD';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.8;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * (hw * 0.72), -4, 11, 15, side * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Main sculpted silhouette (flat feet + domed back)
    ctx.fillStyle = spec.color;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.76, hh);
    ctx.lineTo(-hw * 0.42, hh);
    ctx.lineTo(-hw * 0.36, hh - 9);
    ctx.lineTo(hw * 0.36, hh - 9);
    ctx.lineTo(hw * 0.42, hh);
    ctx.lineTo(hw * 0.76, hh);
    ctx.quadraticCurveTo(hw * 0.88, 0, hw * 0.52, -hh + 4);
    ctx.quadraticCurveTo(0, -hh - 4, -hw * 0.52, -hh + 4);
    ctx.quadraticCurveTo(-hw * 0.88, 0, -hw * 0.76, hh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Curved trunk
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.moveTo(-5, -2);
    ctx.quadraticCurveTo(-8, 15, 4, 18);
    ctx.quadraticCurveTo(10, 18, 9, 13);
    ctx.quadraticCurveTo(3, 12, 5, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tusks
    ctx.fillStyle = '#FFFBEB';
    ctx.beginPath();
    ctx.moveTo(-12, 3);
    ctx.quadraticCurveTo(-17, 10, -10, 11);
    ctx.moveTo(12, 3);
    ctx.quadraticCurveTo(17, 10, 10, 11);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-11, -7, 4.2, 0, Math.PI * 2);
    ctx.arc(11, -7, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-11, -7, 2.2, 0, Math.PI * 2);
    ctx.arc(11, -7, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.kind === 'bear' || spec.kind === 'panda') {
    // Roly-poly rounded silhouette (tips/rolls visibly!)
    const isPanda = spec.kind === 'panda';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.beginPath();
    ctx.ellipse(0, hh - 2, hw * 0.65, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Round ears
    ctx.fillStyle = isPanda ? '#0F172A' : '#92400E';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.8;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * (hw * 0.56), -hh + 5, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Plump oval body
    ctx.fillStyle = spec.color;
    ctx.beginPath();
    ctx.ellipse(0, 1, hw * 0.88, hh * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isPanda) {
      // Panda dark belly band + eye patches
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.ellipse(-10, -5, 6.5, 5.2, -0.3, 0, Math.PI * 2);
      ctx.ellipse(10, -5, 6.5, 5.2, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 12, hw * 0.68, 7, 0, 0, Math.PI);
      ctx.fill();
    } else {
      // Bear tan belly & muzzle
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.ellipse(0, 10, hw * 0.48, hh * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes & nose
    ctx.fillStyle = isPanda ? '#FFFFFF' : '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-10, -5, 3.6, 0, Math.PI * 2);
    ctx.arc(10, -5, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-10, -5, 1.9, 0, Math.PI * 2);
    ctx.arc(10, -5, 1.9, 0, Math.PI * 2);
    ctx.arc(0, -1, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.kind === 'penguin') {
    // Tall narrow tapered egg silhouette (top-heavy stance)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, hh - 1, hw * 0.72, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Orange feet
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(-7, hh - 2, 6.5, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(7, hh - 2, 6.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Flippers
    ctx.fillStyle = '#1E293B';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * (hw * 0.85), 3, 5.5, 14, side * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Tapered pear body
    ctx.fillStyle = spec.color;
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.bezierCurveTo(hw * 0.82, -hh, hw * 0.92, 6, hw * 0.65, hh - 4);
    ctx.quadraticCurveTo(0, hh, -hw * 0.65, hh - 4);
    ctx.bezierCurveTo(-hw * 0.92, 6, -hw * 0.82, -hh, 0, -hh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // White belly
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, 7, hw * 0.56, hh * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes & orange beak
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-6.5, -11, 3.8, 0, Math.PI * 2);
    ctx.arc(6.5, -11, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-6.5, -11, 2, 0, Math.PI * 2);
    ctx.arc(6.5, -11, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(5, -6);
    ctx.lineTo(0, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (spec.kind === 'cat') {
    // Tall slim cat silhouette with pointed ears & curled tail
    ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, hh - 2, hw * 0.72, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Curled tail
    ctx.strokeStyle = outline;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(hw * 0.5, hh - 8);
    ctx.quadraticCurveTo(hw + 9, hh - 18, hw + 4, 0);
    ctx.stroke();
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Pointy ears + oval upright body
    ctx.fillStyle = spec.color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.55, -hh + 10);
    ctx.lineTo(-hw * 0.42, -hh - 5);
    ctx.lineTo(-4, -hh + 5);
    ctx.quadraticCurveTo(0, -hh + 3, 4, -hh + 5);
    ctx.lineTo(hw * 0.42, -hh - 5);
    ctx.lineTo(hw * 0.55, -hh + 10);
    ctx.quadraticCurveTo(hw * 0.85, 6, hw * 0.62, hh - 2);
    ctx.lineTo(-hw * 0.62, hh - 2);
    ctx.quadraticCurveTo(-hw * 0.85, 6, -hw * 0.55, -hh + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner belly patch
    ctx.fillStyle = '#FFEDD5';
    ctx.beginPath();
    ctx.ellipse(0, 9, hw * 0.42, hh * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes + whiskers
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-7, -8, 3.8, 0, Math.PI * 2);
    ctx.arc(7, -8, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-7, -8, 2, 0, Math.PI * 2);
    ctx.arc(7, -8, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-11, -3);
    ctx.lineTo(-19, -5);
    ctx.moveTo(-11, 0);
    ctx.lineTo(-19, 1);
    ctx.moveTo(11, -3);
    ctx.lineTo(19, -5);
    ctx.moveTo(11, 0);
    ctx.lineTo(19, 1);
    ctx.stroke();
  } else {
    // Frog: wide squat curved amphibian body + big eye domes + tucked hind legs
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, hh - 1, hw * 0.9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = spec.color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.8;

    // Tucked hind legs
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * (hw * 0.72), hh - 7, 9, 7, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Wide low oval torso
    ctx.beginPath();
    ctx.ellipse(0, 3, hw * 0.82, hh * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Lighter throat/belly
    ctx.fillStyle = '#BBF7D0';
    ctx.beginPath();
    ctx.ellipse(0, 6, hw * 0.55, hh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye domes on top
    ctx.fillStyle = spec.color;
    ctx.beginPath();
    ctx.arc(-11, -hh + 4, 7.2, 0, Math.PI * 2);
    ctx.arc(11, -hh + 4, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-11, -hh + 4, 4.4, 0, Math.PI * 2);
    ctx.arc(11, -hh + 4, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-11, -hh + 4, 2.2, 0, Math.PI * 2);
    ctx.arc(11, -hh + 4, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#14532D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 1, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // Player-colored collar/badge dot at bottom chest so ownership stays unmistakable
  if (ringColor) {
    ctx.fillStyle = ringColor;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, hh - 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export const BalanceTowerGame: React.FC<BalanceTowerGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
  onTournamentFinish,
}) => {
  const guard = useTapGuard(350);
  const goHome = useGoHome();
  const arenaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<BalancePhase>('SETUP');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    players.slice(0, Math.min(6, players.length)).map((p) => p.id)
  );
  const [stability, setStability] = useState<StabilityLevel>('medium');
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  // Live HUD state
  const [activePlayerIdx, setActivePlayerIdx] = useState<number>(0);
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [currentAnimal, setCurrentAnimal] = useState<AnimalSpec>(ANIMALS[0]);
  const [stackedCount, setStackedCount] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [roundDeltas, setRoundDeltas] = useState<RoundDelta[]>([]);
  const [winnerPlayers, setWinnerPlayers] = useState<Player[]>([]);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  useArcadeTouchLock(phase === 'PLAYING', arenaRef);
  useNavigationGuard(phase === 'PLAYING', () => setShowExitConfirm(true));

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  const participatingPlayers = useMemo(() => {
    const picked = players.filter((p) => selectedIds.includes(p.id));
    return picked.length >= 2 ? picked : players.slice(0, 2);
  }, [players, selectedIds]);

  const participatingArcadePlayers: ArcadePlayer[] = useMemo(
    () =>
      participatingPlayers.map((p, idx) => ({
        id: p.id,
        name: p.name,
        colorId: TURN_ARCADE_COLOR_ORDER[idx % TURN_ARCADE_COLOR_ORDER.length],
        score: p.score,
      })),
    [participatingPlayers]
  );

  const colorForPlayer = useCallback(
    (playerId: string) => {
      const idx = participatingPlayers.findIndex((p) => p.id === playerId);
      const cid = TURN_ARCADE_COLOR_ORDER[(idx >= 0 ? idx : 0) % TURN_ARCADE_COLOR_ORDER.length];
      return ARCADE_COLORS[cid].hex;
    },
    [participatingPlayers]
  );

  // Mutable simulation state inside requestAnimationFrame
  const simRef = useRef<{
    blocks: StackedBlock[];
    nextBlockId: number;
    boardAngle: number;
    boardAngVel: number;
    craneX: number;
    steerDir: number; // -1..1
    droppingBlock: {
      spec: AnimalSpec;
      x: number;
      y: number;
      vy: number;
      ownerColor: string;
    } | null;
    settlingUntil: number;
    collapseTriggered: boolean;
    turnIdx: number;
    eliminated: Set<string>;
    surviveBonuses: Record<string, number>;
    currentSpec: AnimalSpec;
    particles: SplashParticle[];
    waveTime: number;
    lastJoyHapticSign: number;
    ended: boolean;
  }>({
    blocks: [],
    nextBlockId: 1,
    boardAngle: 0,
    boardAngVel: 0,
    craneX: WORLD_W / 2,
    steerDir: 0,
    droppingBlock: null,
    settlingUntil: 0,
    collapseTriggered: false,
    turnIdx: 0,
    eliminated: new Set(),
    surviveBonuses: {},
    currentSpec: ANIMALS[0],
    particles: [],
    waveTime: 0,
    lastJoyHapticSign: 0,
    ended: false,
  });

  const joyOriginRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const pickRandomAnimal = (): AnimalSpec =>
    ANIMALS[Math.floor(Math.random() * ANIMALS.length)];

  const findNextSurvivorIdx = (fromIdx: number, elim: Set<string>, total: number): number => {
    for (let step = 1; step <= total; step++) {
      const candidate = (fromIdx + step) % total;
      if (!elim.has(participatingPlayers[candidate].id)) return candidate;
    }
    return fromIdx;
  };

  const spawnSplash = (x: number, y: number, color: string) => {
    for (let i = 0; i < 16; i++) {
      const ang = -Math.PI * (0.1 + Math.random() * 0.8);
      const spd = 110 + Math.random() * 190;
      simRef.current.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: 3 + Math.random() * 4,
        life: 0.75 + Math.random() * 0.35,
        color,
      });
    }
  };

  const startGame = guard(() => {
    if (participatingPlayers.length < 2) {
      soundManager.play('error');
      return;
    }
    soundManager.unlock();
    soundManager.play('next');
    triggerHaptic(20);

    const firstAnimal = pickRandomAnimal();
    const bonuses: Record<string, number> = {};
    participatingPlayers.forEach((p) => {
      bonuses[p.id] = 0;
    });

    simRef.current = {
      blocks: [],
      nextBlockId: 1,
      boardAngle: 0,
      boardAngVel: 0,
      craneX: WORLD_W / 2,
      steerDir: 0,
      droppingBlock: null,
      settlingUntil: 0,
      collapseTriggered: false,
      turnIdx: 0,
      eliminated: new Set(),
      surviveBonuses: bonuses,
      currentSpec: firstAnimal,
      particles: [],
      waveTime: 0,
      lastJoyHapticSign: 0,
      ended: false,
    };

    setActivePlayerIdx(0);
    setEliminatedIds([]);
    setCurrentAnimal(firstAnimal);
    setStackedCount(0);
    setIsDropping(false);
    setStatusBanner(null);
    setRoundDeltas([]);
    setWinnerPlayers([]);
    setPhase('PLAYING');
  });

  const handleDropAnimal = useCallback(() => {
    const sim = simRef.current;
    if (phase !== 'PLAYING' || sim.droppingBlock || sim.settlingUntil > 0 || sim.ended) {
      return;
    }
    const activePlayer = participatingPlayers[sim.turnIdx];
    if (!activePlayer) return;

    soundManager.unlock();
    soundManager.play('slash');
    triggerHaptic(18);

    sim.droppingBlock = {
      spec: sim.currentSpec,
      x: sim.craneX,
      y: CRANE_HOVER_Y + 4,
      vy: 75,
      ownerColor: colorForPlayer(activePlayer.id),
    };
    sim.collapseTriggered = false;
    setIsDropping(true);
  }, [colorForPlayer, participatingPlayers, phase]);

  // Main physics + canvas loop
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    let rafId = 0;
    let lastTime = performance.now();
    const cfg = STABILITY_CONFIG[stability];

    const step = (now: number) => {
      const dt = Math.min(0.032, (now - lastTime) / 1000);
      lastTime = now;
      const sim = simRef.current;
      if (sim.ended) return;

      sim.waveTime += dt;

      // 1. Move crane horizontally when aiming
      if (!sim.droppingBlock && sim.settlingUntil === 0) {
        sim.craneX = Math.max(
          CRANE_MARGIN_X,
          Math.min(WORLD_W - CRANE_MARGIN_X, sim.craneX + sim.steerDir * 240 * dt)
        );
      }

      // 2. Compute torque on suspended board from all resting blocks
      let totalTorque = 0;
      sim.blocks.forEach((b) => {
        if (!b.fallingOff) {
          totalTorque += b.localX * b.spec.mass * cfg.torqueScale;
        }
      });

      const sway = Math.sin(sim.waveTime * 1.45) * (stability === 'wild' ? 0.13 : 0.032);
      const angularAccel = totalTorque + sway - cfg.springK * sim.boardAngle - 3.9 * sim.boardAngVel;
      sim.boardAngVel += angularAccel * dt;
      sim.boardAngle += sim.boardAngVel * dt;

      const cosA = Math.cos(sim.boardAngle);
      const sinA = Math.sin(sim.boardAngle);
      const pivotX = WORLD_W / 2;
      const pivotY = BEAM_Y;

      // Helper: convert (localX, localY above beam top) -> world coords
      const toWorld = (lx: number, ly: number) => {
        const up = BEAM_H / 2 + ly;
        return {
          x: pivotX + lx * cosA + up * sinA,
          y: pivotY + lx * sinA - up * cosA,
        };
      };

      // Lookup map for support blocks
      const blockById = new Map<number, StackedBlock>();
      sim.blocks.forEach((b) => blockById.set(b.id, b));

      // 3. Update stacked blocks with shape-aware rolling, tipping & cascading support checks
      const angleTooSteep = Math.abs(sim.boardAngle) > cfg.maxAngle;
      sim.blocks.forEach((b) => {
        if (!b.fallingOff) {
          const support = b.supportId !== null ? blockById.get(b.supportId) : undefined;
          if (b.supportId !== null && (!support || support.fallingOff)) {
            b.fallingOff = true;
            b.vx = Math.sin(sim.boardAngle) * 140 + (Math.random() - 0.5) * 80;
            b.vy = 40;
          } else {
            const supportLocalX = support ? support.localX : 0;
            const supportHalfW = support ? support.spec.baseHalfW : BEAM_W / 2;
            const supportTilt = support ? support.localRot : 0;
            const effectiveSlope = sim.boardAngle + supportTilt * 0.72;
            const offsetFromSupport = b.localX - supportLocalX;
            const normOverhang = offsetFromSupport / Math.max(8, supportHalfW);

            // Round animals roll on smaller slopes; narrow/top-heavy animals tip under overhang
            const slideThreshold = Math.max(0.05, 0.17 - b.spec.roundness * 0.09);
            if (Math.abs(effectiveSlope) > slideThreshold) {
              const rollBoost = 1 + b.spec.roundness * 1.1;
              b.localX += Math.sin(effectiveSlope) * 135 * rollBoost * dt;
            }

            // Tipping torque on local rotation from overhang + shape roundness/top-heaviness
            const tipFactor = 1 + b.spec.topHeavy * 1.25 + b.spec.roundness * 0.6;
            const localTipAccel =
              normOverhang * 4.4 * tipFactor +
              effectiveSlope * 2.2 -
              b.localRot * (8.5 - b.spec.topHeavy * 4.0) -
              b.rotVel * 3.4;
            b.rotVel += localTipAccel * dt;
            b.localRot += b.rotVel * dt;

            // Rounded animals roll sideways as they tilt
            if (b.spec.roundness > 0.45) {
              b.localX += b.localRot * 36 * b.spec.roundness * dt;
            }

            const wp = toWorld(b.localX, b.localY);
            b.worldX = wp.x;
            b.worldY = wp.y;
            b.rot = sim.boardAngle + b.localRot;

            const maxAllowedOverhang = supportHalfW + b.spec.baseHalfW * (0.42 - b.spec.topHeavy * 0.16);
            const maxLocalTilt = 0.66 - b.spec.topHeavy * 0.22;

            if (
              angleTooSteep ||
              Math.abs(b.localX - supportLocalX) > maxAllowedOverhang ||
              Math.abs(b.localRot) > maxLocalTilt
            ) {
              b.fallingOff = true;
              const pushDir =
                Math.abs(b.localX - supportLocalX) > 3
                  ? Math.sign(b.localX - supportLocalX)
                  : Math.sign(effectiveSlope || 1);
              b.vx = Math.sin(sim.boardAngle) * 150 + pushDir * 85;
              b.vy = 35;
            }
          }
        }

        if (b.fallingOff) {
          b.vy += 820 * dt;
          b.worldX += b.vx * dt;
          b.worldY += b.vy * dt;
          b.rot += (b.vx >= 0 ? 3.2 : -3.2) * dt;
        }
      });

      // Helper to compute exact predicted drop landing along vertical laser from dropX
      const computePredictedDrop = (dropX: number, dropSpec: AnimalSpec): {
        hasSupport: boolean;
        landedOnBlock: StackedBlock | null;
        surfaceY: number;
        targetCenterY: number;
      } => {
        const relX = dropX - pivotX;
        const beamSurfaceY = pivotY + relX * sinA - BEAM_H / 2;
        const onBeamWidth = Math.abs(relX) <= BEAM_W / 2 + dropSpec.baseHalfW * 0.45;
        let landedOnBlock: StackedBlock | null = null;
        let surfaceY = beamSurfaceY;

        for (const b of sim.blocks) {
          if (b.fallingOff) continue;
          const horizDist = Math.abs(dropX - b.worldX);
          const overlapW = dropSpec.baseHalfW * 0.65 + b.spec.baseHalfW * 0.92;
          if (horizDist <= overlapW) {
            const topY = b.worldY - b.spec.h * 0.46;
            if (topY < surfaceY) {
              surfaceY = topY;
              landedOnBlock = b;
            }
          }
        }

        return {
          hasSupport: landedOnBlock !== null || onBeamWidth,
          landedOnBlock,
          surfaceY,
          targetCenterY: surfaceY - dropSpec.h * 0.48,
        };
      };

      // 4. Update dropping block
      if (sim.droppingBlock) {
        const drop = sim.droppingBlock;
        drop.vy += 940 * dt;
        drop.y += drop.vy * dt;

        const pred = computePredictedDrop(drop.x, drop.spec);

        if (pred.hasSupport && drop.y >= pred.targetCenterY) {
          const support = pred.landedOnBlock;
          const localX = (drop.x - pivotX) / Math.max(0.4, cosA);
          const localY = support
            ? support.localY + support.spec.h * 0.46 + drop.spec.h * 0.48
            : drop.spec.h * 0.48;

          const overhangOffset = support ? localX - support.localX : localX;
          const tipKick =
            (overhangOffset / (support ? support.spec.baseHalfW : BEAM_W / 2)) *
            (0.8 + drop.spec.topHeavy * 1.1);

          const wp = toWorld(localX, localY);
          sim.blocks.push({
            id: sim.nextBlockId++,
            supportId: support ? support.id : null,
            spec: drop.spec,
            localX,
            localY,
            localRot: tipKick * 0.14,
            rotVel: tipKick * 1.8,
            vy: 0,
            vx: 0,
            fallingOff: false,
            worldX: wp.x,
            worldY: wp.y,
            rot: sim.boardAngle,
            ownerColor: drop.ownerColor,
          });
          // Mass-weighted impact impulse onto seesaw board
          sim.boardAngVel += (localX / BEAM_W) * drop.spec.mass * 0.72;
          sim.droppingBlock = null;
          sim.settlingUntil = now + 1100;
          soundManager.play('bounce');
          triggerHaptic(20);
          setStackedCount(sim.blocks.filter((b) => !b.fallingOff).length);
        } else if (drop.y > WATER_Y) {
          spawnSplash(drop.x, WATER_Y, '#38BDF8');
          sim.droppingBlock = null;
          sim.collapseTriggered = true;
          sim.settlingUntil = now + 650;
          soundManager.play('splash');
          triggerHaptic([60, 40, 80]);
        }
      }

      // Check if any falling-off stacked block hit water
      for (let i = sim.blocks.length - 1; i >= 0; i--) {
        const b = sim.blocks[i];
        if (b.fallingOff && b.worldY >= WATER_Y) {
          spawnSplash(b.worldX, WATER_Y, '#38BDF8');
          sim.blocks.splice(i, 1);
          if (!sim.collapseTriggered) {
            sim.collapseTriggered = true;
            sim.settlingUntil = Math.max(sim.settlingUntil, now + 700);
            soundManager.play('splash');
            soundManager.play('error');
            triggerHaptic([70, 40, 90]);
          }
        }
      }

      // 5. Turn settle completion
      if (sim.settlingUntil > 0 && now >= sim.settlingUntil) {
        sim.settlingUntil = 0;
        setIsDropping(false);

        const activePlayer = participatingPlayers[sim.turnIdx];
        if (sim.collapseTriggered && activePlayer) {
          sim.eliminated.add(activePlayer.id);
          setEliminatedIds(Array.from(sim.eliminated));
          sim.blocks = sim.blocks.filter((b) => !b.fallingOff);
          if (Math.abs(sim.boardAngle) > cfg.maxAngle * 0.72) {
            sim.blocks = [];
            sim.boardAngle = 0;
            sim.boardAngVel = 0;
          }
          setStackedCount(sim.blocks.length);

          const survivors = participatingPlayers.filter((p) => !sim.eliminated.has(p.id));
          if (survivors.length <= 1) {
            sim.ended = true;
            const champ = survivors[0] ?? null;
            const deltas: RoundDelta[] = players.map((p) => {
              const isSelected = participatingPlayers.some((sp) => sp.id === p.id);
              if (!isSelected) return { playerId: p.id, delta: 0 };
              const survivePts = sim.surviveBonuses[p.id] ?? 0;
              const winPts = champ && p.id === champ.id ? 100 : 0;
              return { playerId: p.id, delta: survivePts + winPts };
            });
            setRoundDeltas(deltas);
            setWinnerPlayers(champ ? [champ] : []);
            onApplyDeltas(deltas);
            soundManager.play('victory');
            setPhase('WINNER_SPOTLIGHT');
            return;
          }

          setStatusBanner(`${activePlayer.name} وقع البرج وخرج!`);
          const nextIdx = findNextSurvivorIdx(sim.turnIdx, sim.eliminated, participatingPlayers.length);
          sim.turnIdx = nextIdx;
          setActivePlayerIdx(nextIdx);
        } else if (activePlayer) {
          sim.surviveBonuses[activePlayer.id] = (sim.surviveBonuses[activePlayer.id] ?? 0) + 15;
          soundManager.play('catch');
          setStatusBanner(null);
          const nextIdx = findNextSurvivorIdx(sim.turnIdx, sim.eliminated, participatingPlayers.length);
          sim.turnIdx = nextIdx;
          setActivePlayerIdx(nextIdx);
        }

        const nextSpec = pickRandomAnimal();
        sim.currentSpec = nextSpec;
        setCurrentAnimal(nextSpec);
      }

      // 6. Update particles
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const pt = sim.particles[i];
        pt.vy += 460 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) sim.particles.splice(i, 1);
      }

      // 7. Render vertical portrait canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
        sky.addColorStop(0, '#0284C7');
        sky.addColorStop(0.35, '#38BDF8');
        sky.addColorStop(0.78, '#BAE6FD');
        sky.addColorStop(1, '#E0F2FE');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        // Subtle height altitude ruler ticks for tall vertical tower progress
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = '800 11px Cairo, sans-serif';
        ctx.textAlign = 'left';
        for (let m = 1; m <= 6; m++) {
          const ty = BEAM_Y - m * 85;
          if (ty < 90) break;
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(14, ty);
          ctx.lineTo(54, ty);
          ctx.stroke();
          ctx.fillText(`${m * 2}m`, 14, ty - 4);
        }
        ctx.restore();

        // Soft drifting clouds
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        const cloudDrift = (sim.waveTime * 12) % (WORLD_W + 140);
        [70, 240, 390].forEach((cx, idx) => {
          const x = ((cx + cloudDrift) % (WORLD_W + 120)) - 60;
          const y = 115 + idx * 95;
          ctx.beginPath();
          ctx.arc(x, y, 20, 0, Math.PI * 2);
          ctx.arc(x + 20, y - 7, 24, 0, Math.PI * 2);
          ctx.arc(x + 42, y, 18, 0, Math.PI * 2);
          ctx.fill();
        });

        // Suspension ropes from top frame to beam ends
        const leftEnd = {
          x: pivotX - (BEAM_W / 2 - 14) * cosA,
          y: pivotY - (BEAM_W / 2 - 14) * sinA,
        };
        const rightEnd = {
          x: pivotX + (BEAM_W / 2 - 14) * cosA,
          y: pivotY + (BEAM_W / 2 - 14) * sinA,
        };
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.42)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(pivotX - 115, 0);
        ctx.lineTo(leftEnd.x, leftEnd.y);
        ctx.moveTo(pivotX + 115, 0);
        ctx.lineTo(rightEnd.x, rightEnd.y);
        ctx.stroke();

        // Wooden Balance Beam
        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(sim.boardAngle);
        const woodGrad = ctx.createLinearGradient(0, -BEAM_H / 2, 0, BEAM_H / 2);
        woodGrad.addColorStop(0, '#D97706');
        woodGrad.addColorStop(1, '#92400E');
        ctx.fillStyle = woodGrad;
        ctx.strokeStyle = '#451A03';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-BEAM_W / 2, -BEAM_H / 2, BEAM_W, BEAM_H, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(-3, -BEAM_H / 2 + 2, 6, BEAM_H - 4);
        ctx.restore();

        // Stacked animals
        sim.blocks.forEach((b) => {
          drawAnimalBody(ctx, b.spec, b.worldX, b.worldY, b.rot, b.ownerColor);
        });

        // Crane claw & next animal OR dropping animal
        if (sim.droppingBlock) {
          drawAnimalBody(
            ctx,
            sim.droppingBlock.spec,
            sim.droppingBlock.x,
            sim.droppingBlock.y,
            0,
            sim.droppingBlock.ownerColor
          );
        } else if (sim.settlingUntil === 0) {
          const activePlayer = participatingPlayers[sim.turnIdx];
          const pColor = activePlayer ? colorForPlayer(activePlayer.id) : '#FF6B4A';
          const pred = computePredictedDrop(sim.craneX, sim.currentSpec);
          const laserEndY = pred.hasSupport ? pred.surfaceY : WATER_Y - 6;

          // Crisp Vertical Drop-Guide Laser
          ctx.save();
          const laserColor = pred.hasSupport ? '#0EA5E9' : '#EF4444';
          const laserGrad = ctx.createLinearGradient(sim.craneX, CRANE_HOVER_Y + 24, sim.craneX, laserEndY);
          laserGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
          laserGrad.addColorStop(1, pred.hasSupport ? 'rgba(14, 165, 233, 0.92)' : 'rgba(239, 68, 68, 0.85)');
          ctx.strokeStyle = laserGrad;
          ctx.lineWidth = 2.6;
          ctx.setLineDash([7, 5]);
          ctx.beginPath();
          ctx.moveTo(sim.craneX, CRANE_HOVER_Y + 26);
          ctx.lineTo(sim.craneX, laserEndY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Pulsing target reticle at predicted landing point
          const pulseR = 6 + Math.sin(sim.waveTime * 8) * 1.8;
          ctx.fillStyle = laserColor;
          ctx.beginPath();
          ctx.arc(sim.craneX, laserEndY, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sim.craneX, laserEndY, pulseR + 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Crane cable & hook
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(sim.craneX, 0);
          ctx.lineTo(sim.craneX, CRANE_HOVER_Y - 22);
          ctx.stroke();

          drawAnimalBody(ctx, sim.currentSpec, sim.craneX, CRANE_HOVER_Y, 0, pColor);
        }

        // Shimmering water at bottom
        ctx.fillStyle = 'rgba(14, 165, 233, 0.86)';
        ctx.beginPath();
        ctx.moveTo(0, WORLD_H);
        for (let wx = 0; wx <= WORLD_W; wx += 20) {
          const wy = WATER_Y + Math.sin(wx * 0.04 + sim.waveTime * 3.5) * 4.5;
          ctx.lineTo(wx, wy);
        }
        ctx.lineTo(WORLD_W, WORLD_H);
        ctx.closePath();
        ctx.fill();

        // Splash particles
        sim.particles.forEach((pt) => {
          ctx.globalAlpha = Math.max(0, pt.life);
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [colorForPlayer, onApplyDeltas, participatingPlayers, phase, players, stability]);

  const togglePlayerSelect = (id: string) => {
    soundManager.play('click');
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) {
          soundManager.play('error');
          return prev;
        }
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 6) {
        soundManager.play('error');
        return prev;
      }
      return [...prev, id];
    });
  };

  // Zero-deadzone Floating Joystick handlers
  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    joyOriginRef.current = { x: cx, y: cy, pointerId: e.pointerId };
    triggerHaptic(15);
    updateJoyFromPoint(e.clientX, e.clientY);
  };

  const updateJoyFromPoint = (clientX: number, clientY: number) => {
    const origin = joyOriginRef.current;
    if (!origin) return;
    const maxR = 42;
    const dx = clientX - origin.x;
    const dy = clientY - origin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = dist > maxR ? maxR / dist : 1;
    const kx = dx * clamped;
    const ky = dy * clamped;

    // Instant response with zero deadzone lag
    const steer = Math.max(-1, Math.min(1, kx / maxR));
    simRef.current.steerDir = steer;

    const sign = Math.abs(steer) > 0.2 ? Math.sign(steer) : 0;
    if (sign !== 0 && sign !== simRef.current.lastJoyHapticSign) {
      triggerHaptic(15);
      simRef.current.lastJoyHapticSign = sign;
    } else if (sign === 0) {
      simRef.current.lastJoyHapticSign = 0;
    }

    setJoyKnob({ x: kx, y: ky, active: true });

    // Pull down hard to quick-drop
    if (ky > 34) {
      handleDropAnimal();
    }
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joyOriginRef.current || joyOriginRef.current.pointerId !== e.pointerId) return;
    updateJoyFromPoint(e.clientX, e.clientY);
  };

  const handleJoyUp = () => {
    joyOriginRef.current = null;
    simRef.current.steerDir = 0;
    simRef.current.lastJoyHapticSign = 0;
    setJoyKnob({ x: 0, y: 0, active: false });
  };

  const activeTurnPlayer = participatingPlayers[activePlayerIdx];

  if (phase === 'WINNER_SPOTLIGHT') {
    const spotlightArcadeWinners: ArcadePlayer[] = winnerPlayers.map((w) => {
      const found = participatingArcadePlayers.find((ap) => ap.id === w.id);
      return found ?? { id: w.id, name: w.name, colorId: 'red', score: w.score };
    });
    const seriesMap: Record<string, number> = {};
    roundDeltas.forEach((d) => {
      seriesMap[d.playerId] = d.delta;
    });
    return (
      <ArcadeWinnerSpotlight
        winners={spotlightArcadeWinners}
        seriesScores={seriesMap}
        headline={
          winnerPlayers[0]
            ? `بطل برج التوازن: ${winnerPlayers[0].name}! 🐘`
            : 'انتهت جولة برج التوازن!'
        }
        onContinueToLeaderboard={() => setPhase('LEADERBOARD')}
      />
    );
  }

  if (phase === 'LEADERBOARD') {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="w-full max-w-xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={guard(onExitToArcadeHub)}
            className="min-w-[44px] min-h-[44px] rounded-2xl qada-glass-pill flex items-center justify-center text-[#1E293B] dark:text-[#F8FAFC]"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black text-[#1E293B] dark:text-white">نتائج برج التوازن 🐘</h1>
          <div className="w-11" />
        </header>
        <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4">
          <LeaderboardScreen
            players={players}
            deltas={roundDeltas}
            summaryHeadline={
              winnerPlayers[0]
                ? `ملك التوازن: ${winnerPlayers[0].name} 🏆`
                : 'برج التوازن 🐘'
            }
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
        </main>
      </div>
    );
  }

  return (
    <div
      ref={arenaRef}
      className="min-h-[100dvh] w-full flex flex-col select-none"
    >
      {phase === 'SETUP' ? (
        <>
          <header className="w-full max-w-xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={guard(() => {
                  soundManager.play('click');
                  onExitToArcadeHub();
                })}
                aria-label="رجوع"
                className="min-w-[44px] min-h-[44px] rounded-2xl qada-glass-pill flex items-center justify-center text-[#1E293B] dark:text-[#F8FAFC]"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              {goHome && <HomeLogoBadge onClick={goHome} />}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white">
              برج التوازن 🐘
            </h1>
            <div className="w-11" />
          </header>

          <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 flex flex-col items-center justify-center gap-4">
            <div className="w-full rounded-3xl qada-card p-5 text-center">
              <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-br from-[#0EA5E9] to-[#10B981] border-2 border-white flex items-center justify-center text-4xl shadow-lg animate-float-slow">
                🐘
              </div>
              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white mb-1.5">
                برج توازن الحيوانات (٢–٦ لاعبين)
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                كل لاعب في دوره بيحرك الحيوان بالجويستيك ويسقطه على اللوح المعلق. كل حيوان ليه وزن
                مختلف — اللي يوقع أي حيوان في المية يخرج، وآخر صامد يكسب +١٠٠ نقطة!
              </p>
            </div>

            {/* Select 2-6 Players */}
            <div className="w-full rounded-3xl qada-card p-4 text-right">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs sm:text-sm font-black text-[#1E293B] dark:text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#0EA5E9]" />
                  <span>اختار المشاركين (٢–٦ لاعبين):</span>
                </span>
                <span className="text-xs font-black text-[#059669] dark:text-[#34D399] tabular-nums">
                  {participatingPlayers.length} لاعبين
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {players.map((p) => {
                  const isPicked = selectedIds.includes(p.id);
                  const idx = selectedIds.indexOf(p.id);
                  const cHex =
                    idx >= 0
                      ? ARCADE_COLORS[TURN_ARCADE_COLOR_ORDER[idx % TURN_ARCADE_COLOR_ORDER.length]].hex
                      : '#94A3B8';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlayerSelect(p.id)}
                      className={`min-h-[38px] px-3 rounded-xl text-xs font-black border flex items-center gap-1.5 transition-all ${
                        isPicked
                          ? 'bg-white dark:bg-[#0F172A] border-[#10B981] text-[#1E293B] dark:text-white shadow-sm'
                          : 'bg-[#FFF9F0]/60 dark:bg-[#0F172A]/40 border-[#E7DEC8] dark:border-[#334155] text-[#64748B] opacity-70'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cHex }}
                      />
                      <span>{p.name}</span>
                      {isPicked && <Check className="w-3.5 h-3.5 text-[#10B981]" />}
                    </button>
                  );
                })}
              </div>

              {/* Stability Level */}
              <div className="pt-3 border-t border-[#E7DEC8]/60 dark:border-[#334155]">
                <div className="text-xs font-black text-[#1E293B] dark:text-white mb-2">
                  درجة ثبات المنصة:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['calm', 'medium', 'wild'] as StabilityLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setStability(lvl);
                      }}
                      className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-black transition-all ${
                        stability === lvl
                          ? 'qada-btn-teal text-white'
                          : 'bg-[#FFF9F0]/80 dark:bg-[#0F172A]/80 border border-[#E7DEC8] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {STABILITY_CONFIG[lvl].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={startGame}
              className="w-full max-w-[270px] min-h-[56px] rounded-2xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ابدأ التحدي!</span>
            </button>
          </main>
        </>
      ) : (
        /* PLAYING SCREEN */
        <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto px-3 pt-2 pb-3">
          {/* Pinned Active Turn Banner */}
          {activeTurnPlayer && (
            <ActiveTurnBanner
              label="الدور على:"
              player={activeTurnPlayer}
              swatchHex={colorForPlayer(activeTurnPlayer.id)}
              badgeText={`برج: ${stackedCount} · باقي ${
                participatingPlayers.length - eliminatedIds.length
              }`}
              accent="teal"
              sticky={false}
            />
          )}

          {/* Mini Action Strip */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="min-h-[34px] px-3 rounded-xl qada-glass-pill text-xs font-black text-[#1E293B] dark:text-white"
              >
                خروج
              </button>
              <button
                type="button"
                aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
                onClick={() => soundManager.toggleMute()}
                className="w-9 h-[34px] rounded-xl qada-glass-pill flex items-center justify-center text-[#1E293B] dark:text-white"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="rounded-xl qada-glass-pill px-3 py-1 text-xs font-black text-[#1E293B] dark:text-white flex items-center gap-1.5">
              <span>{currentAnimal.emoji}</span>
              <span>{currentAnimal.name}</span>
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                ({currentAnimal.mass >= 1.3 ? 'تقيل' : currentAnimal.mass >= 1 ? 'متوسط' : 'خفيف'})
              </span>
            </div>
          </div>

          {statusBanner && (
            <div className="mb-2 rounded-xl bg-rose-500/90 text-white text-center py-1 px-3 text-xs font-black animate-pulse">
              💦 {statusBanner}
            </div>
          )}

          {/* Vertical Portrait Physics Canvas */}
          <div className="relative flex-1 min-h-[280px] flex items-center justify-center py-0.5">
            <canvas
              ref={canvasRef}
              width={WORLD_W}
              height={WORLD_H}
              className="h-full max-h-full aspect-[460/740] w-auto max-w-full rounded-3xl overflow-hidden border-2 border-white/75 dark:border-white/25 shadow-xl bg-[#BAE6FD] block touch-none"
            />
          </div>

          {/* Survivors Strip */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 my-2">
            {participatingPlayers.map((p) => {
              const isOut = eliminatedIds.includes(p.id);
              const isActive = activeTurnPlayer?.id === p.id;
              return (
                <span
                  key={p.id}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all ${
                    isOut
                      ? 'bg-rose-500/20 border-rose-400/50 text-rose-500 line-through opacity-55'
                      : isActive
                        ? 'bg-white dark:bg-[#1E293B] border-[#14B8A6] text-[#0F766E] dark:text-[#2DD4BF] scale-105 shadow-sm'
                        : 'qada-glass-pill text-[#475569] dark:text-[#CBD5E1]'
                  }`}
                >
                  {p.name}
                </span>
              );
            })}
          </div>

          {/* Bottom Controls: Responsive Floating Joystick + Big Drop Button */}
          <div className="flex items-center justify-between gap-4 px-2 pb-1">
            {/* Floating Joystick */}
            <div
              onPointerDown={handleJoyDown}
              onPointerMove={handleJoyMove}
              onPointerUp={handleJoyUp}
              onPointerCancel={handleJoyUp}
              className="relative w-28 h-28 rounded-full qada-glass-pill flex items-center justify-center touch-none cursor-grab active:cursor-grabbing shrink-0"
            >
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#0EA5E9]/45 flex items-center justify-between px-1.5 text-[10px] font-black text-[#64748B]">
                <span>◀</span>
                <span>▶</span>
              </div>
              <div
                style={{
                  transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
                }}
                className={`absolute w-12 h-12 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-transform ${
                  joyKnob.active ? 'duration-0 scale-110 bg-[#0EA5E9]' : 'duration-150 bg-[#14B8A6]'
                }`}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>

            <button
              type="button"
              disabled={isDropping}
              onClick={handleDropAnimal}
              className="flex-1 min-h-[74px] rounded-3xl bakasa-btn-green text-white text-xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
            >
              <ArrowDownCircle className="w-7 h-7" />
              <span>{isDropping ? 'بيستقر...' : 'اسقط الحيوان!'}</span>
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="هل أنت متأكد من الخروج؟"
        message="جولة برج التوازن شغالة دلوقتي، لو خرجت النتيجة هتتلغي."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToArcadeHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
