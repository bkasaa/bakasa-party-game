import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
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

interface FrogFlyCatchGameProps {
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
type BugKind = 'fly' | 'gold' | 'wasp';

interface PondBug {
  id: number;
  kind: BugKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobbleSeed: number;
  nextTurnAt: number;
}

interface FrogState {
  playerIdx: number;
  x: number;
  y: number;
  baseAngle: number;
  angle: number;
  phaseOffset: number;
  padAngle: number;
  tongueProgress: number;
  tonguePhase: 'idle' | 'out' | 'in';
  lockedAngle: number;
  caughtKind: BugKind | null;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const TARGET_POINTS = 15;
const DEFAULT_MATCH_SECONDS = 30;

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

function getFrogTongueReach(w: number, h: number): number {
  const padInsetX = Math.max(82, Math.min(126, w * 0.24));
  const padInsetY = Math.max(115, Math.min(160, h * 0.21));
  const distToCenter = Math.hypot(w * 0.5 - padInsetX, h * 0.5 - padInsetY);
  return Math.max(Math.min(w, h) * 0.65, distToCenter + 38);
}

function getCenterPondBounds(w: number, h: number) {
  return {
    minX: w * 0.24,
    maxX: w * 0.76,
    minY: h * 0.27,
    maxY: h * 0.73,
  };
}

function spawnBug(id: number, w: number, h: number, speedMult: number): PondBug {
  const r = Math.random();
  const kind: BugKind = r < 0.2 ? 'gold' : r < 0.4 ? 'wasp' : 'fly';
  const bounds = getCenterPondBounds(w, h);
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? bounds.minX + 10 : bounds.maxX - 10;
  const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
  const baseSpeed = kind === 'gold' ? 128 : kind === 'wasp' ? 104 : 88;
  const speed = baseSpeed * speedMult;
  const angleToMid = Math.atan2(
    h / 2 + (Math.random() - 0.5) * (h * 0.16) - y,
    w / 2 + (Math.random() - 0.5) * (w * 0.12) - x
  );

  return {
    id,
    kind,
    x,
    y,
    vx: Math.cos(angleToMid) * speed,
    vy: Math.sin(angleToMid) * speed,
    wobbleSeed: Math.random() * 10,
    nextTurnAt: performance.now() + 850 + Math.random() * 950,
  };
}

function drawLilyPad(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, notchAngle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(notchAngle);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.moveTo(3, 4);
  ctx.arc(3, 4, r, 0.25, Math.PI * 2 - 0.25);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#25a87a';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, 0.25, Math.PI * 2 - 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle leaf vein lines so rotation is crystal clear!
  ctx.strokeStyle = 'rgba(17, 24, 39, 0.22)';
  ctx.lineWidth = 2;
  for (const va of [Math.PI * 0.55, Math.PI, Math.PI * 1.45]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(va) * (r * 0.72), Math.sin(va) * (r * 0.72));
    ctx.stroke();
  }

  ctx.restore();
}

function drawFrog(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, hex: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = hex;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-7, side * 14, 9, 5, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(9, side * 11, 6, 3.8, side * -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, side * 6.5, 4.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(9.5, side * 6.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBug(ctx: CanvasRenderingContext2D, bug: PondBug, timeSec: number) {
  const wingFlap = Math.sin(timeSec * 38 + bug.wobbleSeed) * 3;
  ctx.save();
  ctx.translate(bug.x, bug.y);
  ctx.rotate(Math.atan2(bug.vy, bug.vx));

  if (bug.kind === 'gold') {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.38)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
  } else if (bug.kind === 'wasp') {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.8;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-2, side * (7 + wingFlap * 0.4), 7, 4, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle =
    bug.kind === 'gold' ? '#facc15' : bug.kind === 'wasp' ? '#f97316' : '#1e293b';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 5.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (bug.kind === 'wasp') {
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -4.5);
    ctx.lineTo(-2, 4.5);
    ctx.moveTo(2, -4.5);
    ctx.lineTo(2, 4.5);
    ctx.stroke();
  }

  ctx.restore();
}

export const FrogFlyCatchGame: React.FC<FrogFlyCatchGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
}) => {
  const [roundNum, setRoundNum] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [matchSeconds, setMatchSeconds] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [seriesScores, setSeriesScores] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [scores, setScores] = useState<number[]>(() => players.map(() => 0));
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
  const frogsRef = useRef<FrogState[]>([]);
  const bugsRef = useRef<PondBug[]>([]);
  const popupsRef = useRef<ScorePopup[]>([]);
  const scoresRef = useRef<number[]>(players.map(() => 0));
  const nextBugIdRef = useRef<number>(1);
  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(DEFAULT_MATCH_SECONDS);
  const finishedRef = useRef<boolean>(false);

  const placements = getCornerPlacements(players.length);
  const goHome = useGoHome();
  const isRoundActive = phase === 'COUNTDOWN' || phase === 'PLAYING';

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

  const resetMatchState = useCallback(() => {
    syncArenaSize();
    const { w, h } = arenaSizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const padInsetX = Math.max(82, Math.min(126, w * 0.24));
    const padInsetY = Math.max(115, Math.min(160, h * 0.21));

    const spots: Record<CornerSlot, { x: number; y: number }> = {
      'bottom-right': { x: w - padInsetX, y: h - padInsetY },
      'top-left': { x: padInsetX, y: padInsetY },
      'bottom-left': { x: padInsetX, y: h - padInsetY },
      'top-right': { x: w - padInsetX, y: padInsetY },
    };

    const currentPlacements = getCornerPlacements(players.length);
    frogsRef.current = players.map((_, idx) => {
      const slot = currentPlacements[idx]?.slot ?? 'bottom-right';
      const spot = spots[slot];
      const baseAngle = Math.atan2(cy - spot.y, cx - spot.x);
      return {
        playerIdx: idx,
        x: spot.x,
        y: spot.y,
        baseAngle,
        angle: baseAngle,
        phaseOffset: idx * 1.35,
        padAngle: baseAngle + Math.PI,
        tongueProgress: 0,
        tonguePhase: 'idle',
        lockedAngle: baseAngle,
        caughtKind: null,
      };
    });

    const initialBugs: PondBug[] = [];
    const baseSpeedMult = 1 + (roundNum - 1) * 0.14;
    for (let i = 0; i < 8; i++) {
      const b = spawnBug(nextBugIdRef.current++, w, h, baseSpeedMult);
      b.x = w * 0.3 + Math.random() * (w * 0.4);
      b.y = h * 0.32 + Math.random() * (h * 0.36);
      initialBugs.push(b);
    }
    bugsRef.current = initialBugs;
    popupsRef.current = [];
    scoresRef.current = players.map(() => 0);
    finishedRef.current = false;
    setScores(players.map(() => 0));
  }, [players, roundNum, syncArenaSize]);

  const finishMatch = useCallback(
    (explicitWinnerIdx?: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const pts = scoresRef.current;
      const winnerIds = new Set<string>();
      let headline = `انتهت الجولة ${roundNum}!`;

      if (typeof explicitWinnerIdx === 'number') {
        const winner = players[explicitWinnerIdx];
        if (winner) {
          winnerIds.add(winner.id);
          headline = `الفائز (جولة ${roundNum}): ${winner.name} وصل لـ ${TARGET_POINTS} نقطة!`;
        }
      } else {
        const best = Math.max(...pts);
        const winners = players.filter((_, idx) => pts[idx] === best && best > 0);
        winners.forEach((w) => winnerIds.add(w.id));
        if (winners.length > 1) {
          headline = `تعادل (${best} نقطة): ${winners.map((w) => w.name).join(' و ')}`;
        } else if (winners.length === 1) {
          headline = `الفائز (جولة ${roundNum}): ${winners[0].name} (${best} نقطة)`;
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

      if (roundNum < totalRounds) {
        soundManager.play('victory');
        setSummaryText(headline);
        setPhase('INTER_ROUND');
      } else {
        const topSeries = Math.max(...players.map((p) => nextSeriesScores[p.id] ?? 0), 0);
        const champs = players.filter((p) => (nextSeriesScores[p.id] ?? 0) === topSeries && topSeries > 0);
        const seriesHeadline =
          champs.length > 1
            ? `أبطال التحدي (${totalRounds} جولات): ${champs.map((c) => c.name).join(' و ')}`
            : champs.length === 1
              ? `بطل التحدي (${totalRounds} جولات): ${champs[0].name}!`
              : `انتهت سلسلة الـ ${totalRounds} جولات!`;
        setSummaryText(seriesHeadline);
        setSeriesWinners(champs);
        setFinalSeriesDeltas(
          players.map((p) => ({ playerId: p.id, delta: nextSeriesScores[p.id] ?? 0 }))
        );
        setPhase('WINNER_SPOTLIGHT');
      }
    },
    [onApplyDeltas, players, roundNum, seriesScores, totalRounds]
  );

  const drawScene = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { w, h } = arenaSizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      const timeSec = now / 1000;
      const tongueReach = getFrogTongueReach(w, h);

      ctx.save();
      ctx.scale(dpr, dpr);

      // Vibrant pond blue water
      ctx.fillStyle = '#3898ff';
      ctx.fillRect(0, 0, w, h);

      // Animated ripples
      const rippleR = 42 + ((timeSec * 24) % 44);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 * (1 - (rippleR - 42) / 44)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
      ctx.stroke();

      // Center lily pad
      drawLilyPad(ctx, cx, cy, 28, -0.7 + Math.sin(timeSec * 0.9) * 0.15);

      // Rotating player lily pads + subtle aim guide dots
      for (const frog of frogsRef.current) {
        drawLilyPad(ctx, frog.x, frog.y, 28, frog.padAngle);

        if (frog.tonguePhase === 'idle') {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 7]);
          ctx.beginPath();
          ctx.moveTo(frog.x + Math.cos(frog.angle) * 18, frog.y + Math.sin(frog.angle) * 18);
          ctx.lineTo(frog.x + Math.cos(frog.angle) * 76, frog.y + Math.sin(frog.angle) * 76);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Tongues
      for (const frog of frogsRef.current) {
        if (frog.tongueProgress <= 0.01) continue;
        const shotAngle = frog.lockedAngle;
        const reach = frog.tongueProgress * tongueReach;
        const startX = frog.x + Math.cos(shotAngle) * 12;
        const startY = frog.y + Math.sin(shotAngle) * 12;
        const tipX = frog.x + Math.cos(shotAngle) * (12 + reach);
        const tipY = frog.y + Math.sin(shotAngle) * (12 + reach);

        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        ctx.fillStyle = '#f43f5e';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 6.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Frogs
      for (const frog of frogsRef.current) {
        const theme = ARCADE_COLORS[players[frog.playerIdx].colorId];
        const drawAngle = frog.tonguePhase === 'idle' ? frog.angle : frog.lockedAngle;
        drawFrog(ctx, frog.x, frog.y, drawAngle, theme.hex);
      }

      // Bugs
      for (const bug of bugsRef.current) {
        drawBug(ctx, bug, timeSec);
      }

      // Score popups
      for (const pop of popupsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.life);
        ctx.font = '900 19px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 4;
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      ctx.restore();
    },
    [players]
  );

  useEffect(() => {
    if (!isRoundActive) return;
    const handleResize = () => {
      syncArenaSize();
      const { w, h } = arenaSizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const padInsetX = Math.max(82, Math.min(126, w * 0.24));
      const padInsetY = Math.max(115, Math.min(160, h * 0.21));
      const spots: Record<CornerSlot, { x: number; y: number }> = {
        'bottom-right': { x: w - padInsetX, y: h - padInsetY },
        'top-left': { x: padInsetX, y: padInsetY },
        'bottom-left': { x: padInsetX, y: h - padInsetY },
        'top-right': { x: w - padInsetX, y: padInsetY },
      };
      const currentPlacements = getCornerPlacements(players.length);
      frogsRef.current.forEach((frog, idx) => {
        const slot = currentPlacements[idx]?.slot ?? 'bottom-right';
        const spot = spots[slot];
        const baseAngle = Math.atan2(cy - spot.y, cx - spot.x);
        frog.x = spot.x;
        frog.y = spot.y;
        frog.baseAngle = baseAngle;
        frog.padAngle = baseAngle + Math.PI;
        if (frog.tonguePhase === 'idle') {
          frog.angle = baseAngle;
          frog.lockedAngle = baseAngle;
        }
      });
      if (phase === 'COUNTDOWN') {
        drawScene(performance.now());
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
  }, [isRoundActive, phase, players.length, syncArenaSize, drawScene]);

  // Countdown sequence
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    resetMatchState();
    drawScene(performance.now());
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
      setPhase('PLAYING');
    }, 1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase, matchSeconds, resetMatchState, drawScene]);

  // Auto-advance after 3s floating inter-round banner
  useEffect(() => {
    if (phase !== 'INTER_ROUND') return;
    const t = window.setTimeout(() => {
      setRoundNum((prev) => prev + 1);
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
      const progress = Math.min(1, elapsedSec / matchSeconds);
      const remaining = Math.max(0, Math.ceil(matchSeconds - elapsedSec));
      if (remaining !== lastTickSecRef.current) {
        lastTickSecRef.current = remaining;
        setSecondsLeft(remaining);
        if (remaining > 0 && remaining <= 5) {
          soundManager.play('tickUrgent');
        }
      }

      if (elapsedSec >= matchSeconds) {
        drawScene(now);
        finishMatch();
        return;
      }

      const { w, h } = arenaSizeRef.current;
      const tongueReach = getFrogTongueReach(w, h);
      const pondBounds = getCenterPondBounds(w, h);
      const speedMult = 1 + progress * 0.55 + Math.min(0.8, (roundNum - 1) * 0.14);
      const oscSpeed = 1.7 + progress * 1.55 + Math.min(1.2, (roundNum - 1) * 0.25);

      // Update bugs with mid-air darting clustered toward the central pond
      const nextBugs: PondBug[] = [];
      for (const bug of bugsRef.current) {
        if (now >= bug.nextTurnAt) {
          bug.nextTurnAt = now + 700 + Math.random() * 850;
          const speed = Math.hypot(bug.vx, bug.vy) * (0.95 + progress * 0.15);
          const curAngle = Math.atan2(bug.vy, bug.vx);
          const toCenterAngle = Math.atan2(h * 0.5 - bug.y, w * 0.5 - bug.x);
          const distFromCenter = Math.hypot(bug.x - w * 0.5, bug.y - h * 0.5);
          const bias = distFromCenter > Math.min(w, h) * 0.18 ? 0.42 : 0.15;
          const turnDelta = (Math.random() - 0.5) * (1.35 + progress * 0.8);
          const blended = curAngle + turnDelta + Math.atan2(Math.sin(toCenterAngle - curAngle), Math.cos(toCenterAngle - curAngle)) * bias;
          bug.vx = Math.cos(blended) * Math.min(205, speed);
          bug.vy = Math.sin(blended) * Math.min(205, speed);
        }

        bug.x += bug.vx * dt;
        bug.y += (bug.vy + Math.sin(elapsedSec * (5 + progress * 3) + bug.wobbleSeed) * 28) * dt;

        if (bug.x < pondBounds.minX && bug.vx < 0) bug.vx = -bug.vx;
        if (bug.x > pondBounds.maxX && bug.vx > 0) bug.vx = -bug.vx;
        if (bug.y < pondBounds.minY && bug.vy < 0) bug.vy = -bug.vy;
        if (bug.y > pondBounds.maxY && bug.vy > 0) bug.vy = -bug.vy;

        nextBugs.push(bug);
      }
      while (nextBugs.length < 8) {
        nextBugs.push(spawnBug(nextBugIdRef.current++, w, h, speedMult));
      }
      bugsRef.current = nextBugs;

      // Update rotating lily pads & frog tongues
      for (const frog of frogsRef.current) {
        const swing = Math.sin(elapsedSec * oscSpeed + frog.phaseOffset) * 0.64;
        frog.angle = frog.baseAngle + swing;
        frog.padAngle = frog.angle + Math.PI;

        if (frog.tonguePhase === 'out') {
          frog.tongueProgress += dt * 7.6;
          if (frog.tongueProgress >= 1) {
            frog.tongueProgress = 1;
            frog.tonguePhase = 'in';
          }
        } else if (frog.tonguePhase === 'in') {
          frog.tongueProgress -= dt * 6.5;
          if (frog.tongueProgress <= 0) {
            frog.tongueProgress = 0;
            frog.tonguePhase = 'idle';
            frog.caughtKind = null;
          }
        }

        if (frog.tonguePhase !== 'idle' && frog.caughtKind === null) {
          const reach = frog.tongueProgress * tongueReach;
          const tipX = frog.x + Math.cos(frog.lockedAngle) * (12 + reach);
          const tipY = frog.y + Math.sin(frog.lockedAngle) * (12 + reach);

          const hitIdx = bugsRef.current.findIndex(
            (b) => Math.hypot(b.x - tipX, b.y - tipY) < 26
          );
          if (hitIdx >= 0) {
            const caught = bugsRef.current[hitIdx];
            bugsRef.current.splice(hitIdx, 1);
            frog.caughtKind = caught.kind;
            frog.tonguePhase = 'in';

            const delta = caught.kind === 'gold' ? 3 : caught.kind === 'wasp' ? -2 : 1;
            scoresRef.current[frog.playerIdx] = (scoresRef.current[frog.playerIdx] ?? 0) + delta;
            setScores([...scoresRef.current]);

            if (caught.kind === 'gold') {
              soundManager.play('gold');
              triggerHaptic(25);
            } else if (caught.kind === 'wasp') {
              soundManager.play('sting');
              triggerHaptic(150);
              setShaking(true);
              if (shakeTimerId !== null) window.clearTimeout(shakeTimerId);
              shakeTimerId = window.setTimeout(() => setShaking(false), 260);
            } else {
              soundManager.play('catch');
              triggerHaptic(25);
            }

            popupsRef.current.push({
              x: caught.x,
              y: caught.y - 8,
              text: delta > 0 ? `+${delta}` : `${delta}`,
              color:
                caught.kind === 'gold'
                  ? '#fde047'
                  : caught.kind === 'wasp'
                    ? '#f87171'
                    : '#ffffff',
              life: 1,
            });

            if (scoresRef.current[frog.playerIdx] >= TARGET_POINTS) {
              drawScene(now);
              finishMatch(frog.playerIdx);
              return;
            }
          }
        }
      }

      popupsRef.current = popupsRef.current
        .map((p) => ({ ...p, y: p.y - 34 * dt, life: p.life - 1.5 * dt }))
        .filter((p) => p.life > 0);

      drawScene(now);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (shakeTimerId !== null) window.clearTimeout(shakeTimerId);
    };
  }, [phase, roundNum, matchSeconds, drawScene, finishMatch]);

  const handleCornerShoot = (playerIdx: number) => {
    if (phase !== 'PLAYING' || finishedRef.current) return;
    const frog = frogsRef.current[playerIdx];
    if (!frog || frog.tonguePhase !== 'idle') return;
    frog.lockedAngle = frog.angle;
    frog.tonguePhase = 'out';
    frog.tongueProgress = 0.05;
    frog.caughtKind = null;
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
            title="صيد الضفادع"
            subtitle={`اضغط زاويتك في اللحظة الصح لتصطاد الدبان (+1) والذهبيات (+3) وتتفادى الدبور (-2)!`}
            players={players}
            accentBgClass="bg-gradient-to-br from-[#0369a1] to-[#10b981]"
            icon={
              <svg viewBox="0 0 48 48" className="w-14 h-14 drop-shadow" aria-hidden="true">
                <circle cx="24" cy="26" r="15" fill="#22c55e" stroke="#111827" strokeWidth="3" />
                <circle cx="17" cy="15" r="5" fill="#ffffff" stroke="#111827" strokeWidth="2.5" />
                <circle cx="31" cy="15" r="5" fill="#ffffff" stroke="#111827" strokeWidth="2.5" />
                <circle cx="17" cy="15" r="2" fill="#111827" />
                <circle cx="31" cy="15" r="2" fill="#111827" />
                <path d="M17 29 Q24 35 31 29" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            }
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            durationLabel="مدة كل جولة:"
            durationOptions={[
              { value: 25, label: '25 ثانية' },
              { value: 30, label: '30 ثانية' },
              { value: 45, label: '45 ثانية' },
            ]}
            defaultDuration={30}
            onStartSeries={(rounds, secs) => {
              setTotalRounds(rounds);
              setMatchSeconds(secs);
              setRoundNum(1);
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
          stageLabel={`جولة ${roundNum}/${totalRounds}`}
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
            className="w-full h-full block bg-[#3898ff]"
          />

          {phase === 'COUNTDOWN' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-6 text-center z-20">
              <div className="text-lg font-black text-amber-300 mb-1 tabular-nums">
                جولة {roundNum} من {totalRounds}
              </div>
              <div className="text-8xl font-black text-white drop-shadow-[0_6px_0_#111827] tabular-nums">
                {countdownNum}
              </div>
              <div className="mt-3 text-sm sm:text-base font-black text-white/95">
                ظبّط توقيت الدوران واصطاد الدبان! (ذهبية +3 · دبور -2)
              </div>
            </div>
          )}

          {/* Sleek Circular Corner Frog Tongue Trigger Pads */}
          {players.map((player, idx) => {
            const placement = placements[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!placement) return null;
            const pts = scores[idx] ?? 0;

            return (
              <button
                key={player.id}
                type="button"
                style={{
                  touchAction: 'none',
                  backgroundColor: theme.hex,
                  color: theme.textOnColor,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundManager.unlock();
                  handleCornerShoot(idx);
                }}
                className={`absolute ${SLOT_CORNER_POS[placement.slot]} z-20 w-[94px] h-[94px] rounded-full border-4 border-[#111827] shadow-[0_5px_0_#111827] active:scale-95 flex flex-col items-center justify-center p-1 cursor-pointer select-none transition-transform`}
              >
                <div
                  className={`flex flex-col items-center justify-center text-center ${SLOT_ROTATE_STYLE[placement.slot]}`}
                >
                  <span className="text-[11px] font-black truncate max-w-[74px]">
                    {player.name}
                  </span>
                  <span className="text-sm font-black tabular-nums">
                    {pts}/{TARGET_POINTS}
                  </span>
                  <span className="text-[10px] font-extrabold opacity-90">اصطاد!</span>
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
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="الخروج من صيد الضفادع؟"
        message="الجولة لسه شغالة، لو خرجت دلوقتي النتيجة مش هتتحسب."
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitToArcadeHub();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
};
