import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { computeBudgetCheck } from "@/lib/budget";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// FR-2: budget-check 통과 못하면 400 (클라이언트 검증에 의존하지 않고 서버에서 재검증, PRD 9절)
// FR-3: 발행 후에는 질문·옵션·판정기준 수정 불가 — 발행 시점부터 rounds는 프론트 UI에서만이
// 아니라 이 라우트를 통과한 뒤로는 다른 PATCH 경로 자체가 없으므로 백엔드에서도 막힌다.

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", params.id)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  }
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "이미 발행되었거나 종료된 캠페인입니다" }, { status: 400 });
  }

  let budget;
  try {
    budget = await computeBudgetCheck(supabase, params.id);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  if (!budget.sufficient) {
    return NextResponse.json(
      { error: "예산이 부족해 발행할 수 없습니다", budget },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "active", prize_pool_total: budget.estimated_total })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
