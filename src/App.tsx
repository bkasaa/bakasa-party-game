import { useEffect, useState } from 'react';
import { CustomContentModal } from './components/CustomContentModal';
import { HomeScreen } from './components/HomeScreen';
import { MainHubScreen } from './components/MainHubScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlayerSetupScreen } from './components/PlayerSetupScreen';
import { SplashIntro } from './components/SplashIntro';
import { ArcadeHubScreen } from './components/arcade/ArcadeHubScreen';
import { ArcadeSetupScreen } from './components/arcade/ArcadeSetupScreen';
import { ChickenCatchGame } from './components/arcade/ChickenCatchGame';
import { BalanceTowerGame } from './components/arcade/BalanceTowerGame';
import { FrogFlyCatchGame } from './components/arcade/FrogFlyCatchGame';
import { HappyBirdsGame } from './components/arcade/HappyBirdsGame';
import { KnifeHitGame } from './components/arcade/KnifeHitGame';
import { PaintFightGame } from './components/arcade/PaintFightGame';
import { RacingGame } from './components/arcade/RacingGame';
import { SoccerGame } from './components/arcade/SoccerGame';
import { StickmanBattleGame } from './components/arcade/StickmanBattleGame';
import { BombGameFlow } from './components/bomb/BombGameFlow';
import { CourtGameFlow } from './components/court/CourtGameFlow';
import { DrawGameFlow } from './components/draw/DrawGameFlow';
import { ClubChainGameFlow } from './components/football/ClubChainGameFlow';
import { FootballAuctionFlow } from './components/football/FootballAuctionFlow';
import { FootballCharadesFlow } from './components/football/FootballCharadesFlow';
import { FootballHubScreen } from './components/football/FootballHubScreen';
import { FootballPasswordFlow } from './components/football/FootballPasswordFlow';
import { FootballThreeGameFlow } from './components/football/FootballThreeGameFlow';
import { FootballTicTacToeFlow } from './components/football/FootballTicTacToeFlow';
import { PenaltyShootoutFlow } from './components/football/PenaltyShootoutFlow';
import { ForgerGameFlow } from './components/forger/ForgerGameFlow';
import { HeadsUpGameFlow } from './components/headsup/HeadsUpGameFlow';
import { SpyGameFlow } from './components/spy/SpyGameFlow';
import { TournamentModeFlow } from './components/tournament/TournamentModeFlow';
import { HomeNavigationProvider } from './contexts/NavigationContext';
import { DEFAULT_FOOTBALL_SETTINGS, FootballGlobalSettings } from './data/footballData';
import { DEFAULT_PLAYER_NAMES, PLAYER_COLOR_CYCLE } from './data/gameData';
import { getCustomTotalCount } from './utils/customContentStorage';
import { useWakeLock } from './hooks/useWakeLock';
import {
  ARCADE_COLOR_ORDER,
  ArcadeColorId,
  ArcadeDelta,
  ArcadePlayer,
  DEFAULT_ARCADE_PLAYERS,
} from './types/arcade';
import {
  AppScreen,
  ArcadeGameId,
  FootballGameId,
  GameId,
  Player,
  RoundDelta,
} from './types/game';
import { resetArcadeSessionStats, resetPartySessionStats } from './utils/sessionStats';
import { useTheme } from './utils/themeManager';

const PLAYERS_STORAGE_KEY = 'bakasa_players_v1';
const ARCADE_PLAYERS_STORAGE_KEY = 'bakasa_arcade_players_v1';
const ARCADE_COUNT_STORAGE_KEY = 'bakasa_arcade_count_v1';

function createInitialPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(PLAYERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Player[];
      if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 20) {
        return parsed.map((p, idx) => ({
          id: typeof p.id === 'string' ? p.id : `p_${idx}_${Date.now()}`,
          name: typeof p.name === 'string' && p.name.trim() ? p.name : `لاعب ${idx + 1}`,
          score: typeof p.score === 'number' && Number.isFinite(p.score) ? p.score : 0,
          avatarId: typeof p.avatarId === 'number' ? p.avatarId : idx,
          color: p.color || PLAYER_COLOR_CYCLE[idx % PLAYER_COLOR_CYCLE.length],
        }));
      }
    }
  } catch {
    // Fallback to defaults if storage unavailable or corrupted
  }

  return DEFAULT_PLAYER_NAMES.map((name, idx) => ({
    id: `player_${idx + 1}`,
    name,
    score: 0,
    avatarId: idx,
    color: PLAYER_COLOR_CYCLE[idx % PLAYER_COLOR_CYCLE.length],
  }));
}

function createInitialArcadePlayers(): ArcadePlayer[] {
  try {
    const raw = localStorage.getItem(ARCADE_PLAYERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ArcadePlayer[];
      if (Array.isArray(parsed) && parsed.length === 4) {
        const usedColors = new Set<ArcadeColorId>();
        return parsed.map((p, idx) => {
          let colorId: ArcadeColorId =
            p.colorId && ARCADE_COLOR_ORDER.includes(p.colorId)
              ? p.colorId
              : ARCADE_COLOR_ORDER[idx];
          if (usedColors.has(colorId)) {
            colorId = ARCADE_COLOR_ORDER.find((c) => !usedColors.has(c)) ?? ARCADE_COLOR_ORDER[idx];
          }
          usedColors.add(colorId);
          return {
            id: typeof p.id === 'string' ? p.id : `arc_${idx + 1}`,
            name: typeof p.name === 'string' && p.name.trim() ? p.name : `لاعب ${idx + 1}`,
            colorId,
            score: typeof p.score === 'number' && Number.isFinite(p.score) ? p.score : 0,
          };
        });
      }
    }
  } catch {
    // Fallback to default 4 arcade players
  }
  return DEFAULT_ARCADE_PLAYERS;
}

function createInitialArcadeCount(): 2 | 3 | 4 {
  try {
    const raw = Number(localStorage.getItem(ARCADE_COUNT_STORAGE_KEY));
    if (raw === 2 || raw === 3 || raw === 4) return raw;
  } catch {
    // Ignore
  }
  return 4;
}

export default function App() {
  useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [players, setPlayers] = useState<Player[]>(createInitialPlayers);
  const [arcadePlayers, setArcadePlayers] = useState<ArcadePlayer[]>(createInitialArcadePlayers);
  const [arcadeCount, setArcadeCount] = useState<2 | 3 | 4>(createInitialArcadeCount);
  const [footballSettings, setFootballSettings] = useState<FootballGlobalSettings>(
    DEFAULT_FOOTBALL_SETTINGS
  );
  const [screen, setScreen] = useState<AppScreen>('HOME');
  const [setupReturnTarget, setSetupReturnTarget] = useState<'HUB' | 'FOOTBALL_HUB' | 'TOURNAMENT_MODE'>('HUB');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTotalCount, setCustomTotalCount] = useState<number>(() => getCustomTotalCount());

  const isGameActive =
    screen !== 'HOME' &&
    screen !== 'SETUP' &&
    screen !== 'HUB' &&
    screen !== 'ARCADE_SETUP' &&
    screen !== 'ARCADE_HUB' &&
    screen !== 'FOOTBALL_HUB';
  useWakeLock(isGameActive);

  useEffect(() => {
    try {
      localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
    } catch {
      // Ignore storage quota errors
    }
  }, [players]);

  useEffect(() => {
    try {
      localStorage.setItem(ARCADE_PLAYERS_STORAGE_KEY, JSON.stringify(arcadePlayers));
    } catch {
      // Ignore storage quota errors
    }
  }, [arcadePlayers]);

  useEffect(() => {
    try {
      localStorage.setItem(ARCADE_COUNT_STORAGE_KEY, String(arcadeCount));
    } catch {
      // Ignore storage quota errors
    }
  }, [arcadeCount]);

  // Party games player handlers
  const handleAddPlayer = (name: string) => {
    setPlayers((prev) => {
      if (prev.length >= 20) return prev;
      const nextIdx = prev.length;
      const usedAvatars = new Set(prev.map((p) => p.avatarId));
      let avatarId = nextIdx % 10;
      for (let i = 0; i < 10; i++) {
        if (!usedAvatars.has(i)) {
          avatarId = i;
          break;
        }
      }
      return [
        ...prev,
        {
          id: `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          score: 0,
          avatarId,
          color: PLAYER_COLOR_CYCLE[nextIdx % PLAYER_COLOR_CYCLE.length],
        },
      ];
    });
  };

  const handleUpdatePlayerName = (id: string, name: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleResetScores = () => {
    resetPartySessionStats();
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
  };

  const handleApplyDeltas = (deltas: RoundDelta[]) => {
    const deltaMap = new Map(deltas.map((d) => [d.playerId, d.delta]));
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        score: p.score + (deltaMap.get(p.id) ?? 0),
      }))
    );
  };

  const handleSelectGame = (gameId: GameId) => {
    if (gameId === 'spy') {
      setScreen('SPY_GAME');
    } else if (gameId === 'bomb_questions') {
      setScreen('BOMB_QUESTIONS_GAME');
    } else if (gameId === 'bomb_classic') {
      setScreen('BOMB_CLASSIC_GAME');
    } else if (gameId === 'draw') {
      setScreen('DRAW_GAME');
    } else if (gameId === 'forger') {
      setScreen('FORGER_GAME');
    } else if (gameId === 'court') {
      setScreen('COURT_GAME');
    } else if (gameId === 'headsup') {
      setScreen('HEADSUP_GAME');
    }
  };

  // 2D Arcade handlers
  const handleUpdateArcadeName = (id: string, name: string) => {
    setArcadePlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const handleSelectArcadeColor = (playerId: string, colorId: ArcadeColorId) => {
    setArcadePlayers((prev) => {
      const target = prev.find((p) => p.id === playerId);
      if (!target || target.colorId === colorId) return prev;
      const oldColor = target.colorId;
      return prev.map((p) => {
        if (p.id === playerId) return { ...p, colorId };
        if (p.colorId === colorId) return { ...p, colorId: oldColor };
        return p;
      });
    });
  };

  const handleResetArcadeScores = () => {
    resetArcadeSessionStats();
    setArcadePlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
  };

  const handleApplyArcadeDeltas = (deltas: ArcadeDelta[]) => {
    const deltaMap = new Map(deltas.map((d) => [d.playerId, d.delta]));
    setArcadePlayers((prev) =>
      prev.map((p) => ({
        ...p,
        score: p.score + (deltaMap.get(p.id) ?? 0),
      }))
    );
  };

  const handleSelectArcadeGame = (gameId: ArcadeGameId) => {
    if (gameId === 'paint') setScreen('ARCADE_PAINT');
    else if (gameId === 'knife') setScreen('ARCADE_KNIFE');
    else if (gameId === 'frog') setScreen('ARCADE_FROG');
    else if (gameId === 'birds') setScreen('ARCADE_BIRDS');
    else if (gameId === 'racing') setScreen('ARCADE_RACING');
    else if (gameId === 'chicken') setScreen('ARCADE_CHICKEN');
    else if (gameId === 'soccer') setScreen('ARCADE_SOCCER');
    else if (gameId === 'stickman') setScreen('ARCADE_STICKMAN');
    else if (gameId === 'balance') setScreen('ARCADE_BALANCE');
  };

  const handleSelectFootballGame = (gameId: FootballGameId) => {
    if (gameId === 'football_spy') setScreen('FOOTBALL_SPY');
    else if (gameId === 'football_password') setScreen('FOOTBALL_PASSWORD');
    else if (gameId === 'football_chain') setScreen('FOOTBALL_CHAIN');
    else if (gameId === 'football_three') setScreen('FOOTBALL_THREE');
    else if (gameId === 'football_charades') setScreen('FOOTBALL_CHARADES');
    else if (gameId === 'football_penalty') setScreen('FOOTBALL_PENALTY');
    else if (gameId === 'football_auction') setScreen('FOOTBALL_AUCTION');
    else if (gameId === 'football_tictactoe') setScreen('FOOTBALL_TICTACTOE');
  };

  const activeArcadePlayers = arcadePlayers.slice(0, arcadeCount);

  return (
    <HomeNavigationProvider onGoHome={() => setScreen('HOME')}>
      <div dir="rtl" className="min-h-screen w-full bakasa-bg text-[#1E293B] dark:text-[#F8FAFC] overflow-x-hidden">
        {showSplash && <SplashIntro onComplete={() => setShowSplash(false)} />}

      {screen === 'HOME' && (
        <HomeScreen
          playerCount={players.length}
          arcadePlayerCount={arcadeCount}
          customTotalCount={customTotalCount}
          onStartPlay={() => {
            setSetupReturnTarget('HUB');
            setScreen('SETUP');
          }}
          onStartArcade={() => setScreen('ARCADE_SETUP')}
          onStartFootball={() => setScreen('FOOTBALL_HUB')}
          onStartTournament={() => setScreen('TOURNAMENT_MODE')}
          onOpenCustomContent={() => setShowCustomModal(true)}
        />
      )}

      {screen === 'SETUP' && (
        <PlayerSetupScreen
          players={players}
          onAddPlayer={handleAddPlayer}
          onUpdatePlayerName={handleUpdatePlayerName}
          onRemovePlayer={handleRemovePlayer}
          onResetScores={handleResetScores}
          onContinue={() => setScreen(setupReturnTarget)}
          onBackToHome={() =>
            setScreen(
              setupReturnTarget === 'FOOTBALL_HUB'
                ? 'FOOTBALL_HUB'
                : setupReturnTarget === 'TOURNAMENT_MODE'
                  ? 'TOURNAMENT_MODE'
                  : 'HOME'
            )
          }
        />
      )}

      {screen === 'HUB' && (
        <MainHubScreen
          players={players}
          onSelectGame={handleSelectGame}
          onEditPlayers={() => {
            setSetupReturnTarget('HUB');
            setScreen('SETUP');
          }}
        />
      )}

      {screen === 'SPY_GAME' && (
        <SpyGameFlow
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      {screen === 'BOMB_QUESTIONS_GAME' && (
        <BombGameFlow
          mode="questions"
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      {screen === 'BOMB_CLASSIC_GAME' && (
        <BombGameFlow
          mode="classic"
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      {screen === 'DRAW_GAME' && (
        <DrawGameFlow
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      {screen === 'FORGER_GAME' && (
        <ForgerGameFlow
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      {screen === 'COURT_GAME' && (
        <CourtGameFlow
          players={players}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      {screen === 'HEADSUP_GAME' && (
        <HeadsUpGameFlow
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      {/* 2D Arcade Section */}
      {screen === 'ARCADE_SETUP' && (
        <ArcadeSetupScreen
          players={arcadePlayers}
          playerCount={arcadeCount}
          onChangePlayerCount={setArcadeCount}
          onUpdatePlayerName={handleUpdateArcadeName}
          onSelectPlayerColor={handleSelectArcadeColor}
          onResetScores={handleResetArcadeScores}
          onContinue={() => setScreen('ARCADE_HUB')}
          onBackToHome={() => setScreen('HOME')}
        />
      )}

      {screen === 'ARCADE_HUB' && (
        <ArcadeHubScreen
          players={activeArcadePlayers}
          onSelectGame={handleSelectArcadeGame}
          onEditPlayers={() => setScreen('ARCADE_SETUP')}
        />
      )}

      {screen === 'ARCADE_PAINT' && (
        <PaintFightGame
          players={activeArcadePlayers}
          onApplyDeltas={handleApplyArcadeDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {screen === 'ARCADE_KNIFE' && (
        <KnifeHitGame
          players={activeArcadePlayers}
          onApplyDeltas={handleApplyArcadeDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {screen === 'ARCADE_FROG' && (
        <FrogFlyCatchGame
          players={activeArcadePlayers}
          onApplyDeltas={handleApplyArcadeDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {screen === 'ARCADE_BIRDS' && (
        <HappyBirdsGame
          players={activeArcadePlayers}
          onApplyDeltas={handleApplyArcadeDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {screen === 'ARCADE_RACING' && (
        <RacingGame
          players={activeArcadePlayers}
          onApplyDeltas={handleApplyArcadeDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {screen === 'ARCADE_CHICKEN' && (
        <ChickenCatchGame
          players={activeArcadePlayers}
          onApplyDeltas={handleApplyArcadeDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {screen === 'ARCADE_SOCCER' && (
        <SoccerGame
          players={activeArcadePlayers}
          onApplyDeltas={handleApplyArcadeDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {screen === 'ARCADE_STICKMAN' && (
        <StickmanBattleGame
          players={activeArcadePlayers}
          onApplyDeltas={handleApplyArcadeDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {screen === 'ARCADE_BALANCE' && (
        <BalanceTowerGame
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToArcadeHub={() => setScreen('ARCADE_HUB')}
        />
      )}

      {/* Football Corner (قعدة اللاعيبة) */}
      {screen === 'FOOTBALL_HUB' && (
        <FootballHubScreen
          players={players}
          settings={footballSettings}
          onChangeSettings={setFootballSettings}
          onSelectGame={handleSelectFootballGame}
          onEditPlayers={() => {
            setSetupReturnTarget('FOOTBALL_HUB');
            setScreen('SETUP');
          }}
          onBackToHome={() => setScreen('HOME')}
        />
      )}

      {screen === 'FOOTBALL_SPY' && (
        <SpyGameFlow
          variant="football"
          players={players}
          footballSettings={footballSettings}
          onUpdateFootballSettings={setFootballSettings}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('FOOTBALL_HUB')}
        />
      )}

      {screen === 'FOOTBALL_PASSWORD' && (
        <FootballPasswordFlow
          players={players}
          initialSettings={footballSettings}
          onUpdateSettings={setFootballSettings}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('FOOTBALL_HUB')}
        />
      )}

      {screen === 'FOOTBALL_CHAIN' && (
        <ClubChainGameFlow
          players={players}
          initialSettings={footballSettings}
          onUpdateSettings={setFootballSettings}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('FOOTBALL_HUB')}
        />
      )}

      {screen === 'FOOTBALL_THREE' && (
        <FootballThreeGameFlow
          players={players}
          initialSettings={footballSettings}
          onUpdateSettings={setFootballSettings}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('FOOTBALL_HUB')}
        />
      )}

      {screen === 'FOOTBALL_CHARADES' && (
        <FootballCharadesFlow
          players={players}
          initialSettings={footballSettings}
          onUpdateSettings={setFootballSettings}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('FOOTBALL_HUB')}
        />
      )}

      {screen === 'FOOTBALL_PENALTY' && (
        <PenaltyShootoutFlow
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('FOOTBALL_HUB')}
        />
      )}

      {screen === 'FOOTBALL_AUCTION' && (
        <FootballAuctionFlow
          players={players}
          initialSettings={footballSettings}
          onUpdateSettings={setFootballSettings}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('FOOTBALL_HUB')}
        />
      )}

      {screen === 'FOOTBALL_TICTACTOE' && (
        <FootballTicTacToeFlow
          players={players}
          initialSettings={footballSettings}
          onUpdateSettings={setFootballSettings}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('FOOTBALL_HUB')}
        />
      )}

      {screen === 'TOURNAMENT_MODE' && (
        <TournamentModeFlow
          players={players}
          footballSettings={footballSettings}
          onUpdateFootballSettings={setFootballSettings}
          onEditPlayers={() => {
            setSetupReturnTarget('TOURNAMENT_MODE');
            setScreen('SETUP');
          }}
          onExitToHome={() => setScreen('HOME')}
        />
      )}

      <CustomContentModal
        open={showCustomModal}
        onClose={() => {
          setShowCustomModal(false);
          setCustomTotalCount(getCustomTotalCount());
        }}
      />

      <OfflineIndicator />
      </div>
    </HomeNavigationProvider>
  );
}
