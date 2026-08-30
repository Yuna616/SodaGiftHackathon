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
  kpop: 'K팝',
  esports: 'e스포츠',
  variety: '예능',
  drama: '드라마',
  beauty: '뷰티',
};

const STATUS_LABEL: Record<PublicCampaignWithConsensus['status'], { text: string; className: string }> = {
  active: { text: '진행중', className: 'bg-soda-500 text-white' },
  ended: { text: '집계중', className: 'bg-amber-400 text-white' },
  resolved: { text: '발표완료', className: 'bg-black/60 text-white' },
};

function formatPrizeLine(campaign: PublicCampaignWithConsensus): string {
  const reward =
    campaign.prize_type === 'amount' && campaign.prize_amount
      ? `${campaign.prize_amount.toLocaleString()}${campaign.prize_currency ?? '원'}`
      : `🎁 ${campaign.prize_label}`;
  return campaign.winner_count !== null ? `${reward} · 최대 ${campaign.winner_count}명` : reward;
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
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
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
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-white bg-black/55 backdrop-blur rounded-full px-2 py-0.5">
              {CATEGORY_LABEL[campaign.category] ?? (campaign.category || '캠페인')}
            </span>
            <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${status.className}`}>
              {status.text}
            </span>
          </div>
        </div>

        <div className="px-4 pt-4">
          <span className="text-xs font-semibold text-soda-600">{campaign.sponsor_name} 제공</span>
          <h3 className="text-xl font-extrabold text-gray-900 leading-tight mt-1 mb-1.5">{campaign.title}</h3>
          <p className="text-sm text-gray-500 text-right mb-3">{formatPrizeLine(campaign)}</p>
        </div>
      </Link>

      <div className="px-4 flex flex-col gap-2 mb-3">
        {campaign.options.map((opt) => {
          const percent = campaign.consensus[opt.id] ?? 0;
          const count = campaign.counts[opt.id] ?? 0;
          const selected = pickedOptionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleOptionClick(opt.id)}
              className={`w-full text-left rounded-xl border p-3 transition ${
                selected ? 'border-soda-500 bg-soda-50' : 'border-gray-200 bg-white active:scale-[0.99]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-medium truncate ${selected ? 'text-soda-600' : 'text-gray-800'}`}>
                  {opt.label}
                </span>
                <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                  {count}명 · {percent}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${selected ? 'bg-soda-500' : 'bg-gray-300'}`}
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <Link href={detailHref} className="block px-4 pb-4 active:opacity-70 transition">
        {campaign.status === 'active' ? (
          <CountdownTimer endAt={campaign.end_at} className="text-xs" />
        ) : (
          <span className="text-xs text-gray-400">참여가 마감됐어요</span>
        )}
      </Link>
    </div>
  );
}
