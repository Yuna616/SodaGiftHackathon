"use client";

// PRD 5.1 대시보드 홈. 왼쪽에 고객사 프로필(배너+아바타+상태 필터), 오른쪽에
// 알림 카드 + 캠페인 목록을 두는 2단 레이아웃. 여기서 새 캠페인을 만들고,
// 자신이 만든 캠페인들을 관리한다.

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "../_components/ui";

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

type StatusFilter = "all" | "active" | "draft" | "ended";
type SortMode = "latest" | "ending";

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("latest");
  const [copied, setCopied] = useState(false);

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

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근 실패 시 조용히 무시
    }
  };

  const visibleCampaigns = useMemo(() => {
    const list = (campaigns ?? []).filter((c) => statusFilter === "all" || c.status === statusFilter);
    const sorted = [...list].sort((a, b) => {
      if (sort === "ending") {
        if (!a.ends_at && !b.ends_at) return 0;
        if (!a.ends_at) return 1;
        if (!b.ends_at) return -1;
        return new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return sorted;
  }, [campaigns, statusFilter, sort]);

  return (
    <main className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <aside>
        <div className="sticky top-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-20 bg-gradient-to-br from-brand-100 to-brand-50" />
          <div className="-mt-10 px-5 pb-5">
            {sponsor ? (
              <>
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-brand-600 text-xl font-bold text-white shadow-sm">
                  {sponsor.name.trim()[0] ?? "?"}
                </div>
                <div className="mb-1 flex min-w-0 items-center gap-1.5">
                  <h1 className="min-w-0 truncate text-base font-bold text-slate-900">{sponsor.name}</h1>
                  <span className="shrink-0">
                    <Badge tone={sponsor.status === "active" ? "green" : "slate"}>
                      {sponsor.status === "active" ? "활성" : sponsor.status}
                    </Badge>
                  </span>
                </div>
                <p className="mb-0.5 truncate text-xs text-slate-400">{sponsor.contact_email}</p>
                <p className="mb-4 text-xs text-slate-400">{formatDate(sponsor.created_at)}부터 함께하고 있어요</p>
              </>
            ) : (
              <div className="pt-2">
                <div className="mb-3 h-16 w-16 animate-pulse rounded-full border-4 border-white bg-slate-200" />
                <div className="mb-2 h-4 w-28 animate-pulse rounded bg-slate-100" />
                <div className="mb-4 h-3 w-36 animate-pulse rounded bg-slate-100" />
              </div>
            )}

            <div className="mb-3 flex gap-2">
              <a href="/" className="flex-1">
                <Button variant="secondary" className="w-full">
                  유저 앱 보기
                </Button>
              </a>
              <Button variant="secondary" onClick={handleShare}>
                {copied ? "복사됨" : "공유"}
              </Button>
            </div>
            <Button className="w-full" onClick={() => (window.location.href = "/campaigns/new")}>
              + 새 캠페인 만들기
            </Button>

            <div className="my-5 border-t border-slate-100" />

            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">지갑 잔액</dt>
                <dd className="font-semibold text-slate-900">
                  {balance ? `${balance.amount.toLocaleString()} ${balance.currency}` : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">진행중 이벤트</dt>
                <dd className="font-semibold text-slate-900">{stats ? `${stats.active_campaigns}개` : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">누적 참여자</dt>
                <dd className="font-semibold text-slate-900">{stats ? `${stats.total_participants}명` : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">지급 실패</dt>
                <dd className={`font-semibold ${stats && stats.total_failed_claims > 0 ? "text-rose-600" : "text-slate-900"}`}>
                  {stats ? `${stats.total_failed_claims}건` : "-"}
                </dd>
              </div>
            </dl>

            <div className="my-5 border-t border-slate-100" />

            <p className="mb-2 text-xs font-medium text-slate-400">상태별로 보기</p>
            <div className="flex flex-col gap-1.5">
              <StatusPill
                label="전체"
                count={stats?.total_campaigns}
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              />
              <StatusPill
                label="진행중"
                count={stats?.active_campaigns}
                active={statusFilter === "active"}
                onClick={() => setStatusFilter("active")}
              />
              <StatusPill
                label="임시저장"
                count={stats?.draft_campaigns}
                active={statusFilter === "draft"}
                onClick={() => setStatusFilter("draft")}
              />
              <StatusPill
                label="종료"
                count={stats?.ended_campaigns}
                active={statusFilter === "ended"}
                onClick={() => setStatusFilter("ended")}
              />
            </div>
          </div>
        </div>
      </aside>

      <section>
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        )}

        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <span className="shrink-0 text-xs font-semibold text-slate-400">알림</span>
          {stats && stats.total_failed_claims > 0 ? (
            <p className="text-sm text-rose-700">
              지급 실패 {stats.total_failed_claims}건이 있어요. 각 캠페인의 지급 현황에서 재시도해주세요.
            </p>
          ) : (
            <p className="text-sm text-slate-400">확인할 알림이 없어요.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-700">
              캠페인 <span className="text-slate-400">{campaigns === null ? "" : `(${visibleCampaigns.length})`}</span>
            </p>
            <div className="flex gap-1.5">
              {(
                [
                  { id: "latest", label: "최신순" },
                  { id: "ending", label: "마감임박순" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    sort === s.id ? "border-brand-500 text-brand-600" : "border-slate-200 text-slate-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {campaigns === null ? (
            <div className="space-y-3 p-5">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : visibleCampaigns.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              {campaigns.length === 0 ? "아직 만든 캠페인이 없어요. \"새 캠페인 만들기\"로 시작해보세요." : "해당 상태의 캠페인이 없어요."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleCampaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} onDelete={c.status === "draft" ? handleDelete : undefined} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatusPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | undefined;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="text-xs text-slate-400">{count ?? "-"}</span>
    </button>
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
    <div className="flex gap-4 px-5 py-4">
      {campaign.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={campaign.thumbnail_url} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-20 w-28 shrink-0 rounded-lg bg-slate-100" />
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <h4 className="truncate text-sm font-semibold text-slate-900">{campaign.title}</h4>
          <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>
          {campaign.category && <Badge tone="purple">{CATEGORY_LABEL[campaign.category] ?? campaign.category}</Badge>}
          {campaign.failed_claims_count > 0 && (
            <Badge tone="red">지급 실패 {campaign.failed_claims_count}건</Badge>
          )}
        </div>

        <p className="mb-2 text-xs text-slate-400">
          {campaign.starts_at || campaign.ends_at
            ? `${formatDate(campaign.starts_at) ?? "미정"} ~ ${formatDate(campaign.ends_at) ?? "미정"}`
            : "기간 미설정"}
        </p>

        <div className="mb-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
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

        <div className="flex items-center gap-3">
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
      </div>
    </div>
  );
}
