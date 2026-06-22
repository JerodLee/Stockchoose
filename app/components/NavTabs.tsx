'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'TERMINAL', href: '/' },
  { label: '1W FORECAST · 코인', href: '/forecast' },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <div style={{ background: '#0a0a0a', borderBottom: '1px solid #1c1c1c', display: 'flex', height: 28, flexShrink: 0 }}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              borderRight: '1px solid #1c1c1c',
              background: active ? '#111' : 'transparent',
              borderBottom: active ? '2px solid #00e676' : '2px solid transparent',
              color: active ? '#fff' : '#555',
              fontSize: 9,
              textDecoration: 'none',
              letterSpacing: '0.05em',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
