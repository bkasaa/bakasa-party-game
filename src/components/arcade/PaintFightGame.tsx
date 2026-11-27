import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, PaintRoller, Snowflake, Sparkles, Zap } from 'lucide-react';
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

interface PaintFightGameProps {
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
type PowerUpKind = 'giant' | 'speed' | 'freeze';

interface RollerEntity {
  playerId: string;
  name: string;
  hex: string;
  darkHex: string;
  x: number;
  y: number;
  angle: number;
  targetAngle: number | null;
  giantUntil: number;
  speedUntil: number;
  frozenUntil: number;
}

interface ArenaPowerUp {
  id: number;
  kind: PowerUpKind;
  x: number;
  y: number;
  spawnedAt: number;
}

interface SpeedTrailPoint {
  x: number;
  y: number;
  hex: string;
  life: number;
}

interface JoystickVisual {
  kx: number; // normalized -1..1
  ky: number; // normalized -1..1
  active: boolean;
  x: number | null;
  y: number | null;
}

interface CoverageStat {
  playerId: string;
  name: string;
  hex: string;
  percent: number;
}

const DEFAULT_MATCH_SECONDS = 30;
const BASE_SPEED = 148;
const BASE_BRUSH = 34;
const PAINT_SCALE = 0.5;
const BG_RGB: [number, number, number] = [247, 231, 203];
const JOYSTICK_MAX_R = 36;

const SLOT_CORNER_POS: Record<CornerSlot, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

const SLOT_ROTATE_STYLE: Record<CornerSlot, string> = {
  'top-left': 'rotate-[135deg]',
  'top-right': '-rotate-[135deg]',
  'bottom-left': 'rotate-45',
  'bottom-right': '-rotate-45',
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function normalizeAngle(rad: number): number {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export const PaintFightGame: React.FC<PaintFightGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
}) => {
  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [matchSeconds, setMatchSeconds] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [seriesScores, setSeriesScores] = useState<Record<string, number>>({});
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [coverageStats, setCoverageStats] = useState<CoverageStat[]>([]);
  const [roundDeltas, setRoundDeltas] = useState<ArcadeDelta[]>([]);
  const [finalSeriesDeltas, setFinalSeriesDeltas] = useState<ArcadeDelta[]>([]);
  const [seriesWinners, setSeriesWinners] = useState<ArcadePlayer[]>([]);
  const [winnerText, setWinnerText] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());
  const [shaking, setShaking] = useState<boolean>(false);
  const [joyVisuals, setJoyVisuals] = useState<JoystickVisual[]>(() =>
    players.map(() => ({ kx: 0, ky: 0, active: false, x: null, y: null }))
  );
  const [activeEffects, setActiveEffects] = useState<
    Array<{ giant: boolean; speed: boolean; frozen: boolean }>
  >(() => players.map(() => ({ giant: false, speed: false, frozen: false })));

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintBufferRef = useRef<HTMLCanvasElement | null>(null);
  const arenaSizeRef = useRef<{ w: number; h: number }>({ w: 390, h: 760 });
  const rollersRef = useRef<RollerEntity[]>([]);
  const powerUpsRef = useRef<ArenaPowerUp[]>([]);
  const trailsRef = useRef<SpeedTrailPoint[]>([]);
  const nextPowerIdRef = useRef<number>(1);
  const nextSpawnAtRef = useRef<number>(0);

  const joyPointersRef = useRef<
    Map<number, { playerIdx: number; cx: number; cy: number; x: number; y: number; rect: DOMRect }>
  >(new Map());
  const joyVectorsRef = useRef<Array<{ dx: number; dy: number; active: boolean }>>(
    players.map(() => ({ dx: 0, dy: 0, active: false }))
  );
  const lastJoyHapticRef = useRef<Array<{ angle: number; time: number }>>(
    players.map(() => ({ angle: 0, time: 0 }))
  );

  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(DEFAULT_MATCH_SECONDS);

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
    const w = Math.max(300, Math.round(el.clientWidth));
    const h = Math.max(420, Math.round(el.clientHeight));
    arenaSizeRef.current = { w, h };
  }, []);

  const initMatchEntities = useCallback(() => {
    syncArenaSize();
    const { w, h } = arenaSizeRef.current;
    const pw = Math.max(120, Math.round(w * PAINT_SCALE));
    const ph = Math.max(160, Math.round(h * PAINT_SCALE));

    const buf = document.createElement('canvas');
    buf.width = pw;
    buf.height = ph;
    const bCtx = buf.getContext('2d', { willReadFrequently: true });
    if (bCtx) {
      bCtx.fillStyle = '#f7e7cb';
      bCtx.fillRect(0, 0, pw, ph);
    }
    paintBufferRef.current = buf;

    const spawnPoints: Record<CornerSlot, { x: number; y: number; angle: number }> = {
      'bottom-right': { x: w * 0.74, y: h * 0.76, angle: -Math.PI * 0.75 },
      'top-left': { x: w * 0.26, y: h * 0.24, angle: Math.PI * 0.25 },
      'bottom-left': { x: w * 0.26, y: h * 0.76, angle: -Math.PI * 0.25 },
      'top-right': { x: w * 0.74, y: h * 0.24, angle: Math.PI * 0.75 },
    };

    const currentPlacements = getCornerPlacements(players.length);
    rollersRef.current = players.map((p, idx) => {
      const theme = ARCADE_COLORS[p.colorId];
      const slot = currentPlacements[idx]?.slot ?? 'bottom-right';
      const sp = spawnPoints[slot];

      if (bCtx) {
        bCtx.fillStyle = theme.hex;
        bCtx.beginPath();
        bCtx.arc(sp.x * PAINT_SCALE, sp.y * PAINT_SCALE, BASE_BRUSH * 0.5 * PAINT_SCALE, 0, Math.PI * 2);
        bCtx.fill();
      }

      return {
        playerId: p.id,
        name: p.name,
        hex: theme.hex,
        darkHex: theme.darkHex,
        x: sp.x,
        y: sp.y,
        angle: sp.angle,
        targetAngle: null,
        giantUntil: 0,
        speedUntil: 0,
        frozenUntil: 0,
      };
    });

    powerUpsRef.current = [];
    trailsRef.current = [];
    joyPointersRef.current.clear();
    joyVectorsRef.current = players.map(() => ({ dx: 0, dy: 0, active: false }));
    setJoyVisuals(players.map(() => ({ kx: 0, ky: 0, active: false, x: null, y: null })));
    setActiveEffects(players.map(() => ({ giant: false, speed: false, frozen: false })));
  }, [players, syncArenaSize]);

  const computeCoverageAndFinish = useCallback(() => {
    const buf = paintBufferRef.current;
    const bCtx = buf?.getContext('2d', { willReadFrequently: true });
    const counts = new Array(players.length).fill(0) as number[];
    const playerRgbs = players.map((p) => hexToRgb(ARCADE_COLORS[p.colorId].hex));

    const pw = buf?.width ?? 180;
    const ph = buf?.height ?? 300;
    if (bCtx) {
      const img = bCtx.getImageData(0, 0, pw, ph).data;
      const totalPixels = pw * ph;
      for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        const r = img[offset];
        const g = img[offset + 1];
        const b = img[offset + 2];

        const drBg = r - BG_RGB[0];
        const dgBg = g - BG_RGB[1];
        const dbBg = b - BG_RGB[2];
        if (drBg * drBg + dgBg * dgBg + dbBg * dbBg < 1400) continue;

        let bestIdx = -1;
        let bestDist = Infinity;
        for (let p = 0; p < playerRgbs.length; p++) {
          const pr = playerRgbs[p];
          const dr = r - pr[0];
          const dg = g - pr[1];
          const db = b - pr[2];
          const d = dr * dr + dg * dg + db * db;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = p;
          }
        }
        if (bestIdx >= 0 && bestDist < 12000) {
          counts[bestIdx]++;
        }
      }
    }

    const totalBoard = pw * ph;
    const stats: CoverageStat[] = players
      .map((p, idx) => ({
        playerId: p.id,
        name: p.name,
        hex: ARCADE_COLORS[p.colorId].hex,
        percent: Number(((counts[idx] / totalBoard) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.percent - a.percent);

    const topPct = stats[0]?.percent ?? 0;
    const winners = stats.filter((s) => s.percent === topPct && topPct > 0);
    const winnerIds = new Set(winners.map((w) => w.playerId));
    winnerIds.forEach((id) => recordArcadeWin(id));

    const deltas: ArcadeDelta[] = players.map((p) => ({
      playerId: p.id,
      delta: winnerIds.has(p.id) ? 100 : 0,
    }));

    setCoverageStats(stats);
    setRoundDeltas(deltas);
    onApplyDeltas(deltas);

    const nextSeriesScores: Record<string, number> = { ...seriesScores };
    deltas.forEach((d) => {
      nextSeriesScores[d.playerId] = (nextSeriesScores[d.playerId] ?? 0) + d.delta;
    });
    setSeriesScores(nextSeriesScores);

    const roundHeadline =
      winners.length > 1
        ? `تعادل: ${winners.map((w) => w.name).join(' و ')} (${topPct}%)`
        : winners.length === 1
          ? `بطل الجولة: ${winners[0].name} (${winners[0].percent}%)`
          : 'انتهى الوقت!';

    if (currentRound < totalRounds) {
      soundManager.play('victory');
      setWinnerText(roundHeadline);
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
      setWinnerText(seriesHeadline);
      setSeriesWinners(champs);
      setFinalSeriesDeltas(
        players.map((p) => ({ playerId: p.id, delta: nextSeriesScores[p.id] ?? 0 }))
      );
      setPhase('WINNER_SPOTLIGHT');
    }
  }, [currentRound, onApplyDeltas, players, seriesScores, totalRounds]);

  const drawPowerUpOrb = (ctx: CanvasRenderingContext2D, pu: ArenaPowerUp, now: number) => {
    const pulse = 1 + Math.sin(now * 0.007 + pu.id) * 0.08;
    const r = 21 * pulse;
    ctx.save();
    ctx.translate(pu.x, pu.y);

    // Outer glow aura
    const auraColor =
      pu.kind === 'giant'
        ? 'rgba(234, 179, 8, 0.34)'
        : pu.kind === 'speed'
          ? 'rgba(249, 115, 22, 0.34)'
          : 'rgba(56, 189, 248, 0.38)';
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
    ctx.fill();

    // Solid cartoon orb
    ctx.fillStyle =
      pu.kind === 'giant' ? '#facc15' : pu.kind === 'speed' ? '#fb923c' : '#38bdf8';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Crisp icon inside orb
    ctx.strokeStyle = '#111827';
    ctx.fillStyle = '#111827';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pu.kind === 'giant') {
      // Wide roller icon + "2X"
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-11, -9, 22, 8, 3);
      ctx.fill();
      ctx.stroke();
      ctx.font = '900 11px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#111827';
      ctx.fillText('2X', 0, 11);
    } else if (pu.kind === 'speed') {
      // Lightning bolt
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(2, -12);
      ctx.lineTo(-8, 1);
      ctx.lineTo(-1, 1);
      ctx.lineTo(-4, 12);
      ctx.lineTo(8, -1);
      ctx.lineTo(1, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Ice snowflake crystal
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.6;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(11, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawScene = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const buf = paintBufferRef.current;
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
    ctx.imageSmoothingEnabled = true;

    // Paint layer stretched smoothly across full screen arena
    ctx.drawImage(buf, 0, 0, w, h);

    // Speed trail particles
    for (const tr of trailsRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, tr.life * 0.55);
      ctx.fillStyle = tr.hex;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 7 * tr.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Power-up pickups
    for (const pu of powerUpsRef.current) {
      drawPowerUpOrb(ctx, pu, now);
    }

    // Cartoon Rollers
    for (const roller of rollersRef.current) {
      const isGiant = roller.giantUntil > now;
      const isSpeed = roller.speedUntil > now;
      const isFrozen = roller.frozenUntil > now;
      const rollerScale = isGiant ? 1.85 : 1;

      ctx.save();
      ctx.translate(roller.x, roller.y);

      // Speed ring glow
      if (isSpeed && !isFrozen) {
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26 * rollerScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.rotate(roller.angle);
      ctx.scale(rollerScale, rollerScale);

      // Drop shadow
      ctx.save();
      ctx.translate(2, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.roundRect(-8, -21, 16, 42, 5);
      ctx.fill();
      ctx.restore();

      // Wire frame arm
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 3.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.lineTo(0, -27);
      ctx.lineTo(-14, -27);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-22, 0);
      ctx.stroke();

      // Handle
      ctx.fillStyle = roller.hex;
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-39, -5.5, 18, 11, 4.5);
      ctx.fill();
      ctx.stroke();

      // Roller cylinder
      ctx.fillStyle = roller.hex;
      ctx.beginPath();
      ctx.roundRect(-8, -21, 16, 42, 5);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-8, -21, 16, 42, 5);
      ctx.clip();
      ctx.strokeStyle = roller.darkHex;
      ctx.lineWidth = 3;
      for (let sy = -24; sy <= 24; sy += 9) {
        ctx.beginPath();
        ctx.moveTo(-10, sy);
        ctx.lineTo(10, sy + 7);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-8, -21, 16, 42, 5);
      ctx.stroke();

      ctx.restore();

      // Semi-transparent ice block when frozen!
      if (isFrozen) {
        const boxSize = 48 * (isGiant ? 1.4 : 1);
        ctx.fillStyle = 'rgba(125, 211, 252, 0.58)';
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, 10);
        ctx.fill();
        ctx.stroke();

        // Ice sheen lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-boxSize * 0.3, -boxSize * 0.1);
        ctx.lineTo(-boxSize * 0.05, -boxSize * 0.34);
        ctx.moveTo(boxSize * 0.05, boxSize * 0.3);
        ctx.lineTo(boxSize * 0.32, boxSize * 0.05);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }, []);

  useEffect(() => {
    if (!isRoundActive) {
      joyPointersRef.current.clear();
      return;
    }
    const handleResize = () => {
      syncArenaSize();
      const { w, h } = arenaSizeRef.current;
      for (const r of rollersRef.current) {
        r.x = Math.max(24, Math.min(w - 24, r.x));
        r.y = Math.max(24, Math.min(h - 24, r.y));
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
  }, [isRoundActive, syncArenaSize]);

  // Countdown sequence
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    initMatchEntities();
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
      nextSpawnAtRef.current = now + 2600;
      setPhase('PLAYING');
    }, 1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase, matchSeconds, initMatchEntities, drawScene]);

  // Auto-advance after 3s floating inter-round scoreboard banner
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
    let lastStatusSync = 0;

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
        drawScene(now);
        computeCoverageAndFinish();
        return;
      }

      const { w, h } = arenaSizeRef.current;

      // Spawn glowing arena power-ups periodically
      if (now >= nextSpawnAtRef.current && powerUpsRef.current.length < 3) {
        nextSpawnAtRef.current = now + 4200 + Math.random() * 2000;
        const kinds: PowerUpKind[] = ['giant', 'speed', 'freeze'];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const safePadX = Math.min(95, w * 0.22);
        const safePadY = Math.min(125, h * 0.22);
        powerUpsRef.current.push({
          id: nextPowerIdRef.current++,
          kind,
          x: safePadX + Math.random() * Math.max(40, w - safePadX * 2),
          y: safePadY + Math.random() * Math.max(40, h - safePadY * 2),
          spawnedAt: now,
        });
      }

      const buf = paintBufferRef.current;
      const bCtx = buf?.getContext('2d', { willReadFrequently: true });
      const scaleX = (buf?.width ?? w * PAINT_SCALE) / w;
      const scaleY = (buf?.height ?? h * PAINT_SCALE) / h;

      for (let i = 0; i < rollersRef.current.length; i++) {
        const roller = rollersRef.current[i];
        const isFrozen = roller.frozenUntil > now;
        if (isFrozen) continue;

        const joy = joyVectorsRef.current[i];
        if (joy && joy.active) {
          const desired = Math.atan2(joy.dy, joy.dx);
          const mag = Math.min(1, Math.hypot(joy.dx, joy.dy) / JOYSTICK_MAX_R);
          const diff = normalizeAngle(desired - roller.angle);
          const maxTurn = (15 + 9 * mag) * dt;
          if (Math.abs(diff) <= maxTurn) {
            roller.angle = desired;
          } else {
            roller.angle += Math.sign(diff) * maxTurn;
          }
        }

        const isGiant = roller.giantUntil > now;
        const isSpeed = roller.speedUntil > now;
        const speed = BASE_SPEED * (isSpeed ? 1.6 : 1);
        const brushW = BASE_BRUSH * (isGiant ? 2 : 1);

        const prevX = roller.x;
        const prevY = roller.y;
        let nextX = prevX + Math.cos(roller.angle) * speed * dt;
        let nextY = prevY + Math.sin(roller.angle) * speed * dt;

        const margin = 20;
        if (nextX < margin) {
          nextX = margin;
          roller.angle = Math.PI - roller.angle;
        } else if (nextX > w - margin) {
          nextX = w - margin;
          roller.angle = Math.PI - roller.angle;
        }
        if (nextY < margin) {
          nextY = margin;
          roller.angle = -roller.angle;
        } else if (nextY > h - margin) {
          nextY = h - margin;
          roller.angle = -roller.angle;
        }

        roller.x = nextX;
        roller.y = nextY;

        if (isSpeed && Math.random() < 0.65) {
          if (trailsRef.current.length >= 60) {
            trailsRef.current.shift();
          }
          trailsRef.current.push({
            x: prevX,
            y: prevY,
            hex: roller.hex,
            life: 1,
          });
        }

        if (bCtx) {
          bCtx.strokeStyle = roller.hex;
          bCtx.lineWidth = brushW * scaleX;
          bCtx.lineCap = 'round';
          bCtx.lineJoin = 'round';
          bCtx.beginPath();
          bCtx.moveTo(prevX * scaleX, prevY * scaleY);
          bCtx.lineTo(nextX * scaleX, nextY * scaleY);
          bCtx.stroke();
        }

        // Check pickup collisions
        const pickupRadius = isGiant ? 42 : 31;
        for (let pIdx = powerUpsRef.current.length - 1; pIdx >= 0; pIdx--) {
          const pu = powerUpsRef.current[pIdx];
          if (Math.hypot(roller.x - pu.x, roller.y - pu.y) <= pickupRadius) {
            powerUpsRef.current.splice(pIdx, 1);
            if (pu.kind === 'giant') {
              soundManager.play('powerup');
              triggerHaptic(25);
              roller.giantUntil = now + 5000;
            } else if (pu.kind === 'speed') {
              soundManager.play('powerup');
              triggerHaptic(25);
              roller.speedUntil = now + 5000;
            } else {
              soundManager.play('freeze');
              triggerHaptic(150);
              setShaking(true);
              if (shakeTimerId !== null) window.clearTimeout(shakeTimerId);
              shakeTimerId = window.setTimeout(() => setShaking(false), 260);
              rollersRef.current.forEach((other, oIdx) => {
                if (oIdx !== i) {
                  other.frozenUntil = now + 4000;
                }
              });
            }
          }
        }
      }

      trailsRef.current = trailsRef.current
        .map((t) => ({ ...t, life: t.life - 3.6 * dt }))
        .filter((t) => t.life > 0);

      if (now - lastStatusSync > 120) {
        lastStatusSync = now;
        setActiveEffects(
          rollersRef.current.map((r) => ({
            giant: r.giantUntil > now,
            speed: r.speedUntil > now,
            frozen: r.frozenUntil > now,
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
  }, [phase, matchSeconds, drawScene, computeCoverageAndFinish]);

  // Strictly Fixed-Base Multi-Touch 360° Virtual Analog Joystick handlers
  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>, playerIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
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
    joyPointersRef.current.set(e.pointerId, {
      playerIdx,
      cx,
      cy,
      x: rect.width / 2,
      y: rect.height / 2,
      rect,
    });
    lastJoyHapticRef.current[playerIdx] = { angle: 0, time: performance.now() };
    updateJoyFromCoords(playerIdx, e.clientX - cx, e.clientY - cy);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = joyPointersRef.current.get(e.pointerId);
    if (!entry) return;
    e.preventDefault();
    const rawDx = e.clientX - entry.cx;
    const rawDy = e.clientY - entry.cy;
    updateJoyFromCoords(entry.playerIdx, rawDx, rawDy);
  };

  const updateJoyFromCoords = (playerIdx: number, rawDx: number, rawDy: number) => {
    const dist = Math.hypot(rawDx, rawDy);
    const active = dist > 0.5;
    const clampedDist = Math.min(JOYSTICK_MAX_R, dist);
    const nx = dist > 0.01 ? (rawDx / dist) * (clampedDist / JOYSTICK_MAX_R) : 0;
    const ny = dist > 0.01 ? (rawDy / dist) * (clampedDist / JOYSTICK_MAX_R) : 0;

    if (dist > 4) {
      const ang = Math.atan2(rawDy, rawDx);
      const now = performance.now();
      const prevH = lastJoyHapticRef.current[playerIdx];
      if (prevH && now - prevH.time >= 95 && Math.abs(normalizeAngle(ang - prevH.angle)) >= 0.85) {
        triggerHaptic(15);
        lastJoyHapticRef.current[playerIdx] = { angle: ang, time: now };
      }
    }

    joyVectorsRef.current[playerIdx] = { dx: rawDx, dy: rawDy, active };
    setJoyVisuals((prev) =>
      prev.map((item, idx) =>
        idx === playerIdx ? { kx: nx, ky: ny, active: true, x: null, y: null } : item
      )
    );
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const entry = joyPointersRef.current.get(e.pointerId);
    if (!entry) return;
    joyPointersRef.current.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
    joyVectorsRef.current[entry.playerIdx] = { dx: 0, dy: 0, active: false };
    setJoyVisuals((prev) =>
      prev.map((item, idx) =>
        idx === entry.playerIdx ? { kx: 0, ky: 0, active: false, x: null, y: null } : item
      )
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
            title="حرب الرولات"
            subtitle="حرّك الجويستيك 360° لتلوين أكبر مساحة واجمع القوى قبل خصومك!"
            players={players}
            accentBgClass="bg-gradient-to-br from-[#991b1b] to-[#f97316]"
            icon={<PaintRoller className="w-12 h-12 text-white" />}
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            durationLabel="مدة كل جولة:"
            durationOptions={[
              { value: 20, label: '20 ثانية' },
              { value: 30, label: '30 ثانية' },
              { value: 45, label: '45 ثانية' },
            ]}
            defaultDuration={30}
            onStartSeries={(rounds, secs) => {
              setTotalRounds(rounds);
              setMatchSeconds(secs);
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
          stageLabel={`جولة ${currentRound}/${totalRounds}`}
          muted={muted}
          onRequestExit={() => setShowExitConfirm(true)}
        />
      )}

      {/* Full-Screen Canvas & 360° Corner Joysticks */}
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
            className="w-full h-full block bg-[#f7e7cb]"
          />

          {phase === 'COUNTDOWN' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-6 text-center z-20">
              <div className="text-lg font-black text-amber-300 mb-1 tabular-nums">
                جولة {currentRound} من {totalRounds}
              </div>
              <div className="text-8xl font-black text-white drop-shadow-[0_6px_0_#111827] tabular-nums">
                {countdownNum}
              </div>
              <div className="mt-3 text-base sm:text-lg font-black text-amber-200">
                حرّك الجويستيك في كل الاتجاهات واجمع القوى!
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs font-extrabold text-white/90">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-yellow-300" /> رول عملاق
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-orange-300" /> سرعة خارقة
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Snowflake className="w-4 h-4 text-sky-300" /> تجميد الخصوم
                </span>
              </div>
            </div>
          )}

          {/* Compact Floating 360° Corner Joysticks */}
          {players.map((player, idx) => {
            const placement = placements[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!placement) return null;

            const jv = joyVisuals[idx] ?? { kx: 0, ky: 0, active: false, x: null, y: null };
            const eff = activeEffects[idx] ?? { giant: false, speed: false, frozen: false };

            return (
              <div
                key={player.id}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleJoyDown(e, idx)}
                onPointerMove={handleJoyMove}
                onPointerUp={handleJoyUp}
                onPointerCancel={handleJoyUp}
                onLostPointerCapture={handleJoyUp}
                className={`absolute ${SLOT_CORNER_POS[placement.slot]} z-20 w-[106px] h-[106px] rounded-full cursor-pointer select-none flex items-center justify-center`}
              >
                <div
                  style={{
                    borderColor: eff.frozen ? '#7dd3fc' : theme.hex,
                    backgroundColor: eff.frozen
                      ? 'rgba(14, 165, 233, 0.54)'
                      : jv.active
                        ? 'rgba(15, 23, 42, 0.72)'
                        : 'rgba(15, 23, 42, 0.52)',
                  }}
                  className="pointer-events-none relative w-full h-full rounded-full border-[3.5px] shadow-[0_4px_0_rgba(0,0,0,0.35)] flex items-center justify-center"
                >
                  <span className="pointer-events-none absolute top-1.5 w-1.5 h-1.5 rounded-full bg-white/45" />
                  <span className="pointer-events-none absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-white/45" />
                  <span className="pointer-events-none absolute left-1.5 w-1.5 h-1.5 rounded-full bg-white/45" />
                  <span className="pointer-events-none absolute right-1.5 w-1.5 h-1.5 rounded-full bg-white/45" />

                  <span
                    className={`pointer-events-none absolute -top-5 px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-black text-white truncate max-w-[98px] ${
                      placement.isTop ? 'rotate-180 -bottom-5 top-auto' : ''
                    }`}
                  >
                    {eff.frozen ? '❄️ مجمد' : eff.giant ? '2X ' + player.name : eff.speed ? '⚡ ' + player.name : player.name}
                  </span>

                  <div
                    style={{
                      backgroundColor: eff.frozen ? '#bae6fd' : theme.hex,
                      transform: `translate3d(${jv.kx * JOYSTICK_MAX_R}px, ${jv.ky * JOYSTICK_MAX_R}px, 0) scale(${jv.active ? 1.08 : 1})`,
                    }}
                    className={`pointer-events-none w-10 h-10 rounded-full border-[3px] border-[#111827] shadow-[0_3px_0_#111827] flex items-center justify-center ${
                      jv.active ? '' : 'transition-transform duration-150'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full bg-white/75 ${SLOT_ROTATE_STYLE[placement.slot]}`}
                    />
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
          headline={winnerText}
          extraRows={coverageStats.map((s) => ({
            playerId: s.playerId,
            badge: `${s.percent}%`,
          }))}
          durationMs={3000}
        />
      )}

      {phase === 'WINNER_SPOTLIGHT' && (
        <ArcadeWinnerSpotlight
          winners={seriesWinners}
          seriesScores={seriesScores}
          headline={winnerText}
          onContinueToLeaderboard={() => setPhase('LEADERBOARD')}
        />
      )}

      {/* 2D Arcade Final Series Leaderboard */}
      {phase === 'LEADERBOARD' && (
        <div className="flex-1 flex flex-col pt-4 overflow-y-auto">
          <div className="w-full max-w-xl mx-auto px-4 pb-2 flex items-center justify-between">
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
            summaryHeadline={winnerText}
            extraContent={
              <div className="rounded-3xl qada-card p-4 flex flex-col gap-2.5">
                <div className="text-xs font-extrabold text-[#64748B] dark:text-[#94A3B8] text-center">
                  تغطية آخر جولة
                </div>
                {coverageStats.map((stat) => (
                  <div key={stat.playerId} className="flex items-center gap-2.5 text-xs font-black">
                    <span
                      style={{ backgroundColor: stat.hex }}
                      className="w-3.5 h-3.5 rounded-full border border-[#1E293B]/20 dark:border-white/30 shrink-0"
                    />
                    <span className="text-[#1E293B] dark:text-[#F8FAFC] w-20 truncate">
                      {stat.name}
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-[#F1E8DA] dark:bg-[#0F172A] overflow-hidden">
                      <div
                        style={{
                          backgroundColor: stat.hex,
                          width: `${Math.max(5, Math.min(100, stat.percent * 2.1))}%`,
                        }}
                        className="h-full rounded-full"
                      />
                    </div>
                    <span className="text-[#1E293B] dark:text-[#F8FAFC] tabular-nums w-12 text-left">
                      {stat.percent}%
                    </span>
                  </div>
                ))}
              </div>
            }
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
        title="الخروج من التحدي؟"
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
