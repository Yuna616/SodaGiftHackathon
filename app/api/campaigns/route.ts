import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// FR-1: 캠페인은 발행 전까지 임시저장(draft) 상태를 유지해야 한다
// TODO: 스폰서 인증(architecture.md 7절) 붙기 전까지 sponsor_id를 body로 받는다

const createCampaignSchema = z.object({
  sponsor_id: z.string().uuid(),
  title: z.string().min(1),
  artist_name: z.string().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  // 참여 미션(사이트 방문). null/미입력이면 미션 없이 바로 참여 가능.
  mission_url: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...parsed.data, status: "draft" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign: data }, { status: 201 });
}
