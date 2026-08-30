import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 캐싱된 상태로 응답하면 안 됨 — 참여자 목록/집계는 계속 바뀌는 데이터라
// 오래된 응답을 돌려주면 스폰서 콘솔에 최신 참여 현황이 안 보인다.
export const dynamic = "force-dynamic";

// 스폰서 콘솔: 캠페인 상세 화면(진행상황 + 참여 유저 목록)에서 쓰는 라우트.
// participants.email은 참가자 앱 어디에도 노출되지 않는 정보라 — 공개
// 컨센서스 라우트(/api/campaigns/[id], 참가자 앱도 씀)와 분리해서 여기서만
// 스폰서 콘솔용으로 내려준다.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, title, status, category, starts_at, ends_at, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  }

  // 참가자 앱과 동일하게 캠페인당 라운드 1개(round_number=1)만 본다(lib/repo.ts).
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select(
      "id, question_text, options, status, reward_mode, expected_winner_count, credit_pool_amount, credit_currency, correct_option_index, resolution_criteria, opens_at, closes_at"
    )
    .eq("campaign_id", params.id)
    .eq("round_number", 1)
    .maybeSingle();
  if (roundError) {
    return NextResponse.json({ error: roundError.message }, { status: 500 });
  }
  if (!round) {
    // 마법사 1단계만 마치고 아직 질문/보상을 저장 안 한 draft — 정상적으로 있을 수 있다.
    return NextResponse.json({ campaign, round: null, participants: [], counts: {}, total_predictions: 0 });
  }

  // participant_id로 따로 .in() 조회하지 않고 FK 임베딩(participants(email))으로
  // 한 번에 가져온다 — 참여자가 많은 캠페인(수백 명)에서 .in() 목록이 UUID
  // 수백 개짜리 초대형 쿼리스트링이 되면서 실제로 500(fetch failed)이 났었다.
  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("participant_id, selected_option_index, submitted_at, is_correct, participants(email)")
    .eq("round_id", round.id)
    .order("submitted_at", { ascending: false });
  if (predictionsError) {
    return NextResponse.json({ error: predictionsError.message }, { status: 500 });
  }

  const options: string[] = round.options ?? [];
  const counts: Record<string, number> = {};
  options.forEach((_, i) => (counts[String(i)] = 0));
  for (const p of predictions ?? []) {
    const key = String(p.selected_option_index);
    if (key in counts) counts[key] += 1;
  }

  const participants = (predictions ?? []).map((p) => {
    // Supabase 타입 생성기 없이 쓰는 프로젝트라 임베딩 결과 타입이 정확히 안 잡혀서
    // any로 받아 좁힌다 — 1:N도 아니고 FK가 명확한 1:1 임베딩이라 안전하다.
    const participant = p.participants as unknown as { email: string } | { email: string }[] | null;
    const email = Array.isArray(participant) ? participant[0]?.email : participant?.email;
    return {
      participant_id: p.participant_id,
      email: email ?? "(알 수 없음)",
      selected_option_index: p.selected_option_index,
      selected_option_label: options[p.selected_option_index] ?? "-",
      submitted_at: p.submitted_at,
      is_correct: p.is_correct,
    };
  });

  return NextResponse.json({
    campaign,
    round,
    participants,
    counts,
    total_predictions: predictions?.length ?? 0,
  });
}
