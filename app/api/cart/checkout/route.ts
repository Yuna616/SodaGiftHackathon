import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/repo";
import { createOrder, buildReferenceId } from "@/lib/soda/client";
import { recordEvent } from "@/lib/analytics";
import { toUSD } from "@/lib/exchangeRates";

export const dynamic = "force-dynamic";

// 장바구니 최종 결제. 소다기프트 주문 API는 한 번에 상품 하나만 주문할 수 있어서
// (수량 파라미터가 없음), 장바구니 항목의 quantity만큼 개별 주문을 순서대로
// 넣는다. 잔액은 통화별로 따로 안 보고 lib/exchangeRates 기본 환율로 전부
// USD 환산해서 하나의 지갑으로 비교한다 — 원화로 딴 적립금으로 엔화 상품을
// 사는 것처럼 통화를 넘나드는 결제가 가능해야 해서다. 결제 전에 총액(USD
// 환산) vs 잔액을 먼저 확인한 뒤에만 시작하고(부분 결제로 애매하게 걸치는 걸
// 방지), 그래도 개별 주문이 실패하면 그 항목만 남은 수량으로 장바구니에
// 되돌려두고 나머지는 계속 진행한다 — 이미 성공한 주문/차감은 그대로 유지,
// 돈이 붕 뜨거나 두 번 빠지는 일이 없게 한다.

type CartItem = {
  id: string;
  product_id: string;
  product_name: string;
  brand: string | null;
  unit_price: number;
  currency: string;
  quantity: number;
  recipient_email: string;
  recipient_name: string | null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { participantId } = (body ?? {}) as { participantId?: string };
  if (!participantId) {
    return NextResponse.json({ error: "MISSING_PARTICIPANT_ID" }, { status: 400 });
  }

  const participant = await getParticipant(participantId);
  if (!participant) {
    return NextResponse.json({ error: "PARTICIPANT_NOT_FOUND" }, { status: 404 });
  }

  const supabase = createServiceRoleClient();

  const { data: cartItems, error: cartError } = await supabase
    .from("cart_items")
    .select("*")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: true });
  if (cartError) {
    return NextResponse.json({ error: cartError.message }, { status: 500 });
  }
  if (!cartItems || cartItems.length === 0) {
    return NextResponse.json({ error: "장바구니가 비어있습니다" }, { status: 400 });
  }

  // 장바구니 총액(USD 환산) vs 잔액(USD 환산)을 먼저 확인한다.
  const cartTotalUSD = (cartItems as CartItem[]).reduce(
    (sum, item) => sum + toUSD(item.unit_price * item.quantity, item.currency),
    0
  );

  const { data: transactions, error: walletError } = await supabase
    .from("wallet_transactions")
    .select("amount, currency")
    .eq("participant_id", participantId);
  if (walletError) {
    return NextResponse.json({ error: walletError.message }, { status: 500 });
  }
  const balanceUSD = (transactions ?? []).reduce((sum, t) => sum + toUSD(Number(t.amount), t.currency), 0);

  if (balanceUSD < cartTotalUSD) {
    return NextResponse.json(
      {
        error: `잔액이 부족합니다 (보유 약 $${balanceUSD.toFixed(2)} / 필요 약 $${cartTotalUSD.toFixed(2)}, 기본 환율 환산 기준)`,
      },
      { status: 400 }
    );
  }

  const placedOrders: Array<{ cartItemId: string; productName: string; sodaOrderId: string }> = [];
  const failedItems: Array<{ cartItemId: string; productName: string; error: string }> = [];

  for (const item of cartItems as CartItem[]) {
    let succeededUnits = 0;
    let lastError: string | null = null;

    for (let unit = 0; unit < item.quantity; unit++) {
      const externalReferenceId = buildReferenceId("cart", item.id, unit, Date.now());
      try {
        const soda = await createOrder({
          productId: item.product_id,
          delivery: {
            method: "EMAIL",
            recipient: { name: item.recipient_name || item.recipient_email, email: item.recipient_email },
          },
          message: "SodaPick 스토어에서 교환한 상품이에요",
          externalReferenceId,
        });

        const { data: order, error: orderError } = await supabase
          .from("gift_orders")
          .insert({
            sender_participant_id: participant.id,
            product_id: item.product_id,
            recipient_email: item.recipient_email,
            recipient_name: item.recipient_name,
            message: null,
            external_reference_id: externalReferenceId,
            soda_order_id: String(soda.id),
            soda_order_item_id: String(soda.orderItemId),
            status: "order_placed",
          })
          .select()
          .single();
        if (orderError) throw new Error(orderError.message);

        // 차감은 원래 통화가 아니라 USD 환산액으로 남긴다 — 적립(딴 통화 그대로)과
        // 지출(USD 환산)을 같은 통화 축으로 섞으면 특정 통화만 마이너스로 보이는
        // 이상한 잔액 내역이 남는다. 총 잔액(USD 합계)은 어느 쪽이든 결과가 같다.
        const { error: debitError } = await supabase.from("wallet_transactions").insert({
          participant_id: participant.id,
          amount: -toUSD(item.unit_price, item.currency),
          currency: "USD",
          reason: "store_purchase",
          gift_order_id: order.id,
        });
        if (debitError) throw new Error(debitError.message);

        placedOrders.push({ cartItemId: item.id, productName: item.product_name, sodaOrderId: String(soda.id) });
        succeededUnits += 1;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "알 수 없는 오류";
        break; // 이 항목은 여기서 멈추고 다음 장바구니 항목으로 넘어간다
      }
    }

    const remaining = item.quantity - succeededUnits;
    if (remaining > 0) {
      if (succeededUnits > 0) {
        await supabase.from("cart_items").update({ quantity: remaining }).eq("id", item.id);
      }
      failedItems.push({ cartItemId: item.id, productName: item.product_name, error: lastError ?? "주문 실패" });
    } else {
      await supabase.from("cart_items").delete().eq("id", item.id);
    }
  }

  if (placedOrders.length > 0) {
    await recordEvent("store_purchase_completed", {
      participantId: participant.id,
      metadata: { orderCount: placedOrders.length, failedCount: failedItems.length },
    });
  }

  return NextResponse.json({ placedOrders, failedItems });
}
