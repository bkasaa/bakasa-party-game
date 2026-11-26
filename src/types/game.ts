export type AppScreen =
  | 'HOME'
  | 'SETUP'
  | 'HUB'
  | 'SPY_GAME'
  | 'BOMB_QUESTIONS_GAME'
  | 'BOMB_CLASSIC_GAME'
  | 'DRAW_GAME'
  | 'FORGER_GAME'
  | 'COURT_GAME'
  | 'HEADSUP_GAME'
  | 'ARCADE_SETUP'
  | 'ARCADE_HUB'
  | 'ARCADE_PAINT'
  | 'ARCADE_KNIFE'
  | 'ARCADE_FROG'
  | 'ARCADE_BIRDS'
  | 'ARCADE_RACING'
  | 'ARCADE_CHICKEN'
  | 'ARCADE_SOCCER'
  | 'ARCADE_STICKMAN'
  | 'ARCADE_BALANCE'
  | 'ARCADE_KHLAWIS'
  | 'FOOTBALL_HUB'
  | 'FOOTBALL_SPY'
  | 'FOOTBALL_CHAIN'
  | 'FOOTBALL_THREE'
  | 'FOOTBALL_CHARADES'
  | 'FOOTBALL_PENALTY'
  | 'FOOTBALL_PASSWORD'
  | 'FOOTBALL_AUCTION'
  | 'FOOTBALL_TICTACTOE'
  | 'TOURNAMENT_MODE';

export type GameId =
  | 'spy'
  | 'bomb_questions'
  | 'bomb_classic'
  | 'draw'
  | 'forger'
  | 'court'
  | 'headsup';

export type FootballGameId =
  | 'football_spy'
  | 'football_chain'
  | 'football_three'
  | 'football_charades'
  | 'football_penalty'
  | 'football_password'
  | 'football_auction'
  | 'football_tictactoe';

export type ArcadeGameId =
  | 'paint'
  | 'knife'
  | 'frog'
  | 'birds'
  | 'racing'
  | 'chicken'
  | 'soccer'
  | 'stickman'
  | 'balance'
  | 'khlawis';

export type BannerColor =
  | 'pink'
  | 'blue'
  | 'coral'
  | 'green'
  | 'orange'
  | 'plum'
  | 'crimson'
  | 'indigo'
  | 'cyan'
  | 'lime'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'violet'
  | 'emerald'
  | 'fuchsia';

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
  | 'transport'
  | 'daily_life';

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

export interface CategoryBank {
  id: string;
  name: string;
  items: string[];
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
