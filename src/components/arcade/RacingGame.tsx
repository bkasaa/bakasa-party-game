import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Car, Flame, Snowflake, Star } from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
import { useArcadeTouchLock } from '../../hooks/useArcadeTouchLock';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import {
  ARCADE_COLORS,
  ArcadeDelta,
  ArcadePlayer,
  CornerSlot,
  getCornerPlacements,
} from '../../types/arcade';
import { recordArcadeWin } from '../../utils/sessionStats';
import { soundManager, triggerHaptic } from '../../utils/soundManager';
import { ConfirmModal } from '../ConfirmModal';
import { HomeLogoBadge } from '../HomeLogoBadge';
import { ArcadeFloatingHud } from './ArcadeFloatingHud';
import { ArcadeLeaderboardScreen } from './ArcadeLeaderboardScreen';
import { ArcadePreGameSetup } from './ArcadePreGameSetup';
import { ArcadeSeriesOverlay } from './ArcadeSeriesOverlay';
import { ArcadeWinnerSpotlight } from './ArcadeWinnerSpotlight';

interface RacingGameProps {
  players: ArcadePlayer[];
  onApplyDeltas: (deltas: ArcadeDelta[]) => void;
  onExitToArcadeHub: () => void;
}

type MatchPhase =
  | 'SETUP'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'INTER_ROUND'
  | 'WINNER_SPOTLIGHT'
  | 'LEADERBOARD';
type PickupKind = 'star' | 'turbo' | 'freeze';

interface TrackSpectator {
  x: number;
  y: number;
  color: string;
  seed: number;
}

interface Vec2 {
  x: number;
  y: number;
}

interface CarEntity {
  playerIdx: number;
  name: string;
  hex: string;
  darkHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  lap: number;
  checkpointIdx: number; // 0..7 sequential checkpoints around loop
  bonusPoints: number;
  turboUntil: number;
  frozenUntil: number;
  finishedLapOrder: number | null;
}

interface JoyInput {
  dx: number;
  dy: number;
  mag: number;
}

interface JoyVisual {
  kx: number;
  ky: number;
  active: boolean;
}

interface TreeObstacle {
  x: number;
  y: number;
  r: number;
}

interface TrackPickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  seed: number;
}

interface ExhaustParticle {
  x: number;
  y: number;
  color: string;
  life: number;
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const DEFAULT_TARGET_LAPS = 3;
const ROUND_SAFETY_SECONDS = 48;
const BASE_CAR_SPEED = 172;
const JOY_MAX_R = 40;
const NUM_CHECKPOINTS = 8;

const SLOT_CORNER_POS: Record<CornerSlot, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
};

// 3 Progressive Circuits (normalized inside [0.19..0.81] so corner steering wheels never cover road)
const CIRCUIT_DEFS: Array<{ name: string; anchors: Vec2[]; roadScale: number }> = [
  {
    name: 'حلبة البداية السريعة',
    roadScale: 0.145,
    anchors: [
      { x: 0.5, y: 0.21 },
      { x: 0.72, y: 0.23 },
      { x: 0.78, y: 0.5 },
      { x: 0.72, y: 0.78 },
      { x: 0.5, y: 0.8 },
      { x: 0.28, y: 0.78 },
      { x: 0.22, y: 0.5 },
      { x: 0.28, y: 0.23 },
    ],
  },
  {
    name: 'منحنيات الثعبان S',
    roadScale: 0.132,
    anchors: [
      { x: 0.48, y: 0.2 },
      { x: 0.75, y: 0.23 },
      { x: 0.78, y: 0.42 },
      { x: 0.56, y: 0.52 },
      { x: 0.76, y: 0.67 },
      { x: 0.66, y: 0.81 },
      { x: 0.34, y: 0.79 },
      { x: 0.22, y: 0.59 },
      { x: 0.38, y: 0.44 },
      { x: 0.24, y: 0.26 },
    ],
  },
  {
    name: 'حلبة الأبطال الضيقة',
    roadScale: 0.122,
    anchors: [
      { x: 0.48, y: 0.19 },
      { x: 0.68, y: 0.21 },
      { x: 0.72, y: 0.35 },
      { x: 0.58, y: 0.39 },
      { x: 0.78, y: 0.48 },
      { x: 0.74, y: 0.65 },
      { x: 0.56, y: 0.63 },
      { x: 0.6, y: 0.79 },
      { x: 0.38, y: 0.81 },
      { x: 0.24, y: 0.67 },
      { x: 0.36, y: 0.55 },
      { x: 0.22, y: 0.38 },
      { x: 0.31, y: 0.21 },
    ],
  },
];

function catmullRomLoop(anchors: Vec2[], w: number, h: number, samplesPerSeg = 14): Vec2[] {
  const pts = anchors.map((a) => ({ x: a.x * w, y: a.y * h }));
  const n = pts.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.push({ x, y });
    }
  }
  return out;
}

function closestTrackPoint(x: number, y: number, loop: Vec2[]): { idx: number; dist: number } {
  let bestIdx = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const dx = x - loop[i].x;
    const dy = y - loop[i].y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestIdx = i;
    }
  }
  return { idx: bestIdx, dist: Math.sqrt(bestD2) };
}

function drawTopDownCar(
  ctx: CanvasRenderingContext2D,
  car: CarEntity,
  now: number
) {
  const isTurbo = car.turboUntil > now;
  const isFrozen = car.frozenUntil > now;

  ctx.save();
  ctx.translate(car.x, car.y);

  ctx.save();
  ctx.rotate(car.angle);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.roundRect(-14, -7, 29, 17, 5);
  ctx.fill();

  // 4 black tires
  ctx.fillStyle = '#111827';
  const wheelCoords = [
    { x: -11, y: -11.5 },
    { x: -11, y: 7 },
    { x: 6, y: -11 },
    { x: 6, y: 6.5 },
  ];
  for (const wc of wheelCoords) {
    ctx.beginPath();
    ctx.roundRect(wc.x, wc.y, 8, 4.5, 1.8);
    ctx.fill();
  }

  // Front nose & main formula chassis
  ctx.fillStyle = isFrozen ? '#bae6fd' : car.hex;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-14, -8, 28, 16, 6);
  ctx.fill();
  ctx.stroke();

  // Rear spoiler
  ctx.fillStyle = car.darkHex;
  ctx.beginPath();
  ctx.roundRect(-16, -9.5, 5, 19, 2);
  ctx.fill();
  ctx.stroke();

  // White racing stripe + cockpit visor
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(0, -2.5, 11, 5, 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(-2, 0, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Turbo glow nose ring
  if (isTurbo && !isFrozen) {
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 19, -0.7, 0.7);
    ctx.stroke();
  }

  ctx.restore();

  // Ice block overlay when frozen
  if (isFrozen) {
    ctx.fillStyle = 'rgba(125, 211, 252, 0.58)';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-19, -19, 38, 38, 8);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export const RacingGame: React.FC<RacingGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
}) => {
  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [targetLaps, setTargetLaps] = useState<number>(DEFAULT_TARGET_LAPS);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [seriesScores, setSeriesScores] = useState<Record<string, number>>({});
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState<number>(ROUND_SAFETY_SECONDS);
  const [carLaps, setCarLaps] = useState<number[]>(() => players.map(() => 1));
  const [joyVisuals, setJoyVisuals] = useState<JoyVisual[]>(() =>
    players.map(() => ({ kx: 0, ky: 0, active: false }))
  );
  const [activeStates, setActiveStates] = useState<
    Array<{ turbo: boolean; frozen: boolean }>
  >(() => players.map(() => ({ turbo: false, frozen: false })));
  const [roundDeltas, setRoundDeltas] = useState<ArcadeDelta[]>([]);
  const [finalSeriesDeltas, setFinalSeriesDeltas] = useState<ArcadeDelta[]>([]);
  const [seriesWinners, setSeriesWinners] = useState<ArcadePlayer[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());
  const [shaking, setShaking] = useState<boolean>(false);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackBufferRef = useRef<HTMLCanvasElement | null>(null);
  const arenaSizeRef = useRef<{ w: number; h: number }>({ w: 390, h: 760 });
  const trackLoopRef = useRef<Vec2[]>([]);
  const roadWidthRef = useRef<number>(64);
  const treesRef = useRef<TreeObstacle[]>([]);
  const carsRef = useRef<CarEntity[]>([]);
  const spectatorsRef = useRef<TrackSpectator[]>([]);
  const crowdCheerUntilRef = useRef<number>(0);
  const lastLeaderIdxRef = useRef<number>(-1);
  const pickupsRef = useRef<TrackPickup[]>([]);
  const exhaustRef = useRef<ExhaustParticle[]>([]);
  const popupsRef = useRef<FloatingPopup[]>([]);
  const joyInputsRef = useRef<JoyInput[]>(players.map(() => ({ dx: 0, dy: 0, mag: 0 })));
  const wheelPointersRef = useRef<Map<number, { playerIdx: number; cx: number; cy: number }>>(
    new Map()
  );
  const lastJoyHapticRef = useRef<Array<{ sector: number; time: number }>>(
    players.map(() => ({ sector: -1, time: 0 }))
  );
  const nextPickupIdRef = useRef<number>(1);
  const nextSpawnAtRef = useRef<number>(0);
  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(ROUND_SAFETY_SECONDS);
  const finishedRef = useRef<boolean>(false);

  const placements = getCornerPlacements(players.length);
  const isRoundActive = phase === 'COUNTDOWN' || phase === 'PLAYING';
  const circuitIdx = Math.min(CIRCUIT_DEFS.length - 1, currentRound - 1);
  const goHome = useGoHome();
  const circuitDef = CIRCUIT_DEFS[circuitIdx];

  useNavigationGuard(isRoundActive, () => setShowExitConfirm(true));
  useArcadeTouchLock(isRoundActive, arenaRef);

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  useEffect(() => {
    if (phase === 'PLAYING') {
      soundManager.startMusic('arcade');
    } else {
      soundManager.stopMusic();
    }
    return () => soundManager.stopMusic();
  }, [phase]);

  const syncArenaSize = useCallback(() => {
    const el = arenaRef.current;
    if (!el) return;
    arenaSizeRef.current = {
      w: Math.max(300, Math.round(el.clientWidth)),
      h: Math.max(420, Math.round(el.clientHeight)),
    };
  }, []);

  const buildTrackBuffer = useCallback(
    (w: number, h: number, loop: Vec2[], roadW: number) => {
      const buf = document.createElement('canvas');
      buf.width = w;
      buf.height = h;
      const ctx = buf.getContext('2d');
      if (!ctx || loop.length < 4) return buf;

      // Lush green grass backdrop
      ctx.fillStyle = '#28b94d';
      ctx.fillRect(0, 0, w, h);

      // Decorative grass patches
      ctx.fillStyle = 'rgba(22, 163, 74, 0.45)';
      for (let i = 0; i < 14; i++) {
        const px = ((i * 97) % (w - 60)) + 30;
        const py = ((i * 151) % (h - 60)) + 30;
        ctx.beginPath();
        ctx.arc(px, py, 16 + (i % 3) * 8, 0, Math.PI * 2);
        ctx.fill();
      }

      const traceLoop = () => {
        ctx.beginPath();
        ctx.moveTo(loop[0].x, loop[0].y);
        for (let i = 1; i < loop.length; i++) {
          ctx.lineTo(loop[i].x, loop[i].y);
        }
        ctx.closePath();
      };

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // 1. Dark curb outline
      traceLoop();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = roadW + 14;
      ctx.stroke();

      // 2. White curb base
      traceLoop();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = roadW + 9;
      ctx.stroke();

      // 3. Red alternating curb dashes
      ctx.save();
      ctx.setLineDash([12, 12]);
      traceLoop();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = roadW + 9;
      ctx.stroke();
      ctx.restore();

      // 4. Asphalt surface
      traceLoop();
      ctx.strokeStyle = '#9bb0be';
      ctx.lineWidth = roadW;
      ctx.stroke();

      // Subtle inner asphalt texture line
      ctx.save();
      ctx.setLineDash([14, 18]);
      traceLoop();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // Checkered Finish Line across loop[0]
      const p0 = loop[0];
      const p1 = loop[1];
      const dirAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      ctx.save();
      ctx.translate(p0.x, p0.y);
      ctx.rotate(dirAngle);
      const squares = 6;
      const sqSize = roadW / squares;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < squares; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#0f172a';
          ctx.fillRect(-sqSize + row * sqSize, -roadW / 2 + col * sqSize, sqSize, sqSize);
        }
      }
      ctx.restore();

      // Decorative trees along safe center/margins away from road (stored for smooth sliding collisions)
      const treeCandidates = [
        { x: w * 0.5, y: h * 0.5 },
        { x: w * 0.5, y: h * 0.1 },
        { x: w * 0.5, y: h * 0.9 },
        { x: w * 0.08, y: h * 0.5 },
        { x: w * 0.92, y: h * 0.5 },
      ];
      const placedTrees: TreeObstacle[] = [];
      for (const tc of treeCandidates) {
        if (closestTrackPoint(tc.x, tc.y, loop).dist > roadW * 0.95) {
          placedTrees.push({ x: tc.x, y: tc.y, r: 14 });
          ctx.fillStyle = '#15803d';
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(tc.x, tc.y, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      treesRef.current = placedTrees;

      return buf;
    },
    []
  );

  const resetMatchState = useCallback(() => {
    syncArenaSize();
    const { w, h } = arenaSizeRef.current;
    const def = CIRCUIT_DEFS[Math.min(CIRCUIT_DEFS.length - 1, currentRound - 1)];
    const roadW = Math.max(54, Math.min(76, Math.min(w, h) * def.roadScale));
    roadWidthRef.current = roadW;

    const loop = catmullRomLoop(def.anchors, w, h, 15);
    trackLoopRef.current = loop;
    trackBufferRef.current = buildTrackBuffer(w, h, loop, roadW);

    const startPt = loop[0];
    const nextPt = loop[2];
    const startAngle = Math.atan2(nextPt.y - startPt.y, nextPt.x - startPt.x);
    const perpX = -Math.sin(startAngle);
    const perpY = Math.cos(startAngle);
    const forwardX = Math.cos(startAngle);
    const forwardY = Math.sin(startAngle);

    carsRef.current = players.map((p, idx) => {
      const theme = ARCADE_COLORS[p.colorId];
      const lat = (idx % 2 === 0 ? -1 : 1) * (roadW * 0.22);
      const back = Math.floor(idx / 2) * 26 + 16;
      return {
        playerIdx: idx,
        name: p.name,
        hex: theme.hex,
        darkHex: theme.darkHex,
        x: startPt.x + perpX * lat - forwardX * back,
        y: startPt.y + perpY * lat - forwardY * back,
        vx: 0,
        vy: 0,
        angle: startAngle,
        lap: 1,
        checkpointIdx: 0,
        bonusPoints: 0,
        turboUntil: 0,
        frozenUntil: 0,
        finishedLapOrder: null,
      };
    });

    // Spawn 2 initial pickups ahead on the track
    pickupsRef.current = [];
    const kinds: PickupKind[] = ['star', 'turbo', 'freeze'];
    for (let i = 0; i < 2; i++) {
      const wp = loop[Math.floor(((i + 1) / 3) * loop.length)];
      pickupsRef.current.push({
        id: nextPickupIdRef.current++,
        kind: kinds[i % kinds.length],
        x: wp.x,
        y: wp.y,
        seed: i * 1.7,
      });
    }

    // Pre-compute trackside spectator stands safely away from road & corner joysticks
    const specColors = ['#ef4444', '#38bdf8', '#facc15', '#10b981', '#ffffff', '#f97316'];
    const spectatorCandidates = [
      { x: w * 0.42, y: 38 },
      { x: w * 0.5, y: 38 },
      { x: w * 0.58, y: 38 },
      { x: w * 0.42, y: h - 38 },
      { x: w * 0.5, y: h - 38 },
      { x: w * 0.58, y: h - 38 },
      { x: 24, y: h * 0.43 },
      { x: 24, y: h * 0.5 },
      { x: 24, y: h * 0.57 },
      { x: w - 24, y: h * 0.43 },
      { x: w - 24, y: h * 0.5 },
      { x: w - 24, y: h * 0.57 },
    ];
    spectatorsRef.current = spectatorCandidates
      .filter((pt) => closestTrackPoint(pt.x, pt.y, loop).dist > roadW * 0.72)
      .map((pt, i) => ({
        x: pt.x,
        y: pt.y,
        color: specColors[i % specColors.length],
        seed: i * 1.15,
      }));
    crowdCheerUntilRef.current = 0;
    lastLeaderIdxRef.current = -1;

    exhaustRef.current = [];
    popupsRef.current = [];
    joyInputsRef.current = players.map(() => ({ dx: 0, dy: 0, mag: 0 }));
    wheelPointersRef.current.clear();
    finishedRef.current = false;
    setJoyVisuals(players.map(() => ({ kx: 0, ky: 0, active: false })));
    setCarLaps(players.map(() => 1));
    setActiveStates(players.map(() => ({ turbo: false, frozen: false })));
  }, [buildTrackBuffer, currentRound, players, syncArenaSize]);

  const finishRound = useCallback(
    (explicitWinnerIdx?: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const winnerIds = new Set<string>();
      let roundHeadline = `انتهت الجولة ${currentRound}!`;

      if (typeof explicitWinnerIdx === 'number') {
        const wPlayer = players[explicitWinnerIdx];
        if (wPlayer) {
          winnerIds.add(wPlayer.id);
          roundHeadline = `أول الواصلين: ${wPlayer.name}! 🏁`;
        }
      } else {
        const progressScores = carsRef.current.map(
          (c) => c.lap * 1000 + c.checkpointIdx * 100 + c.bonusPoints
        );
        const best = Math.max(...progressScores, 0);
        const winners = players.filter((_, i) => progressScores[i] === best && best > 0);
        winners.forEach((w) => winnerIds.add(w.id));
        if (winners.length > 1) {
          roundHeadline = `تعادل مثير: ${winners.map((w) => w.name).join(' و ')}`;
        } else if (winners.length === 1) {
          roundHeadline = `متصدر السباق: ${winners[0].name}! 🏁`;
        }
      }

      winnerIds.forEach((id) => recordArcadeWin(id));

      const deltas: ArcadeDelta[] = players.map((p) => ({
        playerId: p.id,
        delta: winnerIds.has(p.id) ? 100 : 0,
      }));
      setRoundDeltas(deltas);
      onApplyDeltas(deltas);

      const nextSeriesScores: Record<string, number> = { ...seriesScores };
      deltas.forEach((d) => {
        nextSeriesScores[d.playerId] = (nextSeriesScores[d.playerId] ?? 0) + d.delta;
      });
      setSeriesScores(nextSeriesScores);

      if (currentRound < totalRounds) {
        soundManager.play('victory');
        setSummaryText(roundHeadline);
        setPhase('INTER_ROUND');
      } else {
        const topSeries = Math.max(...players.map((p) => nextSeriesScores[p.id] ?? 0), 0);
        const champs = players.filter((p) => (nextSeriesScores[p.id] ?? 0) === topSeries && topSeries > 0);
        const seriesHeadline =
          champs.length > 1
            ? `أبطال السباق (${totalRounds} جولات): ${champs.map((c) => c.name).join(' و ')}`
            : champs.length === 1
              ? `بطل السباق (${totalRounds} جولات): ${champs[0].name}! 🏆`
              : `انتهى تحدي السباق (${totalRounds} جولات)!`;
        setSummaryText(seriesHeadline);
        setSeriesWinners(champs);
        setFinalSeriesDeltas(
          players.map((p) => ({ playerId: p.id, delta: nextSeriesScores[p.id] ?? 0 }))
        );
        setPhase('WINNER_SPOTLIGHT');
      }
    },
    [currentRound, onApplyDeltas, players, seriesScores, totalRounds]
  );

  const drawScene = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const buf = trackBufferRef.current;
    if (!canvas || !buf) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = arenaSizeRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Pre-rendered track layer
    ctx.drawImage(buf, 0, 0, w, h);

    // Animated trackside cheering spectators
    const crowdCheering = now < crowdCheerUntilRef.current;
    for (const sp of spectatorsRef.current) {
      const bounce = crowdCheering
        ? Math.abs(Math.sin(now * 0.022 + sp.seed)) * 6.5
        : Math.sin(now * 0.0045 + sp.seed) * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y + 3, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = sp.color;
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y - bounce, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Exhaust flames / speed particles
    for (const ex of exhaustRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ex.life * 0.75);
      ctx.fillStyle = ex.color;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, 5.5 * ex.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Track pickups (Star, Turbo, Ice Freeze)
    for (const pk of pickupsRef.current) {
      const pulse = 1 + Math.sin(now * 0.007 + pk.seed) * 0.1;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(pulse, pulse);

      ctx.fillStyle =
        pk.kind === 'star'
          ? 'rgba(250, 204, 21, 0.35)'
          : pk.kind === 'turbo'
            ? 'rgba(249, 115, 22, 0.38)'
            : 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle =
        pk.kind === 'star' ? '#facc15' : pk.kind === 'turbo' ? '#fb923c' : '#38bdf8';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.font = '900 13px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pk.kind === 'star' ? '★' : pk.kind === 'turbo' ? '⚡' : '❄', 0, 1);

      ctx.restore();
    }

    // Cars
    for (const car of carsRef.current) {
      drawTopDownCar(ctx, car, now);
    }

    // Popups
    for (const pop of popupsRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pop.life);
      ctx.font = '900 16px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    ctx.restore();
  }, []);

  useEffect(() => {
    if (!isRoundActive) {
      wheelPointersRef.current.clear();
      return;
    }
    const handleResize = () => {
      const prev = arenaSizeRef.current;
      syncArenaSize();
      const next = arenaSizeRef.current;
      if (phase === 'COUNTDOWN' && (prev.w !== next.w || prev.h !== next.h)) {
        resetMatchState();
        drawScene(performance.now());
      } else {
        for (const car of carsRef.current) {
          car.x = Math.max(16, Math.min(next.w - 16, car.x));
          car.y = Math.max(16, Math.min(next.h - 16, car.y));
        }
      }
    };
    const ro = new ResizeObserver(handleResize);
    if (arenaRef.current) ro.observe(arenaRef.current);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isRoundActive, phase, syncArenaSize, resetMatchState, drawScene]);

  // Countdown sequence
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    resetMatchState();
    drawScene(performance.now());
    setCountdownNum(3);
    setSecondsLeft(ROUND_SAFETY_SECONDS);
    lastTickSecRef.current = ROUND_SAFETY_SECONDS;
    soundManager.play('tick');

    const t1 = window.setTimeout(() => {
      setCountdownNum(2);
      soundManager.play('tick');
    }, 600);
    const t2 = window.setTimeout(() => {
      setCountdownNum(1);
      soundManager.play('tick');
    }, 1200);
    const t3 = window.setTimeout(() => {
      soundManager.play('next');
      const now = performance.now();
      roundStartRef.current = now;
      lastFrameRef.current = now;
      nextSpawnAtRef.current = now + 3200;
      setPhase('PLAYING');
    }, 1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase, resetMatchState, drawScene]);

  // Auto-advance after 3s floating inter-round banner
  useEffect(() => {
    if (phase !== 'INTER_ROUND') return;
    const t = window.setTimeout(() => {
      setCurrentRound((prev) => prev + 1);
      setPhase('COUNTDOWN');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Main 60fps loop
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    let rafId = 0;
    let shakeTimerId: number | null = null;
    let lastUiSync = 0;

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      const elapsedSec = (now - roundStartRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(ROUND_SAFETY_SECONDS - elapsedSec));
      if (remaining !== lastTickSecRef.current) {
        lastTickSecRef.current = remaining;
        setSecondsLeft(remaining);
        if (remaining > 0 && remaining <= 5) {
          soundManager.play('tickUrgent');
        }
      }

      if (elapsedSec >= ROUND_SAFETY_SECONDS) {
        drawScene(now);
        finishRound();
        return;
      }

      const { w, h } = arenaSizeRef.current;
      const loop = trackLoopRef.current;
      const roadW = roadWidthRef.current;

      // Spawn random pickups along track loop
      if (now >= nextSpawnAtRef.current && pickupsRef.current.length < 3 && loop.length > 10) {
        nextSpawnAtRef.current = now + 3800 + Math.random() * 1800;
        const kinds: PickupKind[] = ['star', 'turbo', 'freeze'];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const wpIdx = Math.floor(Math.random() * loop.length);
        const wp = loop[wpIdx];
        pickupsRef.current.push({
          id: nextPickupIdRef.current++,
          kind,
          x: wp.x + (Math.random() - 0.5) * (roadW * 0.45),
          y: wp.y + (Math.random() - 0.5) * (roadW * 0.45),
          seed: Math.random() * 6,
        });
      }

      let uiDirty = false;

      for (let i = 0; i < carsRef.current.length; i++) {
        const car = carsRef.current[i];
        if (car.frozenUntil > now) {
          car.vx = 0;
          car.vy = 0;
          continue;
        }

        const joy = joyInputsRef.current[i] ?? { dx: 0, dy: 0, mag: 0 };
        const trackInfo = closestTrackPoint(car.x, car.y, loop);
        const onGrass = trackInfo.dist > roadW * 0.58;
        const isTurbo = car.turboUntil > now;
        const maxSpeed =
          BASE_CAR_SPEED * (isTurbo ? 1.58 : 1) * (onGrass && !isTurbo ? 0.72 : 1);

        if (joy.mag > 0.01) {
          // 360-degree Brawl-Stars-style direct arcade steering with instant crisp rotation
          const targetAngle = Math.atan2(joy.dy, joy.dx);
          const angleDiff = Math.atan2(
            Math.sin(targetAngle - car.angle),
            Math.cos(targetAngle - car.angle)
          );
          car.angle += angleDiff * (1 - Math.exp(-26 * dt));

          const throttle = Math.min(1, 0.32 + joy.mag * 0.68);
          const targetVx = joy.dx * maxSpeed * throttle;
          const targetVy = joy.dy * maxSpeed * throttle;
          const accelLerp = 1 - Math.exp(-20 * dt);
          car.vx += (targetVx - car.vx) * accelLerp;
          car.vy += (targetVy - car.vy) * accelLerp;
        } else {
          // Clean, immediate braking on joystick release (zero ice drift)
          const brake = Math.exp(-18 * dt);
          car.vx *= brake;
          car.vy *= brake;
          if (Math.hypot(car.vx, car.vy) < 4) {
            car.vx = 0;
            car.vy = 0;
          }
        }

        car.x += car.vx * dt;
        car.y += car.vy * dt;

        // Forgiving wall boundaries: slide smoothly along screen edges without sticking
        const margin = 20;
        if (car.x < margin) {
          car.x = margin;
          if (car.vx < 0) car.vx = 0;
        } else if (car.x > w - margin) {
          car.x = w - margin;
          if (car.vx > 0) car.vx = 0;
        }
        if (car.y < margin) {
          car.y = margin;
          if (car.vy < 0) car.vy = 0;
        } else if (car.y > h - margin) {
          car.y = h - margin;
          if (car.vy > 0) car.vy = 0;
        }

        // Forgiving tangent sliding around tree obstacles
        for (const tree of treesRef.current) {
          const dx = car.x - tree.x;
          const dy = car.y - tree.y;
          const dist = Math.hypot(dx, dy);
          const minDist = tree.r + 12;
          if (dist > 0.001 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            car.x = tree.x + nx * minDist;
            car.y = tree.y + ny * minDist;
            const vn = car.vx * nx + car.vy * ny;
            if (vn < 0) {
              car.vx -= vn * nx;
              car.vy -= vn * ny;
            }
          }
        }

        // Flame exhaust trail when boosting (capped at <= 60)
        if (isTurbo && Math.hypot(car.vx, car.vy) > 20 && Math.random() < 0.75) {
          if (exhaustRef.current.length >= 60) {
            exhaustRef.current.shift();
          }
          exhaustRef.current.push({
            x: car.x - Math.cos(car.angle) * 16,
            y: car.y - Math.sin(car.angle) * 16,
            color: Math.random() < 0.5 ? '#fb923c' : '#fde047',
            life: 1,
          });
        }

        // Sequential checkpoint & lap progression (forgiving road tolerance)
        if (loop.length > 0 && trackInfo.dist <= roadW * 0.85) {
          const cp = Math.floor((trackInfo.idx / loop.length) * NUM_CHECKPOINTS);
          if (cp === car.checkpointIdx + 1 || (cp === car.checkpointIdx + 2 && cp < NUM_CHECKPOINTS)) {
            car.checkpointIdx = cp;
          } else if (car.checkpointIdx >= NUM_CHECKPOINTS - 2 && (cp === 0 || cp === 1)) {
            car.checkpointIdx = cp;
            car.lap += 1;
            uiDirty = true;
            crowdCheerUntilRef.current = now + 2000;
            soundManager.play('next');
            popupsRef.current.push({
              x: car.x,
              y: car.y - 20,
              text: car.lap > targetLaps ? '🏁 النهاية!' : `لفة ${car.lap}/${targetLaps}`,
              color: '#ffffff',
              life: 1.2,
            });
            if (car.lap > targetLaps) {
              drawScene(now);
              finishRound(i);
              return;
            }
          }
        }

        // Pickup collisions
        for (let pIdx = pickupsRef.current.length - 1; pIdx >= 0; pIdx--) {
          const pk = pickupsRef.current[pIdx];
          if (Math.hypot(car.x - pk.x, car.y - pk.y) <= 26) {
            pickupsRef.current.splice(pIdx, 1);
            if (pk.kind === 'star') {
              soundManager.play('gold');
              triggerHaptic(25);
              car.bonusPoints += 120;
              car.turboUntil = Math.max(car.turboUntil, now + 1100);
              popupsRef.current.push({
                x: pk.x,
                y: pk.y - 12,
                text: '★ +نقاط',
                color: '#fde047',
                life: 1.1,
              });
            } else if (pk.kind === 'turbo') {
              soundManager.play('powerup');
              triggerHaptic(25);
              car.turboUntil = now + 4000;
              popupsRef.current.push({
                x: pk.x,
                y: pk.y - 12,
                text: '⚡ تيربو!',
                color: '#fb923c',
                life: 1.1,
              });
            } else {
              soundManager.play('freeze');
              triggerHaptic(150);
              setShaking(true);
              if (shakeTimerId !== null) window.clearTimeout(shakeTimerId);
              shakeTimerId = window.setTimeout(() => setShaking(false), 260);
              carsRef.current.forEach((other, oIdx) => {
                if (oIdx !== i) {
                  other.frozenUntil = now + 3000;
                }
              });
              popupsRef.current.push({
                x: pk.x,
                y: pk.y - 12,
                text: '❄️ تجميد!',
                color: '#7dd3fc',
                life: 1.1,
              });
            }
            uiDirty = true;
          }
        }
      }

      // Soft car-to-car bumper collisions
      for (let i = 0; i < carsRef.current.length; i++) {
        for (let j = i + 1; j < carsRef.current.length; j++) {
          const a = carsRef.current[i];
          const b = carsRef.current[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.01 && dist < 24) {
            const push = (24 - dist) * 0.5;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }

      // Cheer spectators when race leader overtakes
      let leadIdx = 0;
      let bestProgress = -1;
      carsRef.current.forEach((c, idx) => {
        const prog = c.lap * 100 + c.checkpointIdx;
        if (prog > bestProgress) {
          bestProgress = prog;
          leadIdx = idx;
        }
      });
      if (lastLeaderIdxRef.current !== -1 && lastLeaderIdxRef.current !== leadIdx) {
        crowdCheerUntilRef.current = now + 1800;
      }
      lastLeaderIdxRef.current = leadIdx;

      exhaustRef.current = exhaustRef.current
        .map((e) => ({ ...e, life: e.life - 3.6 * dt }))
        .filter((e) => e.life > 0);

      popupsRef.current = popupsRef.current
        .map((p) => ({ ...p, y: p.y - 32 * dt, life: p.life - 1.4 * dt }))
        .filter((p) => p.life > 0);

      if (uiDirty || now - lastUiSync > 130) {
        lastUiSync = now;
        setCarLaps(carsRef.current.map((c) => Math.min(targetLaps, c.lap)));
        setActiveStates(
          carsRef.current.map((c) => ({
            turbo: c.turboUntil > now,
            frozen: c.frozenUntil > now,
          }))
        );
      }

      drawScene(now);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (shakeTimerId !== null) window.clearTimeout(shakeTimerId);
    };
  }, [phase, targetLaps, drawScene, finishRound]);

  // Zero-Deadzone 360-Degree Corner Arcade Joystick Multi-Touch Handlers
  const updateJoystick360 = (playerIdx: number, clientX: number, clientY: number, cx: number, cy: number) => {
    const vx = clientX - cx;
    const vy = clientY - cy;
    const dist = Math.hypot(vx, vy);

    if (dist < 0.5) {
      joyInputsRef.current[playerIdx] = { dx: 0, dy: 0, mag: 0 };
      setJoyVisuals((prev) =>
        prev.map((v, i) => (i === playerIdx ? { kx: 0, ky: 0, active: true } : v))
      );
      return;
    }

    const clamped = Math.min(JOY_MAX_R, dist);
    const nx = vx / dist;
    const ny = vy / dist;
    const mag = Math.min(1, dist / JOY_MAX_R);
    const kx = nx * clamped;
    const ky = ny * clamped;

    joyInputsRef.current[playerIdx] = { dx: nx, dy: ny, mag };
    setJoyVisuals((prev) =>
      prev.map((v, i) => (i === playerIdx ? { kx, ky, active: true } : v))
    );

    const ang = Math.atan2(ny, nx);
    const sector = mag > 0.35 ? Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 4) % 4 : -1;
    const prevH = lastJoyHapticRef.current[playerIdx];
    const now = performance.now();
    if (prevH && sector !== -1 && sector !== prevH.sector && now - prevH.time >= 90) {
      if (prevH.sector !== -1) triggerHaptic(15);
      prevH.sector = sector;
      prevH.time = now;
    }
  };

  const handleWheelDown = (e: React.PointerEvent<HTMLDivElement>, playerIdx: number) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }
    soundManager.unlock();
    triggerHaptic(15);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    wheelPointersRef.current.set(e.pointerId, { playerIdx, cx, cy });
    lastJoyHapticRef.current[playerIdx] = { sector: -1, time: performance.now() };
    updateJoystick360(playerIdx, e.clientX, e.clientY, cx, cy);
  };

  const handleWheelMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = wheelPointersRef.current.get(e.pointerId);
    if (!entry) return;
    updateJoystick360(entry.playerIdx, e.clientX, e.clientY, entry.cx, entry.cy);
  };

  const handleWheelUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = wheelPointersRef.current.get(e.pointerId);
    if (!entry) return;
    wheelPointersRef.current.delete(e.pointerId);
    joyInputsRef.current[entry.playerIdx] = { dx: 0, dy: 0, mag: 0 };
    setJoyVisuals((prev) =>
      prev.map((v, i) => (i === entry.playerIdx ? { kx: 0, ky: 0, active: false } : v))
    );
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-[100dvh] flex flex-col select-none overflow-hidden ${
        shaking ? 'animate-screen-shake' : ''
      }`}
    >
      {phase === 'SETUP' && (
        <div className="flex-1 overflow-y-auto">
          <ArcadePreGameSetup
            title="سباق العربيات"
            subtitle="حرك الجويستيك 360° في زاويتك لتحرك عربيتك فوراً في أي اتجاه واجمع التيربو والنجوم لتكسب اللفات!"
            players={players}
            accentBgClass="bg-gradient-to-br from-[#dc2626] to-[#f59e0b]"
            icon={<Car className="w-12 h-12 text-white" />}
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            durationLabel="عدد اللفات في كل سباق:"
            durationOptions={[
              { value: 2, label: '2 لفات' },
              { value: 3, label: '3 لفات' },
              { value: 5, label: '5 لفات' },
            ]}
            defaultDuration={3}
            onStartSeries={(rounds, laps) => {
              setTotalRounds(rounds);
              setTargetLaps(laps);
              setCurrentRound(1);
              setSeriesScores({});
              setPhase('COUNTDOWN');
            }}
            onBack={onExitToArcadeHub}
          />
        </div>
      )}

      {isRoundActive && (
        <ArcadeFloatingHud
          secondsLeft={secondsLeft}
          stageLabel={`سباق ${currentRound}/${totalRounds}`}
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
            style={{ touchAction: 'none' }}
            className="w-full h-full block bg-[#28b94d]"
          />

          {phase === 'COUNTDOWN' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/50 px-6 text-center z-20">
              <div className="text-lg font-black text-amber-300 mb-1 tabular-nums">
                جولة {currentRound} من {totalRounds} · {circuitDef.name}
              </div>
              <div className="text-8xl font-black text-white drop-shadow-[0_6px_0_#111827] tabular-nums">
                {countdownNum}
              </div>
              <div className="mt-3 text-sm sm:text-base font-black text-white/95">
                أول عربية تخلّص {targetLaps} لفات تكسب!
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs font-extrabold text-white/90">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-300" /> نجمة
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-orange-300" /> تيربو
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Snowflake className="w-4 h-4 text-sky-300" /> تجميد المنافسين
                </span>
              </div>
            </div>
          )}

          {/* Fixed 360-Degree Corner Arcade Joysticks */}
          {players.map((player, idx) => {
            const placement = placements[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!placement) return null;

            const joy = joyVisuals[idx] ?? { kx: 0, ky: 0, active: false };
            const lap = carLaps[idx] ?? 1;
            const st = activeStates[idx] ?? { turbo: false, frozen: false };

            return (
              <div
                key={player.id}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleWheelDown(e, idx)}
                onPointerMove={handleWheelMove}
                onPointerUp={handleWheelUp}
                onPointerCancel={handleWheelUp}
                onLostPointerCapture={handleWheelUp}
                className={`absolute ${SLOT_CORNER_POS[placement.slot]} z-20 w-[114px] h-[114px] rounded-full flex items-center justify-center cursor-pointer select-none`}
              >
                {/* Label badge outside joystick */}
                <span
                  className={`pointer-events-none absolute -top-5 px-2 py-0.5 rounded-md bg-black/75 text-[11px] font-black text-white truncate max-w-[108px] tabular-nums ${
                    placement.isTop ? 'rotate-180 -bottom-5 top-auto' : ''
                  }`}
                >
                  {st.frozen ? '❄️ مجمد' : `${player.name} (${lap}/${targetLaps})`}
                </span>

                {/* 360-Degree Virtual Joystick Ring */}
                <div
                  style={{
                    borderColor: st.frozen ? '#bae6fd' : st.turbo ? '#fb923c' : theme.hex,
                  }}
                  className="pointer-events-none relative w-full h-full rounded-full border-[4px] bg-slate-950/60 shadow-[0_5px_0_rgba(0,0,0,0.4)] flex items-center justify-center"
                >
                  {/* Subtle 4-way guide ticks */}
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-2 rounded-full bg-white/40" />
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-2 rounded-full bg-white/40" />
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-1.5 rounded-full bg-white/40" />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2 h-1.5 rounded-full bg-white/40" />

                  {/* Responsive Thumb Knob */}
                  <div
                    style={{
                      transform: `translate(${joy.kx}px, ${joy.ky}px) scale(${joy.active ? 1.12 : 1})`,
                      backgroundColor: st.frozen ? '#bae6fd' : st.turbo ? '#fb923c' : theme.hex,
                    }}
                    className={`relative z-10 w-12 h-12 rounded-full border-[3px] border-white shadow-lg flex items-center justify-center ${
                      joy.active ? 'transition-none' : 'transition-transform duration-150'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-white/45" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {phase === 'INTER_ROUND' && (
        <ArcadeSeriesOverlay
          players={players}
          seriesScores={seriesScores}
          roundDeltas={roundDeltas}
          roundNum={currentRound}
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
          <div className="w-full max-w-xl mx-auto px-4 pb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onExitToArcadeHub}
              className="min-h-[44px] px-3 rounded-2xl bg-white dark:bg-[#1E293B] hover:bg-[#FFF5E8] dark:hover:bg-[#334155] border-2 border-[#E7DEC8] dark:border-[#334155] border-b-4 border-b-[#D5C7B2] dark:border-b-[#090F1E] text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>ألعاب 2D</span>
            </button>
            <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC]">نتيجة السباق</h1>
            <div className="w-20 flex justify-end">
              {goHome && <HomeLogoBadge onClick={goHome} />}
            </div>
          </div>

          <ArcadeLeaderboardScreen
            players={players}
            deltas={finalSeriesDeltas}
            summaryHeadline={summaryText}
            onNewRound={() => {
              setCurrentRound(1);
              setSeriesScores({});
              setPhase('SETUP');
            }}
            onBackToArcadeHub={onExitToArcadeHub}
          />
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="متأكد إنك عايز تخرج من اللعبة؟"
        message="السباق لسه شغال، لو خرجت دلوقتي النتيجة مش هتتحسب."
        cancelLabel="كمل لعب"
        confirmLabel="نعم، اخرج"
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToArcadeHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
