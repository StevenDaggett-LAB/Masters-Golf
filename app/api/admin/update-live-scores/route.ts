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
      `https://api.sportsdata.io/golf/v2/json/Leaderboard/${tournamentId}?key=${apiKey}`,
      {
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch live scores.');
    }

    const data = await response.json();

    const playerRows = Array.isArray(data?.PlayerTournament) 
      ? data.PlayerTournament
      : Array.isArray(data?.Players)
        ? data.Players
        : Array.isArray(data?.Leaderboard)
          ? data.Leaderboard
          : []; 
          
    console.log(
      'LEADERBOARD SAMPLE ROW',
      playerRows.length > 0 ? JSON.stringify(playerRows[0], null, 2) : 'NO ROWS'
      );  
    if (playerRows.length === 0) {
      console.log('LEADERBOARD TOP LEVEL KEYS', Object.keys(data ?? {}));
      throw new Error('Leaderboard endpoint returned no player rows.');
    }     



const mapped = playerRows.map((row: Record<string, unknown>) => {
  const firstName = String(
    row.FirstName ??
      (typeof row.Player === 'object' && row.Player ? (row.Player as Record<string, unknown>).FirstName : '') ??
      ''
  ).trim();

  const lastName = String(
    row.LastName ??
      (typeof row.Player === 'object' && row.Player ? (row.Player as Record<string, unknown>).LastName : '') ??
      ''
  ).trim();

  const golferName = `${firstName} ${lastName}`.trim();


  const playerTournament =
    typeof row.PlayerTournament === 'object' && row.PlayerTournament
      ? (row.PlayerTournament as Record<string, unknown>)
      : row; 

  const totalScore =
    toIntOrNull(
      playerTournament.TotalScore ??
         playerTournament.Total ??
         row.TotalScore ??
         row.Total ??
         row.Score
    ) ?? 0;

  const madeCutValue = playerTournament.MadeCut ?? row.MadeCut;
  const madeCut =
    typeof madeCutValue === 'boolean'
      ? madeCutValue
      : typeof madeCutValue === 'number'
      ? madeCutValue !== 0
      : true;

  const isWithdrawnValue = playerTournament.IsWithdrawn ?? row.IsWithdrawn;
  const isWithdrawn =
    typeof isWithdrawnValue === 'boolean'
      ? isWithdrawnValue
      : typeof isWithdrawnValue === 'number'
      ? isWithdrawnValue !== 0
      : false;

  const statusText =
    isWithdrawn
      ? 'WD'
      : !madeCut
      ? 'MC'
      : String(row.Status ?? row.Position ?? '').trim() || null;

  return {
    golfer_name: golferName,
    total_score: totalScore,
    made_cut: madeCut,
    round_1_score: null,
    round_2_score: null,
    round_3_score: null,
    round_4_score: null,
    sunday_birdies: 0,
    status_text: statusText,
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
