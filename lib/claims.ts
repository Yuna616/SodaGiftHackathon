// 리워드 클레임 확정(상품 선택 → 소다기프트 주문) 공용 로직.
// /api/claims/[id]/confirm(스폰서 쪽에서 먼저 만든 라우트)과
// /api/orders(참가자 앱, 팀원 UI가 predictionId 기준으로 부르는 라우트) 둘 다
// 결국 "reward_claims 하나를 골라진 상품으로 확정한다"는 같은 동작이라 여기로 뺐다.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrder, listProducts } from "@/lib/soda/client";

export type ConfirmClaimResult =
  | { ok: true; claim: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export interface DeliveryOverride {
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
}

export async function confirmClaim(
  supabase: SupabaseClient,
  claimId: string,
  productId: string,
  delivery?: DeliveryOverride
): Promise<ConfirmClaimResult> {
  const { data: claim, error: claimError } = await supabase
    .from("reward_claims")
    .select("*")
    .eq("id", claimId)
    .single();
  if (claimError || !claim) {
    return { ok: false, status: 404, error: "클레임을 찾을 수 없습니다" };
  }
  if (claim.status !== "eligible") {
    return { ok: false, status: 400, error: "eligible 상태의 클레임만 상품을 확정할 수 있습니다" };
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("email")
    .eq("id", claim.participant_id)
    .single();
  if (participantError || !participant) {
    return { ok: false, status: 404, error: "참가자 정보를 찾을 수 없습니다" };
  }

  const isCreditMode = claim.payout_amount !== null;
  let customAmount: number | undefined;

  if (isCreditMode) {
    const products = await listProducts();
    const product = products.find((p) => String(p.id) === productId);
    if (!product) {
      return { ok: false, status: 404, error: "상품을 찾을 수 없습니다" };
    }
    const isVariableAmount = product.amount === null && product.min_amount != null && product.max_amount != null;
    if (!isVariableAmount || product.currency !== claim.payout_currency) {
      return { ok: false, status: 400, error: `이 라운드는 ${claim.payout_currency} 가변금액 상품권만 선택할 수 있습니다` };
    }
    customAmount = claim.payout_amount;
  } else {
    const { data: catalogItem } = await supabase
      .from("campaign_catalog_items")
      .select("product_id")
      .eq("campaign_id", claim.campaign_id)
      .eq("product_id", productId)
      .maybeSingle();
    if (!catalogItem) {
      return { ok: false, status: 400, error: "이 캠페인 카탈로그에 없는 상품입니다" };
    }
  }

  // 상품 선택은 먼저 기록해둔다 — 이후 주문이 실패해도 재시도 시 같은 상품으로 재주문 가능
  await supabase
    .from("reward_claims")
    .update({ selected_product_id: productId, status: "product_selected" })
    .eq("id", claimId);

  try {
    const order = await createOrder({
      productId,
      customAmount,
      delivery: {
        method: "EMAIL",
        recipient: {
          name: delivery?.recipientName || participant.email,
          email: delivery?.recipientEmail || participant.email,
        },
      },
      message: delivery?.message || "SodaPick 예측 성공 리워드",
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
      .eq("id", claimId)
      .select()
      .single();
    if (updateError) {
      return { ok: false, status: 500, error: updateError.message };
    }

    return { ok: true, claim: updated };
  } catch (err) {
    await supabase
      .from("reward_claims")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", claimId);
    return { ok: false, status: 502, error: `소다기프트 주문 실패: ${(err as Error).message}` };
  }
}
