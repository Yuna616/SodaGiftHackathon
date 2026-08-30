import Link from 'next/link';
import CountdownTimer from './CountdownTimer';
import type { CampaignWithConsensus } from '@/lib/types';

const CATEGORY_LABEL: Record<string, string> = {
  kpop: 'K팝',
  esports: 'e스포츠',
  variety: '예능',
  drama: '드라마',
};

const STATUS_LABEL: Record<CampaignWithConsensus['status'], { text: string; className: string }> = {
  active: { text: '진행중', className: 'bg-soda-500 text-white' },
  ended: { text: '집계중', className: 'bg-amber-400 text-white' },
  resolved: { text: '발표완료', className: 'bg-black/60 text-white' },
};

function formatPrize(campaign: CampaignWithConsensus): string {
  if (campaign.prize_type === 'amount' && campaign.prize_amount) {
    return `💰 ${campaign.prize_amount.toLocaleString()}원 상당`;
  }
  return `🎁 ${campaign.prize_label}`;
}

export default function CampaignCard({ campaign }: { campaign: CampaignWithConsensus }) {
  const status = STATUS_LABEL[campaign.status];
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="block rounded-2xl border border-gray-100 bg-white shadow-sm active:scale-[0.99] transition overflow-hidden"
    >
      <div className="relative aspect-[16/9] w-full">
        <img src={campaign.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-white bg-black/55 backdrop-blur rounded-full px-2 py-0.5">
            {CATEGORY_LABEL[campaign.category] ?? campaign.category}
          </span>
          <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${status.className}`}>
            {status.text}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-soda-600">{campaign.sponsor_name} 제공</span>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            총 {campaign.winner_count}명 당첨
          </span>
        </div>
        <p className="text-xl font-extrabold text-gray-900 leading-tight mb-1.5">{formatPrize(campaign)}</p>
        <h3 className="text-sm text-gray-500 mb-3">{campaign.title}</h3>

        <div className="flex flex-col gap-2 mb-3">
          {campaign.options.map((opt) => {
            const percent = campaign.consensus[opt.id] ?? 0;
            const count = campaign.counts[opt.id] ?? 0;
            return (
              <div key={opt.id}>
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="truncate text-gray-700">{opt.label}</span>
                  <span className="shrink-0 text-gray-400 tabular-nums">
                    {count}명 · {percent}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-soda-500" style={{ width: `${Math.max(percent, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {campaign.status === 'active' ? (
          <CountdownTimer endAt={campaign.end_at} className="text-xs" />
        ) : (
          <span className="text-xs text-gray-400">참여가 마감됐어요</span>
        )}
      </div>
    </Link>
  );
}
