import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin-auth';
import { getDraftStatus, resetTournamentData } from '@/lib/server/draft';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await resetTournamentData();
    const status = await getDraftStatus();

    return NextResponse.json({
      success: true,
      message: 'Tournament data has been reset.',
      status: status.status,
      draftLocked: status.effectiveLocked,
      draftOpen: status.draftOpen,
      draftLockedByAdminSetting: status.draftLocked,
      deadlinePassed: status.deadlinePassed,
      hardLockTimeUtc: status.hardLockTimeUtc,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset tournament data.' },
      { status: 400 },
    );
  }
}
