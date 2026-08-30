"use client";

// PRD 5.1 대시보드 홈: 진행중/임시저장/종료 캠페인 리스트, 지갑 잔액 요약 카드,
// 지급 실패 알림 뱃지. 여기서 새 캠페인을 만들고, 자신이 만든 캠페인들을 확인한다.

import { useEffect, useState } from "react";
import { Badge, Button, Callout, Card } from "../_components/ui";

// TODO: 인증 붙기 전까지 seed된 데모 스폰서 id 하드코딩 (마법사와 동일한 값)
const DEMO_SPONSOR_ID = "72495905-2368-41a3-8eba-fef7a07fcc21";

type RoundSummary = {
  id: string;
  round_number: number;
  status: string;
  reward_mode: "PRODUCT" | "CREDIT";
};

type CampaignSummary = {
  id: string;
  title: string;
  status: "draft" | "active" | "ended";
  category: string;
  thumbnail_url: string;
  created_at: string;
  rounds: RoundSummary[];
  failed_claims_count: number;
};

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "임시저장",
  active: "진행중",
  ended: "종료",
};
const CAMPAIGN_STATUS_TONE: Record<string, "slate" | "blue" | "green"> = {
  draft: "slate",
  active: "blue",
  ended: "green",
};
const ROUND_STATUS_LABEL: Record<string, string> = {
  upcoming: "예정",
  open: "진행중",
  closed_pending_resolution: "판정 대기",
  resolved: "판정 완료",
};

export default function SponsorDashboard() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [balance, setBalance] = useState<{ amount: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sponsors/${DEMO_SPONSOR_ID}/campaigns`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return setError(data.error);
        setCampaigns(data.campaigns ?? []);
      });
    fetch("/api/wallet/balance")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setBalance({ amount: data.balance, currency: data.currency });
      });
  }, []);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "캠페인 삭제에 실패했습니다.");
      return;
    }
    setCampaigns((prev) => (prev ?? []).filter((c) => c.id !== id));
  };

  const failedTotal = (campaigns ?? []).reduce((sum, c) => sum + c.failed_claims_count, 0);
  const active = (campaigns ?? []).filter((c) => c.status === "active");
  const draft = (campaigns ?? []).filter((c) => c.status === "draft");
  const ended = (campaigns ?? []).filter((c) => c.status === "ended");

  return (
    <main>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">대시보드</h1>
          <p className="text-sm text-slate-500">내가 만든 캠페인을 관리해요.</p>
        </div>
        <Button onClick={() => (window.location.href = "/campaigns/new")}>+ 새 캠페인 만들기</Button>
      </div>

      {error && (
        <div className="mb-4">
          <Callout tone="red">{error}</Callout>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-slate-500">지갑 잔액</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {balance ? `${balance.amount.toLocaleString()} ${balance.currency}` : "-"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">지급 실패</p>
          <p className={`mt-1 text-xl font-bold ${failedTotal > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {failedTotal}건
          </p>
        </Card>
      </div>

      {campaigns === null ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">
          아직 만든 캠페인이 없어요. "새 캠페인 만들기"로 시작해보세요.
        </Card>
      ) : (
        <div className="space-y-8">
          <CampaignSection title="진행중" campaigns={active} />
          <CampaignSection title="임시저장" campaigns={draft} onDelete={handleDelete} />
          <CampaignSection title="종료" campaigns={ended} />
        </div>
      )}
    </main>
  );
}

function CampaignSection({
  title,
  campaigns,
  onDelete,
}: {
  title: string;
  campaigns: CampaignSummary[];
  onDelete?: (id: string) => void | Promise<void>;
}) {
  if (campaigns.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">
        {title} <span className="text-slate-400">({campaigns.length})</span>
      </h2>
      <div className="space-y-3">
        {campaigns.map((c) => (
          <CampaignRow key={c.id} campaign={c} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

function CampaignRow({
  campaign,
  onDelete,
}: {
  campaign: CampaignSummary;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <Card className="flex items-center gap-4">
      {campaign.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={campaign.thumbnail_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900">{campaign.title}</h3>
          <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>
          {campaign.failed_claims_count > 0 && (
            <Badge tone="red">지급 실패 {campaign.failed_claims_count}건</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs text-slate-500">
          {campaign.rounds.length === 0 ? (
            <span>라운드 없음</span>
          ) : (
            campaign.rounds.map((r) => (
              <span key={r.id} className="rounded-full bg-slate-100 px-2 py-0.5">
                라운드 {r.round_number} · {r.reward_mode === "CREDIT" ? "크레딧" : "상품"} ·{" "}
                {ROUND_STATUS_LABEL[r.status] ?? r.status}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a href={`/campaigns/${campaign.id}/rounds`} className="text-xs font-medium text-brand-600 hover:underline">
          판정 콘솔
        </a>
        <a href={`/campaigns/${campaign.id}/payouts`} className="text-xs font-medium text-brand-600 hover:underline">
          지급 현황
        </a>
        {onDelete &&
          (confirming ? (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-rose-500">삭제할까요?</span>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  await onDelete(campaign.id);
                }}
                className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "확인"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirming(false)}
                className="text-xs font-medium text-slate-400 hover:underline disabled:opacity-50"
              >
                취소
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-xs font-medium text-slate-400 hover:text-rose-600 hover:underline"
            >
              삭제
            </button>
          ))}
      </div>
    </Card>
  );
}
