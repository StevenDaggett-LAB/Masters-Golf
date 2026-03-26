import { NextResponse } from 'next/server';
import {
  fetchTiers,
  hasExactDuplicateTeam,
  isDraftLocked,
  loadUserTeam,
  normalizeTeamPicks,
  saveUserTeam,
} from '@/lib/server/draft';

function validateTeamInput(body: { userId?: string; team?: Record<string, string> }) {
  const userId = body.userId?.trim();
  if (!userId) {
    return { ok: false as const, status: 400, message: 'Missing user session.' };
  }

  const picks = normalizeTeamPicks(body.team ?? {});
  const hasMissingTier = Object.values(picks).some((value) => !value);
  if (hasMissingTier) {
    return { ok: false as const, status: 400, message: 'Select one golfer in each tier.' };
  }

  return { ok: true as const, userId, picks };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId')?.trim();

  if (!userId) {
    return NextResponse.json({ error: 'Missing user session.' }, { status: 400 });
  }

  try {
    const team = await loadUserTeam(userId);
    return NextResponse.json({ team });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load your team.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string; team?: Record<string, string> };
    const parsed = validateTeamInput(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: parsed.status });
    }

    const locked = await isDraftLocked();
    if (locked) {
      return NextResponse.json(
        { error: 'Draft is locked. Teams are read-only now.' },
        { status: 403 },
      );
    }

    const tiers = await fetchTiers();
    const tierMap = new Map<number, Set<string>>();
    for (const tier of tiers) {
      if (!tierMap.has(tier.tierNumber)) {
        tierMap.set(tier.tierNumber, new Set());
      }
      tierMap.get(tier.tierNumber)?.add(tier.golferName);
    }

    const pickList = [
      parsed.picks.tier1,
      parsed.picks.tier2,
      parsed.picks.tier3,
      parsed.picks.tier4,
      parsed.picks.tier5,
      parsed.picks.tier6,
    ];

    for (let i = 0; i < pickList.length; i += 1) {
      const tierNumber = i + 1;
      if (!tierMap.get(tierNumber)?.has(pickList[i])) {
        return NextResponse.json(
          { error: `Invalid golfer selected for tier ${tierNumber}.` },
          { status: 400 },
        );
      }
    }

    const duplicate = await hasExactDuplicateTeam(parsed.picks, parsed.userId);
    if (duplicate) {
      return NextResponse.json(
        {
          error:
            'This exact team has already been taken. Please change at least one golfer.',
        },
        { status: 409 },
      );
    }

    const saved = await saveUserTeam(parsed.userId, parsed.picks);
    return NextResponse.json({ success: true, updated: saved.updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save team.' },
      { status: 500 },
    );
  }
}
