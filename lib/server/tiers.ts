import { createSupabaseAdminClient } from '@/lib/supabase';

export type TierGolfer = {
  tier_number: number;
  golfer_name: string;
  odds: string | null;
};

export async function fetchTiers() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tiers')
    .select('tier_number, golfer_name, odds')
    .order('tier_number', { ascending: true })
    .order('golfer_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load tiers: ${error.message}`);
  }

  return data as TierGolfer[];
}

export async function replaceTiers(entries: TierGolfer[]) {
  const supabase = createSupabaseAdminClient();

  const { error: deleteError } = await supabase.from('tiers').delete().gte('tier_number', 1);
  if (deleteError) {
    throw new Error(`Failed to clear tiers: ${deleteError.message}`);
  }

  if (!entries.length) {
    return;
  }

  const { error: insertError } = await supabase.from('tiers').insert(entries);
  if (insertError) {
    throw new Error(`Failed to save tiers: ${insertError.message}`);
  }
}
