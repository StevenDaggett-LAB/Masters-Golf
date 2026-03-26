import { NextResponse } from 'next/server';
import { fetchTiers } from '@/lib/server/tiers';
import { getDraftSettings, getUserTeam } from '@/lib/server/draft';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
  }

  try {
    const [settings, tiers, existingTeam] = await Promise.all([
      getDraftSettings(),
      fetchTiers(),
      getUserTeam(userId),
    ]);

    return NextResponse.json({
      settings: {
        draftOpen: settings.draft_open,
        draftLocked: settings.draft_locked,
        lockTime: settings.lock_time,
      },
      tiers,
      existingTeam,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load draft data.' },
      { status: 500 },
    );
  }
}
