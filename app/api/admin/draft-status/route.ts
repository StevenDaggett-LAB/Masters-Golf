import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getDraftStatus, setDraftAdminState } from '@/lib/server/draft';

function isAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  return Boolean(env.adminAccessToken) && token === env.adminAccessToken;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { action?: 'open' | 'lock' };
    if (!body.action || (body.action !== 'open' && body.action !== 'lock')) {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    await setDraftAdminState(body.action === 'open' ? 'open' : 'locked');
    const status = await getDraftStatus();

    return NextResponse.json({
      success: true,
      status: status.status,
      draftLocked: status.effectiveLocked,
      draftOpen: status.draftOpen,
      draftLockedByAdminSetting: status.draftLocked,
      deadlinePassed: status.deadlinePassed,
      hardLockTimeUtc: status.hardLockTimeUtc,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update draft status.' },
      { status: 400 },
    );
  }
}
