'use client';

import { useEffect, useState } from 'react';
import type { PublicCampaign } from '@/lib/types';

const EVENT_LABEL: Record<string, string> = {
  campaign_viewed: '캠페인 조회',
  prediction_submitted: '예측 제출',
  invite_link_shared: '초대 링크 공유',
  invite_completed: '초대 완료',
  result_notified: '결과 알림',
  claim_started: '클레임 시작',
  claim_completed: '클레임 완료',
  sender_cta_clicked: '발신 CTA 클릭/완료',
};

export default function AdminPage() {
  const [campaigns, setCampaigns] = useState<PublicCampaign[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ event_name: string; count: number }[]>([]);

  function refresh() {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((data) => setCampaigns(data.campaigns ?? []));
    fetch('/api/admin/analytics')
      .then((r) => r.json())
      .then((data) => setCounts(data.counts ?? []));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function resolve(campaignId: string) {
    const chosen = selections[campaignId];
    if (!chosen) return;
    setStatus('처리 중...');
    const res = await fetch('/api/admin/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, winningOptionIds: [chosen] }),
    });
    const data = await res.json();
    setStatus(res.ok ? `발표 완료 · 당첨자 ${data.winnerCount}명` : `처리 실패: ${data.error ?? ''}`);
    refresh();
  }

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-gray-900 mb-1 pt-2">관리자 · 결과 발표</h1>
      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-5">
        해커톤 데모용 화면입니다. 인증이 없으니 운영 환경에서는 반드시 접근 제한을 추가하세요. 정답은
        1개만 고를 수 있어요(4지선다 라운드 설계 제약).
      </p>

      {status && <p className="text-xs text-soda-600 mb-3">{status}</p>}

      <div className="flex flex-col gap-4 mb-8">
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800">{c.title}</p>
              <span className="text-[11px] text-gray-400">{c.status}</span>
            </div>
            <div className="flex flex-col gap-1.5 mb-3">
              {c.options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="radio"
                    name={`resolve-${c.id}`}
                    disabled={c.status === 'resolved'}
                    checked={
                      c.status === 'resolved'
                        ? c.reward_option_ids.includes(opt.id)
                        : selections[c.id] === opt.id
                    }
                    onChange={() => setSelections((prev) => ({ ...prev, [c.id]: opt.id }))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <button
              onClick={() => resolve(c.id)}
              disabled={c.status === 'resolved' || !selections[c.id]}
              className="w-full rounded-xl bg-gray-900 text-white text-sm font-semibold py-2.5 disabled:opacity-30"
            >
              {c.status === 'resolved' ? '발표 완료' : '결과 발표'}
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-800 mb-2">트래킹 이벤트 퍼널</h2>
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
        {Object.keys(EVENT_LABEL).map((key) => {
          const found = counts.find((c) => c.event_name === key);
          return (
            <div key={key} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-gray-600">{EVENT_LABEL[key]}</span>
              <span className="font-semibold text-gray-800 tabular-nums">{found?.count ?? 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
