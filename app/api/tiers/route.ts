import { NextResponse } from 'next/server';
import { fetchTiers } from '@/lib/server/draft';

export async function GET() {
  try {
    const tiers = await fetchTiers();
    return NextResponse.json({ tiers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load tiers.' },
      { status: 500 },
    );
  }
}
