export type AppScreen = 'SETUP' | 'HUB' | 'SPY_GAME' | 'BOMB_GAME';

export type GameId = 'spy' | 'bomb' | 'draw' | 'forger' | 'court';

export type BannerColor = 'pink' | 'blue' | 'coral' | 'green' | 'orange' | 'plum';

export interface Player {
  id: string;
  name: string;
  score: number;
  avatarId: number;
  color: BannerColor;
}

export interface SpyCategory {
  id: string;
  name: string;
  color: BannerColor;
  iconType: 'food' | 'movies' | 'places' | 'animals' | 'clothes' | 'girls';
  words: string[];
}

export type SpyPhase =
  | 'CATEGORY_SELECT'
  | 'PASS_DEVICE'
  | 'REVEAL_CARD'
  | 'DISCUSSION'
  | 'VOTING'
  | 'ROUND_REVEAL'
  | 'LEADERBOARD';

export type BombPhase =
  | 'READY'
  | 'ACTIVE'
  | 'EXPLODED'
  | 'LEADERBOARD';

export interface RoundDelta {
  playerId: string;
  delta: number;
}
