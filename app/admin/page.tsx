'use client';

import { useEffect, useState } from 'react';
import { NavLinks } from '@/components/nav-links';

type TierRow = {
  tier_number: number;
  golfer_name: string;
  odds: string | null;
};

const tierKeys = [1, 2, 3, 4, 5, 6] as const;

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tierText, setTierText] = useState<Record<number, string>>({
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
    6: '',
  });

  useEffect(() => {
    async function loadTiers() {
      const response = await fetch('/api/admin/tiers', { cache: 'no-store' });
      const data = (await response.json()) as { tiers?: TierRow[]; error?: string };

      if (!response.ok || data.error) {
        setError(data.error ?? 'Failed to load tiers.');
        setLoading(false);
        return;
      }

      const grouped: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      for (const row of data.tiers ?? []) {
        grouped[row.tier_number].push(`${row.golfer_name} | ${row.odds ?? ''}`.trim());
      }

      setTierText({
        1: grouped[1].join('\n'),
        2: grouped[2].join('\n'),
        3: grouped[3].join('\n'),
        4: grouped[4].join('\n'),
        5: grouped[5].join('\n'),
        6: grouped[6].join('\n'),
      });
      setLoading(false);
    }

    loadTiers().catch(() => {
      setError('Failed to load tiers.');
      setLoading(false);
    });
  }, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload: TierRow[] = [];

    for (const tierNumber of tierKeys) {
      const rows = tierText[tierNumber]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      rows.forEach((row) => {
        const [name, odds] = row.split('|').map((part) => part.trim());
        if (name) {
          payload.push({
            tier_number: tierNumber,
            golfer_name: name,
            odds: odds || null,
          });
        }
      });
    }

    try {
      const response = await fetch('/api/admin/tiers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: payload }),
      });
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to save tiers.');
        return;
      }

      setMessage('Tiers saved successfully.');
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
        <p>
          Use one line per golfer in format: <code>Golfer Name | Odds</code>
        </p>

        {loading ? <p>Loading tiers…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}

        {!loading ? (
          <>
            {tierKeys.map((tierNumber) => (
              <div key={tierNumber}>
                <label htmlFor={`tier-${tierNumber}`}>Tier {tierNumber}</label>
                <textarea
                  id={`tier-${tierNumber}`}
                  rows={5}
                  value={tierText[tierNumber]}
                  onChange={(event) =>
                    setTierText((prev) => ({
                      ...prev,
                      [tierNumber]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}

            <div className="nav-row">
              <button className="button" onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Tiers'}
              </button>
            </div>
          </>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
