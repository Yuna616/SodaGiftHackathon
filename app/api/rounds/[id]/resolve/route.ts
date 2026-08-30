import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildExternalReferenceId } from "@/lib/soda/client";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// architecture.md 4절: status='closed_pending_resolution'만 허용, 성공 시
// predictions.is_correct 일괄 계산 + reward_claims 생성 + resolution_audit_logs 기록
//
// FR-4: GET은 확정 전 "영향받는 참가자 수 / 예상 지급액" 미리보기 전용 —
//       이 미리보기를 안 거치고 바로 POST를 호출하는 경로는 프론트에 두지 않는다.
// FR-5: 판정 확정 후에는 정답값을 직접 수정할 수 없다 —
//       DB 트리거(0001_init.sql, check_round_resolvable)가 재수정 자체를 막는다.

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const optionParam = req.nextUrl.searchParams.get("option");
  const option = Number(optionParam);
  if (optionParam === null || Number.isNaN(option)) {
    return NextResponse.json({ error: "option 쿼리 파라미터가 필요합니다" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, campaign_id, status")
    .eq("id", params.id)
    .single();
  if (roundError || !round) {
    return NextResponse.json({ error: "라운드를 찾을 수 없습니다" }, { status: 404 });
  }

  const { count, error: countError } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("round_id", params.id)
    .eq("selected_option_index", option);
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const affectedParticipantCount = count ?? 0;

  return NextResponse.json({
    round_id: params.id,
    option,
    affected_participant_count: affectedParticipantCount,
  });
}

const resolveSchema = z.object({
  correct_option_index: z.number().int().min(0).max(3),
  resolved_by: z.string().uuid(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, campaign_id, status, reward_mode, credit_pool_amount, credit_currency")
    .eq("id", params.id)
    .single();
  if (roundError || !round) {
    return NextResponse.json({ error: "라운드를 찾을 수 없습니다" }, { status: 404 });
  }
  if (round.status !== "closed_pending_resolution") {
    return NextResponse.json(
      { error: "closed_pending_resolution 상태인 라운드만 판정 확정할 수 있습니다" },
      { status: 400 }
    );
  }

  // 1) 정답 확정 — DB 트리거가 status를 resolved로 전환하고 재수정을 막는다 (FR-5)
  const { error: updateError } = await supabase
    .from("rounds")
    .update({ correct_option_index: parsed.data.correct_option_index })
    .eq("id", params.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 2) 감사 로그 append-only 기록 (RLS: UPDATE/DELETE 정책 자체가 없음)
  const { error: auditError } = await supabase.from("resolution_audit_logs").insert({
    round_id: params.id,
    resolved_by: parsed.data.resolved_by,
    correct_option_index: parsed.data.correct_option_index,
  });
  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 });
  }

  // 3) 참가자 예측 정오답 일괄 계산
  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("id, participant_id, selected_option_index")
    .eq("round_id", params.id);
  if (predictionsError) {
    return NextResponse.json({ error: predictionsError.message }, { status: 500 });
  }

  const correctPredictions = (predictions ?? []).filter(
    (p) => p.selected_option_index === parsed.data.correct_option_index
  );

  for (const p of predictions ?? []) {
    await supabase
      .from("predictions")
      .update({ is_correct: p.selected_option_index === parsed.data.correct_option_index })
      .eq("id", p.id);
  }

  // 4) 정답자만 reward_claims 생성 (FR-6: external_reference_id로 중복지급 방지)
  //
  //    PRODUCT 모드: 아직 어떤 카탈로그 상품을 받을지 안 정해졌으니 eligible로
  //    대기시키고, 참가자가 직접 고르는 /api/claims/[id]/confirm(또는 참가자
  //    쪽 /api/orders)에서 실제 소다기프트 주문을 넣는다.
  //
  //    CREDIT 모드: 소다기프트엔 범용 현금이 없어서 "돈"을 실제로 지급하는
  //    소다기프트 주문은 애초에 존재하지 않는다 — 그래서 브랜드를 고르게
  //    하지 않고, 판정 즉시 fulfilled로 확정해서 마이페이지 "누적 획득
  //    리워드"에 바로 더해지게 한다(지갑에 돈이 쌓이는 형태). 참가자가
  //    고를 게 없다. soda_order_id는 실제 주문이 없으니 계속 null.
  if (correctPredictions.length > 0) {
    const payoutAmount =
      round.reward_mode === "CREDIT" ? (round.credit_pool_amount ?? 0) / correctPredictions.length : null;

    const claims = correctPredictions.map((p) => ({
      round_id: params.id,
      campaign_id: round.campaign_id,
      participant_id: p.participant_id,
      status: round.reward_mode === "CREDIT" ? ("fulfilled" as const) : ("eligible" as const),
      external_reference_id: buildExternalReferenceId(round.campaign_id, params.id, p.participant_id),
      payout_amount: payoutAmount,
      payout_currency: round.reward_mode === "CREDIT" ? round.credit_currency : null,
    }));

    const { error: claimsError } = await supabase
      .from("reward_claims")
      .upsert(claims, { onConflict: "round_id,participant_id", ignoreDuplicates: true });
    if (claimsError) {
      return NextResponse.json({ error: claimsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    round_id: params.id,
    correct_option_index: parsed.data.correct_option_index,
    winner_count: correctPredictions.length,
  });
}
