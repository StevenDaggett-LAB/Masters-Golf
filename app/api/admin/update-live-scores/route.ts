import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { saveGolferScores, type GolferScoreRecord } from '@/lib/server/scoring';

function isAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  return Boolean(env.adminAccessToken) && token === env.adminAccessToken;
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

function parseBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 'yes', 'y', '1'].includes(normalized);
  }
  return fallback;
}

function normalizeRecord(input: Record<string, unknown>): GolferScoreRecord | null {
  const golferName = String(input.golfer_name ?? input.golferName ?? '').trim();
  if (!golferName) return null;

  return {
    golferName,
    totalScore: toIntOrNull(input.total_score ?? input.totalScore) ?? 0,
    madeCut: parseBoolean(input.made_cut ?? input.madeCut, true),
    round1Score: toIntOrNull(input.round_1_score ?? input.round1Score) ?? null,
    round2Score: toIntOrNull(input.round_2_score ?? input.round2Score) ?? null,
    round3Score: toIntOrNull(input.round_3_score ?? input.round3Score) ?? null,
    round4Score: toIntOrNull(input.round_4_score ?? input.round4Score) ?? null,
    sundayBirdies: toIntOrNull(input.sunday_birdies ?? input.sundayBirdies) ?? 0,
    statusText: String(input.status_text ?? input.statusText ?? '').trim() || null,
    currentRoundScore:
      toIntOrNull(input.current_round_score ?? input.currentRoundScore) ?? null,
  } satisfies GolferScoreRecord;
}


export async function POST(request: NextRequest) {
  const tournamentId = 688;

  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.SPORTSDATA_API_KEY;

    if (!apiKey) {
      throw new Error('SPORTSDATA_API_KEY is not configured.');
    }

    const response = await fetch(
      `https://api.sportsdata.io/golf/v2/json/PlayerTournamentRoundScores/${tournamentId}?key=${apiKey}`,
      {
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch live scores.');
    }

    const data = await response.json();


const mapped = data.map((player: Record<string, unknown>) => {
  const rounds = Array.isArray(player.PlayerRoundScore)
    ? (player.PlayerRoundScore as Array<Record<string, unknown>>)
    : [];

  const getRoundScore = (roundNumber: number) => {
    const round = rounds.find(
      (r: Record<string, unknown>) => Number(r.Number) === roundNumber
    );
    return typeof round?.Score === 'number' ? round.Score : toIntOrNull(round?.Score);
  };

return {
    golfer_name: `${String(player.FirstName ?? '')} ${String(player.LastName ?? '')}`.trim(),
    total_score: toIntOrNull(player.TotalScore) ?? 0,
    made_cut: true,
    round_1_score: getRoundScore(1),
    round_2_score: getRoundScore(2),
    round_3_score: getRoundScore(3),
    round_4_score: getRoundScore(4),
    sunday_birdies: 0,
    status_text: String(player.Status ?? '').trim() || null,
    current_round_score: null,
  };
});
    const normalized = mapped
       .map((r: Record<string, unknown>) => normalizeRecord(r))
       .filter((r: GolferScoreRecord | null): r is GolferScoreRecord => r !== null);

    await saveGolferScores(normalized);



    return NextResponse.json({
      success: true,
      count: Array.isArray(data) ? data.length : 0,
      message: 'Live scores fetched successfully.',
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update live scores.',
      },
      { status: 500 }
    );
  }
}
