"use client";

// 캠페인 생성 마법사 2단계(상세 화면)용 미리보기. 참가자 상세 페이지
// (app/(participant)/campaigns/[id]/page.tsx)의 정적인 부분만 그대로 옮겨서,
// 판정 기준·참여 미션 URL을 고칠 때마다 참가자가 카드를 눌러 들어갔을 때
// 실제로 보게 될 화면이 그대로 보이게 한다. 예측 제출/로그인/초대 공유 같은
// 상호작용은 다 뺐다 — 정적인 미리보기일 뿐이라서.

import ConsensusBar from "@/components/ConsensusBar";
import CountdownTimer from "@/components/CountdownTimer";
import type { PublicCampaignWithConsensus } from "@/lib/types";

function formatPrize(campaign: PublicCampaignWithConsensus): string {
  if (campaign.prize_type === "amount" && campaign.prize_amount) {
    return `💰 ${campaign.prize_amount.toLocaleString()}${campaign.prize_currency ?? "원"} 상당`;
  }
  return `🎁 ${campaign.prize_label}`;
}

export function CampaignDetailPreview({ campaign }: { campaign: PublicCampaignWithConsensus }) {
  const sponsor = campaign.sponsor_name || "스폰서";
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="relative aspect-[16/9] w-full bg-black">
        {campaign.media_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.media_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="border-b border-gray-100 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-soda-50 px-2.5 py-1 text-xs font-semibold text-soda-600">
            {sponsor} 제공
          </span>
          {campaign.winner_count !== null && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
              총 {campaign.winner_count}명 당첨
            </span>
          )}
        </div>
        <h1 className="mb-1 text-2xl font-extrabold leading-snug text-gray-900">{campaign.title}</h1>
        <p className="mb-3 text-sm text-gray-500">{formatPrize(campaign)}</p>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <CountdownTimer endAt={campaign.end_at} />
          <span>·</span>
          <span>{campaign.total_predictions}명 참여중</span>
        </div>
      </div>

      <div className="p-4">
        <p className="mb-4 text-sm text-gray-600">
          {campaign.resolution_criteria ? (
            campaign.resolution_criteria
          ) : (
            <span className="text-gray-300">판정 기준을 입력해주세요</span>
          )}
        </p>

        <div className="mb-4 flex flex-col gap-2">
          {campaign.options.map((opt) => (
            <ConsensusBar key={opt.id} label={opt.label} percent={0} disabled />
          ))}
        </div>

        {campaign.mission_url && (
          <div className="mt-5 rounded-2xl border border-gray-200 p-4">
            <p className="mb-3 text-sm text-gray-700">
              {sponsor}가 준비한 페이지를 방문하면 PICK에 참여할 수 있어요
            </p>
            {/* 미리보기 전체가 pointer-events-none으로 감싸여 있어서(카드 클릭 방지),
                이 링크만 pointer-events-auto로 되살려 실제로 입력한 미션 URL을 열어본다. */}
            <a
              href={campaign.mission_url}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto block w-full rounded-xl border border-gray-300 bg-white py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {sponsor} 이벤트 페이지 방문하기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
