export type ScoreboardMood = 'winner' | 'middle' | 'last' | 'neutral';

export interface ScoreboardRankInfo {
  rank: number;
  mood: ScoreboardMood;
}

export function getScoreboardRankMap<T extends { id: string; score: number }>(
  sortedPlayers: T[]
): Map<string, ScoreboardRankInfo> {
  const result = new Map<string, ScoreboardRankInfo>();
  if (sortedPlayers.length === 0) return result;

  const highestScore = sortedPlayers[0].score;
  const lowestScore = sortedPlayers[sortedPlayers.length - 1].score;
  const allTied = highestScore === lowestScore;

  let currentRank = 1;
  sortedPlayers.forEach((player, idx) => {
    if (idx > 0 && player.score < sortedPlayers[idx - 1].score) {
      currentRank = idx + 1;
    }

    let mood: ScoreboardMood = 'neutral';
    if (sortedPlayers.length >= 2) {
      if (allTied) {
        mood = highestScore > 0 ? 'winner' : 'neutral';
      } else if (player.score === highestScore) {
        mood = 'winner';
      } else if (player.score === lowestScore) {
        mood = 'last';
      } else {
        mood = 'middle';
      }
    } else if (player.score > 0) {
      mood = 'winner';
    }

    result.set(player.id, { rank: currentRank, mood });
  });

  return result;
}
