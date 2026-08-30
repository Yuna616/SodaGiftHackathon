'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, setSession, clearSession } from '@/lib/session';
import type { PublicCampaign, PublicPrediction, ClaimOrder } from '@/lib/types';

type PredictionRow = PublicPrediction & {
  campaign: PublicCampaign;
  isResolved: boolean;
  isWinner: boolean;
  claimOrder: ClaimOrder | null;
};

interface LeaderboardEntry {
  participantId: string;
  wins: number;
  email: string;
}

export default function MyPage() {
  const [email, setEmail] = useState('');
  const [participant, setParticipant] = useState<{ id: string; email: string } | null>(null);
  const [predictions, setPredictions] = useState<PredictionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  async function loadByEmail(targetEmail: string) {
    setError(null);
    const res = await fetch('/api/participants/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError('참여 이력을 찾을 수 없어요. 예측에 먼저 참여해주세요');
      return;
    }
    setParticipant(data.participant);
    setPredictions(data.predictions);
    setSession({ participantId: data.participant.id, email: data.participant.email });
  }

  useEffect(() => {
    const session = getSession();
    if (session) {
      loadByEmail(session.email);
    }
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => setLeaderboard(data.ranking ?? []));
  }, []);

  if (!participant) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-bold text-gray-900 mb-4 pt-2">마이페이지</h1>
        <div className="rounded-2xl border border-gray-200 p-4 mb-6">
          <p className="text-sm text-gray-600 mb-3">참여했던 이메일로 내 예측 현황을 확인하세요</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-2 outline-none focus:border-soda-400"
          />
          {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
          <button
            onClick={() => email && loadByEmail(email)}
            disabled={!email}
            className="w-full rounded-xl bg-black text-white font-semibold py-2.5 text-sm disabled:opacity-40"
          >
            조회하기
          </button>
        </div>
        <Leaderboard entries={leaderboard} />
      </div>
    );
  }

  const active = predictions?.filter((p) => p.campaign.status === 'active') ?? [];
  const past = predictions?.filter((p) => p.campaign.status !== 'active') ?? [];
  const winners = past.filter((p) => p.isWinner);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between pt-2 mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">마이페이지</h1>
          <p className="text-xs text-gray-400 mt-0.5">{participant.email}</p>
        </div>
        <button
          onClick={() => {
            clearSession();
            setParticipant(null);
            setPredictions(null);
          }}
          className="text-xs text-gray-400"
        >
          다른 이메일로 보기
        </button>
      </div>

      {winners.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">🎉 당첨 내역</h2>
          <div className="flex flex-col gap-2">
            {winners.map((p) => (
              <div key={p.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                <p className="text-sm font-semibold text-amber-800">{p.campaign.title}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {p.campaign.options.find((o) => o.id === p.selected_option)?.label} 예측 성공!
                </p>
                {p.claimOrder ? (
                  <span className="inline-block mt-2 text-xs font-semibold text-amber-600">기프티콘 수령 완료</span>
                ) : (
                  <Link
                    href={`/claim/${p.id}`}
                    className="inline-block mt-2 text-xs font-semibold text-white bg-amber-500 rounded-full px-3 py-1.5"
                  >
                    기프티콘 받기
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">참여 중인 캠페인</h2>
        {active.length === 0 ? (
          <p className="text-xs text-gray-400">참여 중인 캠페인이 없어요</p>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((p) => (
              <Link
                key={p.id}
                href={`/campaigns/${p.campaign.id}`}
                className="block rounded-xl border border-gray-200 p-3"
              >
                <p className="text-sm font-medium text-gray-800">{p.campaign.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.campaign.options.find((o) => o.id === p.selected_option)?.label} 선택 · 배수 x{p.multiplier}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">지난 예측 내역</h2>
        {past.length === 0 ? (
          <p className="text-xs text-gray-400">아직 결과가 발표된 예측이 없어요</p>
        ) : (
          <div className="flex flex-col gap-2">
            {past.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                <div>
                  <p className="text-sm text-gray-800">{p.campaign.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.campaign.options.find((o) => o.id === p.selected_option)?.label}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold rounded-full px-2 py-1 ${
                    p.isResolved
                      ? p.isWinner
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-400'
                      : 'bg-blue-50 text-blue-500'
                  }`}
                >
                  {p.isResolved ? (p.isWinner ? '성공' : '실패') : '집계중'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Leaderboard entries={leaderboard} />
    </div>
  );
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        <h2 className="text-sm font-semibold text-gray-800">예측왕 리더보드</h2>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-400">아직 랭킹 데이터가 없어요</p>
      ) : (
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          {entries.map((entry, i) => (
            <div key={entry.participantId} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm text-gray-700">
                <span className="text-gray-400 font-semibold mr-2">{i + 1}</span>
                {entry.email}
              </span>
              <span className="text-xs text-gray-500">{entry.wins}회 적중</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
