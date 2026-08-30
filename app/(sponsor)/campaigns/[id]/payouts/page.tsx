"use client";

// PRD 5.8 지급 현황 & 실패 재시도

import { useEffect, useState } from "react";
import { Badge, Button, Callout, Card } from "../../../_components/ui";

type Claim = {
  id: string;
  participant_id: string;
  status: string;
  selected_product_id: string | null;
  external_reference_id: string;
  payout_amount: number | null; // CREDIT 모드에서만 채워짐
  payout_currency: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  eligible: "대기중",
  product_selected: "상품 선택됨",
  order_placed: "주문 완료",
  fulfilled: "지급 완료",
  failed: "실패",
};

const STATUS_TONES: Record<string, "slate" | "blue" | "amber" | "green" | "red"> = {
  eligible: "slate",
  product_selected: "blue",
  order_placed: "amber",
  fulfilled: "green",
  failed: "red",
};

// 주문 완료(order_placed)까지 가면 소다기프트에 실제 주문이 들어간 상태라
// 스폰서가 더 할 일이 없다 — 실제 배송 여부를 이 앱이 콜백으로 추적하진
// 않으니 "끝난" 상태로 취급한다. 정답자가 아직 상품을 고르지도 않은
// eligible/product_selected만 "진행 중"으로 보고, 하나라도 남아있으면
// "이벤트 끝내기"를 못 누르게 막는다.
const INCOMPLETE_STATUSES = new Set(["eligible", "product_selected"]);

export default function PayoutsPage({ params }: { params: { id: string } }) {
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  // 재시도 버튼 연타 방지 — 클레임별로 잠가서 다른 건 재시도는 막지 않는다
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [ending, setEnding] = useState(false);

  async function load() {
    const res = await fetch(`/api/campaigns/${params.id}/claims`);
    const json = await res.json();
    if (res.ok) {
      setClaims(json.claims ?? []);
      setCampaignStatus(json.campaign?.status ?? null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleEndEvent() {
    if (ending) return;
    setEnding(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${params.id}/end`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) return setError(typeof json.error === "string" ? json.error : "이벤트 종료에 실패했습니다");
      setCampaignStatus(json.campaign.status);
    } finally {
      setEnding(false);
    }
  }

  async function handleRetry(claimId: string) {
    if (retryingIds.has(claimId)) return;
    setRetryingIds((prev) => new Set(prev).add(claimId));
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/retry`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) return setError(JSON.stringify(json.error));
      await load();
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(claimId);
        return next;
      });
    }
  }

  const failedCount = claims.filter((c) => c.status === "failed").length;
  const incompleteCount = claims.filter((c) => INCOMPLETE_STATUSES.has(c.status)).length;
  const canEndEvent = campaignStatus === "active" && claims.length > 0 && incompleteCount === 0;
  const visible = showFailedOnly ? claims.filter((c) => c.status === "failed") : claims;

  return (
    <main>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">지급 현황</h1>
          <p className="text-sm text-slate-500">참가자별 리워드 지급 상태를 확인하고 실패 건을 재시도해요.</p>
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 && <Badge tone="red">실패 {failedCount}건</Badge>}
          {campaignStatus === "ended" && <Badge tone="slate">종료됨</Badge>}
          {canEndEvent && (
            <Button onClick={handleEndEvent} disabled={ending}>
              {ending ? "종료 중..." : "이벤트 끝내기"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Callout tone="red">{error}</Callout>
        </div>
      )}

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showFailedOnly}
              onChange={(e) => setShowFailedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            실패 건만 보기
          </label>
          <span className="text-xs text-slate-400">{visible.length}건</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-5 py-2 font-medium">참가자</th>
                <th className="px-5 py-2 font-medium">상품 / 배당액</th>
                <th className="px-5 py-2 font-medium">상태</th>
                <th className="px-5 py-2 font-medium">참조ID</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{c.participant_id.slice(0, 8)}</td>
                  <td className="px-5 py-3 text-slate-800">
                    {c.payout_amount !== null
                      ? `${c.payout_amount.toFixed(2)} ${c.payout_currency}`
                      : c.selected_product_id ?? "-"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONES[c.status] ?? "slate"}>{STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </td>
                  <td className="max-w-[160px] truncate px-5 py-3 font-mono text-xs text-slate-400">
                    {c.external_reference_id}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.status === "failed" && (
                      <Button variant="secondary" onClick={() => handleRetry(c.id)} disabled={retryingIds.has(c.id)}>
                        {retryingIds.has(c.id) ? "재시도 중..." : "재시도"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                    표시할 클레임이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
