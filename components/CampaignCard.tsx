'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CountdownTimer from './CountdownTimer';
import type { PublicCampaignWithConsensus } from '@/lib/types';

// 옵션을 누르면 상세 페이지의 선택 상태(ConsensusBar)와 같은 색이 먼저 칠해지고,
// 그 색이 눈에 보인 다음에 상세 페이지로 넘어가도록 짧게 지연시킨다.
const SELECT_TRANSITION_MS = 180;

const CATEGORY_LABEL: Record<string, string> = {
  kpop: 'K-Pop',
  esports: 'Esports',
  variety: 'Variety',
  drama: 'Drama',
  beauty: 'Beauty',
};

const STATUS_LABEL: Record<PublicCampaignWithConsensus['status'], { text: string; className: string }> = {
  active: { text: 'Live', className: 'bg-accent text-white' },
  ended: { text: 'Tallying', className: 'bg-amber-400 text-white' },
  resolved: { text: 'Announced', className: 'bg-black/60 text-white' },
};

function formatPrizeLine(campaign: PublicCampaignWithConsensus): string {
  const reward =
    campaign.prize_type === 'amount' && campaign.prize_amount
      ? `${campaign.prize_currency ?? 'KRW'} ${campaign.prize_amount.toLocaleString()}`
      : `🎁 ${campaign.prize_label}`;
  return campaign.winner_count !== null ? `${reward} · up to ${campaign.winner_count} winners` : reward;
}

export default function CampaignCard({ campaign }: { campaign: PublicCampaignWithConsensus }) {
  const router = useRouter();
  const status = STATUS_LABEL[campaign.status];
  const detailHref = `/campaigns/${campaign.id}`;
  const canPick = campaign.status === 'active';
  const [pickedOptionId, setPickedOptionId] = useState<string | null>(null);

  function handleOptionClick(optionId: string) {
    if (!canPick) {
      router.push(detailHref);
      return;
    }
    setPickedOptionId(optionId);
    setTimeout(() => router.push(`${detailHref}?option=${optionId}`), SELECT_TRANSITION_MS);
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_2px_10px_rgba(20,22,26,.05)]">
      <Link href={detailHref} className="block active:scale-[0.99] transition">
        <div className="relative aspect-[16/9] w-full bg-gray-100">
          {campaign.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.thumbnail_url}
              alt=""
              className={`h-full w-full object-cover ${!canPick ? 'grayscale-[60%] brightness-75' : ''}`}
              loading="lazy"
            />
          )}
          <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5">
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white">
              {CATEGORY_LABEL[campaign.category] ?? (campaign.category || 'Campaign')}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
              {status.text}
            </span>
          </div>
        </div>

        <div className="px-[18px] pt-[18px]">
          <div className="mb-[7px] text-[11.5px] font-semibold text-accent-dark">
            Sponsored by {campaign.sponsor_name}
          </div>
          <h3 className="mb-2.5 text-[19px] font-extrabold leading-[1.35] tracking-[-0.3px] text-ink">
            {campaign.title}
          </h3>
          <div className="mb-4 flex items-center gap-2 text-[12.5px] font-semibold text-[#5A6068]">
            <span className="rounded-lg bg-[#F1F3F5] px-2.5 py-1">{formatPrizeLine(campaign)}</span>
            {campaign.status === 'active' ? (
              <CountdownTimer endAt={campaign.end_at} className="text-danger" />
            ) : (
              <span className="text-gray-400">Entries closed</span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-col gap-[9px] px-[18px] pb-5">
        {campaign.options.map((opt) => {
          const percent = campaign.consensus[opt.id] ?? 0;
          const count = campaign.counts[opt.id] ?? 0;
          const selected = pickedOptionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleOptionClick(opt.id)}
              className={`w-full rounded-2xl border-[1.5px] p-3.5 text-left transition ${
                selected ? 'border-accent bg-accent-light' : 'border-[#ECEDF0] bg-white active:scale-[0.99]'
              }`}
            >
              <div className="mb-[9px] flex items-baseline justify-between">
                <span className={`truncate text-sm font-bold ${selected ? 'text-accent-dark' : 'text-ink'}`}>
                  {opt.label}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[#8B9199]">
                  {count} in · {percent}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F3F5]">
                <div
                  className={`h-full rounded-full ${selected ? 'bg-accent' : 'bg-gray-300'}`}
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
