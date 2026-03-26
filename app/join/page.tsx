'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NavLinks } from '@/components/nav-links';

type JoinResult = {
  success?: boolean;
  userId?: string;
  existing?: boolean;
  error?: string;
};

export default function JoinPage() {
  const [fullName, setFullName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, teamName }),
      });
      const data = (await response.json()) as JoinResult;

      if (!response.ok || !data.success) {
        setError(data.error ?? 'Unable to join right now.');
        return;
      }

      setMessage(data.existing ? 'Welcome back! Redirecting to lobby…' : 'You are in! Redirecting…');
      router.push('/lobby');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="card">
        <h2>Join the Pool</h2>
        <p>Only approved members can register.</p>

        <form onSubmit={onSubmit}>
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <label htmlFor="teamName">Team name</label>
          <input
            id="teamName"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            required
          />

          <div className="nav-row">
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Join'}
            </button>
          </div>
        </form>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <NavLinks />
      </section>
    </main>
  );
}
