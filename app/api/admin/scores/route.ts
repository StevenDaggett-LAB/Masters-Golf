import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { GolferScoreRecord, saveGolferScores } from '@/lib/server/scoring';

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

function normalizeRecord(input: Record<string, unknown>) {
  const golferName = String(input.golfer_name ?? input.golferName ?? '').trim();
  if (!golferName) return null;

  return {
    golferName,
    totalScore: toIntOrNull(input.total_score ?? input.totalScore) ?? 0,
    madeCut: parseBoolean(input.made_cut ?? input.madeCut, true),
    round1Score: toIntOrNull(input.round_1_score ?? input.round1Score),
    round2Score: toIntOrNull(input.round_2_score ?? input.round2Score),
    round3Score: toIntOrNull(input.round_3_score ?? input.round3Score),
    round4Score: toIntOrNull(input.round_4_score ?? input.round4Score),
    sundayBirdies: toIntOrNull(input.sunday_birdies ?? input.sundayBirdies) ?? 0,
  } satisfies GolferScoreRecord;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an array of score rows.' }, { status: 400 });
    }

    const rows = body;
    const records = rows
      .map((row) => (typeof row === 'object' && row ? normalizeRecord(row as Record<string, unknown>) : null))
      .filter((row): row is GolferScoreRecord => row !== null);

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid score rows found.' }, { status: 400 });
    }

    await saveGolferScores(records);
    return NextResponse.json({ success: true, count: records.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import scores.' },
      { status: 400 },
    );
  }
}
