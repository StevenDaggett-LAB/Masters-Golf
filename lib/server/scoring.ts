import { createSupabaseAdminClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { getDraftStatus, TeamPicks } from '@/lib/server/draft';

export type GolferScoreRecord = {
  golferName: string;
  totalScore: number;
  madeCut: boolean;
  round1Score: number | null;
  round2Score: number | null;
  round3Score: number | null;
  round4Score: number | null;
  sundayBirdies: number;
  statusText?: string | null;
  currentRoundScore?: number | null;
};

export type LeaderboardGolferBreakdown = {
  golferName: string;
  tournamentScore: number;
  statusText: string | null;
  currentRoundScore: number | null;
};

export type LeaderboardEntry = {
  userId: string;
  playerFullName: string;
  teamName: string;
  selectedGolfers: LeaderboardGolferBreakdown[];
  teamTotalScore: number;
  sundayBirdies: number;
  rankingPosition: number;
  tiebreakerApplied: boolean;
};

type TeamRow = {
  userId: string;
  playerFullName: string;
  teamName: string;
  picks: TeamPicks;
};

type ScoredTeam = TeamRow & {
  selectedGolfers: LeaderboardGolferBreakdown[];
  teamTotalScore: number;
  sundayBirdies: number;
};

const inMemoryScores = new Map<string, GolferScoreRecord>();
function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function toIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function toIntOrDefault(value: unknown, fallback: number) {
  const parsed = toIntOrNull(value);
  return parsed ?? fallback;
}

function parseBoolean(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function computeRoundHighs(records: GolferScoreRecord[]) {
  const rounds: Array<keyof Pick<GolferScoreRecord, 'round1Score' | 'round2Score' | 'round3Score' | 'round4Score'>> = [
    'round1Score',
    'round2Score',
    'round3Score',
    'round4Score',
  ];

  const highs: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  rounds.forEach((roundKey, idx) => {
    const values = records
      .map((record) => {
        const roundScore = record[roundKey];
        if (typeof roundScore !== 'number') {
          return null;
        }

        return roundScore;
      })
      .filter((value): value is number => typeof value === 'number');

    highs[idx + 1] = values.length > 0 ? Math.max(...values) : 0;
  });

  return highs;
}


function calculateGolferEffectiveTotal(
  record: GolferScoreRecord,
  highs: Record<number, number>
) {
 if (record.madeCut) {
    return record.totalScore;
  }

  const r1 = typeof record.round1Score === 'number' ? record.round1Score : 0;
  const r2 = typeof record.round2Score === 'number' ? record.round2Score : 0;

  return r1 + r2 + highs[3] + highs[4];
}
function compareScoredTeams(a: Pick<ScoredTeam, 'teamTotalScore' | 'sundayBirdies' | 'teamName'>, b: Pick<ScoredTeam, 'teamTotalScore' | 'sundayBirdies' | 'teamName'>) {
  if (a.teamTotalScore !== b.teamTotalScore) {
    return a.teamTotalScore - b.teamTotalScore;
  }

  if (a.sundayBirdies !== b.sundayBirdies) {
    return b.sundayBirdies - a.sundayBirdies;
  }

  return a.teamName.localeCompare(b.teamName);
}

async function loadSavedTeams(): Promise<TeamRow[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('teams')
    .select('user_id, tier1, tier2, tier3, tier4, tier5, tier6, users!inner(full_name, team_name)')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load saved teams: ${error.message}`);
  }

  const seenUserIds = new Set<string>();
  const rows: TeamRow[] = [];

  for (const row of data ?? []) {
    if (seenUserIds.has(row.user_id)) {
      continue;
    }

    seenUserIds.add(row.user_id);

    const userRow = Array.isArray(row.users) ? row.users[0] : row.users;
    if (!userRow) {
      continue;
    }

    rows.push({
      userId: row.user_id,
      playerFullName: userRow.full_name,
      teamName: userRow.team_name,
      picks: {
        tier1: row.tier1,
        tier2: row.tier2,
        tier3: row.tier3,
        tier4: row.tier4,
        tier5: row.tier5,
        tier6: row.tier6,
      },
    });
  }

  return rows;
}

export async function loadGolferScores(): Promise<GolferScoreRecord[]> {
  if (!hasSupabaseConfig()) {
    return Array.from(inMemoryScores.values()).sort((a, b) => a.golferName.localeCompare(b.golferName));
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('golfer_scores')
    .select(
      'golfer_name, total_score, made_cut, round_1_score, round_2_score, round_3_score, round_4_score, sunday_birdies, status_text, current_round_score',
    )
    .order('golfer_name', { ascending: true });

  if (error) {
    if (inMemoryScores.size > 0) {
      return Array.from(inMemoryScores.values()).sort((a, b) => a.golferName.localeCompare(b.golferName));
    }

    throw new Error(`Failed to load golfer scores: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    golferName: row.golfer_name,
    totalScore: toIntOrDefault(row.total_score, 0),
    madeCut: parseBoolean(row.made_cut, true),
    round1Score: toIntOrNull(row.round_1_score),
    round2Score: toIntOrNull(row.round_2_score),
    round3Score: toIntOrNull(row.round_3_score),
    round4Score: toIntOrNull(row.round_4_score),
    sundayBirdies: toIntOrDefault(row.sunday_birdies, 0),
    statusText: typeof row.status_text === 'string' ? row.status_text.trim() || null : null,
    currentRoundScore: toIntOrNull(row.current_round_score),
  }));
}
export async function saveGolferScores(records: GolferScoreRecord[]) {
  if (!hasSupabaseConfig()) {
    for (const record of records) {
      inMemoryScores.set(normalizeName(record.golferName), {
        ...record,
        golferName: record.golferName.trim(),
      });
    }
    return;
  }

  const supabase = createSupabaseAdminClient();

  const upsertRows = records.map((record) => ({
    golfer_name: record.golferName.trim(),
    total_score: record.totalScore,
    made_cut: record.madeCut,
    round_1_score: record.round1Score,
    round_2_score: record.round2Score,
    round_3_score: record.round3Score,
    round_4_score: record.round4Score,
    sunday_birdies: record.sundayBirdies,
    status_text: record.statusText?.trim() || null,
    current_round_score: record.currentRoundScore ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('golfer_scores')
    .upsert(upsertRows, { onConflict: 'golfer_name', ignoreDuplicates: false });

  if (error) {
    for (const record of records) {
      inMemoryScores.set(normalizeName(record.golferName), {
        ...record,
        golferName: record.golferName.trim(),
      });
    }
    return;
  }
}

export async function getLeaderboardData() {
  const status = await getDraftStatus();
  if (!status.effectiveLocked) {
    return {
      isVisible: false,
      hardLockTimeUtc: status.hardLockTimeUtc,
      entries: [] as LeaderboardEntry[],
    };
  }

  const [teams, scores] = await Promise.all([loadSavedTeams(), loadGolferScores()]);

  const scoreMap = new Map(scores.map((record) => [normalizeName(record.golferName), record]));
  const highs = computeRoundHighs(scores);

  const scored: ScoredTeam[] = teams.map((team) => {
    const golferNames = [
      team.picks.tier1,
      team.picks.tier2,
      team.picks.tier3,
      team.picks.tier4,
      team.picks.tier5,
      team.picks.tier6,
    ];

    const totals = golferNames.map((golferName) => {
      const record = scoreMap.get(normalizeName(golferName));
      if (!record) {
        return {
          golferName,
          tournamentScore: 0,
          statusText: null,
          currentRoundScore: null,
          total: 0,
          sundayBirdies: 0,
        };
      }
if (record.golferName === 'Min Woo Lee') {
  console.log('MIN WOO RECORD', record);
  console.log('ROUND HIGHS', highs);
}
      const tournamentScore = calculateGolferEffectiveTotal(record, highs);
      return {
        golferName: record.golferName,
        tournamentScore,
        statusText: record.statusText ?? null,
        currentRoundScore: record.currentRoundScore ?? null,
        total: tournamentScore,
        sundayBirdies: record.sundayBirdies,
      };
    });

    return {
      ...team,
      selectedGolfers: totals.map(({ golferName, tournamentScore, statusText, currentRoundScore }) => ({
        golferName,
        tournamentScore,
        statusText,
        currentRoundScore,
      })),
      teamTotalScore: totals.reduce((sum, item) => sum + item.total, 0),
      sundayBirdies: totals.reduce((sum, item) => sum + item.sundayBirdies, 0),
    };
  });

  scored.sort(compareScoredTeams);

  const scoreGroupCounts = new Map<number, number>();
  for (const row of scored) {
    scoreGroupCounts.set(row.teamTotalScore, (scoreGroupCounts.get(row.teamTotalScore) ?? 0) + 1);
  }

  const entries: LeaderboardEntry[] = scored.map((row, index) => ({
    userId: row.userId,
    playerFullName: row.playerFullName,
    teamName: row.teamName,
    selectedGolfers: row.selectedGolfers,
    teamTotalScore: row.teamTotalScore,
    sundayBirdies: row.sundayBirdies,
    rankingPosition: index + 1,
    tiebreakerApplied: (scoreGroupCounts.get(row.teamTotalScore) ?? 0) > 1,
  }));

  return {
    isVisible: true,
    hardLockTimeUtc: status.hardLockTimeUtc,
    entries,
  };
}
