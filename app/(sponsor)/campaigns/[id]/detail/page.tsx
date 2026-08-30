"use client";

// 스폰서 콘솔: 캠페인 상세 화면. 대시보드 목록에서 캠페인을 눌러 들어오는
// 진입점 — 진행상황(질문별 득표 현황)과 참여 유저 목록(이메일 포함)을 한
// 화면에서 본다. 판정 확정/지급 재시도 같은 액션은 각자 전용 화면
// (/rounds, /payouts)에 그대로 두고, 여기는 조회 전용이다.

import { useEffect, useState } from "react";
import { Badge, Callout, Card } from "../../../_components/ui";
import ConsensusBar from "@/components/ConsensusBar";
import ConsensusTrendChart from "@/components/ConsensusTrendChart";
import type { CampaignOption, ConsensusTrendPoint } from "@/lib/types";

type CampaignInfo = {
  id: string;
  title: string;
  status: "draft" | "active" | "ended";
  category: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type RoundInfo = {
  id: string;
  question_text: string;
  options: string[];
  status: string;
  reward_mode: "PRODUCT" | "CREDIT";
  expected_winner_count: number | null;
  credit_pool_amount: number | null;
  credit_currency: string | null;
  correct_option_index: number | null;
  resolution_criteria: string | null;
  opens_at: string;
  closes_at: string;
};

type ParticipantRow = {
  participant_id: string;
  email: string;
  selected_option_index: number;
  selected_option_label: string;
  submitted_at: string;
  is_correct: boolean | null;
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

function formatDateTime(iso: string | null) {
  if (!iso) return "미정";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [trend, setTrend] = useState<ConsensusTrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/campaigns/${params.id}/participants`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return setError(typeof data.error === "string" ? data.error : "불러오는 데 실패했어요");
        setCampaign(data.campaign);
        setRound(data.round);
        setParticipants(data.participants ?? []);
        setCounts(data.counts ?? {});
        setTotalPredictions(data.total_predictions ?? 0);
      })
      .catch(() => setError("불러오는 데 실패했어요"))
      .finally(() => setLoading(false));

    // 참가자 앱과 같은 "선택 비중 추이" 그래프 — /api/campaigns/[id]/trend를
    // 그대로 재사용한다(참가자 상세 화면과 동일한 라우트, 동일한 컴포넌트).
    fetch(`/api/campaigns/${params.id}/trend`)
      .then((r) => r.json())
      .then((data) => setTrend(data.points ?? []))
      .catch(() => {});
  }, [params.id]);

  return (
    <main>
      <a href="/dashboard" className="mb-3 inline-block text-xs text-slate-400 hover:text-slate-600">
        ← 대시보드로
      </a>

      {loading ? (
        <div className="space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : error || !campaign ? (
        <Callout tone="red">{error ?? "캠페인을 찾을 수 없어요"}</Callout>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{campaign.title}</h1>
            <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            {/* campaigns.starts_at/ends_at은 마법사가 채우지 않는 컬럼이라(실제 기간은
                라운드 opens_at/closes_at) 라운드가 있으면 그쪽을 기준으로 보여준다. */}
            {round
              ? `${formatDateTime(round.opens_at)} ~ ${formatDateTime(round.closes_at)}`
              : campaign.starts_at || campaign.ends_at
                ? `${formatDateTime(campaign.starts_at)} ~ ${formatDateTime(campaign.ends_at)}`
                : "기간 미설정"}
          </p>

          <div className="mb-6 flex gap-4">
            <a href={`/campaigns/${params.id}/rounds`} className="text-xs font-medium text-brand-600 hover:underline">
              판정 콘솔 →
            </a>
            <a href={`/campaigns/${params.id}/payouts`} className="text-xs font-medium text-brand-600 hover:underline">
              지급 현황 →
            </a>
          </div>

          {!round ? (
            <Callout tone="amber">아직 예측 질문이 설정되지 않았어요. 캠페인 생성을 마저 진행해주세요.</Callout>
          ) : (
            <>
              <Card className="mb-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">진행상황</h2>
                  <Badge tone="slate">{ROUND_STATUS_LABEL[round.status] ?? round.status}</Badge>
                </div>
                <p className="mb-4 text-sm text-slate-700">{round.question_text}</p>

                {/* 참가자 상세 화면(app/(participant)/campaigns/[id]/page.tsx)과 완전히 같은
                    ConsensusBar/ConsensusTrendChart를 그대로 재사용 — 스폰서가 보는 진행상황이
                    참가자가 보는 것과 다르게 보이면 안 되니 별도로 다시 그리지 않는다. */}
                <div className="mb-4 flex flex-col gap-2">
                  {round.options.map((opt, i) => {
                    const count = counts[String(i)] ?? 0;
                    const percent = totalPredictions > 0 ? Math.round((count / totalPredictions) * 100) : 0;
                    const isAnswer = round.correct_option_index === i;
                    return (
                      <div key={i} className="relative">
                        <ConsensusBar label={opt} percent={percent} selected={isAnswer} disabled />
                        <div className="mt-1 flex justify-end gap-2 text-xs text-slate-400">
                          {isAnswer && <span className="font-semibold text-emerald-600">✓ 정답</span>}
                          <span>{count}표</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">선택 비중 추이</p>
                  <ConsensusTrendChart
                    options={round.options.map((label, i): CampaignOption => ({ id: String(i), label }))}
                    points={trend}
                  />
                </div>

                <dl className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">총 참여</dt>
                    <dd className="font-semibold text-slate-900">{totalPredictions}명</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">보상 방식</dt>
                    <dd className="font-semibold text-slate-900">
                      {round.reward_mode === "CREDIT" ? "크레딧 배당" : "상품 지급"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">최대 당첨자 수</dt>
                    <dd className="font-semibold text-slate-900">{round.expected_winner_count ?? "-"}명</dd>
                  </div>
                </dl>
                {round.reward_mode === "CREDIT" && round.credit_pool_amount !== null && (
                  <p className="mt-2 text-xs text-slate-500">
                    풀 금액 {round.credit_pool_amount.toLocaleString()} {round.credit_currency}
                  </p>
                )}
              </Card>

              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-semibold text-slate-700">참여 유저 목록</h2>
                  <span className="text-xs text-slate-400">{participants.length}명</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="px-5 py-2 font-medium">이메일</th>
                        <th className="px-5 py-2 font-medium">선택</th>
                        <th className="px-5 py-2 font-medium">제출 시각</th>
                        {round.correct_option_index !== null && <th className="px-5 py-2 font-medium">정오답</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => (
                        <tr key={p.participant_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="px-5 py-3 text-slate-800">{p.email}</td>
                          <td className="px-5 py-3 text-slate-600">{p.selected_option_label}</td>
                          <td className="px-5 py-3 text-xs text-slate-400">{formatDateTime(p.submitted_at)}</td>
                          {round.correct_option_index !== null && (
                            <td className="px-5 py-3">
                              {p.is_correct ? <Badge tone="green">정답</Badge> : <Badge tone="slate">오답</Badge>}
                            </td>
                          )}
                        </tr>
                      ))}
                      {participants.length === 0 && (
                        <tr>
                          <td
                            colSpan={round.correct_option_index !== null ? 4 : 3}
                            className="px-5 py-8 text-center text-sm text-slate-400"
                          >
                            아직 참여자가 없어요.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </main>
  );
}
