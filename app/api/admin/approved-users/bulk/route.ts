import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin-auth';
import { bulkAddApprovedUsers } from '@/lib/server/approved-users';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { names?: string[] };
    const count = await bulkAddApprovedUsers(body.names ?? []);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import approved users.' },
      { status: 400 },
    );
  }
}
