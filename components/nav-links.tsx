'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type LinkItem = {
  href: string;
  label: string;
  requiresAdmin?: boolean;
};

const links: LinkItem[] = [
  { href: '/', label: 'Landing' },
  { href: '/join', label: 'Join' },
  { href: '/lobby', label: 'Lobby' },
  { href: '/draft', label: 'Draft' },
  { href: '/admin', label: 'Admin', requiresAdmin: true },
];

export function NavLinks() {
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAdminAccess() {
      try {
        const response = await fetch('/api/admin/access', { cache: 'no-store' });
        const data = (await response.json()) as { hasAccess?: boolean };

        if (!active) {
          return;
        }

        setHasAdminAccess(Boolean(data.hasAccess));
      } catch {
        if (active) {
          setHasAdminAccess(false);
        }
      }
    }

    loadAdminAccess();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="nav-row">
      {links
        .filter((link) => !link.requiresAdmin || hasAdminAccess)
        .map((link) => (
          <Link className="button" key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
    </div>
  );
}
