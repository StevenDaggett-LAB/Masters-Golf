'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NavLinks } from '@/components/nav-links';
import { getStoredUserId } from '@/lib/session';

type TierRow = {
  tier_number: number;
  golfer_name: string;
  odds: string | null;
};

type DraftPayload = {
  settings: { draftOpen: boolean; draftLocked: boolean; lockTime: string | null };
  tiers: TierRow[];
  existingTeam: {
    tier1: string | null;
    tier2: string | null;
    tier3: string | null;
    tier4: string | null;
    tier5: string | null;
    tier6: string | null;
  } | null;
  error?: string;
};

type SelectionState = {
  tier1: string;
  tier2: string;
  tier3: string;
  tier4: string;
  tier5: string;
  tier6: string;
};

const emptySelections: SelectionState = {
  tier1: '',
  tier2: '',
  tier3: '',
  tier4: '',
  tier5: '',
  tier6: '',
};

export default function DraftPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftLocked, setDraftLocked] = useState(true);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [selections, setSelections] = useState<SelectionState>(emptySelections);

  useEffect(() => {
    const storedUserId = getStoredUserId();
    if (!storedUserId) {
      router.replace('/join');
      return;
    }

    setUserId(storedUserId);

    async function loadDraftData() {
      const response = await fetch(`/api/draft?userId=${encodeURIComponent(storedUserId)}`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as DraftPayload;

      if (!response.ok || data.error) {
        setError(data.error ?? 'Failed to load draft data.');
        setLoading(false);
        return;
      }

      setDraftOpen(data.settings.draftOpen);
      setDraftLocked(data.settings.draftLocked);
      setTiers(data.tiers);

      if (data.existingTeam) {
        setSelections({
          tier1: data.existingTeam.tier1 ?? '',
          tier2: data.existingTeam.tier2 ?? '',
          tier3: data.existingTeam.tier3 ?? '',
          tier4: data.existingTeam.tier4 ?? '',
          tier5: data.existingTeam.tier5 ?? '',
          tier6: data.existingTeam.tier6 ?? '',
        });
      }

      setLoading(false);
    }

    loadDraftData().catch(() => {
      setError('Failed to load draft data.');
      setLoading(false);
    });
  }, [router]);

  const groupedTiers = useMemo(() => {
    const map = new Map<number, TierRow[]>();
    for (let tierNumber = 1; tierNumber <= 6; tierNumber++) {
      map.set(tierNumber, []);
    }

    tiers.forEach((row) => {
      const current = map.get(row.tier_number) ?? [];
      current.push(row);
      map.set(row.tier_number, current);
    });

    return map;
  }, [tiers]);

  const readOnly = !draftOpen || draftLocked;

  async function onSaveTeam() {
    if (!userId) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/draft/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, selections }),
      });
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to save team.');
        return;
      }

      setMessage('Team saved successfully. You can edit and re-save before lock.');
    } catch {
      setError('Network error while saving team.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <section className="card">
        <h2>Draft Room</h2>
        {loading ? <p>Loading draft data…</p> : null}

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        {!loading && readOnly ? (
          <p>
            Draft is currently closed or locked. Team selections are read-only right now.
          </p>
        ) : null}

        {!loading && !readOnly ? (
          <div>
            <p>Select one golfer from each tier, then save your team.</p>
            {[1, 2, 3, 4, 5, 6].map((tierNumber) => {
              const key = `tier${tierNumber}` as keyof SelectionState;
              const options = groupedTiers.get(tierNumber) ?? [];

              return (
                <div key={tierNumber}>
                  <label htmlFor={key}>Tier {tierNumber}</label>
                  <select
                    id={key}
                    value={selections[key]}
                    onChange={(event) =>
                      setSelections((prev) => ({
                        ...prev,
                        [key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select a golfer</option>
                    {options.map((option) => (
                      <option
                        key={`${tierNumber}-${option.golfer_name}`}
                        value={option.golfer_name}
                      >
                        {option.golfer_name} ({option.odds ?? 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <div className="nav-row">
              <button className="button" onClick={onSaveTeam} disabled={saving}>
                {saving ? 'Saving…' : 'Save Team'}
              </button>
            </div>
          </div>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
