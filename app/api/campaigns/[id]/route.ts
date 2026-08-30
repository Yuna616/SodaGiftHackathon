import { NextRequest, NextResponse } from "next/server";
import { getCampaignWithConsensus } from "@/lib/repo";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 참가자 앱: 캠페인 상세 + 컨센서스(%). 팀원 원본 라우트를 Supabase로 이식.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const campaign = await getCampaignWithConsensus(params.id);
  if (!campaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}

// 고객사 콘솔: 캠페인 삭제. 발행 전(draft) 캠페인만 지울 수 있다 — 한 번 발행되면
// 참가자가 예측을 냈을 수 있고 판정 불변성(FR-5) 취지상 이력을 지워선 안 되기 때문.
// 하위 행(rounds/catalog/predictions 등)은 0006 마이그레이션의 cascade로 같이 정리된다.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: campaign, error: fetchError } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "발행된 캠페인은 삭제할 수 없습니다. 임시저장 상태만 삭제 가능합니다." },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabase.from("campaigns").delete().eq("id", params.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
