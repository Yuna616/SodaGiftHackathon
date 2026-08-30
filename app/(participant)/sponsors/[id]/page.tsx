'use client';

// 참가자가 보는 공개 스폰서 프로필. 고객사 콘솔 대시보드의 "참가자 화면으로 보기"에서
// 넘어온다. 지갑 잔액/지급 실패 같은 콘솔 전용 정보는 여기 노출하지 않는다.

import { useEffect, useState } from 'react';
import CampaignCard from '@/components/CampaignCard';
import type { PublicCampaignWithConsensus } from '@/lib/types';

type SponsorProfile = { id: string; name: string; created_at: string };

export default function SponsorProfilePage({ params }: { params: { id: string } }) {
  const [sponsor, setSponsor] = useState<SponsorProfile | null>(null);
  const [campaigns, setCampaigns] = useState<PublicCampaignWithConsensus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sponsors/${params.id}/profile`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return setError(data.error);
        setSponsor(data.sponsor);
        setCampaigns(data.campaigns ?? []);
      });
  }, [params.id]);

  if (error) {
    return <div className="px-4 py-16 text-center text-sm text-gray-400">존재하지 않는 스폰서예요.</div>;
  }

  return (
    <div>
      <header className="flex items-center gap-3 px-4 pb-4 pt-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-soda-500 text-xl font-bold text-white">
          {sponsor?.name?.trim()?.[0] ?? '?'}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-gray-900">{sponsor?.name ?? '불러오는 중...'}</h1>
          <p className="text-xs text-gray-400">
            {campaigns === null ? '' : `캠페인 ${campaigns.length}개 진행`}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 pb-8">
        {campaigns === null &&
          [0, 1].map((i) => <div key={i} className="h-96 animate-pulse rounded-2xl bg-gray-100" />)}
        {campaigns !== null && campaigns.length === 0 && (
          <div className="py-16 text-center text-sm text-gray-400">진행 중인 캠페인이 없어요</div>
        )}
        {campaigns?.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </div>
  );
}
