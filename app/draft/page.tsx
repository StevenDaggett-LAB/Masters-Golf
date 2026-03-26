'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NavLinks } from '@/components/nav-links';
import { getStoredUserId } from '@/lib/session';

type TierGolfer = {
  id: string;
  tierNumber: number;
  golferName: string;
  odds: string | null;
};

type Team = {
  tier1: string | null;
  tier2: string | null;
  tier3: string | null;
  tier4: string | null;
  tier5: string | null;
  tier6: string | null;
};

type DraftStatus = 'open' | 'locked_by_admin' | 'locked_by_deadline';

type LobbyStatus = {
  draftLocked: boolean;
  draftOpen: boolean;
  lockTime: string | null;
  status: DraftStatus;
};

const tierNumbers = [1, 2, 3, 4, 5, 6] as const;

export default function DraftPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [tiers, setTiers] = useState<TierGolfer[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({
    tier1: '',
    tier2: '',
    tier3: '',
    tier4: '',
    tier5: '',
    tier6: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftLocked, setDraftLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const sessionUser = getStoredUserId();
    if (!sessionUser) {
      router.replace('/join');
      return;
    }

    setUserId(sessionUser);

    async function loadPageData() {
      setLoading(true);
      setError(null);

      const [tiersResponse, teamResponse, statusResponse] = await Promise.all([
        fetch('/api/tiers', { cache: 'no-store' }),
        fetch(`/api/team?userId=${sessionUser}`, { cache: 'no-store' }),
        fetch('/api/lobby-status', { cache: 'no-store' }),
      ]);

      const tiersData = (await tiersResponse.json()) as { tiers?: TierGolfer[]; error?: string };
      const teamData = (await teamResponse.json()) as { team?: Team; error?: string };
      const statusData = (await statusResponse.json()) as LobbyStatus & { error?: string };

      if (!tiersResponse.ok || !tiersData.tiers) {
        throw new Error(tiersData.error ?? 'Unable to load tiers.');
      }

      if (!statusResponse.ok) {
        throw new Error(statusData.error ?? 'Unable to load draft status.');
      }

      setDraftLocked(statusData.draftLocked);
      if (statusData.status === 'locked_by_deadline') {
        setLockMessage('Draft is locked. Team edits closed on April 8, 2026 at 8:00 PM Pacific.');
      } else if (statusData.status === 'locked_by_admin') {
        setLockMessage('Draft is currently locked by admin settings.');
      } else {
        setLockMessage(null);
      }

      setTiers(tiersData.tiers);

      if (teamData.team) {
        setSelection({
          tier1: teamData.team.tier1 ?? '',
          tier2: teamData.team.tier2 ?? '',
          tier3: teamData.team.tier3 ?? '',
          tier4: teamData.team.tier4 ?? '',
          tier5: teamData.team.tier5 ?? '',
          tier6: teamData.team.tier6 ?? '',
        });
      }

      setLoading(false);
    }

    loadPageData().catch((loadError) => {
      setLoading(false);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load draft data.');
    });
  }, [router]);

  const golfersByTier = useMemo(() => {
    const map = new Map<number, TierGolfer[]>();
    for (const tierNumber of tierNumbers) {
      map.set(tierNumber, []);
    }
    for (const golfer of tiers) {
      map.get(golfer.tierNumber)?.push(golfer);
    }
    return map;
  }, [tiers]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draftLocked) {
      setError(lockMessage ?? 'Draft is locked. Teams are read-only now.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, team: selection }),
      });

      const data = (await response.json()) as { success?: boolean; updated?: boolean; error?: string };

      if (!response.ok || !data.success) {
        setError(data.error ?? 'Unable to save team right now.');
        return;
      }

      setSuccess(data.updated ? 'Team updated successfully.' : 'Team saved successfully.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <section className="card">
        <h2>Draft Your Team</h2>
        <p>Select one golfer from each tier.</p>

        {loading ? <p>Loading draft board…</p> : null}
        {lockMessage ? <p className="error">{lockMessage}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        {!loading && !error ? (
          <form onSubmit={handleSubmit} className="stack-form">
            {tierNumbers.map((tierNumber) => {
              const key = `tier${tierNumber}`;
              const golfers = golfersByTier.get(tierNumber) ?? [];

              return (
                <div key={key}>
                  <label htmlFor={key}>Tier {tierNumber}</label>
                  <select
                    id={key}
                    value={selection[key] ?? ''}
                    onChange={(event) =>
                      setSelection((previous) => ({ ...previous, [key]: event.target.value }))
                    }
                    required
                    disabled={draftLocked}
                  >
                    <option value="">Select a golfer</option>
                    {golfers.map((golfer) => (
                      <option key={golfer.id} value={golfer.golferName}>
                        {golfer.golferName}
                        {golfer.odds ? ` (${golfer.odds})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <div className="nav-row">
              <button className="button" type="submit" disabled={saving || draftLocked}>
                {draftLocked ? 'Draft Locked' : saving ? 'Saving…' : 'Save Team'}
              </button>
            </div>
          </form>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
