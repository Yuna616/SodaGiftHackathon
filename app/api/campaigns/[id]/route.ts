import { NextRequest, NextResponse } from "next/server";
import { getCampaignWithConsensus } from "@/lib/repo";

export const dynamic = "force-dynamic";

// 참가자 앱: 캠페인 상세 + 컨센서스(%). 팀원 원본 라우트를 Supabase로 이식.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const campaign = await getCampaignWithConsensus(params.id);
  if (!campaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}
