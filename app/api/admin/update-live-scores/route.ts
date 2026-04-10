import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

function isAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  return Boolean(env.adminAccessToken) && token === env.adminAccessToken;
}

export async function POST(request: NextRequest) {
  const tournamentId = 688;

  try {
    const res = await fetch(
      `https://api.sportsdata.io/golf/v2/json/PlayerTournamentRoundScores/${tournamentId}?key=${process.env.SPORTSDATA_API_KEY}`
    );

    const data = await res.json();

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Live score update failed:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch scores' },
      { status: 500 }
    );
  }
}
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message?: string }).message)
          : 'Failed to fetch live scores.',
      );
    }

    console.log(
      'SportsDataIO response sample:',
      Array.isArray(data) ? data.slice(0, 2) : data,
    );

    return NextResponse.json({
      success: true,
      count: Array.isArray(data) ? data.length : 0,
      message: 'Live scores fetched successfully.',
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