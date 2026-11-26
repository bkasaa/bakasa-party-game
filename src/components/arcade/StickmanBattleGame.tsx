import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Map as MapIcon, Swords } from 'lucide-react';
import { useGoHome } from '../../contexts/NavigationContext';
import { useArcadeTouchLock } from '../../hooks/useArcadeTouchLock';
import { mapScreenDeltaToLandscape, useForceLandscape } from '../../hooks/useForceLandscape';
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

interface StickmanBattleGameProps {
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

type MapId = 'ice' | 'kraken' | 'cyber' | 'volcano' | 'pirate';
type MapChoice = 'random' | MapId;
type WeaponId = 'fists' | 'saber' | 'hammer' | 'blaster' | 'axe' | 'shield';

interface MapMeta {
  id: MapId;
  name: string;
  emoji: string;
  badgeColor: string;
}

const MAPS: MapMeta[] = [
  { id: 'ice', name: 'الجليد', emoji: '❄️', badgeColor: 'bg-[#38BDF8]' },
  { id: 'kraken', name: 'الأخطبوط', emoji: '🐙', badgeColor: 'bg-[#A855F7]' },
  { id: 'cyber', name: 'الساحة المستقبلية', emoji: '⚡', badgeColor: 'bg-[#06B6D4]' },
  { id: 'volcano', name: 'البركان', emoji: '🌋', badgeColor: 'bg-[#F97316]' },
  { id: 'pirate', name: 'سفينة القراصنة', emoji: '🏴‍☠️', badgeColor: 'bg-[#D97706]' },
];

interface WeaponMeta {
  id: WeaponId;
  name: string;
  emoji: string;
  damage: number;
  knockback: number;
  reach: number;
  cooldown: number;
}

const WEAPON_DURATION_MS = 12000;

const WEAPONS: Record<WeaponId, WeaponMeta> = {
  fists: {
    id: 'fists',
    name: 'قبضة وركلة',
    emoji: '👊',
    damage: 11,
    knockback: 315,
    reach: 30,
    cooldown: 0.24,
  },
  saber: {
    id: 'saber',
    name: 'سيف الليزر',
    emoji: '⚔️',
    damage: 16,
    knockback: 390,
    reach: 54,
    cooldown: 0.28,
  },
  hammer: {
    id: 'hammer',
    name: 'المطرقة العملاقة',
    emoji: '🔨',
    damage: 25,
    knockback: 570,
    reach: 56,
    cooldown: 0.48,
  },
  blaster: {
    id: 'blaster',
    name: 'مسدس الليزر',
    emoji: '🔫',
    damage: 14,
    knockback: 310,
    reach: 38,
    cooldown: 0.44,
  },
  axe: {
    id: 'axe',
    name: 'فأس المعركة',
    emoji: '🪓',
    damage: 20,
    knockback: 465,
    reach: 62,
    cooldown: 0.36,
  },
  shield: {
    id: 'shield',
    name: 'الدرع الصادم',
    emoji: '🛡️',
    damage: 13,
    knockback: 510,
    reach: 48,
    cooldown: 0.4,
  },
};

const WEAPON_LIST: WeaponId[] = ['saber', 'hammer', 'blaster', 'axe', 'shield'];

interface WeaponTrailSample {
  handX: number;
  handY: number;
  tipX: number;
  tipY: number;
  life: number;
}

interface StickmanFighter {
  playerIdx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  weapon: WeaponId;
  weaponExpiresAt: number;
  invulnUntil: number;
  facing: number; // -1 or 1
  aimAngle: number;
  weaponWorldAngle: number;
  swingOffset: number;
  swingDir: number;
  attackCooldownUntil: number;
  clashCooldownUntil: number;
  hitFlashUntil: number;
  ragdollUntil: number;
  shieldActiveUntil: number;
  duckChargeSec: number;
  bubbleShieldUntil: number;
  shieldCharges: number;
  isDucking: boolean;
  weaponTrail: WeaponTrailSample[];
  tilt: number;
  angVel: number;
  runCycle: number;
  onGround: boolean;
  wasOnGround: boolean;
  lastGroundedAt: number;
  jumpsLeft: number;
  jumpChargeSec: number;
  koAt: number;
}

interface LaserProjectile {
  ownerIdx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

interface MysteryCrate {
  x: number;
  y: number;
  vy: number;
  landed: boolean;
  weapon: WeaponId;
  bobPhase: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
}

interface LightningFlash {
  x: number;
  y: number;
  angle: number;
  color: string;
  life: number;
  maxLife: number;
}

interface DustPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingBanner {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface BridgePlank {
  x: number;
  y: number;
  w: number;
  h: number;
  steppedTime: number;
  brokenUntil: number;
}

interface StickJoystick {
  activePointer: number | null;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
  dx: number;
  dy: number;
  mag: number;
  lastSector: number;
}

const DEFAULT_MATCH_SECONDS = 45;
const JOY_MAX_R = 38;

const SLOT_CORNER_POS: Record<CornerSlot, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

function createEmptyJoystick(): StickJoystick {
  return {
    activePointer: null,
    originX: 0,
    originY: 0,
    knobX: 0,
    knobY: 0,
    dx: 0,
    dy: 0,
    mag: 0,
    lastSector: -1,
  };
}

function getKrakenDomeY(x: number, w: number, h: number): number | null {
  const cx = w * 0.5;
  const rx = Math.min(w * 0.36, 250);
  const dx = x - cx;
  if (Math.abs(dx) > rx) return null;
  const norm = dx / rx;
  const baseTopY = h * 0.68;
  const domeHeight = Math.min(h * 0.14, 72);
  return baseTopY - domeHeight * Math.sqrt(Math.max(0, 1 - norm * norm));
}

function getPirateDeckY(x: number, w: number, h: number, timeSec: number): number | null {
  const cx = w * 0.5;
  const halfDeck = Math.min(w * 0.36, 260);
  const dx = x - cx;
  if (Math.abs(dx) > halfDeck) return null;
  const tilt = Math.sin(timeSec * 1.15) * 0.13;
  const baseY = h * 0.67;
  return baseY + dx * Math.tan(tilt);
}

interface RectPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  bounce?: boolean;
}

function getMapPlatforms(
  mapId: MapId,
  w: number,
  h: number,
  planks: BridgePlank[],
  now: number
): RectPlatform[] {
  if (mapId === 'ice') {
    const platY = h * 0.66;
    const blockH = Math.max(80, h * 0.34);
    const leftW = w * 0.25;
    const midW = w * 0.27;
    const rightW = w * 0.25;
    return [
      { x: w * 0.06, y: platY + 10, w: leftW, h: blockH },
      { x: w * 0.5 - midW * 0.5, y: platY - 12, w: midW, h: blockH + 16 },
      { x: w * 0.94 - rightW, y: platY + 8, w: rightW, h: blockH },
    ];
  }

  if (mapId === 'cyber') {
    const topY = h * 0.44;
    const botY = h * 0.69;
    const deckW = Math.min(w * 0.72, 540);
    const deckX = (w - deckW) * 0.5;
    return [
      { x: deckX + deckW * 0.08, y: topY, w: deckW * 0.84, h: 20 },
      { x: deckX, y: botY, w: deckW, h: 22 },
      // Glowing cyan bounce pads on outer bottom deck
      { x: deckX + 10, y: botY - 8, w: 46, h: 10, bounce: true },
      { x: deckX + deckW - 56, y: botY - 8, w: 46, h: 10, bounce: true },
    ];
  }

  if (mapId === 'volcano') {
    const bankY = h * 0.65;
    const bankW = w * 0.22;
    const list: RectPlatform[] = [
      { x: w * 0.06, y: bankY, w: bankW, h: h * 0.35 },
      { x: w * 0.94 - bankW, y: bankY, w: bankW, h: h * 0.35 },
    ];
    for (const p of planks) {
      if (p.brokenUntil <= now) {
        list.push({ x: p.x, y: p.y, w: p.w, h: p.h });
      }
    }
    return list;
  }

  return [];
}

function normalizeAngle(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-4) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

function segmentToSegmentDist(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number
): { dist: number; cx: number; cy: number } {
  const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  const intersect =
    ccw(a1x, a1y, b1x, b1y, b2x, b2y) !== ccw(a2x, a2y, b1x, b1y, b2x, b2y) &&
    ccw(a1x, a1y, a2x, a2y, b1x, b1y) !== ccw(a1x, a1y, a2x, a2y, b2x, b2y);

  const midX = ((a1x + a2x) * 0.5 + (b1x + b2x) * 0.5) * 0.5;
  const midY = ((a1y + a2y) * 0.5 + (b1y + b2y) * 0.5) * 0.5;
  if (intersect) {
    return { dist: 0, cx: midX, cy: midY };
  }

  const d1 = distPointToSegment(a1x, a1y, b1x, b1y, b2x, b2y);
  const d2 = distPointToSegment(a2x, a2y, b1x, b1y, b2x, b2y);
  const d3 = distPointToSegment(b1x, b1y, a1x, a1y, a2x, a2y);
  const d4 = distPointToSegment(b2x, b2y, a1x, a1y, a2x, a2y);
  return { dist: Math.min(d1, d2, d3, d4), cx: midX, cy: midY };
}

function getSolidSurfaceAtX(
  mapId: MapId,
  x: number,
  refY: number,
  w: number,
  h: number,
  timeSec: number,
  platforms: RectPlatform[]
): number | null {
  if (mapId === 'kraken') {
    const dy = getKrakenDomeY(x, w, h);
    return dy !== null && dy >= refY - 26 ? dy : null;
  }
  if (mapId === 'pirate') {
    const dy = getPirateDeckY(x, w, h, timeSec);
    return dy !== null && dy >= refY - 26 ? dy : null;
  }
  let bestY: number | null = null;
  for (const p of platforms) {
    if (p.bounce) continue;
    if (x >= p.x - 4 && x <= p.x + p.w + 4 && p.y >= refY - 22) {
      if (bestY === null || p.y < bestY) bestY = p.y;
    }
  }
  return bestY;
}

function getWeaponWorldGeometry(f: StickmanFighter) {
  const reach = WEAPONS[f.weapon].reach;
  const sinT = Math.sin(f.tilt);
  const cosT = Math.cos(f.tilt);
  const shoulderX = f.x + 12 * sinT;
  const shoulderY = f.y - 12 * cosT;
  const ang = f.weaponWorldAngle;
  const handX = shoulderX + Math.cos(ang) * 19;
  const handY = shoulderY + Math.sin(ang) * 19;
  const tipX = handX + Math.cos(ang) * reach;
  const tipY = handY + Math.sin(ang) * reach;
  return { shoulderX, shoulderY, handX, handY, tipX, tipY, ang };
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  weapon: WeaponId,
  handX: number,
  handY: number,
  angle: number,
  playerHex: string,
  timeSec: number,
  isSwinging: boolean
) {
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(angle);

  if (weapon === 'fists') {
    // Bare-handed combat fist / impact arc
    ctx.fillStyle = playerHex;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(3, 0, isSwinging ? 7.5 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isSwinging) {
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(10, 0, 14, -0.75, 0.75);
      ctx.stroke();
    }
  } else if (weapon === 'saber') {
    // Handle
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -3.5, 16, 7, 2.5);
    ctx.fill();
    ctx.stroke();

    // Glowing blade
    const bladeLen = isSwinging ? 48 : 42;
    ctx.save();
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.roundRect(7, -3.6, bladeLen, 7.2, 3.6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(8, -1.6, bladeLen - 3, 3.2, 1.6);
    ctx.fill();
    ctx.restore();
  } else if (weapon === 'hammer') {
    ctx.fillStyle = '#92400E';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-4, -3, 38, 6, 2);
    ctx.fill();
    ctx.stroke();

    // Oversized hammer head
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.roundRect(26, -16, 19, 32, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(28, -12, 15, 5);
    ctx.fillRect(28, 7, 15, 5);
  } else if (weapon === 'blaster') {
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-4, -5, 26, 10, 3);
    ctx.fill();
    ctx.stroke();
    // Glowing nozzle
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.roundRect(14, -3, 12, 6, 2);
    ctx.fill();
  } else if (weapon === 'axe') {
    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-6, -2.8, 46, 5.6, 2);
    ctx.fill();
    ctx.stroke();

    // Sharp twin axe blade
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.quadraticCurveTo(44, -18, 48, -12);
    ctx.quadraticCurveTo(43, 0, 48, 12);
    ctx.quadraticCurveTo(44, 18, 28, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(38, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (weapon === 'shield') {
    const pulse = 1 + Math.sin(timeSec * 8) * 0.08;
    ctx.save();
    ctx.fillStyle = playerHex;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(4, 0, 30 * pulse, -Math.PI * 0.65, Math.PI * 0.65);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(4, 0, 30 * pulse, -Math.PI * 0.62, Math.PI * 0.62);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, 0, 27 * pulse, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawStickmanFighter(
  ctx: CanvasRenderingContext2D,
  f: StickmanFighter,
  hex: string,
  now: number,
  timeSec: number
) {
  if (!f.alive) return;

  const isFlashing = f.hitFlashUntil > now;
  const isInvuln = f.invulnUntil > now;
  const hasBubbleShield = f.bubbleShieldUntil > now;
  const blinkAlpha = isInvuln ? 0.72 + Math.sin(now * 0.03) * 0.25 : 1;
  const bodyColor = isFlashing ? '#FFFFFF' : hex;
  const isRagdoll = f.ragdollUntil > now;
  const isSwinging = Math.abs(f.swingOffset) > 0.25;

  // Weapon motion slash trail in world coordinates
  if (f.weaponTrail.length >= 2) {
    const trailColor =
      f.weapon === 'saber'
        ? '#EF4444'
        : f.weapon === 'axe'
          ? '#38BDF8'
          : f.weapon === 'hammer'
            ? '#F59E0B'
            : hex;
    for (let i = 1; i < f.weaponTrail.length; i++) {
      const prev = f.weaponTrail[i - 1];
      const curr = f.weaponTrail[i];
      const alpha = Math.max(0, Math.min(0.42, curr.life * 2.2));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = trailColor;
      ctx.beginPath();
      ctx.moveTo(prev.handX, prev.handY);
      ctx.lineTo(prev.tipX, prev.tipY);
      ctx.lineTo(curr.tipX, curr.tipY);
      ctx.lineTo(curr.handX, curr.handY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Floating HP Bar + 12s Weapon Timer bar directly above head
  const barW = 42;
  const barH = 6.5;
  const hpRatio = Math.max(0, Math.min(1, f.hp / f.maxHp));
  const hpColor = hpRatio > 0.55 ? '#22C55E' : hpRatio > 0.28 ? '#F59E0B' : '#EF4444';
  const barX = f.x - barW * 0.5;
  const barY = f.y - (f.isDucking ? 40 : 47);

  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3, 4);
  ctx.fill();

  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 3);
  ctx.fill();

  if (hpRatio > 0) {
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(3, barW * hpRatio), barH, 3);
    ctx.fill();
  }

  // Visible weapon countdown bar directly beneath HP bar
  if (f.weapon !== 'fists' && f.weaponExpiresAt > now) {
    const wepRatio = Math.max(0, Math.min(1, (f.weaponExpiresAt - now) / WEAPON_DURATION_MS));
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(barX, barY + barH + 2, barW, 3.5, 2);
    ctx.fill();
    ctx.fillStyle = wepRatio > 0.3 ? '#38BDF8' : '#FB923C';
    ctx.beginPath();
    ctx.roundRect(barX, barY + barH + 2, Math.max(2, barW * wepRatio), 3.5, 2);
    ctx.fill();
  }
  ctx.restore();

  // Jump Charge Progress Ring (0 -> 2.0s continuous upward hold)
  if (f.jumpChargeSec > 0.08) {
    const jumpProg = Math.min(1, f.jumpChargeSec / 2.0);
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 4, 23, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(f.x, f.y - 4, 23, -Math.PI / 2, -Math.PI / 2 + jumpProg * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Ducking Shield Charge Progress Ring (0 -> 3s)
  if (f.duckChargeSec > 0.08 && !hasBubbleShield) {
    const chargeProg = Math.min(1, f.duckChargeSec / 3);
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 2, 29, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#38BDF8';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(f.x, f.y - 2, 29, -Math.PI / 2, -Math.PI / 2 + chargeProg * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Glowing Protective Energy Bubble Shield (Ground-Duck 4s Shield OR 1s Pit Respawn Invuln)
  if (hasBubbleShield || isInvuln) {
    const shieldRem = hasBubbleShield
      ? Math.max(0, (f.bubbleShieldUntil - now) / 4000)
      : Math.max(0, (f.invulnUntil - now) / 1000);
    const pulseR = 32 + Math.sin(now * 0.018) * 2.2;
    ctx.save();
    ctx.shadowColor = hasBubbleShield ? '#22D3EE' : '#38BDF8';
    ctx.shadowBlur = hasBubbleShield ? 16 : 8;
    ctx.fillStyle = hasBubbleShield
      ? 'rgba(34, 211, 238, 0.22)'
      : 'rgba(56, 189, 248, 0.16)';
    ctx.beginPath();
    ctx.arc(f.x, f.y - 4, pulseR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hasBubbleShield ? '#67E8F9' : '#38BDF8';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Countdown energy arc around bubble
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(f.x, f.y - 4, pulseR + 4, -Math.PI / 2, -Math.PI / 2 + shieldRem * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Articulated Stickman Body
  ctx.save();
  ctx.globalAlpha = blinkAlpha;
  ctx.translate(f.x, f.y + (f.isDucking ? 5 : 0));
  ctx.rotate(f.tilt);

  const hipY = f.isDucking ? 9 : 6;
  const shoulderY = f.isDucking ? -7 : -12;
  const headY = f.isDucking ? -18 : -24;

  // Compute dynamic procedural leg poses (with snappy kick pose during bare-handed swing)
  const isFistKick = f.weapon === 'fists' && isSwinging && f.swingDir < 0;
  const speedNorm = Math.min(1, Math.abs(f.vx) / 210);
  const stride = f.onGround
    ? Math.sin(f.runCycle) * (6 + 10 * speedNorm)
    : Math.sin(timeSec * 12 + f.playerIdx) * (isRagdoll ? 12 : 5);
  const liftA = f.onGround ? Math.max(0, Math.cos(f.runCycle)) * 4 * speedNorm : 3;
  const liftB = f.onGround ? Math.max(0, -Math.cos(f.runCycle)) * 4 * speedNorm : 6;

  const foot1X = isFistKick ? f.facing * 23 : stride;
  const foot1Y = isFistKick ? 4 : 23 - liftA;
  const foot2X = -stride;
  const foot2Y = 23 - liftB;

  const knee1X = foot1X * 0.55 + f.facing * 3;
  const knee1Y = (hipY + foot1Y) * 0.5;
  const knee2X = foot2X * 0.55 + f.facing * 2;
  const knee2Y = (hipY + foot2Y) * 0.5;

  // Weapon arm in local space (uses clamped world angle when available)
  const localAim = f.weaponWorldAngle - f.tilt;
  const elbowX = Math.cos(localAim - 0.15 * f.facing) * 10;
  const elbowY = shoulderY + Math.sin(localAim - 0.15 * f.facing) * 10;
  const handX = Math.cos(localAim) * 19;
  const handY = shoulderY + Math.sin(localAim) * 19;

  // Off-hand counterbalance arm
  const offAngle = isRagdoll
    ? localAim + Math.PI * 0.8 + Math.sin(timeSec * 14) * 0.5
    : Math.PI * 0.5 + f.facing * (0.65 + Math.sin(f.runCycle) * 0.35 * speedNorm);
  const offHandX = Math.cos(offAngle) * 15;
  const offHandY = shoulderY + Math.sin(offAngle) * 15;

  const strokeLimbs = (color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(0, shoulderY);
    ctx.lineTo(0, hipY);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(knee1X, knee1Y);
    ctx.lineTo(foot1X, foot1Y);
    ctx.moveTo(0, hipY);
    ctx.lineTo(knee2X, knee2Y);
    ctx.lineTo(foot2X, foot2Y);
    ctx.stroke();

    // Off arm
    ctx.beginPath();
    ctx.moveTo(0, shoulderY);
    ctx.lineTo(offHandX, offHandY);
    ctx.stroke();

    // Weapon arm
    ctx.beginPath();
    ctx.moveTo(0, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
  };

  // Dark outline pass
  strokeLimbs('#0F172A', 9.2);
  // Bright fighter color pass
  strokeLimbs(bodyColor, 5.4);

  // Secondary off-hand lightsaber for dual-saber look!
  if (f.weapon === 'saber') {
    drawWeapon(ctx, 'saber', offHandX, offHandY, offAngle, bodyColor, timeSec, isSwinging);
  }

  // Primary weapon
  drawWeapon(ctx, f.weapon, handX, handY, localAim, bodyColor, timeSec, isSwinging);

  // Head
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, headY, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Expressive Eye dot
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(f.facing * 4, headY - 1, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawArenaMap(
  ctx: CanvasRenderingContext2D,
  mapId: MapId,
  w: number,
  h: number,
  timeSec: number,
  planks: BridgePlank[],
  now: number
) {
  if (mapId === 'ice') {
    // Pale arctic sky + layered mountain silhouettes (Screenshot 1)
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#BAE6FD');
    sky.addColorStop(0.65, '#E0F2FE');
    sky.addColorStop(1, '#7DD3FC');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Shimmering arctic aurora ribbon in sky
    ctx.save();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let ax = 0; ax <= w; ax += 32) {
      const ay = h * 0.15 + Math.sin(ax * 0.015 + timeSec * 1.1) * 16;
      if (ax === 0) ctx.moveTo(ax, ay);
      else ctx.lineTo(ax, ay);
    }
    ctx.stroke();
    ctx.restore();

    // Distant jagged mountains
    ctx.fillStyle = '#93C5FD';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.56);
    ctx.lineTo(w * 0.16, h * 0.2);
    ctx.lineTo(w * 0.34, h * 0.45);
    ctx.lineTo(w * 0.54, h * 0.14);
    ctx.lineTo(w * 0.74, h * 0.42);
    ctx.lineTo(w * 0.9, h * 0.22);
    ctx.lineTo(w, h * 0.5);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Mid frozen cliff horizon
    ctx.fillStyle = '#E0F2FE';
    ctx.fillRect(0, h * 0.56, w, 14);
    ctx.fillStyle = '#60A5FA';
    ctx.fillRect(0, h * 0.56 + 14, w, 6);

    // Freezing water at bottom
    const waterY = h * 0.87;
    ctx.fillStyle = '#1D4ED8';
    ctx.fillRect(0, waterY, w, h - waterY);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(0, waterY, w, 5);

    // Textured Ice block platforms with glowing icy rim & fluffy snow caps
    const plats = getMapPlatforms('ice', w, h, planks, now);
    for (const p of plats) {
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, '#38BDF8');
      grad.addColorStop(1, '#0284C7');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y + 8, p.w, p.h, 8);
      ctx.fill();

      // Crystalline ice facets & stone/ice texture
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.18, p.y + 22);
      ctx.lineTo(p.x + p.w * 0.32, p.y + 52);
      ctx.moveTo(p.x + p.w * 0.72, p.y + 26);
      ctx.lineTo(p.x + p.w * 0.58, p.y + 62);
      ctx.stroke();

      // Glowing snow cap with top highlight rim
      ctx.save();
      ctx.shadowColor = '#BAE6FD';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(p.x - 3, p.y, p.w + 6, 18, 9);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Gentle snow specks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (let i = 0; i < 16; i++) {
      const sx = ((i * 89 + timeSec * 18) % (w + 20)) - 10;
      const sy = ((i * 67 + timeSec * (26 + (i % 4) * 8)) % (h * 0.85));
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (mapId === 'kraken') {
    // Ocean sky + sunken ship silhouette + curved maroon dome + tentacles (Screenshot 2)
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#93B5C6');
    sky.addColorStop(0.7, '#BFD6E2');
    sky.addColorStop(1, '#648CA1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sunken ship mast silhouette behind dome
    ctx.save();
    ctx.translate(w * 0.5, h * 0.49);
    ctx.rotate(-0.18);
    ctx.fillStyle = 'rgba(71, 85, 105, 0.42)';
    ctx.fillRect(-5, -60, 10, 110);
    ctx.fillRect(-38, -32, 76, 8);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.35)';
    ctx.beginPath();
    ctx.moveTo(-32, -24);
    ctx.lineTo(32, -24);
    ctx.lineTo(20, 20);
    ctx.lineTo(-24, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Giant swaying Kraken tentacles on left & right
    for (const side of [-1, 1]) {
      const baseX = side < 0 ? w * 0.13 : w * 0.87;
      const sway = Math.sin(timeSec * 1.9 + (side < 0 ? 0 : 1.7)) * 22;
      ctx.save();
      ctx.strokeStyle = '#883955';
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, h * 0.92);
      ctx.quadraticCurveTo(baseX - side * 28 + sway * 0.4, h * 0.68, baseX + side * 20 + sway, h * 0.44);
      ctx.stroke();

      ctx.strokeStyle = '#A84B6C';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(baseX, h * 0.92);
      ctx.quadraticCurveTo(baseX - side * 28 + sway * 0.4, h * 0.68, baseX + side * 20 + sway, h * 0.44);
      ctx.stroke();
      ctx.restore();
    }

    // Curved Maroon Kraken Dome Island
    const cx = w * 0.5;
    const rx = Math.min(w * 0.36, 250);
    const domeHeight = Math.min(h * 0.14, 72);
    const baseTopY = h * 0.68;

    ctx.fillStyle = '#88294B';
    ctx.beginPath();
    ctx.moveTo(cx - rx, h);
    for (let x = cx - rx; x <= cx + rx; x += 6) {
      const norm = (x - cx) / rx;
      const y = baseTopY - domeHeight * Math.sqrt(Math.max(0, 1 - norm * norm));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(cx + rx, h);
    ctx.closePath();
    ctx.fill();

    // Subtle suction spots on dome
    ctx.fillStyle = 'rgba(190, 75, 115, 0.45)';
    for (const [ox, oy, r] of [
      [-rx * 0.45, 22, 11],
      [rx * 0.4, 24, 13],
      [0, 34, 15],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + ox, baseTopY + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ocean waves at bottom
    const seaY = h * 0.86;
    ctx.fillStyle = '#3B6E8C';
    ctx.fillRect(0, seaY, w, h - seaY);
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 18) {
      const wy = seaY + Math.sin(x * 0.05 + timeSec * 3) * 3.5;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
    return;
  }

  if (mapId === 'cyber') {
    // Midnight grid + crossed glowing neon sabers + hazard-trimmed cyber decks (Screenshot 3)
    ctx.fillStyle = '#071324';
    ctx.fillRect(0, 0, w, h);

    // Subtle neon cyber grid
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.1)';
    ctx.lineWidth = 1;
    const step = 36;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Stadium floodlight beams + cyber circuit arches
    ctx.save();
    for (const sx of [w * 0.18, w * 0.82]) {
      const beam = ctx.createLinearGradient(sx, 0, w * 0.5, h * 0.72);
      beam.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      beam.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(sx - 24, 0);
      ctx.lineTo(sx + 24, 0);
      ctx.lineTo(sx + 130, h * 0.72);
      ctx.lineTo(sx - 130, h * 0.72);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Giant crossed neon sabers behind arena
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.78);
    ctx.lineTo(w * 0.64, h * 0.25);
    ctx.stroke();
    ctx.strokeStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(w * 0.66, h * 0.78);
    ctx.lineTo(w * 0.36, h * 0.25);
    ctx.stroke();

    ctx.fillStyle = '#22D3EE';
    ctx.font = '900 34px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', w * 0.5, h * 0.24);
    ctx.restore();

    // Metallic Cyber platforms with glowing cyan/gold rims & rivets
    const plats = getMapPlatforms('cyber', w, h, planks, now);
    for (const p of plats) {
      if (p.bounce) {
        ctx.save();
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#22D3EE';
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 5);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ECFEFF';
        ctx.fillRect(p.x + 6, p.y + 2, p.w - 12, 3);
      } else {
        ctx.save();
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 10;
        const deckGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
        deckGrad.addColorStop(0, '#1E293B');
        deckGrad.addColorStop(1, '#0F172A');
        ctx.fillStyle = deckGrad;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 6);
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // Hazard amber accent blocks & rivets
        ctx.fillStyle = '#F59E0B';
        for (let bx = p.x + 12; bx < p.x + p.w - 22; bx += 38) {
          ctx.fillRect(bx, p.y + 5, 18, 4);
        }
        ctx.fillStyle = '#94A3B8';
        for (let rx = p.x + 10; rx < p.x + p.w - 8; rx += 52) {
          ctx.beginPath();
          ctx.arc(rx, p.y + p.h - 5, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Cyber floor danger line
    ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
    ctx.fillRect(0, h * 0.9, w, h * 0.1);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.9);
    ctx.lineTo(w, h * 0.9);
    ctx.stroke();
    return;
  }

  if (mapId === 'volcano') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2A0A0A');
    sky.addColorStop(0.65, '#45120B');
    sky.addColorStop(1, '#7C2D12');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Distant volcano silhouette
    ctx.fillStyle = '#1C0D0D';
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.88);
    ctx.lineTo(w * 0.44, h * 0.28);
    ctx.lineTo(w * 0.56, h * 0.28);
    ctx.lineTo(w * 0.8, h * 0.88);
    ctx.closePath();
    ctx.fill();

    // Rising embers
    ctx.fillStyle = 'rgba(251, 146, 60, 0.75)';
    for (let i = 0; i < 14; i++) {
      const ex = (w * 0.1 + i * 67 + Math.sin(timeSec + i) * 18) % w;
      const ey = h - ((timeSec * 42 + i * 55) % (h * 0.85));
      ctx.beginPath();
      ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Volcanic stone ledges with glowing magma rim
    const bankY = h * 0.65;
    const bankW = w * 0.22;
    for (const bx of [w * 0.06, w * 0.94 - bankW]) {
      ctx.save();
      ctx.shadowColor = '#F97316';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#292524';
      ctx.strokeStyle = '#FB923C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(bx, bankY, bankW, h * 0.35, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Stone fissures
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + bankW * 0.3, bankY + 18);
      ctx.lineTo(bx + bankW * 0.42, bankY + 46);
      ctx.lineTo(bx + bankW * 0.36, bankY + 68);
      ctx.stroke();
    }

    // Crumbling bridge segments
    for (const p of planks) {
      if (p.brokenUntil > now) continue;
      const shake = p.steppedTime > 0.7 ? (Math.random() - 0.5) * 3 : 0;
      ctx.fillStyle = p.steppedTime > 0.7 ? '#B45309' : '#78350F';
      ctx.strokeStyle = '#1C1917';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(p.x + shake, p.y, p.w, p.h, 5);
      ctx.fill();
      ctx.stroke();
    }

    // Bubbling molten lava at bottom
    const lavaY = h * 0.87;
    const lavaGrad = ctx.createLinearGradient(0, lavaY, 0, h);
    lavaGrad.addColorStop(0, '#FB923C');
    lavaGrad.addColorStop(0.3, '#EA580C');
    lavaGrad.addColorStop(1, '#DC2626');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, lavaY, w, h - lavaY);

    ctx.fillStyle = '#FEF08A';
    for (let i = 0; i < 7; i++) {
      const bx = (w / 7) * (i + 0.5);
      const r = 4 + Math.abs(Math.sin(timeSec * 3 + i)) * 5;
      ctx.beginPath();
      ctx.arc(bx, lavaY + 4, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Map 5: Pirate Ship
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#38BDF8');
  sky.addColorStop(0.7, '#BAE6FD');
  sky.addColorStop(1, '#0EA5E9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const halfDeck = Math.min(w * 0.36, 260);
  const tilt = Math.sin(timeSec * 1.15) * 0.13;
  const baseY = h * 0.67;

  // Tilting Pirate Ship Hull & Mast
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(tilt);

  // Mast & Sail
  ctx.fillStyle = '#78350F';
  ctx.fillRect(-5, -145, 10, 145);
  ctx.fillRect(-52, -125, 104, 7);
  ctx.fillStyle = '#FFFBEB';
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-48, -118);
  ctx.quadraticCurveTo(0, -108, 48, -118);
  ctx.lineTo(38, -42);
  ctx.quadraticCurveTo(0, -34, -38, -42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Skull mark on sail
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(0, -82, 10, 0, Math.PI * 2);
  ctx.fill();

  // Wooden ship hull
  ctx.fillStyle = '#92400E';
  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-halfDeck, 0);
  ctx.lineTo(halfDeck, 0);
  ctx.lineTo(halfDeck * 0.78, 56);
  ctx.lineTo(-halfDeck * 0.78, 56);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Deck plank surface
  ctx.fillStyle = '#D97706';
  ctx.fillRect(-halfDeck, -4, halfDeck * 2, 9);
  ctx.restore();

  // Tropical ocean waves at bottom
  const waveY = h * 0.86;
  ctx.fillStyle = '#0369A1';
  ctx.fillRect(0, waveY, w, h - waveY);
  ctx.strokeStyle = '#E0F2FE';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 18) {
    const wy = waveY + Math.sin(x * 0.05 + timeSec * 3.4) * 4;
    if (x === 0) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();
}

export const StickmanBattleGame: React.FC<StickmanBattleGameProps> = ({
  players,
  onApplyDeltas,
  onExitToArcadeHub,
}) => {
  const [roundNum, setRoundNum] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number>(3);
  const [matchSeconds, setMatchSeconds] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [selectedMapChoice, setSelectedMapChoice] = useState<MapChoice>('random');
  const [activeMap, setActiveMap] = useState<MapId>('ice');
  const [roundWeapon, setRoundWeapon] = useState<WeaponId>('saber');
  const [seriesScores, setSeriesScores] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_MATCH_SECONDS);
  const [hpSnapshot, setHpSnapshot] = useState<number[]>(() => players.map(() => 100));
  const [shieldChargesSnapshot, setShieldChargesSnapshot] = useState<number[]>(() =>
    players.map(() => 2)
  );
  const [roundDeltas, setRoundDeltas] = useState<ArcadeDelta[]>([]);
  const [finalSeriesDeltas, setFinalSeriesDeltas] = useState<ArcadeDelta[]>([]);
  const [seriesWinners, setSeriesWinners] = useState<ArcadePlayer[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());
  const [, setJoyRenderTick] = useState<number>(0);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaSizeRef = useRef<{ w: number; h: number }>({ w: 800, h: 420 });

  const fightersRef = useRef<StickmanFighter[]>([]);
  const projectilesRef = useRef<LaserProjectile[]>([]);
  const cratesRef = useRef<MysteryCrate[]>([]);
  const sparksRef = useRef<SparkParticle[]>([]);
  const dustRef = useRef<DustPuff[]>([]);
  const shockwavesRef = useRef<ShockwaveRing[]>([]);
  const lightningRef = useRef<LightningFlash[]>([]);
  const bannersRef = useRef<FloatingBanner[]>([]);
  const planksRef = useRef<BridgePlank[]>([]);
  const joysticksRef = useRef<StickJoystick[]>(players.map(() => createEmptyJoystick()));

  const activeMapRef = useRef<MapId>('ice');
  const roundStartRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(DEFAULT_MATCH_SECONDS);
  const hitStopUntilRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);
  const nextCrateAtRef = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);
  const koCelebrateAtRef = useRef<number | null>(null);

  const placements = getCornerPlacements(players.length);
  const goHome = useGoHome();
  const isRoundActive = phase === 'COUNTDOWN' || phase === 'PLAYING' || phase === 'INTER_ROUND';
  const isArenaMounted = phase === 'COUNTDOWN' || phase === 'PLAYING';
  const { isRotatedPortrait } = useForceLandscape(isRoundActive);

  useNavigationGuard(isRoundActive, () => setShowExitConfirm(true));
  useArcadeTouchLock(isRoundActive, arenaRef);

  useEffect(() => {
    return soundManager.subscribe(setMuted);
  }, []);

  // Sync landscape arena dimensions cleanly whenever orientation or viewport size changes
  useEffect(() => {
    if (!isArenaMounted) return;

    const handleResize = () => {
      const el = arenaRef.current;
      if (el) {
        arenaSizeRef.current = {
          w: Math.max(320, Math.round(el.clientWidth)),
          h: Math.max(320, Math.round(el.clientHeight)),
        };
      }
    };
    const raf = window.requestAnimationFrame(handleResize);
    const ro = new ResizeObserver(handleResize);
    if (arenaRef.current) ro.observe(arenaRef.current);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isArenaMounted, isRotatedPortrait]);

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
      w: Math.max(320, Math.round(el.clientWidth)),
      h: Math.max(320, Math.round(el.clientHeight)),
    };
  }, []);

  const spawnSparks = useCallback((x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      if (sparksRef.current.length + dustRef.current.length >= 60) {
        if (sparksRef.current.length > 0) sparksRef.current.shift();
        else dustRef.current.shift();
      }
      const a = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 220;
      const life = 0.25 + Math.random() * 0.25;
      sparksRef.current.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        size: 2.2 + Math.random() * 2.5,
        life,
        maxLife: life,
      });
    }
  }, []);

  const spawnDust = useCallback((x: number, y: number, count = 6, color = 'rgba(226, 232, 240, 0.85)') => {
    for (let i = 0; i < count; i++) {
      if (sparksRef.current.length + dustRef.current.length >= 60) {
        if (dustRef.current.length > 0) dustRef.current.shift();
        else sparksRef.current.shift();
      }
      const life = 0.25 + Math.random() * 0.22;
      dustRef.current.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 85,
        vy: -18 - Math.random() * 48,
        radius: 4 + Math.random() * 5,
        color,
        life,
        maxLife: life,
      });
    }
  }, []);

  const resetRoundState = useCallback(() => {
    syncArenaSize();
    const { w, h } = arenaSizeRef.current;

    const chosenMap: MapId =
      selectedMapChoice === 'random'
        ? MAPS[(roundNum - 1 + Math.floor(Math.random() * MAPS.length)) % MAPS.length].id
        : selectedMapChoice;
    activeMapRef.current = chosenMap;
    setActiveMap(chosenMap);

    const chosenWeapon: WeaponId = WEAPON_LIST[Math.floor(Math.random() * WEAPON_LIST.length)];
    setRoundWeapon(chosenWeapon);

    // Setup volcano bridge planks if volcano map
    if (chosenMap === 'volcano') {
      const bankW = w * 0.22;
      const gapStart = w * 0.06 + bankW + 4;
      const gapEnd = w * 0.94 - bankW - 4;
      const span = Math.max(80, gapEnd - gapStart);
      const count = 4;
      const plankW = span / count - 5;
      const list: BridgePlank[] = [];
      for (let i = 0; i < count; i++) {
        list.push({
          x: gapStart + i * (plankW + 5),
          y: h * 0.65,
          w: plankW,
          h: 16,
          steppedTime: 0,
          brokenUntil: 0,
        });
      }
      planksRef.current = list;
    } else {
      planksRef.current = [];
    }

    // Spawn 2-4 stickmen evenly spaced across safe platforms
    const spawnXs =
      players.length === 2
        ? [w * 0.28, w * 0.72]
        : players.length === 3
          ? [w * 0.24, w * 0.5, w * 0.76]
          : [w * 0.2, w * 0.4, w * 0.6, w * 0.8];

    const startY = chosenMap === 'cyber' ? h * 0.36 : h * 0.46;

    fightersRef.current = players.map((_, idx) => {
      const sx = spawnXs[idx] ?? w * 0.5;
      const facing = sx < w * 0.5 ? 1 : -1;
      const initAim = facing > 0 ? 0 : Math.PI;
      return {
        playerIdx: idx,
        x: sx,
        y: startY,
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        alive: true,
        weapon: chosenWeapon,
        weaponExpiresAt: performance.now() + WEAPON_DURATION_MS + 1800,
        invulnUntil: 0,
        facing,
        aimAngle: initAim,
        weaponWorldAngle: initAim,
        swingOffset: 0,
        swingDir: 1,
        attackCooldownUntil: 0,
        clashCooldownUntil: 0,
        hitFlashUntil: 0,
        ragdollUntil: 0,
        shieldActiveUntil: 0,
        duckChargeSec: 0,
        bubbleShieldUntil: 0,
        shieldCharges: 2,
        isDucking: false,
        weaponTrail: [],
        tilt: 0,
        angVel: 0,
        runCycle: idx * 1.1,
        onGround: false,
        wasOnGround: false,
        lastGroundedAt: 0,
        jumpsLeft: 2,
        jumpChargeSec: 0,
        koAt: 0,
      };
    });

    projectilesRef.current = [];
    cratesRef.current = [];
    sparksRef.current = [];
    dustRef.current = [];
    shockwavesRef.current = [];
    lightningRef.current = [];
    bannersRef.current = [];
    joysticksRef.current = players.map(() => createEmptyJoystick());
    hitStopUntilRef.current = 0;
    screenShakeRef.current = 0;
    koCelebrateAtRef.current = null;
    finishedRef.current = false;
    setHpSnapshot(players.map(() => 100));
    setShieldChargesSnapshot(players.map(() => 2));
  }, [players, roundNum, selectedMapChoice, syncArenaSize]);

  const finishRound = useCallback(
    (winnerIdx?: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const fighters = fightersRef.current;
      const winnerIds = new Set<string>();
      let headline = `انتهت الجولة ${roundNum}!`;

      if (typeof winnerIdx === 'number' && players[winnerIdx]) {
        winnerIds.add(players[winnerIdx].id);
        headline = `الناجي الأخير (جولة ${roundNum}): ${players[winnerIdx].name}!`;
      } else {
        const aliveFighters = fighters.filter((f) => f.alive);
        const pool = aliveFighters.length > 0 ? aliveFighters : fighters;
        const bestHp = Math.max(...pool.map((f) => f.hp));
        const champs = pool.filter((f) => f.hp === bestHp && bestHp > 0);
        champs.forEach((c) => winnerIds.add(players[c.playerIdx].id));
        if (champs.length === 1) {
          headline = `الفائز (جولة ${roundNum}): ${players[champs[0].playerIdx].name}!`;
        } else if (champs.length > 1) {
          headline = `تعادل في الجولة ${roundNum}!`;
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
            ? `أبطال حرب الستيك مان (${totalRounds} جولات): ${champs.map((c) => c.name).join(' و ')}`
            : champs.length === 1
              ? `بطل حرب الستيك مان: ${champs[0].name}!`
              : `انتهى تحدي الستيك مان!`;
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      const timeSec = now / 1000;
      ctx.save();
      ctx.scale(dpr, dpr);

      // Canvas-level screen shake decay transform
      const shakeMag = screenShakeRef.current;
      if (shakeMag > 0.25) {
        const sx = (Math.random() - 0.5) * 2 * shakeMag;
        const sy = (Math.random() - 0.5) * 2 * shakeMag;
        ctx.translate(sx, sy);
      }

      drawArenaMap(ctx, activeMapRef.current, w, h, timeSec, planksRef.current, now);

      // Mystery parachute weapon crates
      for (const crate of cratesRef.current) {
        ctx.save();
        ctx.translate(crate.x, crate.y + (crate.landed ? Math.sin(timeSec * 4 + crate.bobPhase) * 3 : 0));

        if (!crate.landed) {
          ctx.fillStyle = '#FACC15';
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, -24, 16, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-14, -24);
          ctx.lineTo(-7, -9);
          ctx.moveTo(14, -24);
          ctx.lineTo(7, -9);
          ctx.stroke();
        }

        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-12, -12, 24, 24, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 13px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 1);
        ctx.restore();
      }

      // Stickmen fighters
      for (const f of fightersRef.current) {
        const theme = ARCADE_COLORS[players[f.playerIdx].colorId];
        drawStickmanFighter(ctx, f, theme.hex, now, timeSec);
      }

      // Blaster laser projectiles
      for (const proj of projectilesRef.current) {
        ctx.save();
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        const norm = Math.hypot(proj.vx, proj.vy) || 1;
        ctx.beginPath();
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.x - (proj.vx / norm) * 18, proj.y - (proj.vy / norm) * 18);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Shockwaves
      for (const sw of shockwavesRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sw.life);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Sharp yellow/white lightning clash flashes (Supreme Duelist clash effect)
      for (const lf of lightningRef.current) {
        ctx.save();
        ctx.translate(lf.x, lf.y);
        ctx.rotate(lf.angle);
        ctx.globalAlpha = Math.max(0, lf.life / lf.maxLife);
        ctx.fillStyle = lf.color;
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-4, -26);
        ctx.lineTo(10, -5);
        ctx.lineTo(2, -3);
        ctx.lineTo(13, 24);
        ctx.lineTo(-9, 3);
        ctx.lineTo(-1, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Dynamic dust puffs behind fighters (jumps, landings, dashes)
      for (const dp of dustRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, (dp.life / dp.maxLife) * 0.65);
        ctx.fillStyle = dp.color;
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, dp.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Impact sparks
      for (const sp of sparksRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Floating weapon / KO banners
      for (const b of bannersRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, b.life);
        ctx.font = '900 16px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 4;
        ctx.strokeText(b.text, b.x, b.y);
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, b.x, b.y);
        ctx.restore();
      }

      ctx.restore();
    },
    [players]
  );

  // Countdown sequence
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    resetRoundState();
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
      nextCrateAtRef.current = now + 5200;
      fightersRef.current.forEach((f) => {
        if (f.weapon !== 'fists') {
          f.weaponExpiresAt = now + WEAPON_DURATION_MS;
        }
      });
      setPhase('PLAYING');
    }, 1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase, matchSeconds, resetRoundState, drawScene]);

  // Inter-round pause auto advance
  useEffect(() => {
    if (phase !== 'INTER_ROUND') return;
    const t = window.setTimeout(() => {
      setRoundNum((prev) => prev + 1);
      setPhase('COUNTDOWN');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // 60fps ragdoll combat simulation
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    let rafId = 0;
    const step = (now: number) => {
      const rawDt = Math.min(0.04, Math.max(0.001, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      // Hit-stop freeze frame on heavy impacts
      if (now < hitStopUntilRef.current) {
        drawScene(now);
        rafId = window.requestAnimationFrame(step);
        return;
      }

      const dt = rawDt;
      const elapsedSec = (now - roundStartRef.current) / 1000;
      const timeSec = now / 1000;
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
        finishRound();
        return;
      }

      // Smooth canvas screen shake decay
      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - 38 * dt);
      }

      const { w, h } = arenaSizeRef.current;
      const mapId = activeMapRef.current;

      // Spawn periodic mystery weapon crate
      if (now >= nextCrateAtRef.current && cratesRef.current.length < 2) {
        nextCrateAtRef.current = now + 6800;
        const dropWeapon = WEAPON_LIST[Math.floor(Math.random() * WEAPON_LIST.length)];
        cratesRef.current.push({
          x: w * 0.24 + Math.random() * (w * 0.52),
          y: 28,
          vy: 56,
          landed: false,
          weapon: dropWeapon,
          bobPhase: Math.random() * Math.PI * 2,
        });
      }

      // Update bridge planks for volcano map
      if (mapId === 'volcano') {
        for (const p of planksRef.current) {
          if (p.brokenUntil > 0 && p.brokenUntil <= now) {
            p.brokenUntil = 0;
            p.steppedTime = 0;
          }
        }
      }

      const platforms = getMapPlatforms(mapId, w, h, planksRef.current, now);
      const gravity = 910;
      const footOffset = 23;

      // 1. Weapon 12s expiration + Movement, platform collisions, coyote time & PD upright balance
      for (const f of fightersRef.current) {
        if (!f.alive) continue;

        if (f.weapon !== 'fists' && f.weaponExpiresAt > 0 && now >= f.weaponExpiresAt) {
          f.weapon = 'fists';
          f.weaponExpiresAt = 0;
          bannersRef.current.push({
            x: f.x,
            y: f.y - 42,
            text: 'انتهى السلاح! 👊',
            color: '#FDE047',
            life: 1.0,
          });
        }

        const joy = joysticksRef.current[f.playerIdx];
        const isRagdoll = f.ragdollUntil > now;
        const canCoyoteJump = f.onGround || (now - f.lastGroundedAt <= 115 && f.jumpsLeft === 2);
        const moveAccel = f.onGround ? (mapId === 'ice' ? 480 : 1480) : 820;
        const maxRun = mapId === 'ice' ? 280 : 246;

        if (joy && joy.mag > 0.06) {
          if (!isRagdoll) {
            const horizScale = f.onGround && joy.dy > 0.6 ? 0.35 : 1;
            f.vx += joy.dx * moveAccel * horizScale * dt;
            if (Math.abs(joy.dx) > 0.12) {
              f.facing = joy.dx >= 0 ? 1 : -1;
            }
          }
          f.aimAngle = Math.atan2(joy.dy, joy.dx);

          // 2.0-second continuous upward hold jump (dy < -0.6 while mag > 0.45)
          const holdingJumpUp = !isRagdoll && joy.mag > 0.45 && joy.dy < -0.6;
          if (holdingJumpUp && (canCoyoteJump || f.jumpsLeft > 0)) {
            f.jumpChargeSec += dt;
            if (f.jumpChargeSec >= 2.0) {
              f.jumpChargeSec = 0;
              const isGroundJump = canCoyoteJump;
              f.vy = isGroundJump ? -495 : -445;
              f.onGround = false;
              f.jumpsLeft = isGroundJump ? 1 : 0;
              soundManager.play('bounce');
              triggerHaptic(22);
              spawnDust(f.x, f.y + 22, 7);
              spawnSparks(f.x, f.y + 18, '#FACC15', 5);
              if (!isGroundJump) {
                shockwavesRef.current.push({
                  x: f.x,
                  y: f.y + 20,
                  radius: 6,
                  maxRadius: 28,
                  color: '#FACC15',
                  life: 0.75,
                });
              }
            }
          } else {
            f.jumpChargeSec = 0;
          }
        } else {
          f.jumpChargeSec = 0;
        }

        // Ground-Duck Energy Shield (hold dy > 0.6 while on solid ground for 3 continuous seconds -> 4s bubble shield, 2/2 uses)
        const holdingDuck =
          f.onGround &&
          !isRagdoll &&
          Boolean(joy && joy.mag > 0.45 && joy.dy > 0.6);
        f.isDucking = holdingDuck;
        if (holdingDuck && f.bubbleShieldUntil <= now && f.shieldCharges > 0) {
          f.duckChargeSec += dt;
          if (f.duckChargeSec >= 3.0) {
            f.duckChargeSec = 0;
            f.shieldCharges -= 1;
            f.bubbleShieldUntil = now + 4000;
            soundManager.play('powerup');
            triggerHaptic([25, 30, 35]);
            spawnSparks(f.x, f.y - 4, '#22D3EE', 16);
            shockwavesRef.current.push({
              x: f.x,
              y: f.y - 4,
              radius: 14,
              maxRadius: 68,
              color: '#22D3EE',
              life: 1,
            });
            bannersRef.current.push({
              x: f.x,
              y: f.y - 48,
              text: `درع الطاقة! 🛡️ (${f.shieldCharges}/٢)`,
              color: '#67E8F9',
              life: 1.3,
            });
          }
        } else {
          f.duckChargeSec = 0;
        }

        // Running dust puffs
        if (f.onGround && Math.abs(f.vx) > 155 && Math.random() < 0.28) {
          spawnDust(f.x - Math.sign(f.vx) * 8, f.y + 21, 1);
        }

        // Pirate ship slope drift
        if (mapId === 'pirate' && f.onGround) {
          const shipTilt = Math.sin(timeSec * 1.15) * 0.13;
          f.vx += Math.sin(shipTilt) * 360 * dt;
        }

        // Kraken dome slope slide near edges
        if (mapId === 'kraken' && f.onGround) {
          const offsetNorm = (f.x - w * 0.5) / Math.min(w * 0.36, 250);
          f.vx += offsetNorm * 140 * dt;
        }

        // Horizontal friction
        const drag = f.onGround ? (mapId === 'ice' ? 0.968 : 0.82) : 0.965;
        f.vx *= Math.pow(drag, dt * 60);
        if (
          !isRagdoll &&
          Math.abs(f.vx) > maxRun &&
          (!joy || joy.mag < 0.05 || Math.sign(f.vx) === Math.sign(joy.dx))
        ) {
          f.vx = Math.sign(f.vx) * Math.max(maxRun, Math.abs(f.vx) * 0.93);
        }

        // Gravity & integration
        f.vy += gravity * dt;
        const prevX = f.x;
        const prevY = f.y;
        f.x += f.vx * dt;
        f.y += f.vy * dt;

        // Horizontal soft bounds
        if (f.x < 18) {
          f.x = 18;
          f.vx = Math.abs(f.vx) * 0.4;
        } else if (f.x > w - 18) {
          f.x = w - 18;
          f.vx = -Math.abs(f.vx) * 0.4;
        }

        // Ceiling soft clamp
        if (f.y < 36) {
          f.y = 36;
          if (f.vy < 0) f.vy = 0;
        }

        // Solid side-wall blocking on thick terrain blocks (icebergs & volcano ledges)
        if (mapId === 'ice' || mapId === 'volcano') {
          const fighterHalfW = 11;
          for (const plat of platforms) {
            if (plat.h < 50) continue; // thin bridges only block from top
            const torsoInBlockY = f.y + footOffset > plat.y + 8 && f.y - 16 < plat.y + plat.h;
            if (torsoInBlockY && f.x + fighterHalfW > plat.x && f.x - fighterHalfW < plat.x + plat.w) {
              if (prevX + fighterHalfW <= plat.x + 6) {
                f.x = plat.x - fighterHalfW;
                f.vx = Math.min(0, -Math.abs(f.vx) * 0.35);
              } else if (prevX - fighterHalfW >= plat.x + plat.w - 6) {
                f.x = plat.x + plat.w + fighterHalfW;
                f.vx = Math.max(0, Math.abs(f.vx) * 0.35);
              }
            }
          }
        }

        // Ground collision by active map
        f.wasOnGround = f.onGround;
        f.onGround = false;

        if (mapId === 'kraken') {
          const domeY = getKrakenDomeY(f.x, w, h);
          if (domeY !== null && f.y + footOffset >= domeY && prevY + footOffset <= domeY + 26 && f.vy >= 0) {
            f.y = domeY - footOffset;
            f.vy = 0;
            f.onGround = true;
            f.lastGroundedAt = now;
            f.jumpsLeft = 2;
          }
        } else if (mapId === 'pirate') {
          const deckY = getPirateDeckY(f.x, w, h, timeSec);
          if (deckY !== null && f.y + footOffset >= deckY && prevY + footOffset <= deckY + 28 && f.vy >= 0) {
            f.y = deckY - footOffset;
            f.vy = 0;
            f.onGround = true;
            f.lastGroundedAt = now;
            f.jumpsLeft = 2;
          }
        } else {
          for (const plat of platforms) {
            const withinX = f.x >= plat.x - 9 && f.x <= plat.x + plat.w + 9;
            if (
              withinX &&
              f.vy >= 0 &&
              prevY + footOffset <= plat.y + 16 &&
              f.y + footOffset >= plat.y
            ) {
              f.y = plat.y - footOffset;
              if (plat.bounce) {
                f.vy = -660;
                f.onGround = false;
                f.jumpsLeft = 2;
                soundManager.play('bounce');
                spawnDust(f.x, plat.y, 7, 'rgba(103, 232, 249, 0.85)');
                shockwavesRef.current.push({
                  x: f.x,
                  y: plat.y,
                  radius: 10,
                  maxRadius: 42,
                  color: '#22D3EE',
                  life: 1,
                });
              } else {
                f.vy = 0;
                f.onGround = true;
                f.lastGroundedAt = now;
                f.jumpsLeft = 2;
              }
            }
          }
        }
        if (f.onGround && !f.wasOnGround) {
          spawnDust(f.x, f.y + footOffset, 5);
        }

        // Volcano bridge plank wear when stood upon
        if (mapId === 'volcano' && f.onGround) {
          for (const p of planksRef.current) {
            if (p.brokenUntil <= now && f.x >= p.x && f.x <= p.x + p.w && Math.abs(f.y + footOffset - p.y) < 10) {
              p.steppedTime += dt;
              if (p.steppedTime >= 1.5) {
                p.brokenUntil = now + 4200;
                soundManager.play('shatter');
                spawnSparks(p.x + p.w * 0.5, p.y + 8, '#F97316', 10);
              }
            }
          }
        }

        // Kraken swaying tentacle bump hazard on far edges
        if (mapId === 'kraken') {
          for (const side of [-1, 1]) {
            const baseX = side < 0 ? w * 0.13 : w * 0.87;
            const sway = Math.sin(timeSec * 1.9 + (side < 0 ? 0 : 1.7)) * 22;
            const tipX = baseX + side * 20 + sway;
            const tipY = h * 0.56;
            if (Math.hypot(f.x - tipX, f.y - tipY) < 34) {
              f.vx = -side * 250;
              f.vy = -220;
              f.ragdollUntil = Math.max(f.ragdollUntil, now + 240);
            }
          }
        }

        // PD Spring-Damper Upright Controller + Smooth Ragdoll Recovery
        if (isRagdoll) {
          f.tilt = normalizeAngle(f.tilt + f.angVel * dt);
          f.angVel *= Math.pow(0.975, dt * 60);
        } else {
          const slopeLean = mapId === 'pirate' && f.onGround ? Math.sin(timeSec * 1.15) * 0.12 : 0;
          const moveLean = Math.max(-0.22, Math.min(0.22, f.vx * 0.00095));
          const targetTilt = slopeLean + moveLean;
          const tiltError = normalizeAngle(targetTilt - f.tilt);
          const springK = f.onGround ? 155 : 75;
          const damper = f.onGround ? 17.5 : 11.5;
          f.angVel += (tiltError * springK - f.angVel * damper) * dt;
          f.tilt = normalizeAngle(f.tilt + f.angVel * dt);
        }

        if (f.onGround && Math.abs(f.vx) > 15) {
          f.runCycle += Math.abs(f.vx) * 0.045 * dt;
        }

        // Spring swing offset back to neutral
        f.swingOffset *= Math.pow(0.84, dt * 60);

        // Compute clamped weaponWorldAngle so melee weapons never clip into platforms/domes/decks
        let desiredWorldAngle = f.aimAngle + f.swingOffset;
        if (f.weapon === 'saber' || f.weapon === 'hammer' || f.weapon === 'axe') {
          const reachLen = 19 + WEAPONS[f.weapon].reach;
          const shoulderX = f.x + 12 * Math.sin(f.tilt);
          const shoulderY = f.y - 12 * Math.cos(f.tilt);
          const rawTipX = shoulderX + Math.cos(desiredWorldAngle) * reachLen;
          const rawTipY = shoulderY + Math.sin(desiredWorldAngle) * reachLen;
          const groundY = getSolidSurfaceAtX(mapId, rawTipX, f.y - 10, w, h, timeSec, platforms);
          if (groundY !== null && rawTipY > groundY - 3) {
            const dyLimit = groundY - 3 - shoulderY;
            const sinCap = Math.max(-0.98, Math.min(0.98, dyLimit / reachLen));
            const cosSign = Math.cos(desiredWorldAngle) >= 0 ? 1 : -1;
            const maxDownAngle =
              cosSign >= 0 ? Math.asin(sinCap) : Math.PI - Math.asin(sinCap);
            desiredWorldAngle = maxDownAngle;
            if (Math.abs(f.swingOffset) > 0.55 && Math.random() < 0.35) {
              spawnSparks(rawTipX, groundY - 3, '#FDE047', 2);
            }
          }
        }
        f.weaponWorldAngle = desiredWorldAngle;

        // Update animated weapon slash trail
        f.weaponTrail = f.weaponTrail
          .map((t) => ({ ...t, life: t.life - dt }))
          .filter((t) => t.life > 0);
        if (Math.abs(f.swingOffset) > 0.2 && f.weapon !== 'blaster' && f.weapon !== 'shield') {
          const wg = getWeaponWorldGeometry(f);
          f.weaponTrail.push({
            handX: wg.handX,
            handY: wg.handY,
            tipX: wg.tipX,
            tipY: wg.tipY,
            life: 0.16,
          });
          if (f.weaponTrail.length > 7) {
            f.weaponTrail.shift();
          }
        }
      }

      // 2. Weapon-vs-Weapon mid-air clash deflection + lightning clash flash
      for (let i = 0; i < fightersRef.current.length; i++) {
        const a = fightersRef.current[i];
        if (!a.alive || a.weapon === 'blaster' || a.weapon === 'shield' || a.weapon === 'fists') continue;
        for (let j = i + 1; j < fightersRef.current.length; j++) {
          const b = fightersRef.current[j];
          if (!b.alive || b.weapon === 'blaster' || b.weapon === 'shield' || b.weapon === 'fists') continue;
          if (now < a.clashCooldownUntil || now < b.clashCooldownUntil) continue;
          const eitherSwinging = Math.abs(a.swingOffset) > 0.16 || Math.abs(b.swingOffset) > 0.16;
          if (!eitherSwinging) continue;

          const ga = getWeaponWorldGeometry(a);
          const gb = getWeaponWorldGeometry(b);
          const seg = segmentToSegmentDist(
            ga.handX,
            ga.handY,
            ga.tipX,
            ga.tipY,
            gb.handX,
            gb.handY,
            gb.tipX,
            gb.tipY
          );
          if (seg.dist <= 13) {
            a.clashCooldownUntil = now + 260;
            b.clashCooldownUntil = now + 260;
            const pushDir = a.x <= b.x ? -1 : 1;
            a.vx = pushDir * 240;
            b.vx = -pushDir * 240;
            a.vy = Math.min(a.vy, -120);
            b.vy = Math.min(b.vy, -120);
            a.swingOffset = -a.swingOffset * 0.7;
            b.swingOffset = -b.swingOffset * 0.7;
            hitStopUntilRef.current = now + 42;
            screenShakeRef.current = Math.max(screenShakeRef.current, 7.5);
            soundManager.play('clash');
            triggerHaptic(24);
            spawnSparks(seg.cx, seg.cy, '#FDE047', 12);
            spawnSparks(seg.cx, seg.cy, '#FB923C', 6);
            lightningRef.current.push({
              x: seg.cx,
              y: seg.cy,
              angle: (Math.random() - 0.5) * 0.9,
              color: '#FACC15',
              life: 0.24,
              maxLife: 0.24,
            });
          }
        }
      }

      // 3. Fighter Attacks (Segment-to-Capsule melee & Fists & Blaster & Shield) + Pit Bounce
      for (const f of fightersRef.current) {
        if (!f.alive) continue;
        const joy = joysticksRef.current[f.playerIdx];
        const isRagdoll = f.ragdollUntil > now;
        const wMeta = WEAPONS[f.weapon];

        if (joy && joy.mag > 0.22 && now >= f.attackCooldownUntil && !isRagdoll) {
          if (f.weapon === 'blaster') {
            f.attackCooldownUntil = now + wMeta.cooldown * 1000;
            const theme = ARCADE_COLORS[players[f.playerIdx].colorId];
            const muzzleX = f.x + Math.cos(f.aimAngle) * 26;
            const muzzleY = f.y - 12 + Math.sin(f.aimAngle) * 26;
            projectilesRef.current.push({
              ownerIdx: f.playerIdx,
              x: muzzleX,
              y: muzzleY,
              vx: Math.cos(f.aimAngle) * 510,
              vy: Math.sin(f.aimAngle) * 510,
              color: theme.hex,
              life: 1.5,
            });
            f.swingOffset = -0.35 * f.facing;
            soundManager.play('laser');
          } else if (f.weapon === 'shield') {
            f.shieldActiveUntil = now + 220;
          } else {
            const hasTargetNear = fightersRef.current.some(
              (other) =>
                other.alive &&
                other.playerIdx !== f.playerIdx &&
                Math.hypot(other.x - f.x, other.y - f.y) <= wMeta.reach + 32
            );
            if (hasTargetNear || joy.mag > 0.62) {
              f.attackCooldownUntil = now + wMeta.cooldown * 1000;
              f.swingDir = -f.swingDir;
              f.swingOffset = 1.45 * f.swingDir;
              f.weaponWorldAngle = f.aimAngle + f.swingOffset;
              soundManager.play('slash');

              const wg = getWeaponWorldGeometry(f);
              for (const target of fightersRef.current) {
                if (!target.alive || target.playerIdx === f.playerIdx) continue;
                // Capsule distance from weapon segment (hand -> tip) to target body (head -> hips)
                const segHit = segmentToSegmentDist(
                  wg.handX,
                  wg.handY,
                  wg.tipX,
                  wg.tipY,
                  target.x,
                  target.y - 24,
                  target.x,
                  target.y + 12
                );
                if (segHit.dist <= 20) {
                  if (target.invulnUntil > now) continue;
                  const isShielding =
                    target.bubbleShieldUntil > now ||
                    (target.weapon === 'shield' && target.shieldActiveUntil + 220 > now);
                  if (isShielding) {
                    const deflectAngle = Math.atan2(f.y - target.y, f.x - target.x);
                    f.vx = Math.cos(deflectAngle) * 390;
                    f.vy = -215;
                    soundManager.play('clash');
                    screenShakeRef.current = Math.max(screenShakeRef.current, 6);
                    spawnSparks(segHit.cx, segHit.cy, '#38BDF8', 12);
                    bannersRef.current.push({
                      x: target.x,
                      y: target.y - 44,
                      text: 'محمي! 🛡️',
                      color: '#67E8F9',
                      life: 0.85,
                    });
                    shockwavesRef.current.push({
                      x: target.x,
                      y: target.y - 8,
                      radius: 14,
                      maxRadius: 56,
                      color: '#38BDF8',
                      life: 1,
                    });
                    continue;
                  }

                  const knockAngle = Math.atan2(target.y - f.y - 12, target.x - f.x);
                  const dmg = wMeta.damage;
                  target.hp = Math.max(0, target.hp - dmg);
                  target.hitFlashUntil = now + 135;
                  target.ragdollUntil = now + (f.weapon === 'hammer' ? 480 : 300);
                  target.vx = Math.cos(knockAngle) * wMeta.knockback;
                  target.vy = Math.min(-215, Math.sin(knockAngle) * wMeta.knockback * 0.7 - 155);
                  target.angVel = Math.sign(target.vx || 1) * (f.weapon === 'hammer' ? 14 : 9.5);
                  spawnDust(target.x, target.y, 6);

                  hitStopUntilRef.current = now + (f.weapon === 'hammer' ? 54 : 38);
                  screenShakeRef.current = Math.max(
                    screenShakeRef.current,
                    f.weapon === 'hammer' ? 11 : 6
                  );
                  soundManager.play(f.weapon === 'saber' ? 'clash' : 'hit');
                  triggerHaptic(f.weapon === 'hammer' ? 35 : 20);

                  bannersRef.current.push({
                    x: target.x + (Math.random() - 0.5) * 14,
                    y: target.y - 38,
                    text: `-${dmg}${dmg >= 20 ? ' 💥' : ''}`,
                    color: dmg >= 20 ? '#F97316' : '#FCA5A5',
                    life: 0.95,
                  });

                  spawnSparks(
                    segHit.cx,
                    segHit.cy,
                    f.weapon === 'saber' ? '#EF4444' : '#FACC15',
                    14
                  );
                  if (f.weapon === 'saber' || f.weapon === 'hammer') {
                    lightningRef.current.push({
                      x: segHit.cx,
                      y: segHit.cy,
                      angle: (Math.random() - 0.5) * 0.7,
                      color: '#FDE047',
                      life: 0.22,
                      maxLife: 0.22,
                    });
                  }
                  shockwavesRef.current.push({
                    x: target.x,
                    y: target.y - 8,
                    radius: 8,
                    maxRadius: f.weapon === 'hammer' ? 58 : 38,
                    color: '#FDE047',
                    life: 1,
                  });

                  if (target.hp <= 0) {
                    target.alive = false;
                    target.koAt = now;
                    screenShakeRef.current = Math.max(screenShakeRef.current, 14);
                    soundManager.play('explosion');
                    spawnSparks(target.x, target.y, ARCADE_COLORS[players[target.playerIdx].colorId].hex, 24);
                    bannersRef.current.push({
                      x: target.x,
                      y: target.y - 26,
                      text: 'K.O! 💥',
                      color: '#FACC15',
                      life: 1.2,
                    });
                  }
                }
              }
            }
          }
        }

        // Energy Shield close-range shock push
        if (f.weapon === 'shield' && f.shieldActiveUntil > now && now >= f.attackCooldownUntil) {
          for (const target of fightersRef.current) {
            if (
              !target.alive ||
              target.playerIdx === f.playerIdx ||
              target.invulnUntil > now ||
              target.bubbleShieldUntil > now
            ) {
              continue;
            }
            if (Math.hypot(target.x - f.x, target.y - f.y) < 52) {
              f.attackCooldownUntil = now + 450;
              const angle = Math.atan2(target.y - f.y - 10, target.x - f.x);
              target.hp = Math.max(0, target.hp - WEAPONS.shield.damage);
              target.vx = Math.cos(angle) * WEAPONS.shield.knockback;
              target.vy = -245;
              target.ragdollUntil = now + 320;
              target.hitFlashUntil = now + 120;
              screenShakeRef.current = Math.max(screenShakeRef.current, 6.5);
              soundManager.play('clash');
              triggerHaptic(22);
              bannersRef.current.push({
                x: target.x,
                y: target.y - 36,
                text: `-${WEAPONS.shield.damage}`,
                color: '#38BDF8',
                life: 0.9,
              });
              shockwavesRef.current.push({
                x: f.x,
                y: f.y - 8,
                radius: 16,
                maxRadius: 64,
                color: '#38BDF8',
                life: 1,
              });
              if (target.hp <= 0) {
                target.alive = false;
                target.koAt = now;
                soundManager.play('explosion');
              }
            }
          }
        }

        // Bottom pit bounce-back: -15 HP & 1s glowing shield onto nearest safe platform (K.O. only at HP <= 0)
        const hazardY = h * 0.88;
        if (f.y >= hazardY) {
          f.hp = Math.max(0, f.hp - 15);
          screenShakeRef.current = Math.max(screenShakeRef.current, 9);
          soundManager.play(mapId === 'volcano' ? 'explosion' : 'splash');
          triggerHaptic(32);
          spawnSparks(
            f.x,
            hazardY - 4,
            mapId === 'volcano' ? '#FB923C' : '#E0F2FE',
            18
          );

          if (f.hp <= 0) {
            f.alive = false;
            f.koAt = now;
            bannersRef.current.push({
              x: f.x,
              y: hazardY - 28,
              text: 'K.O! 💥',
              color: '#FACC15',
              life: 1.25,
            });
          } else {
            // Find nearest safe platform center X to bounce back cleanly
            let safeTargetX = w * 0.5;
            if (mapId === 'kraken') {
              const rx = Math.min(w * 0.36, 250) * 0.72;
              safeTargetX = Math.max(w * 0.5 - rx, Math.min(w * 0.5 + rx, f.x));
            } else if (mapId === 'pirate') {
              const halfD = Math.min(w * 0.36, 260) * 0.72;
              safeTargetX = Math.max(w * 0.5 - halfD, Math.min(w * 0.5 + halfD, f.x));
            } else {
              let bestDist = Infinity;
              for (const plat of platforms) {
                if (plat.bounce) continue;
                const pcx = plat.x + plat.w * 0.5;
                const d = Math.abs(f.x - pcx);
                if (d < bestDist) {
                  bestDist = d;
                  safeTargetX = pcx;
                }
              }
            }

            f.y = hazardY - 12;
            f.vy = -685;
            f.vx = Math.max(-290, Math.min(290, (safeTargetX - f.x) * 1.95));
            f.jumpsLeft = 2;
            f.tilt = 0;
            f.angVel = 0;
            f.ragdollUntil = 0;
            f.hitFlashUntil = now + 150;
            f.invulnUntil = now + 1000;
            soundManager.play('bounce');
            shockwavesRef.current.push({
              x: f.x,
              y: hazardY - 6,
              radius: 12,
              maxRadius: 56,
              color: '#38BDF8',
              life: 1,
            });
            bannersRef.current.push({
              x: f.x,
              y: hazardY - 34,
              text: '-15 HP 🛡️',
              color: '#7DD3FC',
              life: 1.1,
            });
          }
        }
      }

      // Update Mystery Crates (12s weapon timer on pickup)
      const nextCrates: MysteryCrate[] = [];
      for (const crate of cratesRef.current) {
        if (!crate.landed) {
          crate.y += crate.vy * dt;
          if (mapId === 'kraken') {
            const dy = getKrakenDomeY(crate.x, w, h);
            if (dy !== null && crate.y + 12 >= dy) {
              crate.y = dy - 14;
              crate.landed = true;
            }
          } else if (mapId === 'pirate') {
            const dy = getPirateDeckY(crate.x, w, h, timeSec);
            if (dy !== null && crate.y + 12 >= dy) {
              crate.y = dy - 14;
              crate.landed = true;
            }
          } else {
            for (const plat of platforms) {
              if (!plat.bounce && crate.x >= plat.x && crate.x <= plat.x + plat.w && crate.y + 12 >= plat.y) {
                crate.y = plat.y - 14;
                crate.landed = true;
                break;
              }
            }
          }
        }

        if (crate.y > h * 0.9) continue;

        let pickedUp = false;
        for (const f of fightersRef.current) {
          if (!f.alive) continue;
          if (Math.hypot(f.x - crate.x, f.y - 8 - crate.y) < 30) {
            const alternatives = WEAPON_LIST.filter((wid) => wid !== f.weapon);
            const newWep = alternatives[Math.floor(Math.random() * alternatives.length)] ?? crate.weapon;
            f.weapon = newWep;
            f.weaponExpiresAt = now + WEAPON_DURATION_MS;
            pickedUp = true;
            soundManager.play('powerup');
            triggerHaptic(20);
            spawnSparks(crate.x, crate.y, '#FACC15', 14);
            bannersRef.current.push({
              x: crate.x,
              y: crate.y - 24,
              text: `${WEAPONS[newWep].emoji} ${WEAPONS[newWep].name} (١٢ث)!`,
              color: '#FDE047',
              life: 1.25,
            });
            break;
          }
        }
        if (!pickedUp) nextCrates.push(crate);
      }
      cratesRef.current = nextCrates;

      // Update Laser Projectiles (including terrain collision & shield deflection)
      const nextProj: LaserProjectile[] = [];
      for (const proj of projectilesRef.current) {
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        proj.life -= dt;
        if (proj.life <= 0 || proj.x < 0 || proj.x > w || proj.y < 0 || proj.y > h) continue;

        let blockedByTerrain = false;
        if (mapId === 'ice' || mapId === 'volcano') {
          for (const plat of platforms) {
            if (plat.h >= 50 && proj.x >= plat.x && proj.x <= plat.x + plat.w && proj.y >= plat.y && proj.y <= plat.y + plat.h) {
              blockedByTerrain = true;
              spawnSparks(proj.x, proj.y, proj.color, 6);
              break;
            }
          }
        } else if (mapId === 'kraken') {
          const dy = getKrakenDomeY(proj.x, w, h);
          if (dy !== null && proj.y >= dy) {
            blockedByTerrain = true;
            spawnSparks(proj.x, proj.y, proj.color, 6);
          }
        }
        if (blockedByTerrain) continue;

        let hit = false;
        for (const target of fightersRef.current) {
          if (!target.alive || target.playerIdx === proj.ownerIdx || target.invulnUntil > now) continue;
          if (distPointToSegment(proj.x, proj.y, target.x, target.y - 24, target.x, target.y + 12) < 15) {
            if (
              target.bubbleShieldUntil > now ||
              (target.weapon === 'shield' && target.shieldActiveUntil + 220 > now)
            ) {
              proj.vx = -proj.vx;
              proj.vy = -proj.vy;
              proj.ownerIdx = target.playerIdx;
              soundManager.play('clash');
              spawnSparks(proj.x, proj.y, '#38BDF8', 8);
            } else {
              hit = true;
              const knockDir = Math.sign(proj.vx || 1);
              const dmg = WEAPONS.blaster.damage;
              target.hp = Math.max(0, target.hp - dmg);
              target.vx = knockDir * WEAPONS.blaster.knockback;
              target.vy = -175;
              target.hitFlashUntil = now + 120;
              target.ragdollUntil = now + 230;
              screenShakeRef.current = Math.max(screenShakeRef.current, 4.5);
              soundManager.play('hit');
              triggerHaptic(18);
              spawnSparks(proj.x, proj.y, proj.color, 10);
              bannersRef.current.push({
                x: target.x,
                y: target.y - 36,
                text: `-${dmg} ⚡`,
                color: '#38BDF8',
                life: 0.9,
              });
              if (target.hp <= 0) {
                target.alive = false;
                target.koAt = now;
                soundManager.play('explosion');
                bannersRef.current.push({
                  x: target.x,
                  y: target.y - 24,
                  text: 'K.O! 💥',
                  color: '#FACC15',
                  life: 1.2,
                });
              }
            }
            break;
          }
        }
        if (!hit) nextProj.push(proj);
      }
      projectilesRef.current = nextProj;

      // Update VFX
      sparksRef.current = sparksRef.current
        .map((s) => ({
          ...s,
          x: s.x + s.vx * dt,
          y: s.y + s.vy * dt,
          vy: s.vy + 260 * dt,
          life: s.life - dt,
        }))
        .filter((s) => s.life > 0);

      dustRef.current = dustRef.current
        .map((d) => ({
          ...d,
          x: d.x + d.vx * dt,
          y: d.y + d.vy * dt,
          radius: d.radius + 14 * dt,
          life: d.life - dt,
        }))
        .filter((d) => d.life > 0);

      shockwavesRef.current = shockwavesRef.current
        .map((sw) => ({
          ...sw,
          radius: sw.radius + (sw.maxRadius - sw.radius) * Math.min(1, dt * 11),
          life: sw.life - dt * 3.2,
        }))
        .filter((sw) => sw.life > 0);

      lightningRef.current = lightningRef.current
        .map((lf) => ({ ...lf, life: lf.life - dt }))
        .filter((lf) => lf.life > 0);

      bannersRef.current = bannersRef.current
        .map((b) => ({ ...b, y: b.y - 28 * dt, life: b.life - dt * 0.9 }))
        .filter((b) => b.life > 0);

      setHpSnapshot(fightersRef.current.map((f) => Math.round(f.hp)));
      setShieldChargesSnapshot(fightersRef.current.map((f) => f.shieldCharges));

      // Check Last Stickman Standing
      const aliveList = fightersRef.current.filter((f) => f.alive);
      if (aliveList.length <= 1) {
        if (koCelebrateAtRef.current === null) {
          koCelebrateAtRef.current = now + 620;
        } else if (now >= koCelebrateAtRef.current) {
          drawScene(now);
          finishRound(aliveList[0]?.playerIdx);
          return;
        }
      }

      drawScene(now);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [phase, matchSeconds, players, drawScene, finishRound, spawnSparks, spawnDust]);

  // Strictly Fixed-Base Corner Joysticks with Isolated Multi-Touch
  const handleJoyStart = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'PLAYING' && phase !== 'COUNTDOWN') return;
    e.preventDefault();
    e.stopPropagation();
    soundManager.unlock();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const ox = rect.width / 2;
    const oy = rect.height / 2;
    const cx = rect.left + ox;
    const cy = rect.top + oy;
    const j = joysticksRef.current[idx];
    if (!j) return;
    j.activePointer = e.pointerId;
    j.originX = ox;
    j.originY = oy;

    const { dx: vx, dy: vy } = mapScreenDeltaToLandscape(
      e.clientX - cx,
      e.clientY - cy,
      isRotatedPortrait
    );
    const dist = Math.hypot(vx, vy);
    const clamped = Math.min(JOY_MAX_R, dist);
    const ang = Math.atan2(vy, vx);
    j.knobX = dist > 0.5 ? ox + Math.cos(ang) * clamped : ox;
    j.knobY = dist > 0.5 ? oy + Math.sin(ang) * clamped : oy;
    const mag = Math.min(1, dist / JOY_MAX_R);
    j.mag = mag;
    j.dx = dist > 0.5 ? Math.cos(ang) * mag : 0;
    j.dy = dist > 0.5 ? Math.sin(ang) * mag : 0;
    j.lastSector = -1;
    triggerHaptic(15);
    setJoyRenderTick((t) => t + 1);
  };

  const handleJoyMove = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    const j = joysticksRef.current[idx];
    if (!j || j.activePointer !== e.pointerId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const ox = rect.width / 2;
    const oy = rect.height / 2;
    const cx = rect.left + ox;
    const cy = rect.top + oy;
    j.originX = ox;
    j.originY = oy;
    const { dx: vx, dy: vy } = mapScreenDeltaToLandscape(
      e.clientX - cx,
      e.clientY - cy,
      isRotatedPortrait
    );
    const dist = Math.hypot(vx, vy);
    const clamped = Math.min(JOY_MAX_R, dist);
    const ang = Math.atan2(vy, vx);
    j.knobX = ox + Math.cos(ang) * clamped;
    j.knobY = oy + Math.sin(ang) * clamped;
    const mag = Math.min(1, dist / JOY_MAX_R);
    j.mag = mag;
    j.dx = dist > 0.5 ? Math.cos(ang) * mag : 0;
    j.dy = dist > 0.5 ? Math.sin(ang) * mag : 0;

    const sector = mag > 0.4 ? Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 4) % 4 : -1;
    if (sector !== -1 && sector !== j.lastSector) {
      if (j.lastSector !== -1) triggerHaptic(15);
      j.lastSector = sector;
    }
    setJoyRenderTick((t) => t + 1);
  };

  const handleJoyEnd = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    const j = joysticksRef.current[idx];
    if (!j || j.activePointer !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
    joysticksRef.current[idx] = createEmptyJoystick();
    setJoyRenderTick((t) => t + 1);
  };

  const activeMapMeta = MAPS.find((m) => m.id === activeMap) ?? MAPS[0];
  const weaponMeta = WEAPONS[roundWeapon];

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] flex flex-col select-none overflow-hidden">
      {phase === 'SETUP' && (
        <div className="flex-1 overflow-y-auto">
          <ArcadePreGameSetup
            title="حرب الستيك مان"
            subtitle="حرك الجويستيك للضرب والتصويب واثبت لفوق ثانيتين للنط! آخر مقاتل صامد يكسب الجولة!"
            players={players}
            accentBgClass="bg-gradient-to-br from-[#0284C7] via-[#6366F1] to-[#F97316]"
            icon={<Swords className="w-12 h-12 text-white drop-shadow" />}
            roundOptions={[3, 5, 7]}
            defaultRounds={3}
            durationLabel="مدة كل جولة:"
            durationOptions={[
              { value: 35, label: '٣٥ ثانية' },
              { value: 45, label: '٤٥ ثانية' },
              { value: 60, label: '٦٠ ثانية' },
            ]}
            defaultDuration={45}
            customConfigSlot={
              <div className="pt-3 border-t border-[#F1E8DA] dark:border-[#334155]">
                <div className="text-xs sm:text-sm font-extrabold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2 mb-2.5">
                  <MapIcon className="w-4 h-4 text-[#F59E0B]" />
                  <span>خريطة القتال:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.play('click');
                      setSelectedMapChoice('random');
                    }}
                    className={`min-h-[42px] rounded-xl px-2 text-xs font-black transition-all ${
                      selectedMapChoice === 'random'
                        ? 'qada-btn-amber text-[#1E293B]'
                        : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] border-2 border-[#E7DEC8] dark:border-[#334155]'
                    }`}
                  >
                    🎲 عشوائي كل جولة
                  </button>
                  {MAPS.map((m) => {
                    const active = selectedMapChoice === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          soundManager.play('click');
                          setSelectedMapChoice(m.id);
                        }}
                        className={`min-h-[42px] rounded-xl px-2 text-xs font-black transition-all ${
                          active
                            ? 'qada-btn-teal text-white'
                            : 'bg-[#FFF9F0] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] border-2 border-[#E7DEC8] dark:border-[#334155]'
                        }`}
                      >
                        {m.emoji} {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            }
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

      {isArenaMounted && (
        <div
          ref={arenaRef}
          dir="ltr"
          style={
            isRotatedPortrait
              ? {
                  width: '100dvh',
                  height: '100vw',
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(90deg)',
                  transformOrigin: 'center center',
                  touchAction: 'none',
                }
              : { touchAction: 'none' }
          }
          className={
            isRotatedPortrait
              ? 'overflow-hidden bg-[#071324] z-10'
              : 'relative w-full h-full overflow-hidden'
          }
        >
          <ArcadeFloatingHud
            secondsLeft={secondsLeft}
            stageLabel={`جولة ${roundNum}/${totalRounds} · ${activeMapMeta.emoji}`}
            muted={muted}
            positionMode="absolute"
            onRequestExit={() => setShowExitConfirm(true)}
          />

          <canvas
            ref={canvasRef}
            style={{ touchAction: 'none' }}
            className="w-full h-full block bg-[#071324]"
          />

          {/* Compact top HP + Shield charge strip */}
          <div className="pointer-events-none absolute top-[38px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 flex-wrap justify-center max-w-[78%]">
            {players.map((p, idx) => {
              const theme = ARCADE_COLORS[p.colorId];
              const hp = hpSnapshot[idx] ?? 0;
              const shieldsLeft = shieldChargesSnapshot[idx] ?? 2;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1 rounded-full bg-slate-950/90 border border-white/25 px-2.5 py-0.5 text-[11px] font-black text-white shadow ${
                    hp <= 0 ? 'opacity-40 line-through' : ''
                  }`}
                >
                  <span
                    style={{ backgroundColor: theme.hex }}
                    className="w-2.5 h-2.5 rounded-full border border-white/80 shrink-0"
                  />
                  <span className="truncate max-w-[54px]">{p.name}</span>
                  <span className="tabular-nums text-emerald-300">{hp}</span>
                  <span className="tabular-nums text-cyan-300 text-[10px]">
                    🛡️{shieldsLeft}/2
                  </span>
                </div>
              );
            })}
          </div>

          {phase === 'COUNTDOWN' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/50 px-6 text-center z-20">
              <div className="text-lg font-black text-amber-300 mb-1 tabular-nums">
                جولة {roundNum} من {totalRounds} · {activeMapMeta.emoji} {activeMapMeta.name}
              </div>
              <div className="text-8xl font-black text-white drop-shadow-[0_6px_0_#111827] tabular-nums">
                {countdownNum}
              </div>
              <div className="mt-3 rounded-2xl bg-slate-900/90 border border-white/25 px-4 py-2 text-sm sm:text-base font-black text-white shadow-lg">
                سلاح الجولة: {weaponMeta.emoji} {weaponMeta.name}
              </div>
              <p className="mt-2 text-xs font-extrabold text-white/85">
                اثبت الجويستيك لفوق ثانيتين للنط ⬆️ · انزل لتحت ٣ ثواني لدرع الطاقة! 🛡️
              </p>
            </div>
          )}

          {/* Strictly Fixed-Base 2-4 Corner Joysticks */}
          {players.map((player, idx) => {
            const placement = placements[idx];
            const theme = ARCADE_COLORS[player.colorId];
            if (!placement) return null;
            const joy = joysticksRef.current[idx];
            const isActive = joy?.activePointer !== null;
            const kx = isActive && joy ? joy.knobX - joy.originX : 0;
            const ky = isActive && joy ? joy.knobY - joy.originY : 0;
            const shieldsLeft = shieldChargesSnapshot[idx] ?? 2;

            return (
              <div
                key={player.id}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleJoyStart(idx, e)}
                onPointerMove={(e) => handleJoyMove(idx, e)}
                onPointerUp={(e) => handleJoyEnd(idx, e)}
                onPointerCancel={(e) => handleJoyEnd(idx, e)}
                onLostPointerCapture={(e) => handleJoyEnd(idx, e)}
                className={`absolute ${SLOT_CORNER_POS[placement.slot]} z-20 w-[110px] h-[110px] rounded-full cursor-pointer select-none flex items-center justify-center`}
              >
                <div
                  style={{
                    borderColor: theme.hex,
                    backgroundColor: isActive
                      ? 'rgba(15, 23, 42, 0.72)'
                      : 'rgba(15, 23, 42, 0.52)',
                  }}
                  className="pointer-events-none relative w-full h-full rounded-full border-[3.5px] shadow-[0_4px_0_rgba(0,0,0,0.35)] flex items-center justify-center"
                >
                  <span
                    className={`pointer-events-none absolute -top-5 px-2 py-0.5 rounded-full bg-black/75 text-[10px] font-black text-white truncate max-w-[110px] ${
                      placement.isTop ? 'rotate-180 -bottom-5 top-auto' : ''
                    }`}
                  >
                    ⚔️ {player.name} · 🛡️{shieldsLeft}/2
                  </span>

                  <div
                    style={{
                      backgroundColor: theme.hex,
                      transform: `translate3d(${kx}px, ${ky}px, 0) scale(${isActive ? 1.08 : 1})`,
                    }}
                    className={`pointer-events-none w-[42px] h-[42px] rounded-full border-[3px] border-white shadow-lg ${
                      isActive ? '' : 'transition-transform duration-150'
                    }`}
                  />
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
        title="متأكد إنك عايز تخرج من اللعبة؟"
        message="الجولة لسه شغالة، لو خرجت دلوقتي النتيجة مش هتتحسب."
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
