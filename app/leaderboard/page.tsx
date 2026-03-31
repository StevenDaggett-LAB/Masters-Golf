'use client';

import { useEffect, useState } from 'react';
import { NavLinks } from '@/components/nav-links';

type LeaderboardEntry = {
  userId: string;
  playerFullName: string;
  teamName: string;
  selectedGolfers: string[];
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
                  <tr key={entry.userId}>
                    <td>{entry.rankingPosition}</td>
                    <td>{entry.playerFullName}</td>
                    <td>{entry.teamName}</td>
                    <td>{entry.selectedGolfers.join(', ')}</td>
                    <td>{entry.teamTotalScore > 0 ? `+${entry.teamTotalScore}` : entry.teamTotalScore}</td>
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
