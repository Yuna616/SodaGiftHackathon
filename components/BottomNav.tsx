'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: '캠페인', icon: '🏠' },
  { href: '/store', label: '스토어', icon: '🛍️' },
  { href: '/my', label: '마이페이지', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();
  // 캠페인 상세 화면은 플로팅 PICK 바가 이 자리를 대신한다 (핵심 행동에 집중)
  if (pathname?.startsWith('/campaigns/')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="tab-bar flex">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                active ? 'text-soda-600 font-semibold' : 'text-gray-400'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
