'use client';

import { useEffect, useState } from 'react';
import { NavLinks } from '@/components/nav-links';
import { formatRelativeToPar } from '@/lib/formatting/golf';

type LeaderboardEntry = {
  userId: string;
  playerFullName: string;
  teamName: string;
  selectedGolfers: Array<{
    golferName: string;
    tournamentScore: number;
    statusText: string | null;
    currentRoundScore: number | null;
  }>;
  teamTotalScore: number;
  sundayBirdies: number;
  rankingPosition: number;
  tiebreakerApplied: boolean;
};

type LeaderboardResponse = {
  isVisible: boolean;
  hardLockTimeUtc: string;
  entries: LeaderboardEntry[];
  error?: string;
};

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function getGolferStatusLine(golfer: LeaderboardEntry['selectedGolfers'][number]) {
    const roundText =
      golfer.currentRoundScore !== null ? `R: ${formatRelativeToPar(golfer.currentRoundScore)}` : null;
    const statusText = golfer.statusText?.trim() || null;

    if (roundText && statusText) {
      return `(${roundText} • ${statusText})`;
    }

    if (roundText) {
      return `(${roundText})`;
    }

    if (statusText) {
      return `(${statusText})`;
    }

    return null;
  }

  useEffect(() => {
    async function loadLeaderboard() {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' });
      const payload = (await response.json()) as LeaderboardResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load leaderboard.');
      }

      setData(payload);
    }

    loadLeaderboard().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load leaderboard.');
    });
  }, []);

  return (
    <main>
      <section className="card">
        <h2>Leaderboard</h2>

        {!data && !error ? <p>Loading leaderboard…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {data && !data.isVisible ? <p>Teams will be revealed after the draft locks.</p> : null}

        {data && data.isVisible ? (
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Golfers</th>
                  <th>Total</th>
                  <th>Tiebreaker</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.userId} className={entry.rankingPosition === 1 ? 'leaderboard-leader-row' : undefined}>
                    <td>{entry.rankingPosition}</td>
                    <td>{entry.playerFullName}</td>
                    <td>{entry.teamName}</td>
                    <td>
                      <ul className="leaderboard-golfers">
                        {entry.selectedGolfers.map((golfer) => {
                          const statusLine = getGolferStatusLine(golfer);

                          return (
                            <li key={`${entry.userId}-${golfer.golferName}`} className="leaderboard-golfer-row">
                              <span className="leaderboard-golfer-main">
                                <span className="leaderboard-golfer-name">{golfer.golferName}</span>
                                <span className="leaderboard-golfer-score">{formatRelativeToPar(golfer.tournamentScore)}</span>
                              </span>
                              {statusLine ? <span className="leaderboard-golfer-status">{statusLine}</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td>{formatRelativeToPar(entry.teamTotalScore)}</td>
                    <td>{entry.tiebreakerApplied ? `Sunday birdies: ${entry.sundayBirdies}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
