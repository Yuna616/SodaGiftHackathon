"use client";

// PRD 5.7 라운드 판정 콘솔
// FR-4: 확정 전 "영향받는 참가자 수" 미리보기 필수
// FR-5: 확정 후에는 되돌릴 수 없음 (서버가 강제, 여기선 UI로 실수만 방지)

import { useEffect, useState } from "react";
import { Badge, Button, Callout, Card } from "../../../_components/ui";

const DEMO_SPONSOR_ID = "72495905-2368-41a3-8eba-fef7a07fcc21";

type Round = {
  id: string;
  round_number: number;
  question_text: string;
  options: string[];
  status: string;
  correct_option_index: number | null;
  reward_mode: "PRODUCT" | "CREDIT";
  credit_pool_amount: number | null;
  credit_currency: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: "예정",
  open: "진행중",
  closed_pending_resolution: "판정 대기",
  resolved: "판정 완료",
};

const STATUS_TONES: Record<string, "slate" | "blue" | "amber" | "green"> = {
  upcoming: "slate",
  open: "blue",
  closed_pending_resolution: "amber",
  resolved: "green",
};

export default function RoundsConsole({ params }: { params: { id: string } }) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<{ roundId: string; option: number; count: number } | null>(
    null
  );
  // 버튼 연타 방지 (특히 확정 버튼 — 판정은 되돌릴 수 없어서 중복 호출 위험이 더 큼)
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch(`/api/campaigns/${params.id}/rounds`);
    const json = await res.json();
    if (res.ok) setRounds(json.rounds ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleClose(roundId: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/close`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) return setError(JSON.stringify(json.error));
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreview(roundId: string, option: number) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/resolve?option=${option}`);
      const json = await res.json();
      if (!res.ok) return setError(JSON.stringify(json.error));
      setPreviewFor({ roundId, option, count: json.affected_participant_count });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmResolve() {
    if (!previewFor || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${previewFor.roundId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correct_option_index: previewFor.option,
          resolved_by: DEMO_SPONSOR_ID,
        }),
      });
      const json = await res.json();
      if (!res.ok) return setError(JSON.stringify(json.error));
      setPreviewFor(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  const previewRound = rounds.find((r) => r.id === previewFor?.roundId);

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">라운드 판정 콘솔</h1>
      <p className="mb-6 text-sm text-slate-500">라운드를 마감하고 정답을 확정해요.</p>

      {error && (
        <div className="mb-4">
          <Callout tone="red">{error}</Callout>
        </div>
      )}

      <div className="space-y-4">
        {rounds.map((r) => (
          <Card key={r.id}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">라운드 {r.round_number}</h2>
              <Badge tone={STATUS_TONES[r.status] ?? "slate"}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
              {r.reward_mode === "CREDIT" && (
                <span className="text-xs text-slate-500">
                  크레딧 배당 · 풀 {r.credit_pool_amount} {r.credit_currency} (정답자가 직접 상품권 선택)
                </span>
              )}
            </div>
            <p className="mb-4 text-sm text-slate-700">{r.question_text}</p>

            {r.status === "resolved" ? (
              <Callout tone="green">✓ 확정된 정답: {r.options[r.correct_option_index ?? -1]}</Callout>
            ) : r.status === "closed_pending_resolution" ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {r.options.map((opt, i) => (
                  <Button
                    key={i}
                    variant="secondary"
                    onClick={() => handlePreview(r.id, i)}
                    disabled={submitting}
                    className="truncate"
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            ) : (
              <Button variant="secondary" onClick={() => handleClose(r.id)} disabled={submitting}>
                마감(판정 대기로 전환)
              </Button>
            )}
          </Card>
        ))}

        {rounds.length === 0 && <Card className="text-center text-sm text-slate-500">라운드가 없어요.</Card>}
      </div>

      {previewFor && previewRound && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">판정 확정 전 최종 확인</h3>
            <p className="mb-1 text-sm text-slate-700">
              정답: <span className="font-medium">{previewRound.options[previewFor.option]}</span>
            </p>
            <p className="mb-4 text-sm text-slate-700">
              영향받는 참가자: <span className="font-medium">{previewFor.count}명</span>
            </p>
            <div className="mb-4">
              <Callout tone="red">확정 후에는 되돌릴 수 없습니다.</Callout>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreviewFor(null)} disabled={submitting}>
                취소
              </Button>
              <Button variant="danger" onClick={handleConfirmResolve} disabled={submitting}>
                {submitting ? "확정 중..." : "확정"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
