import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { DEMO_SPONSOR_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

// 스폰서 대시보드(PRD 5.1)용 — 프로필 정보 + 통계 + 캠페인 목록(실패한 지급
// 건수 포함)을 한 번에 반환한다. 캠페인별로 다시 조회하지 않고 in()으로
// 배치 조회해서 캠페인 수와 무관하게 쿼리 수를 고정한다.
//
// 스폰서 로그인이 아직 없어서(TODO, lib/constants.ts) 실제 캠페인은 전부
// 시딩된 여러 고객사(sponsor_id)에 흩어져 있고, 데모 계정 소유 캠페인은 0건이다.
// 그래서 데모 계정으로 조회할 땐 sponsor_id 필터를 걸지 않고 "관리자 뷰"로
// 전체 캠페인을 보여준다 — sponsor_id 자체는 안 건드리므로 참가자 화면에 보이는
// 브랜드명(HYBE, Netflix 등)은 그대로다.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();
  const isAdminView = params.id === DEMO_SPONSOR_ID;

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

  let campaignsQuery = supabase
    .from("campaigns")
    .select("id, title, status, category, thumbnail_url, created_at, starts_at, ends_at, sponsor_id")
    .order("created_at", { ascending: false });
  if (!isAdminView) campaignsQuery = campaignsQuery.eq("sponsor_id", params.id);
  const { data: campaigns, error: campaignsError } = await campaignsQuery;
  if (campaignsError) {
    return NextResponse.json({ error: campaignsError.message }, { status: 500 });
  }

  // 관리자 뷰에서만 캠페인마다 실제 소유 고객사명을 같이 내려준다 — 단일
  // 스폰서 뷰에선 어차피 전부 같은 스폰서라 불필요.
  const sponsorNameById = new Map<string, string>();
  if (isAdminView && (campaigns ?? []).length > 0) {
    const sponsorIds = Array.from(new Set((campaigns ?? []).map((c) => c.sponsor_id)));
    const { data: sponsorRows } = await supabase.from("sponsors").select("id, name").in("id", sponsorIds);
    for (const s of sponsorRows ?? []) sponsorNameById.set(s.id, s.name as string);
  }

  const campaignIds = (campaigns ?? []).map((c) => c.id);

  // rounds는 화면에 직접 보여줄 일이 없다(캠페인당 라운드 1개뿐이라 목록에서
  // 따로 표시할 정보가 없음) — 아래 참여자 수 집계에 쓸 round id만 필요하다.
  const [{ data: rounds }, { data: failedClaims }] =
    campaignIds.length > 0
      ? await Promise.all([
          supabase.from("rounds").select("id").in("campaign_id", campaignIds),
          supabase.from("reward_claims").select("id, campaign_id").in("campaign_id", campaignIds).eq("status", "failed"),
        ])
      : [{ data: [] as { id: string }[] }, { data: [] as { id: string; campaign_id: string }[] }];

  const failedCountByCampaignId = new Map<string, number>();
  for (const fc of failedClaims ?? []) {
    failedCountByCampaignId.set(fc.campaign_id, (failedCountByCampaignId.get(fc.campaign_id) ?? 0) + 1);
  }

  const results = (campaigns ?? []).map((campaign) => ({
    ...campaign,
    failed_claims_count: failedCountByCampaignId.get(campaign.id) ?? 0,
    ...(isAdminView ? { sponsor_name: sponsorNameById.get(campaign.sponsor_id) ?? "" } : {}),
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
