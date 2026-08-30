import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { listCampaignsBySponsor } from "@/lib/repo";

export const dynamic = "force-dynamic";

// 참가자 앱: 공개 스폰서 프로필. 지갑 잔액/지급 실패 같은 콘솔 전용 통계는
// 절대 포함하지 않는다 — 이름/캠페인 목록만 공개 대상.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: sponsor, error } = await supabase
    .from("sponsors")
    .select("id, name, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!sponsor) {
    return NextResponse.json({ error: "SPONSOR_NOT_FOUND" }, { status: 404 });
  }

  const campaigns = await listCampaignsBySponsor(params.id);

  return NextResponse.json({ sponsor, campaigns });
}
