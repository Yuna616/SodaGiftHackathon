'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/session';

interface NotificationBellProps {
  variant?: 'light' | 'dark';
}

// 캠페인 상세(미디어 위, 어두운 배경) & 마이페이지(밝은 배경) 양쪽에서 쓰는 종모양 버튼.
// 안읽은 알림이 있으면 우측 상단에 빨간 점을 띄운다.
export default function NotificationBell({ variant = 'dark' }: NotificationBellProps) {
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

  const isDark = variant === 'dark';

  return (
    <Link
      href="/notifications"
      aria-label="Activity"
      className={`relative h-8 w-8 rounded-full flex items-center justify-center backdrop-blur ${
        isDark ? 'bg-black/50 text-white' : 'bg-gray-100 text-gray-700'
      }`}
    >
      <span className="text-sm leading-none">🔔</span>
      {unreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
      )}
    </Link>
  );
}
