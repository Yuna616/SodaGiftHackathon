'use client';

import { useEffect, useState } from 'react';
import CategoryTabs from '@/components/CategoryTabs';
import CampaignCard from '@/components/CampaignCard';
import Logo from '@/components/Logo';
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
      <header className="px-5 pt-3.5 pb-0">
        <div className="flex items-center justify-between">
          <Logo />
          <button
            type="button"
            aria-label="Search"
            className="grid h-[38px] w-[38px] place-items-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.08)]"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#14161A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </button>
        </div>

        <div className="my-4">
          <CategoryTabs active={category} onChange={setCategory} />
        </div>

        <div className="flex gap-3.5 pb-1 text-[13px] font-semibold text-[#9AA0A8]">
          {(
            [
              { id: 'recommended', label: 'Recommended' },
              { id: 'ending', label: 'Closing soon' },
              { id: 'popular', label: 'Popular' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={sort === s.id ? 'border-b-2 border-ink pb-[3px] text-ink' : ''}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 pt-3.5">
        {campaigns === null &&
          [0, 1].map((i) => (
            <div key={i} className="h-96 rounded-3xl bg-gray-100 animate-pulse" />
          ))}
        {campaigns !== null && campaigns.length === 0 && (
          <div className="py-16 text-center text-sm text-gray-400">No campaigns are running right now</div>
        )}
        {campaigns?.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>

      <div className="px-4 py-8 text-center">
        <a href="/dashboard" className="text-xs text-gray-300 underline">
          Sponsor login
        </a>
      </div>
    </div>
  );
}
