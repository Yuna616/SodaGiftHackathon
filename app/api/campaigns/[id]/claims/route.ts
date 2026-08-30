import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// PRD 5.8 지급 현황 화면의 클레임 목록 테이블용.
// architecture.md 4절 라우트 표엔 단건 조회(/api/claims/[id]/status)만 있고
// 목록 조회가 없어서, 대시보드에 필요해 추가함.

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const [{ data: campaign, error: campaignError }, { data: claims, error: claimsError }] = await Promise.all([
    supabase.from("campaigns").select("id, status").eq("id", params.id).maybeSingle(),
    supabase.from("reward_claims").select("*").eq("campaign_id", params.id).order("created_at", { ascending: false }),
  ]);

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }
  if (claimsError) {
    return NextResponse.json({ error: claimsError.message }, { status: 500 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ campaign, claims });
}
