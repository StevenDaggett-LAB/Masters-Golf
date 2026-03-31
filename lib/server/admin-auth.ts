import { NextRequest } from 'next/server';
import { env } from '@/lib/env';

export function isAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  return Boolean(env.adminAccessToken) && token === env.adminAccessToken;
}
