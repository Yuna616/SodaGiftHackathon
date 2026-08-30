import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 스폰서 대시보드(PRD 5.1)용 — 이 스폰서가 만든 캠페인 전부(draft 포함)를
// 라운드 요약 + 실패한 지급 건수와 함께 반환한다.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id, title, status, category, thumbnail_url, created_at")
    .eq("sponsor_id", params.id)
    .order("created_at", { ascending: false });
  if (campaignsError) {
    return NextResponse.json({ error: campaignsError.message }, { status: 500 });
  }

  const results = await Promise.all(
    (campaigns ?? []).map(async (campaign) => {
      const { data: rounds } = await supabase
        .from("rounds")
        .select("id, round_number, status, reward_mode")
        .eq("campaign_id", campaign.id)
        .order("round_number", { ascending: true });

      const { count: failedClaimsCount } = await supabase
        .from("reward_claims")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "failed");

      return { ...campaign, rounds: rounds ?? [], failed_claims_count: failedClaimsCount ?? 0 };
    })
  );

  return NextResponse.json({ campaigns: results });
}
