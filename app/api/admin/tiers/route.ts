import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { replaceTiers, fetchTiers, type TierGolfer } from '@/lib/server/tiers';

async function ensureAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  return Boolean(env.adminAccessToken && token === env.adminAccessToken);
}

export async function GET() {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tiers = await fetchTiers();
    return NextResponse.json({ tiers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load admin tiers.' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { tiers?: TierGolfer[] };
    const tiers = body.tiers ?? [];

    const valid = tiers.every(
      (row) =>
        row.tier_number >= 1 &&
        row.tier_number <= 6 &&
        row.golfer_name?.trim().length > 0,
    );

    if (!valid) {
      return NextResponse.json(
        { error: 'Each tier row must include tier_number (1-6) and golfer_name.' },
        { status: 400 },
      );
    }

    await replaceTiers(
      tiers.map((entry) => ({
        tier_number: entry.tier_number,
        golfer_name: entry.golfer_name.trim(),
        odds: entry.odds?.trim() || null,
      })),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save tiers.' },
      { status: 500 },
    );
  }
}
