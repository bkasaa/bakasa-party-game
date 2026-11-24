import { ArcadePlayer } from '../types/arcade';
import { Player } from '../types/game';

interface PartySessionStats {
  correctSpyVotes: Record<string, number>;
  bombExplosions: Record<string, number>;
  drawWins: Record<string, number>;
}

interface ArcadeSessionStats {
  arcadeWins: Record<string, number>;
  soccerGoals: Record<string, number>;
}

const partyStats: PartySessionStats = {
  correctSpyVotes: {},
  bombExplosions: {},
  drawWins: {},
};

const arcadeStats: ArcadeSessionStats = {
  arcadeWins: {},
  soccerGoals: {},
};

export function recordSpyCatch(playerId: string): void {
  partyStats.correctSpyVotes[playerId] = (partyStats.correctSpyVotes[playerId] ?? 0) + 1;
}

export function recordBombExplosion(playerId: string): void {
  partyStats.bombExplosions[playerId] = (partyStats.bombExplosions[playerId] ?? 0) + 1;
}

export function recordDrawWin(playerId: string): void {
  partyStats.drawWins[playerId] = (partyStats.drawWins[playerId] ?? 0) + 1;
}

export function recordArcadeWin(playerId: string): void {
  arcadeStats.arcadeWins[playerId] = (arcadeStats.arcadeWins[playerId] ?? 0) + 1;
}

export function recordSoccerGoal(playerId: string): void {
  arcadeStats.soccerGoals[playerId] = (arcadeStats.soccerGoals[playerId] ?? 0) + 1;
}

export function resetPartySessionStats(): void {
  partyStats.correctSpyVotes = {};
  partyStats.bombExplosions = {};
  partyStats.drawWins = {};
}

export function resetArcadeSessionStats(): void {
  arcadeStats.arcadeWins = {};
  arcadeStats.soccerGoals = {};
}

/**
 * Computes fun dynamic Egyptian Arabic badges/titles for each player
 * on the Party Leaderboard based on session stats and scores.
 */
export function computePartyTitles(sortedPlayers: Player[]): Record<string, string> {
  const titles: Record<string, string> = {};
  const usedLabels = new Set<string>();

  if (sortedPlayers.length === 0) return titles;

  // 1. King of Bakasa (Top score)
  const topScore = Math.max(...sortedPlayers.map((p) => p.score), 0);
  if (topScore > 0) {
    const king = sortedPlayers.find((p) => p.score === topScore);
    if (king) {
      titles[king.id] = 'ملك القعدة 👑';
      usedLabels.add('king');
    }
  }

  // 2. Bomb Victim (Most bomb explosions)
  let maxBombs = 0;
  let bombVictimId: string | null = null;
  for (const p of sortedPlayers) {
    const b = partyStats.bombExplosions[p.id] ?? 0;
    if (b > maxBombs) {
      maxBombs = b;
      bombVictimId = p.id;
    }
  }
  if (bombVictimId && maxBombs > 0 && !titles[bombVictimId]) {
    titles[bombVictimId] = 'ضحية القنبلة 💥';
    usedLabels.add('bomb');
  }

  // 3. Spy Hunter (Best voter)
  let maxVotes = 0;
  let hunterId: string | null = null;
  for (const p of sortedPlayers) {
    const v = partyStats.correctSpyVotes[p.id] ?? 0;
    if (v > maxVotes && !titles[p.id]) {
      maxVotes = v;
      hunterId = p.id;
    }
  }
  if (hunterId && maxVotes > 0) {
    titles[hunterId] = 'صياد الجواسيس 🎯';
    usedLabels.add('hunter');
  }

  // 4. Sketch Artist (Top drawing wins)
  let maxDraws = 0;
  let artistId: string | null = null;
  for (const p of sortedPlayers) {
    const d = partyStats.drawWins[p.id] ?? 0;
    if (d > maxDraws && !titles[p.id]) {
      maxDraws = d;
      artistId = p.id;
    }
  }
  if (artistId && maxDraws > 0) {
    titles[artistId] = 'فنان الشلة 🎨';
    usedLabels.add('artist');
  }

  // 5. Helpful fallback fun title for runner-up / bottom if scores are active
  sortedPlayers.forEach((p, idx) => {
    if (titles[p.id]) return;
    if (idx === 1 && p.score > 0 && !usedLabels.has('runner')) {
      titles[p.id] = 'المنافس الشرس ⚡';
      usedLabels.add('runner');
    } else if (
      idx === sortedPlayers.length - 1 &&
      sortedPlayers.length >= 3 &&
      !usedLabels.has('tail')
    ) {
      titles[p.id] = 'نجم القعدة ⭐';
      usedLabels.add('tail');
    }
  });

  return titles;
}

/**
 * Computes fun dynamic Egyptian Arabic badges/titles for each player
 * on the 2D Arcade Leaderboard.
 */
export function computeArcadeTitles(sortedPlayers: ArcadePlayer[]): Record<string, string> {
  const titles: Record<string, string> = {};
  const used = new Set<string>();

  if (sortedPlayers.length === 0) return titles;

  const topScore = Math.max(...sortedPlayers.map((p) => p.score), 0);

  // 1. Top Scorer -> هداف الشلة / ملك الـ 2D
  let maxGoals = 0;
  let topGoalId: string | null = null;
  for (const p of sortedPlayers) {
    const g = arcadeStats.soccerGoals[p.id] ?? 0;
    if (g > maxGoals) {
      maxGoals = g;
      topGoalId = p.id;
    }
  }

  if (topScore > 0) {
    const leader = sortedPlayers.find((p) => p.score === topScore);
    if (leader) {
      titles[leader.id] =
        topGoalId === leader.id && maxGoals > 0 ? 'هداف الشلة ⚽' : 'ملك القعدة 👑';
      used.add('leader');
    }
  }

  if (topGoalId && maxGoals > 0 && !titles[topGoalId]) {
    titles[topGoalId] = 'هداف الشلة ⚽';
    used.add('scorer');
  }

  // Most wins or runner-up
  sortedPlayers.forEach((p, idx) => {
    if (titles[p.id]) return;
    const wins = arcadeStats.arcadeWins[p.id] ?? 0;
    if (wins >= 2 && !used.has('pro')) {
      titles[p.id] = 'بطل الجولات 🔥';
      used.add('pro');
    } else if (idx === 1 && p.score > 0 && !used.has('fast')) {
      titles[p.id] = 'سريع الرد فعل ⚡';
      used.add('fast');
    } else if (idx === sortedPlayers.length - 1 && sortedPlayers.length >= 3 && !used.has('chill')) {
      titles[p.id] = 'روح التحدي 🌟';
      used.add('chill');
    }
  });

  return titles;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
