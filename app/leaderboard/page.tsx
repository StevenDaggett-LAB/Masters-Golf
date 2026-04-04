'use client';

import { useEffect, useState } from 'react';

type LeaderboardGolfer = {
  golferName: string;
  tournamentScore: number;
  statusText: string | null;
  currentRoundScore: number | null;
};


type LeaderboardEntry = {
  userId: string;
  playerFullName: string;
  teamName: string;
  selectedGolfers: LeaderboardGolfer[];
  teamTotalScore: number;
  sundayBirdies: number;
  rankingPosition: number | string;
  tiebreakerApplied?: boolean;
  teamTodayScore?: number | null;
  teamThruSummary?: string | null;
};


type LeaderboardResponse = {
  isVisible: boolean;
  lastUpdated?: string | null;
  entries: LeaderboardEntry[];
  error?: string;
};

function formatRelative(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  if (value === 0) return 'E';
  return value > 0 ? `+${value}` : `${value}`;
}

function scoreClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return 'score-even';
  return value < 0 ? 'score-negative' : 'score-positive';
}

export default function LeaderboardPage() {
const [data, setData] = useState<LeaderboardResponse | null>(null);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;

  async function loadLeaderboard() {
    try {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' });
      const payload = (await response.json()) as LeaderboardResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load leaderboard.');
      }

      if (!cancelled) {
        setData(payload);
        setError(null);
      }
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard.');
      }
    }
  }

  void loadLeaderboard();
  const interval = window.setInterval(loadLeaderboard, 30000);

  return () => {
    cancelled = true;
    window.clearInterval(interval);
  };
}, []);



  return (
    <main className="leaderboard-page augusta-board-page">
      <div className="augusta-board-frame">
        <div className="augusta-board-header">
          <span className="augusta-board-title">2025 Masters Leaders</span>
        </div>


        
        {!data && !error ? <div className="leaderboard-loading">Loading leaderboard...</div> : null}
        {error ? <div className="leaderboard-loading">{error}</div> : null}
        {data && !data.isVisible ? (
          <div className="leaderboard-loading">Teams will be revealed after the draft locks.</div>

        ) : null}

        {data && data.isVisible ? (
          <>
            {data.lastUpdated ? (
              <div className="augusta-board-updated">Last updated: {data.lastUpdated}</div>
            ) : null}

            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table augusta-board-table">
                <thead>
                  <tr>
                    <th>POS</th>
                    <th>PLAYER</th>
                    <th>TEAM</th>
                    <th>TODAY</th>
                    <th>THRU</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>

                {data.entries.map((entry, index) => (
                  <tbody key={entry.userId}>
                    <tr className={index === 0 ? 'leader-row' : ''}>
                      <td className="pos-cell">{entry.rankingPosition}</td>
                      <td className="player-name">{entry.playerFullName}</td>
                      <td className="team-name-cell">{entry.teamName}</td>
                      <td className={scoreClass(entry.teamTodayScore)}>
                        {formatRelative(entry.teamTodayScore)}
                      </td>
                      <td>{entry.teamThruSummary ?? '—'}</td>
                      <td className={scoreClass(entry.teamTotalScore)}>
                        {formatRelative(entry.teamTotalScore)}
                      </td>
                    </tr>

                    {entry.selectedGolfers.map((golfer) => (
                      <tr
                        key={`${entry.userId}-${golfer.golferName}`}
                        className="golfer-detail-row"
                      >
                        <td></td>
                        <td className="golfer-detail-name">{golfer.golferName}</td>
                        <td className="golfer-detail-status">{golfer.statusText ?? '—'}</td>
                        <td className={scoreClass(golfer.currentRoundScore)}>
                          {formatRelative(golfer.currentRoundScore)}
                        </td>
                        <td>{entry.teamName}</td>
                        <td className={scoreClass(golfer.tournamentScore)}>
                          {formatRelative(golfer.tournamentScore)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </>
        ) : null}

        <div className="augusta-board-footer">- Augusta National Golf Club -</div>
      </div>
    </main>
  );
}