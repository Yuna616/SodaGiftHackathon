import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createOrder, listProducts } from "@/lib/soda/client";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// architecture.md 4절: 리워드 상품 확정 + 발송. 원래 유저앱(참가자) 담당으로 남겨둔
// 라우트지만, CREDIT 모드가 이 라우트 없이는 지급 자체가 안 되는 구조라 여기서 구현함.
//
// PRODUCT 모드: 캠페인 카탈로그(campaign_catalog_items)에서 고른 상품 그대로 주문.
// CREDIT 모드: claim.payout_amount(정답자 수로 나눈 몫)를 참가자가 고른 가변금액
//   상품권에 custom_amount로 실어 주문 — 상품권 통화가 payout_currency와 같아야 함
//   (소다기프트엔 범용 현금이 없어서, "돈"이 아니라 "이 통화로 살 수 있는 상품권"이 지급 단위다).

const confirmSchema = z.object({
  product_id: z.union([z.string(), z.number()]).transform(String),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: claim, error: claimError } = await supabase
    .from("reward_claims")
    .select("*")
    .eq("id", params.id)
    .single();
  if (claimError || !claim) {
    return NextResponse.json({ error: "클레임을 찾을 수 없습니다" }, { status: 404 });
  }
  if (claim.status !== "eligible") {
    return NextResponse.json({ error: "eligible 상태의 클레임만 상품을 확정할 수 있습니다" }, { status: 400 });
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("email")
    .eq("id", claim.participant_id)
    .single();
  if (participantError || !participant) {
    return NextResponse.json({ error: "참가자 정보를 찾을 수 없습니다" }, { status: 404 });
  }

  const isCreditMode = claim.payout_amount !== null;
  let customAmount: number | undefined;

  if (isCreditMode) {
    const products = await listProducts();
    const product = products.find((p) => String(p.id) === parsed.data.product_id);
    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
    }
    const isVariableAmount = product.amount === null && product.min_amount != null && product.max_amount != null;
    if (!isVariableAmount || product.currency !== claim.payout_currency) {
      return NextResponse.json(
        { error: `이 라운드는 ${claim.payout_currency} 가변금액 상품권만 선택할 수 있습니다` },
        { status: 400 }
      );
    }
    customAmount = claim.payout_amount;
  } else {
    const { data: catalogItem } = await supabase
      .from("campaign_catalog_items")
      .select("product_id")
      .eq("campaign_id", claim.campaign_id)
      .eq("product_id", parsed.data.product_id)
      .maybeSingle();
    if (!catalogItem) {
      return NextResponse.json({ error: "이 캠페인 카탈로그에 없는 상품입니다" }, { status: 400 });
    }
  }

  // 상품 선택은 먼저 기록해둔다 — 이후 주문이 실패해도 재시도 시 같은 상품으로 재주문 가능
  await supabase
    .from("reward_claims")
    .update({ selected_product_id: parsed.data.product_id, status: "product_selected" })
    .eq("id", params.id);

  try {
    const order = await createOrder({
      productId: parsed.data.product_id,
      customAmount,
      delivery: { method: "EMAIL", recipient: { name: participant.email, email: participant.email } },
      message: "SodaPick 예측 성공 리워드",
      externalReferenceId: claim.external_reference_id,
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
    await supabase
      .from("reward_claims")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", params.id);
    return NextResponse.json(
      { error: `소다기프트 주문 실패: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
