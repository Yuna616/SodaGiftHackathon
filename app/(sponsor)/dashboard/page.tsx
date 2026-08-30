"use client";

// PRD 5.1 대시보드 홈: 고객사 프로필 + 지갑 잔액 + 진행중 이벤트를 한눈에 보여주는
// 메인 화면. 여기서 새 캠페인을 만들고, 자신이 만든 캠페인들을 관리한다.

import { useEffect, useState } from "react";
import { Badge, Button, Callout, Card } from "../_components/ui";

// TODO: 인증 붙기 전까지 seed된 데모 스폰서 id 하드코딩 (마법사와 동일한 값)
const DEMO_SPONSOR_ID = "72495905-2368-41a3-8eba-fef7a07fcc21";

const CATEGORY_LABEL: Record<string, string> = {
  kpop: "K팝",
  esports: "e스포츠",
  variety: "예능",
  drama: "드라마",
};

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
  starts_at: string | null;
  ends_at: string | null;
  rounds: RoundSummary[];
  failed_claims_count: number;
};

type Sponsor = {
  id: string;
  name: string;
  contact_email: string;
  status: string;
  created_at: string;
};

type Stats = {
  total_campaigns: number;
  active_campaigns: number;
  draft_campaigns: number;
  ended_campaigns: number;
  total_participants: number;
  total_failed_claims: number;
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

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function SponsorDashboard() {
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [balance, setBalance] = useState<{ amount: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sponsors/${DEMO_SPONSOR_ID}/campaigns`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return setError(data.error);
        setSponsor(data.sponsor);
        setStats(data.stats);
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

  const active = (campaigns ?? []).filter((c) => c.status === "active");
  const draft = (campaigns ?? []).filter((c) => c.status === "draft");
  const ended = (campaigns ?? []).filter((c) => c.status === "ended");

  return (
    <main>
      {error && (
        <div className="mb-4">
          <Callout tone="red">{error}</Callout>
        </div>
      )}

      <ProfileHeader sponsor={sponsor} />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="지갑 잔액"
          value={balance ? `${balance.amount.toLocaleString()} ${balance.currency}` : "-"}
        />
        <StatCard label="진행중 이벤트" value={stats ? `${stats.active_campaigns}개` : "-"} />
        <StatCard label="누적 참여자" value={stats ? `${stats.total_participants.toLocaleString()}명` : "-"} />
        <StatCard
          label="지급 실패"
          value={stats ? `${stats.total_failed_claims}건` : "-"}
          tone={stats && stats.total_failed_claims > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">내 이벤트</h2>
        <Button onClick={() => (window.location.href = "/campaigns/new")}>+ 새 캠페인 만들기</Button>
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
          {active.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                진행중 <span className="text-slate-400">({active.length})</span>
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {active.map((c) => (
                  <ActiveCampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </section>
          )}

          <CampaignSection title="임시저장" campaigns={draft} onDelete={handleDelete} />
          <CampaignSection title="종료" campaigns={ended} />
        </div>
      )}
    </main>
  );
}

function ProfileHeader({ sponsor }: { sponsor: Sponsor | null }) {
  const initial = sponsor?.name?.trim()?.[0] ?? "?";
  return (
    <Card className="mb-6 flex items-center gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        {sponsor ? (
          <>
            <div className="mb-0.5 flex items-center gap-2">
              <h1 className="truncate text-lg font-bold text-slate-900">{sponsor.name}</h1>
              <Badge tone={sponsor.status === "active" ? "green" : "slate"}>
                {sponsor.status === "active" ? "활성" : sponsor.status}
              </Badge>
            </div>
            <p className="truncate text-sm text-slate-500">{sponsor.contact_email}</p>
            <p className="mt-0.5 text-xs text-slate-400">{formatDate(sponsor.created_at)}부터 함께하고 있어요</p>
          </>
        ) : (
          <>
            <div className="mb-2 h-5 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
          </>
        )}
      </div>
    </Card>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <Card>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "danger" ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
    </Card>
  );
}

function ActiveCampaignCard({ campaign }: { campaign: CampaignSummary }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {campaign.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.thumbnail_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-100" />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <h4 className="truncate text-sm font-semibold text-slate-900">{campaign.title}</h4>
            {campaign.category && <Badge tone="purple">{CATEGORY_LABEL[campaign.category] ?? campaign.category}</Badge>}
            {campaign.failed_claims_count > 0 && (
              <Badge tone="red">지급 실패 {campaign.failed_claims_count}건</Badge>
            )}
          </div>
          {(campaign.starts_at || campaign.ends_at) && (
            <p className="text-xs text-slate-400">
              {formatDate(campaign.starts_at)} ~ {formatDate(campaign.ends_at)}
            </p>
          )}
        </div>
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

      <div className="flex gap-3 border-t border-slate-100 pt-3">
        <a href={`/campaigns/${campaign.id}/rounds`} className="text-xs font-medium text-brand-600 hover:underline">
          판정 콘솔
        </a>
        <a href={`/campaigns/${campaign.id}/payouts`} className="text-xs font-medium text-brand-600 hover:underline">
          지급 현황
        </a>
      </div>
    </Card>
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
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        {title} <span className="text-slate-400">({campaigns.length})</span>
      </h3>
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
          <h4 className="truncate text-sm font-semibold text-slate-900">{campaign.title}</h4>
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
