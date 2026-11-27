import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Swords } from 'lucide-react';
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

interface KnifeHitGameProps {
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

interface StuckKnife {
  relAngle: number;
  hex: string;
  darkHex: string;
  playerId: string | null; // null = pre-stuck stage obstacle knife
}

interface BonusApple {
  relAngle: number;
  sliced: boolean;
}

interface FlyingKnife {
  playerIdx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hex: string;
  darkHex: string;
}

interface ShatterShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  color: string;
  life: number;
}

interface ImpactFlash {
  x: number;
  y: number;
  life: number;
}

const TARGET_KNIVES = 7;
const DEFAULT_MATCH_SECONDS = 30;
const COLLISION_ARC = 0.24;
const KNIFE_SPEED = 980;

const STAGE_THEMES = [
  { name: 'خشبة كلاسيك', bgInner: '#7c5566', bgOuter: '#4c303e' },
  { name: 'بطيخة صيفي', bgInner: '#3f6212', bgOuter: '#1a2e05' },
  { name: 'قرص جبنة', bgInner: '#78350f', bgOuter: '#451a03' },
  { name: 'درع نيون', bgInner: '#1e1b4b', bgOuter: '#090d1f' },
  { name: 'بيتزا ذهبية', bgInner: '#7f1d1d', bgOuter: '#3b0a0a' },
] as const;

const SLOT_CORNER_POS: Record<CornerSlot, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
};

const SLOT_ROTATE_STYLE: Record<CornerSlot, string> = {
  'top-left': 'rotate-[135deg]',
  'top-right': '-rotate-[135deg]',
  'bottom-left': 'rotate-45',
  'bottom-right': '-rotate-45',
};

function normalizeAngle(rad: number): number {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function drawKnifeShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  handleHex: string,
  darkHex: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Blade pointing along +X
  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(4, -6.5);
  ctx.lineTo(-2, -6.5);
  ctx.lineTo(-2, 6.5);
  ctx.lineTo(4, 6.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(18, 0);
  ctx.stroke();

  // Guard
  ctx.fillStyle = darkHex;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-5, -8.5, 4.5, 17, 2);
  ctx.fill();
  ctx.stroke();

  // Colored handle
  ctx.fillStyle = handleHex;
  ctx.beginPath();
  ctx.roundRect(-24, -4.5, 19, 9, 3.5);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawStageTarget(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  angle: number,
  themeIdx: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  if (themeIdx === 0) {
    // Stage 1: Classic Wood Log
    ctx.fillStyle = '#3b1e0e';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#733f1e';
    ctx.beginPath();
    ctx.arc(0, 0, r - 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#572d14';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#4a250e';
    ctx.beginPath();
    ctx.arc(r * 0.42, 8, 4.5, 0, Math.PI * 2);
    ctx.arc(-r * 0.35, -18, 3.5, 0, Math.PI * 2);
    ctx.arc(10, -r * 0.45, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeIdx === 1) {
    // Stage 2: Watermelon Target
    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.arc(0, 0, r - 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(0, 0, r - 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111827';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(r * 0.46, 0, 4, 2.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (themeIdx === 2) {
    // Stage 3: Swiss Cheese Wheel
    ctx.fillStyle = '#ca8a04';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 0, r - 8, 0, Math.PI * 2);
    ctx.fill();

    const holes = [
      { x: r * 0.35, y: -r * 0.25, hr: 9 },
      { x: -r * 0.38, y: r * 0.12, hr: 11 },
      { x: r * 0.14, y: r * 0.42, hr: 7 },
      { x: -r * 0.12, y: -r * 0.38, hr: 6 },
      { x: 4, y: 2, hr: 8 },
    ];
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 1.8;
    for (const hole of holes) {
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, hole.hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (themeIdx === 3) {
    // Stage 4: Neon Cyber Shield
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(r * 0.35, 0);
      ctx.lineTo(r * 0.88, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Stage 5+: Golden Pizza Wheel
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, r - 9, 0, Math.PI * 2);
    ctx.fill();

    // Slice lines
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (r - 9), Math.sin(a) * (r - 9));
      ctx.stroke();
    }

    // Pepperoni slices
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.25;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.5), 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

export const KnifeHitGame: React.FC<KnifeHitGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
}) => {
  const [stage, setStage] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [matchSeconds, setMatchSeconds] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [seriesScores, setSeriesScores] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [hitCounts, setHitCounts] = useState<number[]>(() => players.map(() => 0));
  const [eliminatedList, setEliminatedList] = useState<boolean[]>(() => players.map(() => false));
  const [roundDeltas, setRoundDeltas] = useState<ArcadeDelta[]>([]);
  const [finalSeriesDeltas, setFinalSeriesDeltas] = useState<ArcadeDelta[]>([]);
  const [seriesWinners, setSeriesWinners] = useState<ArcadePlayer[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());
  const [shaking, setShaking] = useState<boolean>(false);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaSizeRef = useRef<{ w: number; h: number }>({ w: 390, h: 760 });

  const logAngleRef = useRef<number>(0);
  const logVelRef = useRef<number>(1.9);
  const pauseUntilRef = useRef<number>(0);
  const nextSpeedShiftRef = useRef<number>(0);
  const logRecoilRef = useRef<number>(0);
  const stuckRef = useRef<StuckKnife[]>([]);
  const applesRef = useRef<BonusApple[]>([]);
  const flyingRef = useRef<FlyingKnife[]>([]);
  const shardsRef = useRef<ShatterShard[]>([]);
  const flashesRef = useRef<ImpactFlash[]>([]);
  const countsRef = useRef<number[]>(players.map(() => 0));
  const eliminatedRef = useRef<boolean[]>(players.map(() => false));
  const lastThrowRef = useRef<number[]>(players.map(() => 0));
  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(DEFAULT_MATCH_SECONDS);
  const finishedRef = useRef<boolean>(false);

  const placements = getCornerPlacements(players.length);
  const isRoundActive = phase === 'COUNTDOWN' || phase === 'PLAYING';
  const themeIdx = (stage - 1) % STAGE_THEMES.length;
  const goHome = useGoHome();
  const stageTheme = STAGE_THEMES[themeIdx];

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

  const getGeometry = useCallback(() => {
    const { w, h } = arenaSizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const logR = Math.max(54, Math.min(76, Math.min(w, h) * 0.165));
    const origins: Record<CornerSlot, { x: number; y: number }> = {
      'bottom-right': { x: w - 66, y: h - 74 },
      'top-left': { x: 66, y: 74 },
      'bottom-left': { x: 66, y: h - 74 },
      'top-right': { x: w - 66, y: 74 },
    };
    return { w, h, cx, cy, logR, origins };
  }, []);

  const syncArenaSize = useCallback(() => {
    const el = arenaRef.current;
    if (!el) return;
    arenaSizeRef.current = {
      w: Math.max(300, Math.round(el.clientWidth)),
      h: Math.max(420, Math.round(el.clientHeight)),
    };
  }, []);

  const resetMatchState = useCallback(() => {
    syncArenaSize();
    logAngleRef.current = 0;
    logVelRef.current = 1.85 + Math.min(1.5, (stage - 1) * 0.25);
    pauseUntilRef.current = 0;
    nextSpeedShiftRef.current = performance.now() + Math.max(1800, 3200 - stage * 220);
    logRecoilRef.current = 0;

    // Pre-stuck neutral obstacle knives starting from Stage 2+
    const preStuck: StuckKnife[] = [];
    const obstacleCount = stage >= 2 ? Math.min(6, stage) : 0;
    for (let i = 0; i < obstacleCount; i++) {
      const baseAngle = (i * (Math.PI * 2)) / obstacleCount + (Math.random() - 0.5) * 0.22;
      preStuck.push({
        relAngle: normalizeAngle(baseAngle),
        hex: '#64748b',
        darkHex: '#1e293b',
        playerId: null,
      });
    }
    stuckRef.current = preStuck;

    // Bonus apples on Stage 2+ placed safely between obstacles
    const apples: BonusApple[] = [];
    if (stage >= 2) {
      const appleCount = stage >= 4 ? 2 : 1;
      for (let a = 0; a < appleCount; a++) {
        apples.push({
          relAngle: normalizeAngle(((a + 0.5) * Math.PI * 2) / Math.max(2, obstacleCount) + 0.3),
          sliced: false,
        });
      }
    }
    applesRef.current = apples;

    flyingRef.current = [];
    shardsRef.current = [];
    flashesRef.current = [];
    countsRef.current = players.map(() => 0);
    eliminatedRef.current = players.map(() => false);
    lastThrowRef.current = players.map(() => 0);
    finishedRef.current = false;
    setHitCounts(players.map(() => 0));
    setEliminatedList(players.map(() => false));
  }, [players, stage, syncArenaSize]);

  const finishMatch = useCallback(
    (explicitWinnerIdx?: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const counts = countsRef.current;
      const winnerIds = new Set<string>();
      let headline = `انتهت المرحلة ${stage}!`;

      if (typeof explicitWinnerIdx === 'number') {
        const winner = players[explicitWinnerIdx];
        if (winner) {
          winnerIds.add(winner.id);
          headline = `المرحلة ${stage} — الفائز: ${winner.name}!`;
        }
      } else {
        const best = Math.max(...counts, 0);
        const winners = players.filter((_, idx) => counts[idx] === best && best > 0);
        winners.forEach((w) => winnerIds.add(w.id));
        if (winners.length > 1) {
          headline = `المرحلة ${stage} — تعادل (${best} سكاكين): ${winners.map((w) => w.name).join(' و ')}`;
        } else if (winners.length === 1) {
          headline = `المرحلة ${stage} — الفائز: ${winners[0].name} (${best} سكاكين)`;
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

      if (stage < totalRounds) {
        soundManager.play('victory');
        setSummaryText(headline);
        setPhase('INTER_ROUND');
      } else {
        const topSeries = Math.max(...players.map((p) => nextSeriesScores[p.id] ?? 0), 0);
        const champs = players.filter((p) => (nextSeriesScores[p.id] ?? 0) === topSeries && topSeries > 0);
        const seriesHeadline =
          champs.length > 1
            ? `أبطال التحدي (${totalRounds} مراحل): ${champs.map((c) => c.name).join(' و ')}`
            : champs.length === 1
              ? `بطل التحدي (${totalRounds} مراحل): ${champs[0].name}!`
              : `انتهت سلسلة الـ ${totalRounds} مراحل!`;
        setSummaryText(seriesHeadline);
        setSeriesWinners(champs);
        setFinalSeriesDeltas(
          players.map((p) => ({ playerId: p.id, delta: nextSeriesScores[p.id] ?? 0 }))
        );
        setPhase('WINNER_SPOTLIGHT');
      }
    },
    [onApplyDeltas, players, seriesScores, stage, totalRounds]
  );

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h, cx, cy, logR, origins } = getGeometry();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Stage background gradient
    const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(w, h) * 0.72);
    grad.addColorStop(0, stageTheme.bgInner);
    grad.addColorStop(1, stageTheme.bgOuter);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Ready knives waiting near corners
    const currentPlacements = getCornerPlacements(players.length);
    players.forEach((p, idx) => {
      if (eliminatedRef.current[idx]) return;
      const slot = currentPlacements[idx]?.slot ?? 'bottom-right';
      const origin = origins[slot];
      const theme = ARCADE_COLORS[p.colorId];
      const aimAngle = Math.atan2(cy - origin.y, cx - origin.x);
      drawKnifeShape(ctx, origin.x, origin.y, aimAngle, theme.hex, theme.darkHex);
    });

    const logDrawR = logR - logRecoilRef.current * 0.45;

    // Bonus apples on wheel rim
    for (const ap of applesRef.current) {
      if (ap.sliced) continue;
      const worldAngle = ap.relAngle + logAngleRef.current;
      const ax = cx + Math.cos(worldAngle) * (logDrawR + 12);
      const ay = cy + Math.sin(worldAngle) * (logDrawR + 12);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(2, -10, 4.5, 2.5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Stuck knives (player + neutral obstacle knives)
    for (const sk of stuckRef.current) {
      const worldAngle = sk.relAngle + logAngleRef.current;
      const kx = cx + Math.cos(worldAngle) * (logDrawR + 14);
      const ky = cy + Math.sin(worldAngle) * (logDrawR + 14);
      drawKnifeShape(ctx, kx, ky, worldAngle + Math.PI, sk.hex, sk.darkHex);
    }

    // Flying knives
    for (const fk of flyingRef.current) {
      drawKnifeShape(ctx, fk.x, fk.y, fk.angle, fk.hex, fk.darkHex);
    }

    // Shattering knife shards
    for (const sh of shardsRef.current) {
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.angle);
      ctx.globalAlpha = Math.max(0, sh.life);
      ctx.fillStyle = sh.color;
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -4);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Evolving rotating target wheel
    drawStageTarget(ctx, cx, cy, logDrawR, logAngleRef.current, themeIdx);

    // Impact starburst flashes
    for (const fl of flashesRef.current) {
      ctx.save();
      ctx.translate(fl.x, fl.y);
      ctx.globalAlpha = Math.max(0, fl.life);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const spikes = 7;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? 19 : 7;
        const a = (i * Math.PI) / spikes;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [getGeometry, players, stageTheme.bgInner, stageTheme.bgOuter, themeIdx]);

  // Countdown sequence
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    resetMatchState();
    drawScene();
    setCountdownNum(3);
    setSecondsLeft(matchSeconds);
    lastTickSecRef.current = matchSeconds;
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
      nextSpeedShiftRef.current = now + Math.max(1600, 3200 - stage * 220);
      setPhase('PLAYING');
    }, 1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase, matchSeconds, resetMatchState, drawScene, stage]);

  // Auto-advance after 3s floating inter-round banner
  useEffect(() => {
    if (phase !== 'INTER_ROUND') return;
    const t = window.setTimeout(() => {
      setStage((prev) => prev + 1);
      setPhase('COUNTDOWN');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Main 60fps loop
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    let rafId = 0;
    let shakeTimerId: number | null = null;
    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      const elapsedSec = (now - roundStartRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(matchSeconds - elapsedSec));
      if (remaining !== lastTickSecRef.current) {
        lastTickSecRef.current = remaining;
        setSecondsLeft(remaining);
        if (remaining > 0 && remaining <= 5) {
          soundManager.play('tickUrgent');
        }
      }

      if (elapsedSec >= matchSeconds) {
        drawScene();
        finishMatch();
        return;
      }

      // Progressive dynamic wheel physics (speeds up, slows down, pauses briefly, reverses!)
      if (now >= nextSpeedShiftRef.current) {
        const interval = Math.max(1400, 3100 - stage * 220) + Math.random() * 1400;
        nextSpeedShiftRef.current = now + interval;

        // Brief unpredictable pause on Stage 2+
        if (stage >= 2 && Math.random() < 0.32) {
          pauseUntilRef.current = now + 420 + Math.random() * 280;
        }
        const flip = Math.random() < (stage >= 2 ? 0.72 : 0.55) ? -1 : 1;
        const baseMin = 1.45 + Math.min(1.1, (stage - 1) * 0.22);
        const baseMax = 2.65 + Math.min(1.4, (stage - 1) * 0.28);
        const speed = baseMin + Math.random() * (baseMax - baseMin);
        logVelRef.current = Math.sign(logVelRef.current || 1) * flip * speed;
      }

      if (now >= pauseUntilRef.current) {
        logAngleRef.current += logVelRef.current * dt;
      }
      logRecoilRef.current = Math.max(0, logRecoilRef.current - 28 * dt);

      const { cx, cy, logR } = getGeometry();
      const remainingFlying: FlyingKnife[] = [];

      for (const fk of flyingRef.current) {
        fk.x += fk.vx * dt;
        fk.y += fk.vy * dt;

        const dx = fk.x - cx;
        const dy = fk.y - cy;
        const dist = Math.hypot(dx, dy);

        if (dist <= logR + 14) {
          const worldHitAngle = Math.atan2(dy, dx);
          const relAngle = normalizeAngle(worldHitAngle - logAngleRef.current);

          const collided = stuckRef.current.some(
            (sk) => Math.abs(normalizeAngle(relAngle - sk.relAngle)) < COLLISION_ARC
          );

          if (collided) {
            soundManager.play('shatter');
            triggerHaptic(150);
            setShaking(true);
            if (shakeTimerId !== null) window.clearTimeout(shakeTimerId);
            shakeTimerId = window.setTimeout(() => setShaking(false), 260);
            eliminatedRef.current[fk.playerIdx] = true;
            setEliminatedList([...eliminatedRef.current]);

            // Shatter knife into flying shards (capped at <= 60)
            for (let s = 0; s < 5; s++) {
              if (shardsRef.current.length >= 60) shardsRef.current.shift();
              const outAngle = worldHitAngle + (Math.random() - 0.5) * 1.3;
              const spd = 220 + Math.random() * 220;
              shardsRef.current.push({
                x: fk.x,
                y: fk.y,
                vx: Math.cos(outAngle) * spd,
                vy: Math.sin(outAngle) * spd,
                angle: fk.angle + s,
                spin: (Math.random() - 0.5) * 20,
                color: s < 2 ? fk.hex : '#e2e8f0',
                life: 1,
              });
            }
            flashesRef.current.push({ x: fk.x, y: fk.y, life: 1 });

            // Check if all players are eliminated or only 1 survivor holds strict lead
            const survivors = players
              .map((_, i) => i)
              .filter((i) => !eliminatedRef.current[i]);
            if (survivors.length === 0) {
              drawScene();
              finishMatch();
              return;
            }
            if (survivors.length === 1 && players.length > 1) {
              const survIdx = survivors[0];
              const maxElimScore = Math.max(
                ...players.map((_, i) => (eliminatedRef.current[i] ? countsRef.current[i] : -1))
              );
              if (countsRef.current[survIdx] > maxElimScore) {
                drawScene();
                finishMatch(survIdx);
                return;
              }
            }
          } else {
            soundManager.play('hit');
            triggerHaptic(25);
            logRecoilRef.current = 7;

            // Check bonus apple slice!
            let bonusAppleHit = false;
            for (const ap of applesRef.current) {
              if (!ap.sliced && Math.abs(normalizeAngle(relAngle - ap.relAngle)) < 0.25) {
                ap.sliced = true;
                bonusAppleHit = true;
                soundManager.play('gold');
                for (let s = 0; s < 4; s++) {
                  shardsRef.current.push({
                    x: cx + Math.cos(worldHitAngle) * (logR + 10),
                    y: cy + Math.sin(worldHitAngle) * (logR + 10),
                    vx: (Math.random() - 0.5) * 260,
                    vy: (Math.random() - 0.5) * 260,
                    angle: s,
                    spin: 12,
                    color: s % 2 === 0 ? '#ef4444' : '#fef08a',
                    life: 1,
                  });
                }
              }
            }

            stuckRef.current.push({
              relAngle,
              hex: fk.hex,
              darkHex: fk.darkHex,
              playerId: players[fk.playerIdx].id,
            });
            flashesRef.current.push({
              x: cx + Math.cos(worldHitAngle) * logR,
              y: cy + Math.sin(worldHitAngle) * logR,
              life: 1,
            });

            countsRef.current[fk.playerIdx] =
              (countsRef.current[fk.playerIdx] ?? 0) + (bonusAppleHit ? 2 : 1);
            setHitCounts([...countsRef.current]);

            if (countsRef.current[fk.playerIdx] >= TARGET_KNIVES) {
              drawScene();
              finishMatch(fk.playerIdx);
              return;
            }
          }
        } else {
          remainingFlying.push(fk);
        }
      }
      flyingRef.current = remainingFlying;

      shardsRef.current = shardsRef.current
        .map((sh) => ({
          ...sh,
          x: sh.x + sh.vx * dt,
          y: sh.y + sh.vy * dt,
          angle: sh.angle + sh.spin * dt,
          life: sh.life - 1.85 * dt,
        }))
        .filter((sh) => sh.life > 0);

      flashesRef.current = flashesRef.current
        .map((fl) => ({ ...fl, life: fl.life - 4.8 * dt }))
        .filter((fl) => fl.life > 0);

      drawScene();
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (shakeTimerId !== null) window.clearTimeout(shakeTimerId);
    };
  }, [phase, players, stage, matchSeconds, getGeometry, drawScene, finishMatch]);

  const handleCornerThrow = (playerIdx: number) => {
    if (phase !== 'PLAYING' || finishedRef.current) return;
    if (eliminatedRef.current[playerIdx]) {
      soundManager.play('error');
      return;
    }
    const now = performance.now();
    if (now - lastThrowRef.current[playerIdx] < 165) return;
    lastThrowRef.current[playerIdx] = now;

    const { cx, cy, origins } = getGeometry();
    const slot = placements[playerIdx]?.slot ?? 'bottom-right';
    const origin = origins[slot];
    const theme = ARCADE_COLORS[players[playerIdx].colorId];
    const angle = Math.atan2(cy - origin.y, cx - origin.x);

    soundManager.play('slash');
    flyingRef.current.push({
      playerIdx,
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * KNIFE_SPEED,
      vy: Math.sin(angle) * KNIFE_SPEED,
      angle,
      hex: theme.hex,
      darkHex: theme.darkHex,
    });
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
            title="تحدي السكاكين"
            subtitle={`ثبّت ${TARGET_KNIVES} سكاكين في كل مرحلة متطورة من غير ما تخبط السكاكين التانية!`}
            players={players}
            accentBgClass="bg-gradient-to-br from-[#4c1d95] to-[#ec4899]"
            icon={<Swords className="w-12 h-12 text-white" />}
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            durationLabel="مدة كل مرحلة:"
            durationOptions={[
              { value: 25, label: '25 ثانية' },
              { value: 30, label: '30 ثانية' },
              { value: 45, label: '45 ثانية' },
            ]}
            defaultDuration={30}
            onStartSeries={(rounds, secs) => {
              setTotalRounds(rounds);
              setMatchSeconds(secs);
              setStage(1);
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
          stageLabel={`مرحلة ${stage}/${totalRounds}`}
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
            className="w-full h-full block"
          />

          {phase === 'COUNTDOWN' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/50 px-6 text-center z-20">
              <div className="text-lg font-black text-amber-300 mb-1 tabular-nums">
                مرحلة {stage} من {totalRounds} · {stageTheme.name}
              </div>
              <div className="text-8xl font-black text-white drop-shadow-[0_6px_0_#111827] tabular-nums">
                {countdownNum}
              </div>
              <div className="mt-3 text-sm sm:text-base font-black text-white/90">
                ثبّت {TARGET_KNIVES} سكاكين من غير ما تخبط أي سكينة تانية!
              </div>
            </div>
          )}

          {/* Ergonomic Circular Knife-Launch Corner Trigger Pads */}
          {players.map((player, idx) => {
            const placement = placements[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!placement) return null;
            const isOut = eliminatedList[idx] ?? false;
            const hits = hitCounts[idx] ?? 0;

            return (
              <button
                key={player.id}
                type="button"
                style={{
                  touchAction: 'none',
                  backgroundColor: isOut ? 'rgba(30, 41, 59, 0.8)' : theme.hex,
                  color: isOut ? '#fca5a5' : theme.textOnColor,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundManager.unlock();
                  handleCornerThrow(idx);
                }}
                className={`absolute ${SLOT_CORNER_POS[placement.slot]} z-20 w-[96px] h-[96px] rounded-full border-4 border-[#111827] shadow-[0_5px_0_#111827] active:scale-95 flex flex-col items-center justify-center p-1 cursor-pointer select-none transition-transform ${
                  isOut ? 'opacity-65' : ''
                }`}
              >
                <div
                  className={`flex flex-col items-center justify-center text-center ${SLOT_ROTATE_STYLE[placement.slot]}`}
                >
                  <Swords className="w-5 h-5 mb-0.5" />
                  <span className="text-[11px] font-black truncate max-w-[74px]">
                    {player.name}
                  </span>
                  <span
                    className={`text-xs font-black tabular-nums ${
                      isOut ? 'animate-hardluck-shake text-[#FDA4AF]' : ''
                    }`}
                  >
                    {isOut ? 'هاردلك! 😅' : `${hits}/${TARGET_KNIVES}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {phase === 'INTER_ROUND' && (
        <ArcadeSeriesOverlay
          players={players}
          seriesScores={seriesScores}
          roundDeltas={roundDeltas}
          roundNum={stage}
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
              setStage(1);
              setSeriesScores({});
              setPhase('SETUP');
            }}
            onBackToArcadeHub={onExitToArcadeHub}
          />
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="الخروج من تحدي السكاكين؟"
        message="المرحلة لسه شغالة، لو خرجت دلوقتي النتيجة مش هتتحسب."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToArcadeHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
