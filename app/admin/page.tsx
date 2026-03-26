'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { NavLinks } from '@/components/nav-links';
import { AdminAccessButton } from '@/components/admin-access-button';

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

type DraftStatus = 'open' | 'locked_by_admin' | 'locked_by_deadline';

type LobbyStatus = {
  draftLocked: boolean;
  draftOpen: boolean;
  lockTime: string | null;
  status: DraftStatus;
  deadlinePassed?: boolean;
  hardLockTimeUtc?: string;
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

function normalizeImportedTier(row: Record<string, unknown>) {
  const rawTier = row.tierNumber ?? row.tier_number ?? row.tier ?? row['Tier'];
  const rawName =
    row.golferName ?? row.golfer_name ?? row.golfer ?? row.name ?? row['Golfer'] ?? row['Golfer Name'];
  const rawOdds = row.odds ?? row.Odds;

  const tierNumber = Number(rawTier);
  const golferName = typeof rawName === 'string' ? rawName.trim() : '';
  const odds = typeof rawOdds === 'string' ? rawOdds.trim() : rawOdds == null ? '' : String(rawOdds);

  if (!Number.isInteger(tierNumber) || tierNumber < 1 || tierNumber > 6 || !golferName) {
    return null;
  }

  return { tierNumber, golferName, odds };
}

function parseBulkImport(input: string): Array<{ tierNumber: number; golferName: string; odds: string }> {
  const text = input.trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed && 'tiers' in parsed
        ? (parsed as { tiers?: unknown[] }).tiers ?? []
        : [];

    const normalized = rows
      .map((row) => (typeof row === 'object' && row ? normalizeImportedTier(row as Record<string, unknown>) : null))
      .filter((row): row is { tierNumber: number; golferName: string; odds: string } => row !== null);

    if (normalized.length > 0) {
      return normalized;
    }
  } catch {
    // fall back to text parsing
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const hasHeader = /tier/i.test(lines[0]) && /golfer|name/i.test(lines[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const parsedRows: Array<{ tierNumber: number; golferName: string; odds: string }> = [];

  for (const line of dataLines) {
    const csvMatch = line.match(/^(\d)\s*[,|\t]\s*([^,|\t]+?)\s*(?:[,|\t]\s*(.+))?$/);
    if (csvMatch) {
      parsedRows.push({
        tierNumber: Number(csvMatch[1]),
        golferName: csvMatch[2].trim(),
        odds: (csvMatch[3] ?? '').trim(),
      });
      continue;
    }

    const labelMatch = line.match(/^tier\s*(\d)\s*[:\-|]\s*(.+?)\s*(?:[|,]\s*(.+))?$/i);
    if (labelMatch) {
      parsedRows.push({
        tierNumber: Number(labelMatch[1]),
        golferName: labelMatch[2].trim(),
        odds: (labelMatch[3] ?? '').trim(),
      });
      continue;
    }

    const parenOddsMatch = line.match(/^(\d)\s*-\s*(.+?)\s*(?:\(([^)]+)\))?$/);
    if (parenOddsMatch) {
      parsedRows.push({
        tierNumber: Number(parenOddsMatch[1]),
        golferName: parenOddsMatch[2].trim(),
        odds: (parenOddsMatch[3] ?? '').trim(),
      });
    }
  }

  return parsedRows.filter((row) => row.tierNumber >= 1 && row.tierNumber <= 6 && row.golferName.length > 0);
}

export default function AdminPage() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updatingDraftState, setUpdatingDraftState] = useState(false);
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState<LobbyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadTiersAndStatus() {
    setLoading(true);
    const [tiersResponse, statusResponse] = await Promise.all([
      fetch('/api/tiers', { cache: 'no-store' }),
      fetch('/api/lobby-status', { cache: 'no-store' }),
    ]);

    const data = (await tiersResponse.json()) as { tiers?: TierGolfer[]; error?: string };
    const statusData = (await statusResponse.json()) as LobbyStatus & { error?: string };

    if (!tiersResponse.ok || !data.tiers) {
      setError(data.error ?? 'Failed to load tiers.');
      setRows(tierNumbers.map((tier) => makeBlankRow(tier)));
      setLoading(false);
      return;
    }

    if (statusResponse.ok) {
      setStatus(statusData);
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

  useEffect(() => {
    loadTiersAndStatus().catch(() => {
      setError('Unable to load admin data right now.');
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

  async function saveTiers(nextRows: TierRow[], replaceAll: boolean) {
    const response = await fetch('/api/admin/tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tiers: nextRows.map((row) => ({
          tierNumber: row.tierNumber,
          golferName: row.golferName,
          odds: row.odds,
        })),
        replaceAll,
        confirmReplace: replaceAll,
      }),
    });

    const data = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? 'Failed to save tiers.');
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await saveTiers(rows, false);
      setSuccess('Tier board saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Network error while saving tiers.');
    } finally {
      setSaving(false);
    }
  }

  async function onImportAndReplace() {
    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const importedRows = parseBulkImport(importText);
      if (importedRows.length === 0) {
        throw new Error('No valid tier rows found in import text.');
      }

      const nextRows = importedRows.map((row, index) => ({
        ...row,
        localId: `import-${index}-${Math.random().toString(36).slice(2)}`,
      }));

      const confirmed = window.confirm(
        `Replace all current tier rows with ${importedRows.length} imported rows? This cannot be undone.`,
      );
      if (!confirmed) {
        setImporting(false);
        return;
      }

      await saveTiers(nextRows, true);
      setRows(nextRows.sort((a, b) => a.tierNumber - b.tierNumber));
      setSuccess(`Replaced all tiers with ${importedRows.length} imported rows.`);
      setImportText('');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import tiers.');
    } finally {
      setImporting(false);
    }
  }

  async function updateDraftState(action: 'open' | 'lock') {
    setUpdatingDraftState(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/draft-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as LobbyStatus & { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to update draft status.');
      }

      setStatus(data);
      setSuccess(action === 'open' ? 'Draft open action saved.' : 'Draft lock action saved.');
    } catch (draftStateError) {
      setError(draftStateError instanceof Error ? draftStateError.message : 'Failed to update draft status.');
    } finally {
      setUpdatingDraftState(false);
    }
  }

  const statusLabel =
    status?.status === 'open'
      ? 'open'
      : status?.status === 'locked_by_deadline'
        ? 'locked_by_deadline'
        : 'locked_by_admin';
  const editableLabel = status?.status === 'open' ? 'Yes' : 'No';

  return (
    <main>
      <section className="card">
        <h2>Admin Tier Management</h2>
        <p>Create and edit golfers in each of the 6 tiers.</p>
        <div className="nav-row">
          <AdminAccessButton mode="exit" />
        </div>

        {status ? (
          <div className="tier-panel">
            <h3>Draft Status</h3>
            <p>
              <strong>Current effective status:</strong> <code>{statusLabel}</code>
            </p>
            <p>
              <strong>Draft editable right now:</strong> {editableLabel}
            </p>
            <p>
              <strong>Hard deadline:</strong> April 8, 2026 at 8:00 PM America/Los_Angeles
            </p>
            <div className="nav-row">
              <button
                type="button"
                className="button button-small"
                onClick={() => updateDraftState('open')}
                disabled={updatingDraftState}
              >
                {updatingDraftState ? 'Updating…' : 'Open Draft'}
              </button>
              <button
                type="button"
                className="button button-small"
                onClick={() => updateDraftState('lock')}
                disabled={updatingDraftState}
              >
                {updatingDraftState ? 'Updating…' : 'Lock Draft'}
              </button>
            </div>
          </div>
        ) : null}

        {loading ? <p>Loading tiers…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        {!loading ? (
          <>
            <div className="tier-panel">
              <h3>Bulk Tier Import</h3>
              <p>Paste structured text, JSON, or CSV-like rows (tier_number, golfer_name, odds), then replace all tiers.</p>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={`tier_number,golfer_name,odds\n1,Scottie Scheffler,+400\n2,Ludvig Åberg,+1200\n\nOR\n[{"tierNumber":1,"golferName":"Scottie Scheffler","odds":"+400"}]`}
                rows={8}
              />
              <div className="nav-row">
                <button
                  type="button"
                  className="button"
                  onClick={onImportAndReplace}
                  disabled={importing}
                >
                  {importing ? 'Replacing…' : 'Replace All Tiers'}
                </button>
              </div>
            </div>

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
          </>
        ) : null}

        <NavLinks />
      </section>
    </main>
  );
}
