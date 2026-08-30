'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession, setSession } from '@/lib/session';
import { createBrowserSupabaseClient, signInWithGoogle } from '@/lib/supabase/client';
import type { AppNotification, NotificationType } from '@/lib/types';

const TYPE_META: Record<NotificationType, { icon: string; label: string }> = {
  rank_change: { icon: '📊', label: '진행 현황' },
  deadline_soon: { icon: '⏰', label: '마감 임박' },
  result: { icon: '🏆', label: '결과 발표' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [loading, setLoading] = useState(true);

  function loadNotifications(pid: string) {
    return fetch(`/api/notifications?participant_id=${pid}`)
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        // 알림함을 열람하면 전부 읽음 처리
        if ((data.unreadCount ?? 0) > 0) {
          fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId: pid }),
          }).catch(() => {});
        }
      });
  }

  useEffect(() => {
    const session = getSession();
    if (session) {
      setParticipantId(session.participantId);
      loadNotifications(session.participantId).finally(() => setLoading(false));
      return;
    }
    createBrowserSupabaseClient()
      .auth.getUser()
      .then(async ({ data }) => {
        const email = data.user?.email;
        if (!email) {
          setLoading(false);
          return;
        }
        const res = await fetch('/api/participants/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const identified = await res.json();
        setSession({ participantId: identified.participant.id, email: identified.participant.email });
        setParticipantId(identified.participant.id);
        await loadNotifications(identified.participant.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => router.back()}
          className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm"
        >
          ←
        </button>
        <h1 className="text-base font-bold text-gray-900">활동알림</h1>
      </div>

      <div className="px-4">
        {loading ? (
          <div className="flex flex-col gap-2 mt-4">
            <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          </div>
        ) : !participantId ? (
          <div className="flex flex-col items-center justify-center pt-24">
            <p className="text-sm text-gray-400 mb-4">로그인하면 활동알림을 받을 수 있어요</p>
            <button
              onClick={() => signInWithGoogle('/notifications')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
            >
              Google 계정으로 로그인
            </button>
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <p className="text-sm text-gray-400 text-center pt-24">아직 알림이 없어요</p>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type];
              const isUnread = !n.read_at;
              return (
                <Link
                  key={n.id}
                  href={`/campaigns/${n.campaign_id}`}
                  className={`flex gap-3 rounded-xl border p-3 active:bg-gray-50 transition ${
                    isUnread ? 'border-soda-200 bg-soda-50/40' : 'border-gray-200'
                  }`}
                >
                  <span className="text-xl leading-none shrink-0">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-gray-400">{meta.label}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{formatDate(n.created_at)}</span>
                    </div>
                    <p className={`text-sm mt-0.5 ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                  </div>
                  {isUnread && <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
