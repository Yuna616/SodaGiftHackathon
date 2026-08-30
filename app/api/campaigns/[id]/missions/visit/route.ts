import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// 참여 미션(사이트 방문) 완료 처리용 리다이렉트 라우트.
// 유저앱에서 "미션 완료하기" 버튼의 href를 이 라우트로 걸어두면
// 방문 기록을 남긴 뒤 campaign.mission_url로 302 리다이렉트한다.
// 예측 제출 API(/api/predictions, 아직 미구현)는 이 완료 기록이 있는지 먼저 확인해야 한다.

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const participantId = req.nextUrl.searchParams.get("participant_id");
  if (!participantId) {
    return NextResponse.json({ error: "participant_id 쿼리 파라미터가 필요합니다" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("mission_url")
    .eq("id", params.id)
    .single();
  if (campaignError || !campaign) {
    return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  }
  if (!campaign.mission_url) {
    return NextResponse.json({ error: "이 캠페인은 참여 미션이 없습니다" }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from("mission_completions")
    .upsert(
      { campaign_id: params.id, participant_id: participantId },
      { onConflict: "campaign_id,participant_id", ignoreDuplicates: true }
    );
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.redirect(campaign.mission_url);
}
