import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// PRD 5.4 리워드 카탈로그 구성기. architecture.md 라우트 표엔 없지만
// 캠페인 마법사 3단계에 필요해 추가함.

const setCatalogSchema = z.object({
  product_ids: z.array(z.string().min(1)),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = setCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const rows = parsed.data.product_ids.map((product_id) => ({
    campaign_id: params.id,
    product_id,
  }));

  // 마법사에서 여러 번 저장(임시저장 포함)해도 안전하도록 upsert
  const { error } = await supabase
    .from("campaign_catalog_items")
    .upsert(rows, { onConflict: "campaign_id,product_id", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("campaign_catalog_items")
    .select("*")
    .eq("campaign_id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}
