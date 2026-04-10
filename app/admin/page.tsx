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

type GolferScoreInput = {
  golferName: string;
  totalScore: number;
  madeCut: boolean;
  round1Score: number | null;
  round2Score: number | null;
  round3Score: number | null;
  round4Score: number | null;
  sundayBirdies: number;
  statusText: string | null;
  currentRoundScore: number | null;
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

type ApprovedUser = {
  id: string;
  fullName: string;
};

type RegisteredUser = {
  id: string;
  fullName: string;
};

type TeamEntryMode = 'registered' | 'approved';

type TeamSelection = {
  tier1: string;
  tier2: string;
  tier3: string;
  tier4: string;
  tier5: string;
  tier6: string;
};

type ExistingTeam = TeamSelection & {
  id: string;
  user_id: string;
};

const tierNumbers = [1, 2, 3, 4, 5, 6] as const;
const blankTeamSelection: TeamSelection = {
  tier1: '',
  tier2: '',
  tier3: '',
  tier4: '',
  tier5: '',
  tier6: '',
};

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

function toIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeImportedScore(row: Record<string, unknown>) {
  const golferName = String(row.golfer_name ?? row.golferName ?? '').trim();
  if (!golferName) {
    return null;
  }

  return {
    golferName,
    totalScore: toIntOrNull(row.total_score ?? row.totalScore) ?? 0,
    madeCut: parseBoolean(row.made_cut ?? row.madeCut, true),
    round1Score: toIntOrNull(row.round_1_score ?? row.round1Score),
    round2Score: toIntOrNull(row.round_2_score ?? row.round2Score),
    round3Score: toIntOrNull(row.round_3_score ?? row.round3Score),
    round4Score: toIntOrNull(row.round_4_score ?? row.round4Score),
    sundayBirdies: toIntOrNull(row.sunday_birdies ?? row.sundayBirdies) ?? 0,
    statusText: String(row.status_text ?? row.statusText ?? '').trim() || null,
    currentRoundScore: toIntOrNull(row.current_round_score ?? row.currentRoundScore),
  } satisfies GolferScoreInput;
}

function parseScoreImport(input: string): GolferScoreInput[] {
  const text = input.trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed && 'scores' in parsed
        ? (parsed as { scores?: unknown[] }).scores ?? []
        : [];

    const normalized = rows
      .map((row) => (typeof row === 'object' && row ? normalizeImportedScore(row as Record<string, unknown>) : null))
      .filter((row): row is GolferScoreInput => row !== null);
    if (normalized.length > 0) {
      return normalized;
    }
  } catch {
    // fall back to line parsing
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const hasHeader = /golfer/i.test(lines[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const parts = line.split(/[,\t|]/).map((part) => part.trim());
    if (parts.length !== 8 && parts.length !== 10) {
      throw new Error(
        `Line ${index + 1} must have 8 or 10 fields: golfer_name,total_score,made_cut,round_1_score,round_2_score,round_3_score,round_4_score,sunday_birdies[,status_text,current_round_score]`,
      );
    }

    const [golferName, totalScore, madeCut, round1, round2, round3, round4, sundayBirdies, statusText, currentRoundScore] =
      parts;
    if (!golferName) {
      throw new Error(`Line ${index + 1} is missing golfer_name.`);
    }

    return {
      golferName,
      totalScore: toIntOrNull(totalScore) ?? 0,
      madeCut: parseBoolean(madeCut, true),
      round1Score: toIntOrNull(round1),
      round2Score: toIntOrNull(round2),
      round3Score: toIntOrNull(round3),
      round4Score: toIntOrNull(round4),
      sundayBirdies: toIntOrNull(sundayBirdies) ?? 0,
      statusText: statusText ? statusText : null,
      currentRoundScore: toIntOrNull(currentRoundScore),
    } satisfies GolferScoreInput;
  });
}

export default function AdminPage() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updatingDraftState, setUpdatingDraftState] = useState(false);
  const [importText, setImportText] = useState('');
  const [scoreImportText, setScoreImportText] = useState('');
  const [importingScores, setImportingScores] = useState(false);
  const [updatingLiveScores, setUpdatingLiveScores] = useState(false);
  const [resettingTournament, setResettingTournament] = useState(false);
  const [status, setStatus] = useState<LobbyStatus | null>(null);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [approvedUsersWithoutRegistration, setApprovedUsersWithoutRegistration] = useState<ApprovedUser[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [teamEntryMode, setTeamEntryMode] = useState<TeamEntryMode>('registered');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [selectedUserTeam, setSelectedUserTeam] = useState<ExistingTeam | null>(null);
  const [selectedApprovedUserId, setSelectedApprovedUserId] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserTeamName, setNewUserTeamName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [adminTeamSelection, setAdminTeamSelection] = useState<TeamSelection>(blankTeamSelection);
  const [loadingAdminTeam, setLoadingAdminTeam] = useState(false);
  const [savingAdminTeam, setSavingAdminTeam] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [approvedImportText, setApprovedImportText] = useState('');
  const [addingApprovedUser, setAddingApprovedUser] = useState(false);
  const [importingApprovedUsers, setImportingApprovedUsers] = useState(false);
  const [removingApprovedUserId, setRemovingApprovedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadTiersAndStatus() {
    setLoading(true);
    const [tiersResponse, statusResponse, approvedUsersResponse, teamUsersResponse] = await Promise.all([
      fetch('/api/tiers', { cache: 'no-store' }),
      fetch('/api/lobby-status', { cache: 'no-store' }),
      fetch('/api/admin/approved-users', { cache: 'no-store' }),
      fetch('/api/admin/team-entry', { cache: 'no-store' }),
    ]);

    const data = (await tiersResponse.json()) as { tiers?: TierGolfer[]; error?: string };
    const statusData = (await statusResponse.json()) as LobbyStatus & { error?: string };
    const approvedUsersData = (await approvedUsersResponse.json()) as { users?: ApprovedUser[]; error?: string };
    const teamUsersData = (await teamUsersResponse.json()) as {
      users?: RegisteredUser[];
      approvedUsersWithoutRegistration?: ApprovedUser[];
      error?: string;
    };

    if (!tiersResponse.ok || !data.tiers) {
      setError(data.error ?? 'Failed to load tiers.');
      setRows(tierNumbers.map((tier) => makeBlankRow(tier)));
      setLoading(false);
      return;
    }

    if (statusResponse.ok) {
      setStatus(statusData);
    }
    if (approvedUsersResponse.ok) {
      setApprovedUsers(approvedUsersData.users ?? []);
    }
    if (teamUsersResponse.ok) {
      setRegisteredUsers(teamUsersData.users ?? []);
      setApprovedUsersWithoutRegistration(teamUsersData.approvedUsersWithoutRegistration ?? []);
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

  function parseApprovedUserLines(input: string) {
    return input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/\s+/g, ' '));
  }

  async function onAddApprovedUser() {
    setAddingApprovedUser(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/approved-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      });

      const data = (await response.json()) as { success?: boolean; user?: ApprovedUser; error?: string };
      if (!response.ok || !data.success || !data.user) {
        throw new Error(data.error ?? 'Failed to add approved user.');
      }
      const addedUser = data.user;

      setApprovedUsers((previous) => [...previous, addedUser].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setFirstName('');
      setLastName('');
      setSuccess(`Added ${addedUser.fullName} to approved users.`);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to add approved user.');
    } finally {
      setAddingApprovedUser(false);
    }
  }

  async function onRemoveApprovedUser(id: string, fullName: string) {
    setRemovingApprovedUserId(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/approved-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to remove approved user.');
      }

      setApprovedUsers((previous) => previous.filter((user) => user.id !== id));
      setSuccess(`Removed ${fullName} from approved users.`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove approved user.');
    } finally {
      setRemovingApprovedUserId(null);
    }
  }

  async function onImportApprovedUsers() {
    setImportingApprovedUsers(true);
    setError(null);
    setSuccess(null);

    try {
      const names = parseApprovedUserLines(approvedImportText);
      if (names.length === 0) {
        throw new Error('No approved users found in import text.');
      }

      const response = await fetch('/api/admin/approved-users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      });

      const data = (await response.json()) as { success?: boolean; count?: number; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to import approved users.');
      }

      const refreshResponse = await fetch('/api/admin/approved-users', { cache: 'no-store' });
      const refreshData = (await refreshResponse.json()) as { users?: ApprovedUser[]; error?: string };
      if (!refreshResponse.ok) {
        throw new Error(refreshData.error ?? 'Approved users were imported but refresh failed.');
      }

      setApprovedUsers(refreshData.users ?? []);
      setApprovedImportText('');
      setSuccess(`Imported ${data.count ?? names.length} approved users.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import approved users.');
    } finally {
      setImportingApprovedUsers(false);
    }
  }

  async function loadSelectedUserTeam(nextUserId: string) {
    if (!nextUserId) {
      setSelectedUser(null);
      setSelectedUserTeam(null);
      setAdminTeamSelection(blankTeamSelection);
      return;
    }

    setLoadingAdminTeam(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/team-entry?userId=${encodeURIComponent(nextUserId)}`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as {
        user?: RegisteredUser;
        team?: ExistingTeam | null;
        error?: string;
      };

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? 'Failed to load selected user team.');
      }

      setSelectedUser(data.user);
      setSelectedUserTeam(data.team ?? null);
      setAdminTeamSelection({
        tier1: data.team?.tier1 ?? '',
        tier2: data.team?.tier2 ?? '',
        tier3: data.team?.tier3 ?? '',
        tier4: data.team?.tier4 ?? '',
        tier5: data.team?.tier5 ?? '',
        tier6: data.team?.tier6 ?? '',
      });
    } catch (teamError) {
      setSelectedUser(null);
      setSelectedUserTeam(null);
      setAdminTeamSelection(blankTeamSelection);
      setError(teamError instanceof Error ? teamError.message : 'Failed to load selected user team.');
    } finally {
      setLoadingAdminTeam(false);
    }
  }

  async function onSaveAdminTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isRegisteredMode = teamEntryMode === 'registered';
    if (isRegisteredMode && !selectedUserId) {
      setError('Choose a registered user first.');
      return;
    }
    if (!isRegisteredMode && !newUserFullName.trim()) {
      setError('Select or enter an approved full name first.');
      return;
    }
    if (!isRegisteredMode && !newUserTeamName.trim()) {
      setError('Team name is required when creating a user from approved list.');
      return;
    }

    setSavingAdminTeam(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/team-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: isRegisteredMode ? selectedUserId : undefined,
          approvedUserId: isRegisteredMode ? undefined : selectedApprovedUserId || undefined,
          fullName: isRegisteredMode ? undefined : newUserFullName,
          teamName: isRegisteredMode ? undefined : newUserTeamName,
          phone: isRegisteredMode ? undefined : newUserPhone,
          email: isRegisteredMode ? undefined : newUserEmail,
          team: adminTeamSelection,
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        updated?: boolean;
        createdUser?: boolean;
        userId?: string;
        error?: string;
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to save admin team.');
      }
      if (isRegisteredMode) {
        await loadSelectedUserTeam(selectedUserId);
        setSuccess(data.updated ? 'Team updated successfully for selected user.' : 'Team saved successfully for selected user.');
      } else {
        await loadTiersAndStatus();
        setTeamEntryMode('registered');
        if (data.userId) {
          setSelectedUserId(data.userId);
          await loadSelectedUserTeam(data.userId);
        }
        setSuccess(
          data.createdUser
            ? 'Registered user and team created successfully.'
            : 'Existing registered user found and team saved successfully.',
        );
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save admin team.');
    } finally {
      setSavingAdminTeam(false);
    }
  }

  useEffect(() => {
    loadTiersAndStatus().catch(() => {
      setError('Unable to load admin data right now.');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadSelectedUserTeam(selectedUserId).catch(() => {
      setError('Unable to load selected user team right now.');
      setLoadingAdminTeam(false);
    });
  }, [selectedUserId]);

  useEffect(() => {
    const selectedApprovedUser = approvedUsersWithoutRegistration.find((user) => user.id === selectedApprovedUserId);
    if (selectedApprovedUser) {
      setNewUserFullName(selectedApprovedUser.fullName);
    }
  }, [approvedUsersWithoutRegistration, selectedApprovedUserId]);

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

  const golfersByTier = useMemo(() => {
    const map = new Map<number, Array<{ golferName: string; odds: string }>>();
    for (const tierNumber of tierNumbers) {
      map.set(tierNumber, []);
    }

    for (const row of rows) {
      const golferName = row.golferName.trim();
      if (!golferName) {
        continue;
      }

      const tierList = map.get(row.tierNumber) ?? [];
      if (!tierList.some((tierRow) => tierRow.golferName === golferName)) {
        tierList.push({ golferName, odds: row.odds.trim() });
      }
      map.set(row.tierNumber, tierList);
    }

    for (const tierNumber of tierNumbers) {
      const tierList = map.get(tierNumber) ?? [];
      tierList.sort((a, b) => a.golferName.localeCompare(b.golferName));
      map.set(tierNumber, tierList);
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

  async function onImportScores() {
    setImportingScores(true);
    setError(null);
    setSuccess(null);

    try {
      const scores = parseScoreImport(scoreImportText);
      if (scores.length === 0) {
        throw new Error('No valid score rows found in import text.');
      }

      const response = await fetch('/api/admin/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          scores.map((score) => ({
            golfer_name: score.golferName,
            total_score: score.totalScore,
            made_cut: score.madeCut,
            round_1_score: score.round1Score,
            round_2_score: score.round2Score,
            round_3_score: score.round3Score,
            round_4_score: score.round4Score,
            sunday_birdies: score.sundayBirdies,
            status_text: score.statusText,
            current_round_score: score.currentRoundScore,
          })),
        ),
      });

      const data = (await response.json()) as { success?: boolean; count?: number; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to import golfer scores.');
      }

      setSuccess(`Imported ${data.count ?? scores.length} golfer score rows.`);
      setScoreImportText('');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import golfer scores.');
    } finally {
      setImportingScores(false);
    }
  }

  async function onUpdateLiveScores() {
    setUpdatingLiveScores(true);
    setImportingScores(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/update-live-scores', {
        method: 'POST',
      });
      const data = (await response.json()) as { success?: boolean; message?: string; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to update live scores.');
      }

      setSuccess(data.message ?? 'Live scores updated successfully.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update live scores.');
    } finally {
      setUpdatingLiveScores(false);
      setImportingScores(false);

    }
  }
  async function onResetTournament() {
    setError(null);
    setSuccess(null);

    const confirmed = window.confirm(
      'This will delete all registered teams and golfer scores, then reopen the draft. Continue?',
    );
    if (!confirmed) {
      return;
    }

    const typedConfirmation = window.prompt('Type RESET to confirm tournament reset.');
    if (typedConfirmation !== 'RESET') {
      setError('Tournament reset cancelled. You must type RESET exactly.');
      return;
    }

    setResettingTournament(true);
    try {
      const response = await fetch('/api/admin/reset', { method: 'POST' });
      const data = (await response.json()) as LobbyStatus & { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to reset tournament data.');
      }

      setStatus(data);
      await loadTiersAndStatus();
      setSelectedUserId('');
      setSelectedUser(null);
      setSelectedUserTeam(null);
      setAdminTeamSelection(blankTeamSelection);
      setSuccess('Tournament reset complete. Teams and golfer scores were cleared, and draft is open.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Failed to reset tournament data.');
    } finally {
      setResettingTournament(false);
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
          <div className="tier-panel admin-panel">
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
            <div className="tier-panel admin-panel">
              <h3>Admin Team Entry</h3>
              <p>Create or edit a registered user team directly from admin, including approved users not yet registered.</p>
              <div className="nav-row admin-options">
                <label>
                  <input
                    type="radio"
                    name="teamEntryMode"
                    value="registered"
                    checked={teamEntryMode === 'registered'}
                    onChange={() => setTeamEntryMode('registered')}
                  />{' '}
                  Existing registered user
                </label>
                <label>
                  <input
                    type="radio"
                    name="teamEntryMode"
                    value="approved"
                    checked={teamEntryMode === 'approved'}
                    onChange={() => setTeamEntryMode('approved')}
                  />{' '}
                  Approved user not yet registered
                </label>
              </div>

              {teamEntryMode === 'registered' ? (
                <div>
                  <label htmlFor="adminTeamUser">Registered user</label>
                  <select
                    id="adminTeamUser"
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                  >
                    <option value="">Select a registered user</option>
                    {registeredUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="approvedUserToRegister">Approved user</label>
                    <select
                      id="approvedUserToRegister"
                      value={selectedApprovedUserId}
                      onChange={(event) => setSelectedApprovedUserId(event.target.value)}
                      disabled={status?.status !== 'open'}
                    >
                      <option value="">Select from approved list</option>
                      {approvedUsersWithoutRegistration.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="newUserFullName">Full name (approved user)</label>
                    <input
                      id="newUserFullName"
                      value={newUserFullName}
                      onChange={(event) => setNewUserFullName(event.target.value)}
                      list="approved-user-full-names"
                      required
                      disabled={status?.status !== 'open'}
                    />
                    <datalist id="approved-user-full-names">
                      {approvedUsersWithoutRegistration.map((user) => (
                        <option key={user.id} value={user.fullName} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label htmlFor="newUserTeamName">Team name</label>
                    <input
                      id="newUserTeamName"
                      value={newUserTeamName}
                      onChange={(event) => setNewUserTeamName(event.target.value)}
                      required
                      disabled={status?.status !== 'open'}
                    />
                  </div>
                  <div>
                    <label htmlFor="newUserPhone">Phone (optional)</label>
                    <input
                      id="newUserPhone"
                      value={newUserPhone}
                      onChange={(event) => setNewUserPhone(event.target.value)}
                      disabled={status?.status !== 'open'}
                    />
                  </div>
                  <div>
                    <label htmlFor="newUserEmail">Email (optional)</label>
                    <input
                      id="newUserEmail"
                      value={newUserEmail}
                      onChange={(event) => setNewUserEmail(event.target.value)}
                      disabled={status?.status !== 'open'}
                    />
                  </div>
                </>
              )}

              {teamEntryMode === 'registered' && selectedUser ? (
                <>
                  <p>
                    <strong>Selected user:</strong> {selectedUser.fullName}
                  </p>
                  <p>
                    <strong>Current team:</strong> {selectedUserTeam ? 'Exists' : 'No team saved yet'}
                  </p>
                </>
              ) : null}

              {loadingAdminTeam ? <p>Loading selected user team…</p> : null}

              <form onSubmit={onSaveAdminTeam} className="stack-form">
                {tierNumbers.map((tierNumber) => {
                  const key = `tier${tierNumber}` as keyof TeamSelection;
                  const tierGolfers = golfersByTier.get(tierNumber) ?? [];

                  return (
                    <div key={key}>
                      <label htmlFor={key}>Tier {tierNumber}</label>
                      <select
                        id={key}
                        value={adminTeamSelection[key]}
                        onChange={(event) =>
                          setAdminTeamSelection((previous) => ({ ...previous, [key]: event.target.value }))
                        }
                        required
                        disabled={
                          (teamEntryMode === 'registered' ? !selectedUserId : !newUserFullName.trim()) ||
                          status?.status !== 'open' ||
                          loadingAdminTeam
                        }
                      >
                        <option value="">Select a golfer</option>
                        {tierGolfers.map((golfer) => (
                          <option key={`${tierNumber}-${golfer.golferName}`} value={golfer.golferName}>
                            {golfer.golferName}
                            {golfer.odds ? ` (${golfer.odds})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                <div className="nav-row">
                  <button
                    className="button"
                    type="submit"
                    disabled={
                      (teamEntryMode === 'registered'
                        ? !selectedUserId
                        : !newUserFullName.trim() || !newUserTeamName.trim()) ||
                      savingAdminTeam ||
                      status?.status !== 'open' ||
                      loadingAdminTeam
                    }
                  >
                    {status?.status !== 'open'
                      ? 'Draft Locked'
                      : savingAdminTeam
                        ? 'Saving…'
                        : teamEntryMode === 'registered' && selectedUserTeam
                          ? 'Update Team'
                          : teamEntryMode === 'approved'
                            ? 'Create User + Save Team'
                            : 'Save Team'}
                  </button>
                </div>
              </form>
            </div>

            <div className="tier-panel admin-panel">
              <h3>Approved Users</h3>
              <p>Add, import, and remove approved users used by the join flow.</p>
              <div className="admin-inline-row">
                <input
                  placeholder="First Name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
                <input
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
                <button
                  type="button"
                  className="button button-small"
                  onClick={onAddApprovedUser}
                  disabled={addingApprovedUser}
                >
                  {addingApprovedUser ? 'Adding…' : 'Add User'}
                </button>
              </div>
              <textarea
                value={approvedImportText}
                onChange={(event) => setApprovedImportText(event.target.value)}
                placeholder={`Steven Daggett\nSarah Daggett\nTaylor Daggett`}
                rows={5}
              />
              <div className="nav-row">
                <button
                  type="button"
                  className="button"
                  onClick={onImportApprovedUsers}
                  disabled={importingApprovedUsers}
                >
                  {importingApprovedUsers ? 'Importing…' : 'Import Approved Users'}
                </button>
              </div>

              {approvedUsers.length === 0 ? <p>No approved users yet.</p> : null}
              {approvedUsers.map((user) => (
                <div className="tier-row" key={user.id}>
                  <input value={user.fullName} readOnly />
                  <div />
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => onRemoveApprovedUser(user.id, user.fullName)}
                    disabled={removingApprovedUserId === user.id}
                  >
                    {removingApprovedUserId === user.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>

            <div className="tier-panel admin-panel">
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

            <div className="tier-panel admin-panel">
              <h3>Reset Tournament</h3>
              <p>Reset for a new season by clearing registered teams and golfer scores while keeping approved users and tiers.</p>
              <div className="nav-row">
                <button
                  type="button"
                  className="button"
                  onClick={onResetTournament}
                  disabled={resettingTournament}
                >
                  {resettingTournament ? 'Resetting…' : 'Reset Tournament Data'}
                </button>
              </div>
            </div>

            <div className="tier-panel admin-panel">
              <h3>Scoring Import</h3>
              <p>
                Admin-only scoring import. Paste JSON or CSV-like rows in either supported order:
                golfer_name,total_score,made_cut,round_1_score,round_2_score,round_3_score,round_4_score,sunday_birdies
                or golfer_name,total_score,made_cut,round_1_score,round_2_score,round_3_score,round_4_score,sunday_birdies,status_text,current_round_score
              </p>
              <textarea
                value={scoreImportText}
                onChange={(event) => setScoreImportText(event.target.value)}
                placeholder={`golfer_name,total_score,made_cut,round_1_score,round_2_score,round_3_score,round_4_score,sunday_birdies,status_text,current_round_score\nScottie Scheffler,-10,true,-2,-3,-2,-3,7,F,-3\nRory McIlroy,2,false,1,1,,,2,Thru 14,1\n\nOR\n[{\"golfer_name\":\"Scottie Scheffler\",\"total_score\":-10,\"made_cut\":true,\"round_1_score\":-2,\"round_2_score\":-3,\"round_3_score\":-2,\"round_4_score\":-3,\"sunday_birdies\":7,\"status_text\":\"F\",\"current_round_score\":-3}]`}
                rows={8}
              />
              <div className="nav-row">
                <button
                  type="button"
                  className="button"
                  onClick={onImportScores}
                  disabled={importingScores}
                >
                  {importingScores ? 'Importing…' : 'Import Scores'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={onUpdateLiveScores}
                  disabled={updatingLiveScores}
                >
                  {updatingLiveScores ? 'Updating…' : 'Update Live Scores'}
                 onClick={onUpdateLiveScores}
                 disabled={importingScores}
                >
                  {importingScores ? 'Updating…' : 'Update Live Scores'}
                </button>
              </div>
            </div>

            <form onSubmit={onSave} className="stack-form">
              {tierNumbers.map((tierNumber) => (
                <div className="tier-panel admin-panel" key={tierNumber}>
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
