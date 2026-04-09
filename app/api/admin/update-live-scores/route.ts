import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin-auth';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    message: 'Live score update route is ready.',
  });
}
