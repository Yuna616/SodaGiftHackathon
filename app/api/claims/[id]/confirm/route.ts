import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { confirmClaim } from "@/lib/claims";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// architecture.md 4절: 리워드 상품 확정 + 발송. 실제 확정 로직은 lib/claims.ts에 있고
// (참가자 앱의 /api/orders도 같은 로직을 씀), 여기는 claim id로 직접 호출하는 얇은 래퍼.
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
  const result = await confirmClaim(supabase, params.id, parsed.data.product_id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ claim: result.claim });
}
