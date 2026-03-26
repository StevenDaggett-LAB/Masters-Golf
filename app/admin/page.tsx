'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { NavLinks } from '@/components/nav-links';

type TierRow = {
  localId: string;
  tierNumber: number;
  golferName: string;
  odds: string;
};

type TierGolfer = {
  id: string;
  tierNumber: number;
  golferName: string;
  odds: string | null;
};

const tierNumbers = [1, 2, 3, 4, 5, 6] as const;

function makeBlankRow(tierNumber: number): TierRow {
  return {
    localId: `${tierNumber}-${Math.random().toString(36).slice(2)}`,
    tierNumber,
    golferName: '',
    odds: '',
  };
}

export default function AdminPage() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadTiers() {
      setLoading(true);
      const response = await fetch('/api/tiers', { cache: 'no-store' });
      const data = (await response.json()) as { tiers?: TierGolfer[]; error?: string };

      if (!response.ok || !data.tiers) {
        setError(data.error ?? 'Failed to load tiers.');
        setRows(tierNumbers.map((tier) => makeBlankRow(tier)));
        setLoading(false);
        return;
      }

      const nextRows = data.tiers.map((tier) => ({
        localId: tier.id,
        tierNumber: tier.tierNumber,
        golferName: tier.golferName,
        odds: tier.odds ?? '',
      }));

      for (const tierNumber of tierNumbers) {
        if (!nextRows.some((row) => row.tierNumber === tierNumber)) {
          nextRows.push(makeBlankRow(tierNumber));
        }
      }

      setRows(nextRows.sort((a, b) => a.tierNumber - b.tierNumber));
      setLoading(false);
    }

    loadTiers().catch(() => {
      setError('Unable to load tiers right now.');
      setLoading(false);
    });
  }, []);

  const rowsByTier = useMemo(() => {
    const map = new Map<number, TierRow[]>();
    for (const tierNumber of tierNumbers) {
      map.set(
        tierNumber,
        rows.filter((row) => row.tierNumber === tierNumber),
      );
    }
    return map;
  }, [rows]);

  function updateRow(localId: string, field: 'golferName' | 'odds', value: string) {
    setRows((previous) =>
      previous.map((row) => (row.localId === localId ? { ...row, [field]: value } : row)),
    );
  }

  function addRow(tierNumber: number) {
    setRows((previous) => [...previous, makeBlankRow(tierNumber)]);
  }

  function removeRow(localId: string) {
    setRows((previous) => previous.filter((row) => row.localId !== localId));
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiers: rows.map((row) => ({
            tierNumber: row.tierNumber,
            golferName: row.golferName,
            odds: row.odds,
          })),
        }),
      });

      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to save tiers.');
        return;
      }

      setSuccess('Tier board saved.');
    } catch {
      setError('Network error while saving tiers.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <section className="card">
        <h2>Admin Tier Management</h2>
        <p>Create and edit golfers in each of the 6 tiers.</p>

        {loading ? <p>Loading tiers…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        {!loading ? (
          <form onSubmit={onSave} className="stack-form">
            {tierNumbers.map((tierNumber) => (
              <div className="tier-panel" key={tierNumber}>
                <h3>Tier {tierNumber}</h3>
                {rowsByTier.get(tierNumber)?.map((row) => (
                  <div className="tier-row" key={row.localId}>
                    <input
                      placeholder="Golfer name"
                      value={row.golferName}
                      onChange={(event) => updateRow(row.localId, 'golferName', event.target.value)}
                    />
                    <input
                      placeholder="Odds"
                      value={row.odds}
                      onChange={(event) => updateRow(row.localId, 'odds', event.target.value)}
                    />
                    <button
                      type="button"
                      className="button button-small"
                      onClick={() => removeRow(row.localId)}
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="button button-small"
                  onClick={() => addRow(tierNumber)}
                >
                  Add golfer
                </button>
              </div>
            ))}

            <div className="nav-row">
              <button className="button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Tiers'}
              </button>
            </div>
          </form>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
