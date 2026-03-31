import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizeFullName } from '@/lib/normalizers';

export type ApprovedUser = {
  id: string;
  fullName: string;
};

function buildFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function uniqueByNormalizedName(names: string[]) {
  const deduped = new Map<string, string>();

  for (const name of names) {
    const normalized = normalizeFullName(name);
    if (!normalized || deduped.has(normalized)) {
      continue;
    }
    deduped.set(normalized, name);
  }

  return [...deduped.values()];
}

export async function listApprovedUsers(): Promise<ApprovedUser[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('approved_users')
    .select('id, full_name')
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load approved users: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
  }));
}

export async function addApprovedUser(firstName: string, lastName: string): Promise<ApprovedUser> {
  const fullName = buildFullName(firstName, lastName);
  if (!fullName) {
    throw new Error('First name and last name are required.');
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('approved_users')
    .insert({ full_name: fullName })
    .select('id, full_name')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`${fullName} is already approved.`);
    }
    throw new Error(`Failed to add approved user: ${error.message}`);
  }

  return { id: data.id, fullName: data.full_name };
}

export async function bulkAddApprovedUsers(fullNames: string[]): Promise<number> {
  const cleaned = uniqueByNormalizedName(fullNames.map((name) => name.trim()).filter(Boolean));
  if (cleaned.length === 0) {
    return 0;
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingRows, error: existingError } = await supabase.from('approved_users').select('full_name');

  if (existingError) {
    throw new Error(`Failed to load existing approved users: ${existingError.message}`);
  }

  const existing = new Set((existingRows ?? []).map((row) => normalizeFullName(row.full_name)));
  const toInsert = cleaned.filter((name) => !existing.has(normalizeFullName(name)));

  if (toInsert.length === 0) {
    return 0;
  }

  const { error } = await supabase.from('approved_users').insert(toInsert.map((fullName) => ({ full_name: fullName })));

  if (error) {
    throw new Error(`Failed to import approved users: ${error.message}`);
  }

  return toInsert.length;
}

export async function removeApprovedUserById(id: string) {
  if (!id) {
    throw new Error('Approved user id is required.');
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('approved_users').delete().eq('id', id);
  if (error) {
    throw new Error(`Failed to remove approved user: ${error.message}`);
  }
}
