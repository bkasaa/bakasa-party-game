import { useEffect, useState } from 'react';
import { MainHubScreen } from './components/MainHubScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlayerSetupScreen } from './components/PlayerSetupScreen';
import { BombGameFlow } from './components/bomb/BombGameFlow';
import { SpyGameFlow } from './components/spy/SpyGameFlow';
import { DEFAULT_PLAYER_NAMES, PLAYER_COLOR_CYCLE } from './data/gameData';
import { AppScreen, GameId, Player, RoundDelta } from './types/game';

const PLAYERS_STORAGE_KEY = 'bakasa_players_v1';

function createInitialPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(PLAYERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Player[];
      if (Array.isArray(parsed) && parsed.length >= 3 && parsed.length <= 10) {
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

export default function App() {
  const [players, setPlayers] = useState<Player[]>(createInitialPlayers);
  const [screen, setScreen] = useState<AppScreen>('SETUP');

  useEffect(() => {
    try {
      localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
    } catch {
      // Ignore storage quota errors
    }
  }, [players]);

  const handleAddPlayer = (name: string) => {
    setPlayers((prev) => {
      if (prev.length >= 10) return prev;
      const nextIdx = prev.length;
      const usedAvatars = new Set(prev.map((p) => p.avatarId));
      let avatarId = nextIdx;
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
      if (prev.length <= 3) return prev;
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleResetScores = () => {
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
    } else if (gameId === 'bomb') {
      setScreen('BOMB_GAME');
    }
  };

  return (
    <div dir="rtl" className="min-h-screen w-full bakasa-bg text-white overflow-x-hidden">
      {screen === 'SETUP' && (
        <PlayerSetupScreen
          players={players}
          onAddPlayer={handleAddPlayer}
          onUpdatePlayerName={handleUpdatePlayerName}
          onRemovePlayer={handleRemovePlayer}
          onResetScores={handleResetScores}
          onContinue={() => setScreen('HUB')}
        />
      )}

      {screen === 'HUB' && (
        <MainHubScreen
          players={players}
          onSelectGame={handleSelectGame}
          onEditPlayers={() => setScreen('SETUP')}
        />
      )}

      {screen === 'SPY_GAME' && (
        <SpyGameFlow
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      {screen === 'BOMB_GAME' && (
        <BombGameFlow
          players={players}
          onApplyDeltas={handleApplyDeltas}
          onExitToHub={() => setScreen('HUB')}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
