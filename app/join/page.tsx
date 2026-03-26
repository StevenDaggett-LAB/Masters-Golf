'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NavLinks } from '@/components/nav-links';
import { getStoredUserId, storeUserId } from '@/lib/session';

type JoinResult = {
  success?: boolean;
  userId?: string;
  existing?: boolean;
  error?: string;
};

export default function JoinPage() {
  const [fullName, setFullName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const existingUserId = getStoredUserId();
    if (existingUserId) {
      router.replace('/lobby');
    }
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, teamName, phone, email }),
      });
      const data = (await response.json()) as JoinResult;

      if (!response.ok || !data.success || !data.userId) {
        setError(data.error ?? 'Unable to join right now.');
        return;
      }

      storeUserId(data.userId);
      setMessage(
        data.existing
          ? 'Welcome back! Redirecting to lobby…'
          : 'Registration successful. Redirecting to lobby…',
      );
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
          <label htmlFor="fullName">Full Name *</label>
          <input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <label htmlFor="teamName">Team Name *</label>
          <input
            id="teamName"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            required
          />

          <label htmlFor="phone">Phone (optional)</label>
          <input
            id="phone"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          <label htmlFor="email">Email (optional)</label>
          <input
            id="email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <div className="nav-row">
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Joining…' : 'Join Pool'}
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
