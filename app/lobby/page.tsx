'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NavLinks } from '@/components/nav-links';
import { getStoredUserId } from '@/lib/session';

type LobbyStatus = {
  draftLocked: boolean;
  draftOpen: boolean;
  lockTime: string | null;
  status?: 'open' | 'locked_by_admin' | 'locked_by_deadline';
  error?: string;
};

const TARGET_LOCK_TIME_PACIFIC = 'April 8, 2026 at 8:00 PM America/Los_Angeles';
const TARGET_LOCK_TIME_UTC_MS = Date.parse('2026-04-09T03:00:00Z');

function formatCountdown(distanceMs: number) {
  if (distanceMs <= 0) return '00d 00h 00m 00s';
  const days = Math.floor(distanceMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distanceMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((distanceMs / (1000 * 60)) % 60);
  const seconds = Math.floor((distanceMs / 1000) % 60);

  return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export default function LobbyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LobbyStatus | null>(null);
  const [countdownMs, setCountdownMs] = useState(TARGET_LOCK_TIME_UTC_MS - Date.now());

  useEffect(() => {
    const userId = getStoredUserId();
    if (!userId) {
      router.replace('/join');
      return;
    }

    async function fetchLobbyStatus() {
      const response = await fetch('/api/lobby-status', { cache: 'no-store' });
      const data = (await response.json()) as LobbyStatus;

      if (!response.ok) {
        setStatus({ draftLocked: true, draftOpen: false, lockTime: null, error: data.error });
        return;
      }

      setStatus(data);
    }

    fetchLobbyStatus().catch(() => {
      setStatus({
        draftLocked: true,
        draftOpen: false,
        lockTime: null,
        error: 'Unable to load draft status right now.',
      });
    });
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownMs(TARGET_LOCK_TIME_UTC_MS - Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => formatCountdown(countdownMs), [countdownMs]);

  return (
    <main>
      <section className="card">
        <h2>Pre-draft Lobby</h2>

        {!status && <p>Loading draft status…</p>}

        {status?.error && <p className="error">{status.error}</p>}

        {status && !status.draftLocked ? (
          <>
            <p className="success">Draft status: <code>open</code>. Draft is editable.</p>
            <Link className="button" href="/draft">
              Go to Draft
            </Link>
          </>
        ) : null}

        {status && status.draftLocked ? (
          <>
            {status.status === 'locked_by_admin' ? (
              <p>Draft status: <code>locked_by_admin</code>. Teams are read-only.</p>
            ) : (
              <p>Draft status: <code>locked_by_deadline</code>. Teams are read-only.</p>
            )}
            <p>
              Countdown to lock time (<code>{TARGET_LOCK_TIME_PACIFIC}</code>):
            </p>
            <p className="success">
              <strong>{countdown}</strong>
            </p>
          </>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
