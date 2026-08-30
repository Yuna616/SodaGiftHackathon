'use client';

import { useEffect, useState } from 'react';
import CategoryTabs from '@/components/CategoryTabs';
import CampaignCard from '@/components/CampaignCard';
import NotificationBell from '@/components/NotificationBell';
import type { CampaignSort, PublicCampaignWithConsensus } from '@/lib/types';

export default function HomePage() {
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<CampaignSort>('recommended');
  const [campaigns, setCampaigns] = useState<PublicCampaignWithConsensus[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCampaigns(null);
    fetch(`/api/campaigns?category=${category}&sort=${sort}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCampaigns(data.campaigns);
      });
    return () => {
      cancelled = true;
    };
  }, [category, sort]);

  return (
    <div>
      <header className="px-4 pt-6 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">SodaPick</h1>
          <p className="text-sm text-gray-500 mt-0.5">무료로 예측하고, 진짜 기프티콘을 받아보세요</p>
        </div>
        <NotificationBell variant="light" />
      </header>

      <div className="mb-3">
        <CategoryTabs active={category} onChange={setCategory} />
      </div>

      <div className="flex gap-2 px-4 mb-3">
        {(
          [
            { id: 'recommended', label: '추천순' },
            { id: 'ending', label: '마감임박순' },
            { id: 'popular', label: '인기순' },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
              sort === s.id ? 'border-soda-500 text-soda-600' : 'border-gray-200 text-gray-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-4 flex flex-col gap-3">
        {campaigns === null &&
          [0, 1].map((i) => (
            <div key={i} className="h-96 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        {campaigns !== null && campaigns.length === 0 && (
          <div className="py-16 text-center text-sm text-gray-400">진행 중인 캠페인이 없습니다</div>
        )}
        {campaigns?.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>

      <div className="px-4 py-8 text-center">
        <a href="/dashboard" className="text-xs text-gray-300 underline">
          스폰서로 로그인
        </a>
      </div>
    </div>
  );
}
