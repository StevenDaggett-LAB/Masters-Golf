import { NextResponse } from 'next/server';
import {
  exactDuplicateExists,
  getDraftSettings,
  upsertTeam,
  validateSelections,
  type TeamSelections,
} from '@/lib/server/draft';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string; selections?: Partial<TeamSelections> };
    const userId = body.userId?.trim();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
    }

    const validation = validateSelections(body.selections ?? {});
    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const selections = body.selections as TeamSelections;
    const settings = await getDraftSettings();

    if (!settings.draft_open || settings.draft_locked) {
      return NextResponse.json(
        { error: 'Draft is closed. Team edits are read-only right now.' },
        { status: 403 },
      );
    }

    const duplicateExists = await exactDuplicateExists(userId, selections);
    if (duplicateExists) {
      return NextResponse.json(
        {
          error: 'This exact team has already been taken. Please change at least one golfer.',
        },
        { status: 409 },
      );
    }

    await upsertTeam(userId, selections);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save team.' },
      { status: 500 },
    );
  }
}
