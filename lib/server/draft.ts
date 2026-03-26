import { createSupabaseAdminClient } from '@/lib/supabase';

export type TeamSelections = {
  tier1: string;
  tier2: string;
  tier3: string;
  tier4: string;
  tier5: string;
  tier6: string;
};

export function validateSelections(selections: Partial<TeamSelections>) {
  const requiredTiers: Array<keyof TeamSelections> = [
    'tier1',
    'tier2',
    'tier3',
    'tier4',
    'tier5',
    'tier6',
  ];

  for (const key of requiredTiers) {
    if (!selections[key]?.trim()) {
      return { ok: false as const, message: 'Please select one golfer from all six tiers.' };
    }
  }

  return { ok: true as const };
}

export async function getDraftSettings() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('settings')
    .select('draft_open, draft_locked, lock_time')
    .eq('id', 1)
    .single();

  if (error) {
    throw new Error(`Failed to load settings: ${error.message}`);
  }

  return data;
}

export async function getUserTeam(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('teams')
    .select('id, tier1, tier2, tier3, tier4, tier5, tier6, is_locked, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load team: ${error.message}`);
  }

  return data;
}

export async function exactDuplicateExists(userId: string, selections: TeamSelections) {
  const supabase = createSupabaseAdminClient();

  // Exact duplicate prevention: block only 6/6 identical teams from other users.

  const { data, error } = await supabase
    .from('teams')
    .select('id')
    .eq('tier1', selections.tier1)
    .eq('tier2', selections.tier2)
    .eq('tier3', selections.tier3)
    .eq('tier4', selections.tier4)
    .eq('tier5', selections.tier5)
    .eq('tier6', selections.tier6)
    .neq('user_id', userId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to validate duplicate team: ${error.message}`);
  }

  return Boolean(data && data.length > 0);
}

export async function upsertTeam(userId: string, selections: TeamSelections) {
  const supabase = createSupabaseAdminClient();

  // Keep one team row per user by updating existing selection sets in place.
  const existing = await getUserTeam(userId);
  if (existing) {
    const { error } = await supabase
      .from('teams')
      .update({ ...selections, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to update team: ${error.message}`);
    }

    return;
  }

  const { error } = await supabase.from('teams').insert({
    user_id: userId,
    ...selections,
    is_locked: false,
  });

  if (error) {
    throw new Error(`Failed to save team: ${error.message}`);
  }
}
