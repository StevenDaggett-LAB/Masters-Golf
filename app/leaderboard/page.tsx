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

type TeamThruSummary = {
  finished: number;
  active: number;
  notStarted: number;
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

type ScoreUpdateHighlight = {
  golferRows: Record<string, true>;
  teamTotals: Record<string, true>;
};

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [prevEntries, setPrevEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [rowHighlights, setRowHighlights] = useState<Record<string, RowHighlight>>({});
  const [scoreUpdateHighlights, setScoreUpdateHighlights] = useState<ScoreUpdateHighlight>({
    golferRows: {},
    teamTotals: {},
  });
  const prevEntriesRef = useRef<LeaderboardEntry[] | null>(null);
  const clearHighlightsTimeoutRef = useRef<number | null>(null);
  const clearScoreUpdatesTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLeaderboard() {
      try {
        const response = await fetch('/api/leaderboard', { cache: 'no-store' });
        const payload = (await response.json()) as LeaderboardResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load leaderboard.');
        }

        if (!isMounted) {
          return;
        }

        const previousEntries = prevEntriesRef.current;
        const nextHighlights: Record<string, RowHighlight> = {};
        const nextScoreUpdates: ScoreUpdateHighlight = { golferRows: {}, teamTotals: {} };

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
            const teamTotalChanged = entry.teamTotalScore !== previousEntry.teamTotalScore;

            if (movedUp || movedDown || scoreImproved || scoreWorsened) {
              nextHighlights[entry.userId] = { movedUp, movedDown, scoreImproved, scoreWorsened };
            }

            if (teamTotalChanged) {
              nextScoreUpdates.teamTotals[entry.userId] = true;
            }

            const previousScoresByGolfer = new Map(
              previousEntry.selectedGolfers.map((golfer) => [golfer.golferName, golfer.tournamentScore])
            );

            entry.selectedGolfers.forEach((golfer) => {
              const previousGolferScore = previousScoresByGolfer.get(golfer.golferName);

              if (previousGolferScore !== undefined && previousGolferScore !== golfer.tournamentScore) {
                nextScoreUpdates.golferRows[`${entry.userId}-${golfer.golferName}`] = true;
              }
            });
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

        if (clearScoreUpdatesTimeoutRef.current !== null) {
          window.clearTimeout(clearScoreUpdatesTimeoutRef.current);
        }

        setScoreUpdateHighlights(nextScoreUpdates);

        if (
          Object.keys(nextScoreUpdates.golferRows).length > 0 ||
          Object.keys(nextScoreUpdates.teamTotals).length > 0
        ) {
          clearScoreUpdatesTimeoutRef.current = window.setTimeout(() => {
            setScoreUpdateHighlights({ golferRows: {}, teamTotals: {} });
          }, 1000);
        }

        setData(payload);
        setPrevEntries(payload.entries);
        prevEntriesRef.current = payload.entries;
        setError(null);
        setLastUpdatedAt(new Date());
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load leaderboard.');
      }
    }

    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (clearHighlightsTimeoutRef.current !== null) {
        window.clearTimeout(clearHighlightsTimeoutRef.current);
      }
      if (clearScoreUpdatesTimeoutRef.current !== null) {
        window.clearTimeout(clearScoreUpdatesTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    prevEntriesRef.current = prevEntries;
  }, [prevEntries]);

  function buildDisplayedRanks(entries: LeaderboardEntry[]) {
    const scoreGroups = new Map<number, { rank: number; count: number }>();
    const displayedRanks = new Map<string, string>();

    entries.forEach((entry, index) => {
      const existingGroup = scoreGroups.get(entry.teamTotalScore);

      if (existingGroup) {
        scoreGroups.set(entry.teamTotalScore, {
          rank: existingGroup.rank,
          count: existingGroup.count + 1,
        });
        return;
      }

      scoreGroups.set(entry.teamTotalScore, { rank: index + 1, count: 1 });
    });

    entries.forEach((entry) => {
      const group = scoreGroups.get(entry.teamTotalScore);
      const rankLabel = !group
        ? `${entry.rankingPosition}`
        : group.count > 1
          ? `T${group.rank}`
          : `${group.rank}`;

      displayedRanks.set(entry.userId, rankLabel);
    });

    return displayedRanks;
  }

  const displayedRanks = data?.isVisible ? buildDisplayedRanks(data.entries) : null;
  const prevRanksByUser = prevEntries
    ? new Map(prevEntries.map((entry) => [entry.userId, entry.rankingPosition]))
    : null;

  function getRankMovement(entry: LeaderboardEntry) {
    if (!prevRanksByUser) {
      return null;
    }

    const previousRank = prevRanksByUser.get(entry.userId);
    if (previousRank === undefined) {
      return null;
    }

    if (entry.rankingPosition < previousRank) {
      return <span className="rank-movement rank-movement-up">↑</span>;
    }

    if (entry.rankingPosition > previousRank) {
      return <span className="rank-movement rank-movement-down">↓</span>;
    }

    return null;
  }

  function getRelativeScoreClass(score: number | null) {
    if (score === null) {
      return null;
    }

    if (score < 0) {
      return 'score-good';
    }

    if (score > 0) {
      return 'score-bad';
    }

    return 'score-even';
  }

  function formatTeamToday(entry: LeaderboardEntry) {
    const availableRoundScores = entry.selectedGolfers
      .map((golfer) => golfer.currentRoundScore)
      .filter((score): score is number => score !== null);

    if (availableRoundScores.length === 0) {
      return { label: '—', value: null as number | null };
    }

    const todayTotal = availableRoundScores.reduce((sum, score) => sum + score, 0);
    return { label: formatRelativeToPar(todayTotal), value: todayTotal };
  }

  function buildTeamThruSummary(entry: LeaderboardEntry): TeamThruSummary {
    return entry.selectedGolfers.reduce<TeamThruSummary>(
      (summary, golfer) => {
        const status = golfer.statusText?.trim().toUpperCase() ?? '';

        if (!status) {
          summary.notStarted += 1;
          return summary;
        }

        if (
          status === 'F' ||
          status.startsWith('F*') ||
          status.startsWith('WD') ||
          status.startsWith('DQ') ||
          status.startsWith('MDF') ||
          status.startsWith('CUT')
        ) {
          summary.finished += 1;
          return summary;
        }

        if (status.includes(':') || status.includes('AM') || status.includes('PM') || status.includes('TBD')) {
          summary.notStarted += 1;
          return summary;
        }

        summary.active += 1;
        return summary;
      },
      { finished: 0, active: 0, notStarted: 0 },
    );
  }

  function formatTeamThru(summary: TeamThruSummary) {
    return `${summary.finished}F/${summary.active}A/${summary.notStarted}NS`;
  }

  return (
    <main>
      <section className="card">
        <h2>Leaderboard</h2>

        {!data && !error ? <p>Loading leaderboard…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {lastUpdatedAt ? <p className="leaderboard-meta-line">Last updated: {lastUpdatedAt.toLocaleTimeString()}</p> : null}

        {data && !data.isVisible ? <p>Teams will be revealed after the draft locks.</p> : null}

        {data && data.isVisible ? (
          <div className="leaderboard-content">
            <div className="pool-board-frame">
              <div className="pool-board-label-row pool-board-label-row-teams">
                <span>Rank</span>
                <span>Player</span>
                <span>Team</span>
                <span>Today</span>
                <span>Thru</span>
                <span>Total</span>
              </div>
              <div className="pool-board-list">
                {data.entries.map((entry) => {
                  const highlight = rowHighlights[entry.userId];
                  const teamToday = formatTeamToday(entry);
                  const teamThruSummary = buildTeamThruSummary(entry);
                  const teamThruLabel = formatTeamThru(teamThruSummary);
                  const entryClasses = [
                    'pool-board-entry',
                    entry.rankingPosition === 1 ? 'leaderboard-leader-row' : null,
                    highlight?.movedUp ? 'row-up' : null,
                    highlight?.movedDown ? 'row-down' : null,
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <article key={entry.userId} className={entryClasses}>
                      <div className="pool-board-entry-summary pool-board-entry-summary-teams">
                        <p className="pool-summary-cell pool-summary-rank">
                          <span className="pool-mobile-label">Rank</span>
                          <span className="rank-with-movement">
                            <span>{displayedRanks?.get(entry.userId) ?? entry.rankingPosition}</span>
                            {getRankMovement(entry)}
                          </span>
                        </p>
                        <p className="pool-summary-cell pool-summary-player">
                          <span className="pool-mobile-label">Player</span>
                          <span className="leaderboard-team-player">{entry.playerFullName}</span>
                        </p>
                        <p className="pool-summary-cell pool-summary-team">
                          <span className="pool-mobile-label">Team</span>
                          <span className="leaderboard-team-name">{entry.teamName}</span>
                        </p>
                        <p
                          className={[
                            'pool-summary-cell',
                            'leaderboard-team-today',
                            getRelativeScoreClass(teamToday.value),
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span className="pool-mobile-label">Today</span>
                          <span>{teamToday.label}</span>
                        </p>
                        <p className="pool-summary-cell leaderboard-team-thru">
                          <span className="pool-mobile-label">Thru</span>
                          <span>{teamThruLabel}</span>
                        </p>
                        <p
                          className={[
                            'pool-summary-cell',
                            'leaderboard-team-total',
                            highlight?.scoreImproved ? 'score-up' : null,
                            highlight?.scoreWorsened ? 'score-down' : null,
                            scoreUpdateHighlights.teamTotals[entry.userId] ? 'score-updated' : null,
                            getRelativeScoreClass(entry.teamTotalScore),
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span className="pool-mobile-label">Total</span>
                          <span>{formatRelativeToPar(entry.teamTotalScore)}</span>
                        </p>
                      </div>
                      <div className="leaderboard-golfer-detail-row">
                        <div className="leaderboard-golfer-detail-grid leaderboard-golfer-detail-head leaderboard-golfer-detail-head-teams">
                          <span>Golfer</span>
                          <span>Score</span>
                          <span>Status</span>
                          <span>RND</span>
                        </div>
                        <ul className="leaderboard-golfers">
                          {entry.selectedGolfers.map((golfer) => {
                            const golferKey = `${entry.userId}-${golfer.golferName}`;
                            const golferRowClass = scoreUpdateHighlights.golferRows[golferKey]
                              ? 'leaderboard-golfer-row score-updated'
                              : 'leaderboard-golfer-row';

                            return (
                              <li key={golferKey} className={golferRowClass}>
                                <span className="leaderboard-golfer-detail-grid leaderboard-golfer-detail-grid-teams">
                                  <span className="leaderboard-golfer-name">{golfer.golferName}</span>
                                  <span
                                    className={[
                                      'leaderboard-golfer-score',
                                      getRelativeScoreClass(golfer.tournamentScore),
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  >
                                    {formatRelativeToPar(golfer.tournamentScore)}
                                  </span>
                                  <span className="leaderboard-golfer-status">{golfer.statusText?.trim() || '—'}</span>
                                  <span
                                    className={[
                                      'leaderboard-golfer-round',
                                      getRelativeScoreClass(golfer.currentRoundScore),
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  >
                                    {golfer.currentRoundScore === null ? '—' : formatRelativeToPar(golfer.currentRoundScore)}
                                  </span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        {entry.tiebreakerApplied ? (
                          <p className="leaderboard-tiebreaker-note">Tiebreak: Sunday birdies {entry.sundayBirdies}</p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
