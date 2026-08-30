import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/repo";
import { createOrder, buildReferenceId, listProducts } from "@/lib/soda/client";
import { recordEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// "친구에게 선물하기" — 클레임/라운드와 무관한 참가자 발신 플로우(북극성 지표: 발신 전환율).
// 실제 소다기프트 주문으로 처리한다(모킹 아님).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { senderParticipantId, productId, recipientEmail, recipientName, message } = (body ?? {}) as {
    senderParticipantId?: string;
    productId?: string;
    recipientEmail?: string;
    recipientName?: string;
    message?: string;
  };

  if (!senderParticipantId || !productId || !recipientEmail) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (!EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }
  const sender = await getParticipant(senderParticipantId);
  if (!sender) {
    return NextResponse.json({ error: "SENDER_NOT_FOUND" }, { status: 404 });
  }

  const products = await listProducts();
  const product = products.find((p) => String(p.id) === productId);
  if (!product || product.availability !== "ON_SALE") {
    return NextResponse.json({ error: "PRODUCT_DISCONTINUED" }, { status: 409 });
  }

  const externalReferenceId = buildReferenceId("gift", sender.id, Date.now());

  try {
    const soda = await createOrder({
      productId,
      delivery: {
        method: "EMAIL",
        recipient: { name: recipientName || recipientEmail, email: recipientEmail },
      },
      message: message || "제 예측이 맞았어요, 당신도 한번 참여해보세요!",
      externalReferenceId,
    });

    const supabase = createServiceRoleClient();
    const { data: order, error } = await supabase
      .from("gift_orders")
      .insert({
        sender_participant_id: sender.id,
        product_id: productId,
        recipient_email: recipientEmail,
        recipient_name: recipientName || null,
        message: message || null,
        external_reference_id: externalReferenceId,
        soda_order_id: String(soda.id),
        soda_order_item_id: String(soda.orderItemId),
        status: "order_placed",
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordEvent("sender_cta_clicked", {
      participantId: sender.id,
      metadata: { stage: "completed", giftOrderId: order.id },
    });

    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: `소다기프트 주문 실패: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
