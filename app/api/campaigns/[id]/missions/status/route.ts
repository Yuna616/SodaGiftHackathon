import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// 유저앱이 예측 제출 버튼을 활성화하기 전에 미션 완료 여부를 확인하는 용도.
// mission_url이 없는 캠페인은 미션 자체가 없으므로 항상 completed: true.

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
    return NextResponse.json({ completed: true, mission_required: false });
  }

  const { data: completion } = await supabase
    .from("mission_completions")
    .select("completed_at")
    .eq("campaign_id", params.id)
    .eq("participant_id", participantId)
    .maybeSingle();

  return NextResponse.json({ completed: !!completion, mission_required: true });
}
