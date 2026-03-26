'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AdminAccessButtonProps = {
  mode: 'enter' | 'exit';
};

export function AdminAccessButton({ mode }: AdminAccessButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    let adminPassword: string | undefined;
    if (mode === 'enter') {
      const enteredPassword = window.prompt('Enter admin password or PIN');
      if (enteredPassword === null) {
        return;
      }

      adminPassword = enteredPassword;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/access', {
        method: mode === 'enter' ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: mode === 'enter' ? JSON.stringify({ password: adminPassword }) : undefined,
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to update admin access.');
      }

      if (mode === 'enter') {
        // Use a full navigation after cookie mutation so middleware always
        // evaluates /admin with the new cookie value.
        window.location.assign('/admin');
        return;
      }

      router.push('/');
      router.refresh();
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : 'Unable to update admin access.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="button" onClick={onClick} disabled={loading}>
        {loading
          ? mode === 'enter'
            ? 'Opening Admin…'
            : 'Exiting Admin…'
          : mode === 'enter'
            ? 'Admin Access'
            : 'Exit Admin'}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </>
  );
}
