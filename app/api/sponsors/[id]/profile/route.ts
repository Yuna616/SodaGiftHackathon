import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 다른 유저(참가자)가 보는 공개 스폰서 프로필. /api/sponsors/:id/campaigns(콘솔 전용)와
// 거의 같은 모양이지만 두 가지가 다르다 —
// 1) draft 캠페인은 제외(아직 발행 전이라 참가자에게 안 보여야 함)
// 2) 지갑 잔액/지급 실패 관련 필드를 애초에 응답에 넣지 않는다(화면에서 숨기는 게
//    아니라 API 레벨에서 차단 — SponsorProfileView가 owner/public 어느 쪽이든
//    이 응답을 그대로 넘겨받아 그리기 때문에, 여기서 안 주면 절대 안 보인다).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: sponsor, error: sponsorError } = await supabase
    .from("sponsors")
    .select("id, name, avatar_url, banner_url, created_at")
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
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  if (campaignsError) {
    return NextResponse.json({ error: campaignsError.message }, { status: 500 });
  }

  // rounds는 화면에 직접 보여줄 일이 없다(캠페인당 라운드 1개뿐이라 목록에서
  // 따로 표시할 정보가 없음) — 아래 참여자 수 집계에 쓸 round id만 필요하다.
  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: rounds } =
    campaignIds.length > 0
      ? await supabase.from("rounds").select("id").in("campaign_id", campaignIds)
      : { data: [] as { id: string }[] };

  const results = campaigns ?? [];

  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: predictions } =
    roundIds.length > 0
      ? await supabase.from("predictions").select("participant_id").in("round_id", roundIds)
      : { data: [] as { participant_id: string }[] };
  const totalParticipants = new Set((predictions ?? []).map((p) => p.participant_id)).size;

  const stats = {
    total_campaigns: results.length,
    active_campaigns: results.filter((c) => c.status === "active").length,
    ended_campaigns: results.filter((c) => c.status === "ended").length,
    total_participants: totalParticipants,
  };

  return NextResponse.json({ sponsor, stats, campaigns: results });
}
