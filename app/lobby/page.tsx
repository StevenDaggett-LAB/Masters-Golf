import { NavLinks } from '@/components/nav-links';

export default function LobbyPage() {
  return (
    <main>
      <section className="card">
        <h2>Pre-draft Lobby</h2>
        <p>Countdown placeholder: <code>00:00:00</code></p>
        <p>
          Drafting and scoring are intentionally not implemented yet. This page confirms
          navigation and basic pre-draft structure.
        </p>
        <NavLinks />
      </section>
    </main>
  );
}
