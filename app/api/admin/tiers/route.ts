import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { replaceTiers } from '@/lib/server/draft';

function isAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  return Boolean(env.adminAccessToken) && token === env.adminAccessToken;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      tiers?: Array<{ tierNumber?: number; golferName?: string; odds?: string }>;
      replaceAll?: boolean;
      confirmReplace?: boolean;
    };

    if (body.replaceAll && !body.confirmReplace) {
      return NextResponse.json(
        { error: 'Replace-all action requires explicit confirmation.' },
        { status: 400 },
      );
    }

    const tiers = (body.tiers ?? []).map((tier) => ({
      tierNumber: tier.tierNumber ?? 0,
      golferName: tier.golferName ?? '',
      odds: tier.odds ?? '',
    }));

    await replaceTiers(tiers);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save tiers.' },
      { status: 400 },
    );
  }
}
