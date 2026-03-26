import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const cookieToken = request.cookies.get('admin_token')?.value;

    if (!env.adminAccessToken || cookieToken !== env.adminAccessToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
