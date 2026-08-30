'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSession, setSession } from '@/lib/session';
import { createBrowserSupabaseClient, signInWithGoogle } from '@/lib/supabase/client';
import type { AppNotification, NotificationType } from '@/lib/types';

const TYPE_META: Record<NotificationType, { label: string; tint: string; tone: string }> = {
  rank_change: { label: 'UPDATE', tint: '#E6F8FD', tone: '#0A8FB0' },
  deadline_soon: { label: 'CLOSING SOON', tint: '#FDF1E1', tone: '#C96A00' },
  result: { label: 'RESULT', tint: '#E7F7EE', tone: '#12A150' },
};

const FILTERS: { id: 'all' | NotificationType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'result', label: 'Results' },
  { id: 'rank_change', label: 'Updates' },
  { id: 'deadline_soon', label: 'Closing' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return 'TODAY';
  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86400000);
  return diffDays <= 7 ? 'THIS WEEK' : 'EARLIER';
}

export default function NotificationsPage() {
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | NotificationType>('all');

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

  function markAllRead() {
    if (!participantId || !notifications) return;
    setNotifications(notifications.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId }),
    }).catch(() => {});
  }

  const filtered = useMemo(
    () => (notifications ?? []).filter((n) => filter === 'all' || n.type === filter),
    [notifications, filter]
  );
  const groups = useMemo(() => {
    const order = ['TODAY', 'THIS WEEK', 'EARLIER'];
    const byGroup = new Map<string, AppNotification[]>();
    for (const n of filtered) {
      const g = groupLabel(n.created_at);
      byGroup.set(g, [...(byGroup.get(g) ?? []), n]);
    }
    return order.filter((g) => byGroup.has(g)).map((g) => ({ label: g, items: byGroup.get(g)! }));
  }, [filtered]);

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-5 pt-6 pb-1">
        <h1 className="text-[26px] font-extrabold tracking-[-0.5px] text-ink">Activity</h1>
        {notifications && notifications.some((n) => !n.read_at) && (
          <button onClick={markAllRead} className="py-1.5 px-0.5 text-[13px] font-bold text-accent-dark">
            Mark all read
          </button>
        )}
      </div>

      {participantId && notifications && notifications.length > 0 && (
        <div className="flex gap-2 px-5 my-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold ${
                filter === f.id ? 'bg-ink text-white' : 'bg-white text-[#5A6068]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-5">
        {loading ? (
          <div className="flex flex-col gap-2 mt-4">
            <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          </div>
        ) : !participantId ? (
          <div className="flex flex-col items-center justify-center pt-24">
            <p className="text-sm text-gray-400 mb-4">Sign in to receive activity updates</p>
            <button
              onClick={() => signInWithGoogle('/notifications')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
            >
              Sign in with Google
            </button>
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <p className="text-sm text-gray-400 text-center pt-24">No activity yet</p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-[22px]">
              <div className="mb-2.5 mx-1 text-xs font-bold tracking-[.2px] text-[#9AA0A8]">{g.label}</div>
              <div className="flex flex-col gap-2.5">
                {g.items.map((n) => {
                  const meta = TYPE_META[n.type];
                  const isUnread = !n.read_at;
                  return (
                    <Link
                      key={n.id}
                      href={`/campaigns/${n.campaign_id}`}
                      className={`flex items-start gap-3 rounded-[22px] border-[1.5px] p-4 transition ${
                        isUnread ? 'border-[#E4F4FA] bg-white' : 'border-[#EFF0F2] bg-[#FAFBFC]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="rounded-[7px] px-[9px] py-1 text-[10.5px] font-extrabold"
                            style={{ background: meta.tint, color: meta.tone }}
                          >
                            {meta.label}
                          </span>
                          <span className="text-[11.5px] font-medium text-[#9AA0A8]">{formatDate(n.created_at)}</span>
                        </div>
                        <p className="mb-[5px] text-[15px] font-bold leading-[1.4] text-ink">{n.title}</p>
                        <p className="text-[13px] leading-[1.55] text-[#6B7280]">{n.body}</p>
                      </div>
                      {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
