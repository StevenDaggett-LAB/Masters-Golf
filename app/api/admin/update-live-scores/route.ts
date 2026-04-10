import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

function isAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  return Boolean(env.adminAccessToken) && token === env.adminAccessToken;
}

export async function POST(request: NextRequest) {
  const tournamentId = 688;

  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.SPORTSDATA_API_KEY;

    if (!apiKey) {
      throw new Error('SPORTSDATA_API_KEY is not configured.');
    }

    const response = await fetch(
      `https://api.sportsdata.io/golf/v2/json/PlayerTournamentRoundScores/${tournamentId}?key=${apiKey}`,
      {
        cache: 'no-store',
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message?: string }).message)
          : 'Failed to fetch live scores.',
      );
    }

    return NextResponse.json({
      success: true,
      count: Array.isArray(data) ? data.length : 0,
      message: 'Live scores fetched successfully.',
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update live scores.',
      },
      { status: 500 },
    );
  }
}