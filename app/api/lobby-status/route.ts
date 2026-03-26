import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('settings')
    .select('draft_locked, draft_open, lock_time')
    .eq('id', 1)
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to load lobby status: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    draftLocked: data.draft_locked,
    draftOpen: data.draft_open,
    lockTime: data.lock_time,
  });
}
