import { NextResponse } from 'next/server';
import { getLeaderboardData } from '@/lib/server/scoring';

export async function GET() {
  try {
    const leaderboard = await getLeaderboardData();
    return NextResponse.json(leaderboard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load leaderboard.' },
      { status: 500 },
    );
  }
}
