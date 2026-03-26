import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

const cookieName = 'admin_token';

export async function POST() {
  if (!env.adminAccessToken) {
    return NextResponse.json(
      { error: 'ADMIN_ACCESS_TOKEN is not configured on the server.' },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieName, env.adminAccessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}


export async function GET(request: NextRequest) {
  if (!env.adminAccessToken) {
    return NextResponse.json({ hasAccess: false });
  }

  const token = request.cookies.get(cookieName)?.value;

  return NextResponse.json({ hasAccess: token === env.adminAccessToken });
}

