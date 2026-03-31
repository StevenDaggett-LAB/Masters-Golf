import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin-auth';
import {
  addApprovedUser,
  listApprovedUsers,
  removeApprovedUserById,
} from '@/lib/server/approved-users';

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await listApprovedUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load approved users.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { firstName?: string; lastName?: string };
    const user = await addApprovedUser(body.firstName ?? '', body.lastName ?? '');
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add approved user.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string };
    await removeApprovedUserById(body.id ?? '');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove approved user.' },
      { status: 400 },
    );
  }
}
