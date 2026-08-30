import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 고객사 콘솔: 지급 현황 화면의 "이벤트 끝내기". 발행된(active) 캠페인만 대상이다.
// 주문 완료(order_placed)까지 가면 소다기프트에 실제 주문이 들어간 상태라 더 할
// 일이 없다고 본다 — 아직 정답자가 상품을 고르지도 않은 eligible/product_selected가
// 하나라도 남아있으면 막는다(처리 중인데 종료부터 해버리는 걸 방지).
const INCOMPLETE_STATUSES = ["eligible", "product_selected"];

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }
  if (campaign.status !== "active") {
    return NextResponse.json({ error: "진행중인 캠페인만 종료할 수 있습니다" }, { status: 409 });
  }

  const { data: claims, error: claimsError } = await supabase
    .from("reward_claims")
    .select("id, status")
    .eq("campaign_id", params.id);
  if (claimsError) {
    return NextResponse.json({ error: claimsError.message }, { status: 500 });
  }
  if (!claims || claims.length === 0) {
    return NextResponse.json({ error: "아직 판정된 지급 건이 없어 종료할 수 없습니다" }, { status: 409 });
  }
  const incompleteCount = claims.filter((c) => INCOMPLETE_STATUSES.includes(c.status)).length;
  if (incompleteCount > 0) {
    return NextResponse.json(
      { error: `아직 처리 중인 지급이 ${incompleteCount}건 있어 종료할 수 없습니다` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "ended" })
    .eq("id", params.id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
