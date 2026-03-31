'use client';

import { useEffect, useRef, useState } from 'react';
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

type RowHighlight = {
  movedUp: boolean;
  movedDown: boolean;
  scoreImproved: boolean;
  scoreWorsened: boolean;
};

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [prevEntries, setPrevEntries] = useState<LeaderboardEntry[] | null>(null);
  const [rowHighlights, setRowHighlights] = useState<Record<string, RowHighlight>>({});
  const currentEntriesRef = useRef<LeaderboardEntry[] | null>(null);
  const prevEntriesRef = useRef<LeaderboardEntry[] | null>(null);
  const clearHighlightsTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    currentEntriesRef.current = data?.entries ?? null;
  }, [data]);

  useEffect(() => {
    prevEntriesRef.current = prevEntries;
  }, [prevEntries]);

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
      try {
        const response = await fetch('/api/leaderboard', { cache: 'no-store' });
        const payload = (await response.json()) as LeaderboardResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load leaderboard.');
        }

        const previousEntries = prevEntriesRef.current;
        const nextHighlights: Record<string, RowHighlight> = {};

        if (previousEntries) {
          payload.entries.forEach((entry) => {
            const previousEntry = previousEntries.find((candidate) => candidate.userId === entry.userId);

            if (!previousEntry) {
              return;
            }

            const movedUp = entry.rankingPosition < previousEntry.rankingPosition;
            const movedDown = entry.rankingPosition > previousEntry.rankingPosition;
            const scoreImproved = entry.teamTotalScore < previousEntry.teamTotalScore;
            const scoreWorsened = entry.teamTotalScore > previousEntry.teamTotalScore;

            if (movedUp || movedDown || scoreImproved || scoreWorsened) {
              nextHighlights[entry.userId] = { movedUp, movedDown, scoreImproved, scoreWorsened };
            }
          });
        }

        if (clearHighlightsTimeoutRef.current !== null) {
          window.clearTimeout(clearHighlightsTimeoutRef.current);
        }

        setRowHighlights(nextHighlights);

        if (Object.keys(nextHighlights).length > 0) {
          clearHighlightsTimeoutRef.current = window.setTimeout(() => {
            setRowHighlights({});
          }, 2000);
        }

        setPrevEntries(currentEntriesRef.current);
        setData(payload);
        setError(null);
        setLastUpdatedAt(new Date());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load leaderboard.');
      }
    }

    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000);

    return () => {
      clearInterval(interval);
      if (clearHighlightsTimeoutRef.current !== null) {
        window.clearTimeout(clearHighlightsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <main>
      <section className="card">
        <h2>Leaderboard</h2>

        {!data && !error ? <p>Loading leaderboard…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {lastUpdatedAt ? <p>Last updated: {lastUpdatedAt.toLocaleTimeString()}</p> : null}

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
                {data.entries.map((entry) => {
                  const highlight = rowHighlights[entry.userId];
                  const rowClasses = [
                    entry.rankingPosition === 1 ? 'leaderboard-leader-row' : null,
                    highlight?.movedUp ? 'row-up' : null,
                    highlight?.movedDown ? 'row-down' : null,
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <tr key={entry.userId} className={rowClasses || undefined}>
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
                                  <span className="leaderboard-golfer-score">
                                    {formatRelativeToPar(golfer.tournamentScore)}
                                  </span>
                                </span>
                                {statusLine ? <span className="leaderboard-golfer-status">{statusLine}</span> : null}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className={highlight?.scoreImproved ? 'score-up' : highlight?.scoreWorsened ? 'score-down' : undefined}>
                        {formatRelativeToPar(entry.teamTotalScore)}
                      </td>
                      <td>{entry.tiebreakerApplied ? `Sunday birdies: ${entry.sundayBirdies}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
