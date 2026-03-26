import Link from 'next/link';
import { NavLinks } from '@/components/nav-links';

export default function LandingPage() {
  return (
    <main>
      <section className="card">
        <h1>Masters Golf Pool</h1>
        <p>
          Welcome to your private pool. Start by joining your team and then head to the
          pre-draft lobby.
        </p>
        <Link className="button" href="/join">
          Enter
        </Link>
        <NavLinks />
      </section>
    </main>
  );
}
