import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createOrder } from "@/lib/soda/client";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// FR-6: 지급 실패 건은 중복지급 없이 재시도 가능해야 한다.
// external_reference_id는 최초 생성 시점 값을 그대로 유지해 재호출한다.
//
// selected_product_id는 confirm 라우트가 주문 시도 전에 먼저 기록해두므로
// (성공/실패 무관), PRODUCT·CREDIT 모드 둘 다 여기서 같은 필드로 재주문하면 된다.
// CREDIT 모드는 claim.payout_amount가 채워져 있어 customAmount로 같이 보낸다.

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: claim, error } = await supabase
    .from("reward_claims")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !claim) {
    return NextResponse.json({ error: "클레임을 찾을 수 없습니다" }, { status: 404 });
  }
  if (claim.status !== "failed") {
    return NextResponse.json({ error: "실패 상태의 클레임만 재시도할 수 있습니다" }, { status: 400 });
  }
  if (!claim.selected_product_id) {
    return NextResponse.json({ error: "재시도 전 상품 선택이 필요합니다" }, { status: 400 });
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("email")
    .eq("id", claim.participant_id)
    .single();
  if (participantError || !participant) {
    return NextResponse.json({ error: "참가자 정보를 찾을 수 없습니다" }, { status: 404 });
  }

  try {
    const order = await createOrder({
      productId: claim.selected_product_id,
      customAmount: claim.payout_amount ?? undefined,
      delivery: {
        method: "EMAIL",
        recipient: { name: participant.email, email: participant.email },
      },
      externalReferenceId: claim.external_reference_id, // FR-6: 동일 값 재사용
    });

    const { data: updated, error: updateError } = await supabase
      .from("reward_claims")
      .update({
        status: "order_placed",
        soda_order_id: String(order.id),
        soda_order_item_id: String(order.orderItemId),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ claim: updated });
  } catch (err) {
    return NextResponse.json(
      { error: `소다기프트 주문 재시도 실패: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
