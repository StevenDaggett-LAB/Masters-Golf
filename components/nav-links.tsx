import Link from 'next/link';

const links = [
  { href: '/', label: 'Landing' },
  { href: '/join', label: 'Join' },
  { href: '/lobby', label: 'Lobby' },
  { href: '/draft', label: 'Draft' },
  { href: '/admin', label: 'Admin' },
];

export function NavLinks() {
  return (
    <div className="nav-row">
      {links.map((link) => (
        <Link className="button" key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
