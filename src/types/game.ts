export type AppScreen =
  | 'HOME'
  | 'SETUP'
  | 'HUB'
  | 'SPY_GAME'
  | 'BOMB_QUESTIONS_GAME'
  | 'BOMB_CLASSIC_GAME'
  | 'DRAW_GAME'
  | 'FORGER_GAME'
  | 'ARCADE_SETUP'
  | 'ARCADE_HUB'
  | 'ARCADE_PAINT'
  | 'ARCADE_KNIFE'
  | 'ARCADE_FROG'
  | 'ARCADE_BIRDS'
  | 'ARCADE_RACING'
  | 'ARCADE_CHICKEN'
  | 'ARCADE_SOCCER';

export type GameId =
  | 'spy'
  | 'bomb_questions'
  | 'bomb_classic'
  | 'draw'
  | 'forger';

export type ArcadeGameId =
  | 'paint'
  | 'knife'
  | 'frog'
  | 'birds'
  | 'racing'
  | 'chicken'
  | 'soccer';

export type BannerColor = 'pink' | 'blue' | 'coral' | 'green' | 'orange' | 'plum';

export interface Player {
  id: string;
  name: string;
  score: number;
  avatarId: number;
  color: BannerColor;
}

export type SpyIconType =
  | 'places'
  | 'food'
  | 'movies'
  | 'sports'
  | 'jobs'
  | 'animals'
  | 'countries'
  | 'cars'
  | 'home'
  | 'gaming'
  | 'fruits'
  | 'transport';

export interface SpyCategory {
  id: string;
  name: string;
  color: BannerColor;
  iconType: SpyIconType;
  words: string[];
}

export interface ForgerCategory {
  id: string;
  name: string;
  words: string[];
}

export type SpyPhase =
  | 'CATEGORY_SELECT'
  | 'PASS_DEVICE'
  | 'REVEAL_CARD'
  | 'DISCUSSION'
  | 'VOTING'
  | 'SPY_IDENTITY_REVEAL'
  | 'SPY_FINAL_GUESS'
  | 'ROUND_REVEAL'
  | 'LEADERBOARD';

export type BombPhase =
  | 'READY'
  | 'ACTIVE'
  | 'EXPLODED'
  | 'LEADERBOARD';

export type DrawPhase =
  | 'READY'
  | 'PASS_DRAWER'
  | 'REVEAL_WORD'
  | 'DRAWING'
  | 'GUESSING'
  | 'TURN_RESULT'
  | 'LEADERBOARD';

export type ForgerPhase =
  | 'READY'
  | 'PASS_REVEAL'
  | 'REVEAL_ROLE'
  | 'DRAW_STROKE'
  | 'VOTING'
  | 'FORGER_IDENTITY_REVEAL'
  | 'FORGER_FINAL_GUESS'
  | 'ROUND_REVEAL'
  | 'LEADERBOARD';

export interface RoundDelta {
  playerId: string;
  delta: number;
}
