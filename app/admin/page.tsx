import { NavLinks } from '@/components/nav-links';

export default function AdminPage() {
  return (
    <main>
      <section className="card">
        <h2>Admin Area (Protected Placeholder)</h2>
        <p>
          This route is protected by middleware and checks for an <code>admin_token</code>{' '}
          cookie matching your configured environment value.
        </p>
        <p>Admin tooling will be added in later iterations.</p>
        <NavLinks />
      </section>
    </main>
  );
}
