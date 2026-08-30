import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 스폰서 대시보드(PRD 5.1)용 — 프로필 정보 + 통계 + 캠페인 목록(라운드 요약,
// 실패한 지급 건수 포함)을 한 번에 반환한다. 캠페인별로 다시 조회하지 않고
// in()으로 배치 조회해서 캠페인 수와 무관하게 쿼리 수를 고정한다.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: sponsor, error: sponsorError } = await supabase
    .from("sponsors")
    .select("id, name, contact_email, status, avatar_url, banner_url, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (sponsorError) {
    return NextResponse.json({ error: sponsorError.message }, { status: 500 });
  }
  if (!sponsor) {
    return NextResponse.json({ error: "SPONSOR_NOT_FOUND" }, { status: 404 });
  }

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id, title, status, category, thumbnail_url, created_at, starts_at, ends_at")
    .eq("sponsor_id", params.id)
    .order("created_at", { ascending: false });
  if (campaignsError) {
    return NextResponse.json({ error: campaignsError.message }, { status: 500 });
  }

  const campaignIds = (campaigns ?? []).map((c) => c.id);

  const [{ data: rounds }, { data: failedClaims }] =
    campaignIds.length > 0
      ? await Promise.all([
          supabase
            .from("rounds")
            .select("id, campaign_id, round_number, status, reward_mode")
            .in("campaign_id", campaignIds)
            .order("round_number", { ascending: true }),
          supabase.from("reward_claims").select("id, campaign_id").in("campaign_id", campaignIds).eq("status", "failed"),
        ])
      : [{ data: [] as { id: string; campaign_id: string; round_number: number; status: string; reward_mode: string }[] }, { data: [] as { id: string; campaign_id: string }[] }];

  const roundsByCampaignId = new Map<string, typeof rounds>();
  for (const r of rounds ?? []) {
    const list = roundsByCampaignId.get(r.campaign_id) ?? [];
    list.push(r);
    roundsByCampaignId.set(r.campaign_id, list);
  }
  const failedCountByCampaignId = new Map<string, number>();
  for (const fc of failedClaims ?? []) {
    failedCountByCampaignId.set(fc.campaign_id, (failedCountByCampaignId.get(fc.campaign_id) ?? 0) + 1);
  }

  const results = (campaigns ?? []).map((campaign) => ({
    ...campaign,
    rounds: roundsByCampaignId.get(campaign.id) ?? [],
    failed_claims_count: failedCountByCampaignId.get(campaign.id) ?? 0,
  }));

  // 프로필 카드용 통계: 캠페인 상태별 개수 + 이 스폰서의 캠페인에 참여한
  // 참가자 수(중복 제거) + 누적 지급 실패 건수.
  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: predictions } =
    roundIds.length > 0
      ? await supabase.from("predictions").select("participant_id").in("round_id", roundIds)
      : { data: [] as { participant_id: string }[] };
  const totalParticipants = new Set((predictions ?? []).map((p) => p.participant_id)).size;

  const stats = {
    total_campaigns: results.length,
    active_campaigns: results.filter((c) => c.status === "active").length,
    draft_campaigns: results.filter((c) => c.status === "draft").length,
    ended_campaigns: results.filter((c) => c.status === "ended").length,
    total_participants: totalParticipants,
    total_failed_claims: results.reduce((sum, c) => sum + c.failed_claims_count, 0),
  };

  return NextResponse.json({ sponsor, stats, campaigns: results });
}
