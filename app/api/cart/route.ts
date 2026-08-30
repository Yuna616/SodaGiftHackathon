import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getParticipant } from "@/lib/repo";
import { listProducts } from "@/lib/soda/client";

export const dynamic = "force-dynamic";

// 인앱 스토어 장바구니. 담을 때 상품 스냅샷(이름/가격/이미지)을 같이 저장해서
// 장바구니 화면이 매번 소다기프트 카탈로그를 다시 안 불러도 되게 한다 —
// 실제 결제(POST /api/cart/checkout)에서 재고/가격을 다시 검증한다.

export async function GET(req: NextRequest) {
  const participantId = req.nextUrl.searchParams.get("participantId");
  if (!participantId) {
    return NextResponse.json({ error: "MISSING_PARTICIPANT_ID" }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("*")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data });
}

const addToCartSchema = z.object({
  participantId: z.string().uuid(),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
  isGift: z.boolean().default(false),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = addToCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { participantId, productId, quantity, isGift, recipientEmail, recipientName } = parsed.data;

  const participant = await getParticipant(participantId);
  if (!participant) {
    return NextResponse.json({ error: "PARTICIPANT_NOT_FOUND" }, { status: 404 });
  }
  if (isGift && !recipientEmail) {
    return NextResponse.json({ error: "선물하기는 받는 분 이메일이 필요합니다" }, { status: 400 });
  }

  const products = await listProducts();
  const product = products.find((p) => String(p.id) === productId);
  if (!product || product.availability !== "ON_SALE") {
    return NextResponse.json({ error: "PRODUCT_DISCONTINUED" }, { status: 409 });
  }
  if (product.amount === null) {
    return NextResponse.json({ error: "가변금액 상품은 스토어에서 담을 수 없습니다" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("cart_items")
    .insert({
      participant_id: participantId,
      product_id: productId,
      product_name: product.name_ko ?? product.name,
      product_image_url: product.image_url,
      brand: product.brand?.name ?? product.category.name,
      unit_price: product.amount,
      currency: product.currency,
      quantity,
      recipient_email: isGift ? recipientEmail! : participant.email,
      recipient_name: isGift ? (recipientName ?? null) : null,
      is_gift: isGift,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}
