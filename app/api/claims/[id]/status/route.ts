import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getOrderStatus } from "@/lib/soda/client";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// architecture.md 4/5절: soda_order_id가 있으면 GET /v1/orders/{id} 폴링 후 DB 갱신.
// 응답 스키마·상태값은 실호출로 확인함(2026-08-29): order_item.status가
// PENDING → COMPLETED로 바뀌는 걸 폴링으로 관찰.

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: claim, error } = await supabase
    .from("reward_claims")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !claim) {
    return NextResponse.json({ error: "클레임을 찾을 수 없습니다" }, { status: 404 });
  }

  if (!claim.soda_order_id) {
    return NextResponse.json({ claim });
  }

  try {
    const order = await getOrderStatus(Number(claim.soda_order_id));
    const nextStatus = order.orderItemStatus === "COMPLETED" ? "fulfilled" : claim.status;

    const { data: updated, error: updateError } = await supabase
      .from("reward_claims")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ claim: updated });
  } catch (err) {
    return NextResponse.json(
      { error: `소다기프트 주문 조회 실패: ${(err as Error).message}`, claim },
      { status: 502 }
    );
  }
}
