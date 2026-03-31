import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin-auth';
import {
  fetchTiers,
  hasExactDuplicateTeam,
  isDraftLocked,
  listApprovedUsersWithoutRegistration,
  listRegisteredUsers,
  loadUserTeam,
  normalizeTeamPicks,
  saveUserTeam,
} from '@/lib/server/draft';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizeFullName } from '@/lib/normalizers';

function validateTeamInput(body: { team?: Record<string, string> }) {
  const picks = normalizeTeamPicks(body.team ?? {});
  const hasMissingTier = Object.values(picks).some((value) => !value);
  if (hasMissingTier) {
    return { ok: false as const, status: 400, message: 'Select one golfer in each tier.' };
  }

  return { ok: true as const, picks };
}

type TeamEntryPayload = {
  userId?: string;
  approvedUserId?: string;
  fullName?: string;
  teamName?: string;
  phone?: string;
  email?: string;
  team?: Record<string, string>;
};

async function resolveUserIdForTeamEntry(body: TeamEntryPayload) {
  const userId = body.userId?.trim();
  if (userId) {
    return { ok: true as const, userId, created: false };
  }

  const teamName = body.teamName?.trim();
  if (!teamName) {
    return { ok: false as const, status: 400, message: 'Team name is required when creating a new user.' };
  }

  const suppliedApprovedUserId = body.approvedUserId?.trim();
  const suppliedName = body.fullName?.trim();
  const normalizedName = suppliedName ? normalizeFullName(suppliedName) : '';
  const supabase = createSupabaseAdminClient();

  const { data: approvedUsers, error: approvedError } = await supabase.from('approved_users').select('id, full_name');
  if (approvedError) {
    return {
      ok: false as const,
      status: 500,
      message: `Failed to validate approved user: ${approvedError.message}`,
    };
  }

  const approvedUser =
    approvedUsers?.find((row) => row.id === suppliedApprovedUserId) ??
    approvedUsers?.find((row) => normalizeFullName(row.full_name) === normalizedName);

  if (!approvedUser) {
    return {
      ok: false as const,
      status: 403,
      message: 'User must exist in approved users before admin can create a team.',
    };
  }

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id')
    .eq('approved_user_id', approvedUser.id)
    .maybeSingle();

  if (existingUserError) {
    return {
      ok: false as const,
      status: 500,
      message: `Failed to check existing registration: ${existingUserError.message}`,
    };
  }

  if (existingUser) {
    return { ok: true as const, userId: existingUser.id, created: false };
  }

  const { data: insertedUser, error: insertError } = await supabase
    .from('users')
    .insert({
      approved_user_id: approvedUser.id,
      full_name: approvedUser.full_name,
      team_name: teamName,
      phone: body.phone?.trim() || null,
      email: body.email?.trim().toLowerCase() || null,
      pin_hash: null,
    })
    .select('id')
    .single();

  if (insertError) {
    return {
      ok: false as const,
      status: 500,
      message: `Failed to create user: ${insertError.message}`,
    };
  }

  return { ok: true as const, userId: insertedUser.id, created: true };
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = request.nextUrl.searchParams.get('userId')?.trim();

  try {
    if (!userId) {
      const [users, approvedUsersWithoutRegistration] = await Promise.all([
        listRegisteredUsers(),
        listApprovedUsersWithoutRegistration(),
      ]);
      return NextResponse.json({ users, approvedUsersWithoutRegistration });
    }

    const users = await listRegisteredUsers();
    const selectedUser = users.find((user) => user.id === userId);
    if (!selectedUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const team = await loadUserTeam(userId);
    return NextResponse.json({ user: selectedUser, team });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load admin team entry data.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as TeamEntryPayload;
    const parsed = validateTeamInput(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: parsed.status });
    }

    const locked = await isDraftLocked();
    if (locked) {
      return NextResponse.json(
        { error: 'Draft is locked. Team edits closed on April 8, 2026 at 8:00 PM Pacific.' },
        { status: 403 },
      );
    }

    const userResolution = await resolveUserIdForTeamEntry(body);
    if (!userResolution.ok) {
      return NextResponse.json({ error: userResolution.message }, { status: userResolution.status });
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

    const duplicate = await hasExactDuplicateTeam(parsed.picks, userResolution.userId);
    if (duplicate) {
      return NextResponse.json(
        {
          error: 'This exact team has already been taken. Please change at least one golfer.',
        },
        { status: 409 },
      );
    }

    const saved = await saveUserTeam(userResolution.userId, parsed.picks);
    return NextResponse.json({
      success: true,
      updated: saved.updated,
      createdUser: userResolution.created,
      userId: userResolution.userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save team.' },
      { status: 500 },
    );
  }
}
