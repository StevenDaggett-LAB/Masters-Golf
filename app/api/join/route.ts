import { NextResponse } from 'next/server';
import { registerApprovedUser } from '@/lib/server/registration';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      teamName?: string;
      phone?: string;
      email?: string;
    };

    const result = await registerApprovedUser({
      fullName: body.fullName ?? '',
      teamName: body.teamName ?? '',
      phone: body.phone,
      email: body.email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: true, userId: result.userId, existing: result.existing });
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
