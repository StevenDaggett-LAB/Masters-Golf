import { NextResponse } from 'next/server';
import { getDraftStatus } from '@/lib/server/draft';

export async function GET() {
  try {
    const status = await getDraftStatus();

    return NextResponse.json({
      draftLocked: status.effectiveLocked,
      draftOpen: status.draftOpen,
      lockTime: status.lockTime,
      status: status.status,
      deadlinePassed: status.deadlinePassed,
      hardLockTimeUtc: status.hardLockTimeUtc,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? `Failed to load lobby status: ${error.message}` : 'Failed to load lobby status.',
      },
      { status: 500 },
    );
  }
}
