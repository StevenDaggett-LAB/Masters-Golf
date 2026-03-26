import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizeFullName } from '@/lib/normalizers';

type RegistrationPayload = {
  fullName: string;
  teamName: string;
  phone?: string;
  email?: string;
};

type RegistrationResult =
  | { ok: true; userId: string; existing: boolean }
  | { ok: false; status: number; message: string };

/**
 * Handles approved-user validation plus duplicate-safe user creation.
 * We keep this outside of API/UI files so registration rules live in one place.
 */
export async function registerApprovedUser(payload: RegistrationPayload): Promise<RegistrationResult> {
  const fullName = payload.fullName.trim();
  const teamName = payload.teamName.trim();
  const phone = payload.phone?.trim() || null;
  const email = payload.email?.trim().toLowerCase() || null;

  if (!fullName || !teamName) {
    return { ok: false, status: 400, message: 'Full name and team name are required.' };
  }

  const normalizedName = normalizeFullName(fullName);
  const supabase = createSupabaseAdminClient();

  // Load approved users and perform normalized case-insensitive matching in app code.
  const { data: approvedUsers, error: approvedError } = await supabase
    .from('approved_users')
    .select('id, full_name');

  if (approvedError) {
    return {
      ok: false,
      status: 500,
      message: `Failed to validate approved user: ${approvedError.message}`,
    };
  }

  const approvedUser = (approvedUsers ?? []).find((candidate) => {
    return normalizeFullName(candidate.full_name) === normalizedName;
  });

  if (!approvedUser) {
    return {
      ok: false,
      status: 403,
      message: 'You are not on the approved list. Please contact the admin.',
    };
  }

  // Prevent duplicate registrations by tying each user to one approved_user record.
  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id')
    .eq('approved_user_id', approvedUser.id)
    .maybeSingle();

  if (existingUserError) {
    return {
      ok: false,
      status: 500,
      message: `Failed to check existing registration: ${existingUserError.message}`,
    };
  }

  if (existingUser) {
    return { ok: true, userId: existingUser.id, existing: true };
  }

  const { data: insertedUser, error: insertError } = await supabase
    .from('users')
    .insert({
      approved_user_id: approvedUser.id,
      full_name: approvedUser.full_name,
      team_name: teamName,
      phone,
      email,
      pin_hash: null,
    })
    .select('id')
    .single();

  if (insertError) {
    return {
      ok: false,
      status: 500,
      message: `Failed to create user: ${insertError.message}`,
    };
  }

  return { ok: true, userId: insertedUser.id, existing: false };
}
