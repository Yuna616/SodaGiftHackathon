'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/session';

const TABS = [
  {
    href: '/',
    label: 'Campaigns',
    path: 'M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  },
  {
    href: '/store',
    label: 'Store',
    path: 'M4 8h16l-1 12H5zM9 8V6a3 3 0 0 1 6 0v2',
  },
  {
    href: '/notifications',
    label: 'Activity',
    path: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 19a2 2 0 0 0 4 0',
  },
  {
    href: '/my',
    label: 'Profile',
    path: 'M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8',
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    const load = () =>
      fetch(`/api/notifications?participant_id=${session.participantId}`)
        .then((r) => r.json())
        .then((data) => setUnreadCount(data.unreadCount ?? 0))
        .catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  // 캠페인 상세 화면은 플로팅 PICK 바가 이 자리를 대신한다 (핵심 행동에 집중)
  if (pathname?.startsWith('/campaigns/')) return null;

  return (
    <nav className="fixed bottom-[22px] left-1/2 h-[70px] w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 rounded-[35px] bg-white px-1.5 shadow-[0_10px_30px_rgba(20,22,26,.14),0_0_0_1px_rgba(0,0,0,.04)]">
      <div className="flex h-full items-center">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          const showBadge = tab.href === '/notifications' && unreadCount > 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              className="relative flex h-[70px] flex-1 items-center justify-center"
            >
              <span
                className={`relative grid h-10 w-[52px] place-items-center rounded-[20px] ${
                  active ? 'bg-accent-light' : ''
                }`}
              >
                <svg
                  width="23"
                  height="23"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={active ? '#0A8FB0' : '#4A5057'}
                  strokeWidth={active ? 2.1 : 1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={tab.path} />
                </svg>
                {showBadge && (
                  <span className="absolute -right-0.5 -top-1 min-w-[17px] rounded-full border-2 border-white bg-danger px-1 text-center text-[10px] font-extrabold leading-[17px] text-white">
                    {unreadCount}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
