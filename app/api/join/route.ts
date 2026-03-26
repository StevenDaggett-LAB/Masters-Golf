import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizeFullName } from '@/lib/normalizers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { fullName?: string; teamName?: string };
    const fullName = body.fullName?.trim();
    const teamName = body.teamName?.trim();

    if (!fullName || !teamName) {
      return NextResponse.json(
        { error: 'Full name and team name are required.' },
        { status: 400 },
      );
    }

    const normalizedName = normalizeFullName(fullName);
    const supabase = createSupabaseAdminClient();

    const { data: approvedRecord, error: approvedError } = await supabase
      .from('approved_users')
      .select('id, full_name')
      .ilike('full_name', normalizedName)
      .maybeSingle();

    if (approvedError) {
      return NextResponse.json(
        { error: `Failed to validate approved user: ${approvedError.message}` },
        { status: 500 },
      );
    }

    if (!approvedRecord) {
      return NextResponse.json(
        { error: 'Name is not on the approved user list.' },
        { status: 403 },
      );
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', `${normalizedName.replaceAll(' ', '.')}@placeholder.local`)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ success: true, existing: true, userId: existingUser.id });
    }

    const { data: insertedUser, error: userInsertError } = await supabase
      .from('users')
      .insert({
        full_name: fullName,
        team_name: teamName,
        phone: null,
        email: `${normalizedName.replaceAll(' ', '.')}@placeholder.local`,
        pin_hash: null,
      })
      .select('id')
      .single();

    if (userInsertError) {
      return NextResponse.json(
        { error: `Failed to create user: ${userInsertError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, userId: insertedUser.id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unexpected error while joining the pool.',
      },
      { status: 500 },
    );
  }
}
