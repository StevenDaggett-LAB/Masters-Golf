import { createSupabaseAdminClient } from '@/lib/supabase';

export type TierGolfer = {
  id: string;
  tierNumber: number;
  golferName: string;
  odds: string | null;
};

export type TeamPicks = {
  tier1: string;
  tier2: string;
  tier3: string;
  tier4: string;
  tier5: string;
  tier6: string;
};

const tierNumbers = [1, 2, 3, 4, 5, 6] as const;

export function normalizeTeamPicks(input: Partial<TeamPicks>): TeamPicks {
  return {
    tier1: input.tier1?.trim() ?? '',
    tier2: input.tier2?.trim() ?? '',
    tier3: input.tier3?.trim() ?? '',
    tier4: input.tier4?.trim() ?? '',
    tier5: input.tier5?.trim() ?? '',
    tier6: input.tier6?.trim() ?? '',
  };
}

export async function fetchTiers() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tiers')
    .select('id, tier_number, golfer_name, odds')
    .order('tier_number', { ascending: true })
    .order('golfer_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch tiers: ${error.message}`);
  }

  return (data ?? []).map(
    (row): TierGolfer => ({
      id: row.id,
      tierNumber: row.tier_number,
      golferName: row.golfer_name,
      odds: row.odds,
    }),
  );
}

export async function replaceTiers(nextTiers: Array<{ tierNumber: number; golferName: string; odds?: string }>) {
  const cleanRows = nextTiers
    .map((row) => ({
      tier_number: row.tierNumber,
      golfer_name: row.golferName.trim(),
      odds: row.odds?.trim() || null,
    }))
    .filter((row) => row.golfer_name.length > 0);

  for (const tier of tierNumbers) {
    const count = cleanRows.filter((row) => row.tier_number === tier).length;
    if (count === 0) {
      throw new Error(`Tier ${tier} must include at least one golfer.`);
    }
  }

  const supabase = createSupabaseAdminClient();
  const { error: deleteError } = await supabase.from('tiers').delete().gte('tier_number', 1);

  if (deleteError) {
    throw new Error(`Failed to reset tiers: ${deleteError.message}`);
  }

  const { error: insertError } = await supabase.from('tiers').insert(cleanRows);
  if (insertError) {
    throw new Error(`Failed to save tiers: ${insertError.message}`);
  }
}

export async function loadUserTeam(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('teams')
    .select('id, user_id, tier1, tier2, tier3, tier4, tier5, tier6, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load team: ${error.message}`);
  }

  return data;
}

export async function isDraftLocked() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('settings')
    .select('draft_open, draft_locked')
    .eq('id', 1)
    .single();

  if (error) {
    throw new Error(`Failed to load draft settings: ${error.message}`);
  }

  return data.draft_locked || !data.draft_open;
}

export async function hasExactDuplicateTeam(team: TeamPicks, excludeUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('tier1', team.tier1)
    .eq('tier2', team.tier2)
    .eq('tier3', team.tier3)
    .eq('tier4', team.tier4)
    .eq('tier5', team.tier5)
    .eq('tier6', team.tier6)
    .not('user_id', 'eq', excludeUserId);

  if (error) {
    throw new Error(`Failed to check duplicate team: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

export async function saveUserTeam(userId: string, picks: TeamPicks) {
  const existingTeam = await loadUserTeam(userId);
  const supabase = createSupabaseAdminClient();

  if (existingTeam) {
    const { error } = await supabase
      .from('teams')
      .update({ ...picks, updated_at: new Date().toISOString() })
      .eq('id', existingTeam.id);

    if (error) {
      throw new Error(`Failed to update team: ${error.message}`);
    }

    return { updated: true };
  }

  const { error } = await supabase.from('teams').insert({ user_id: userId, ...picks });
  if (error) {
    throw new Error(`Failed to save team: ${error.message}`);
  }

  return { updated: false };
}
