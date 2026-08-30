import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { confirmClaim } from "@/lib/claims";
import { getPrediction, getCampaign } from "@/lib/repo";
import { recordEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// 참가자 앱: 클레임 배송 정보 확정. predictionId 기준으로 reward_claims를 찾아
// lib/claims.ts의 공용 확정 로직을 태운다 (스폰서 쪽 /api/claims/[id]/confirm과 동일 로직).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { predictionId, productId, recipientName, recipientEmail, message } = (body ?? {}) as {
    predictionId?: string;
    productId?: string;
    recipientName?: string;
    recipientEmail?: string;
    message?: string;
  };

  if (!predictionId || !productId || !recipientName || !recipientEmail) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const prediction = await getPrediction(predictionId);
  if (!prediction) {
    return NextResponse.json({ error: "PREDICTION_NOT_FOUND" }, { status: 404 });
  }
  const campaign = await getCampaign(prediction.campaign_id);
  if (!campaign) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const isWinner = campaign.status === "resolved" && campaign.reward_option_ids.includes(prediction.selected_option);
  if (!isWinner) {
    return NextResponse.json({ error: "NOT_A_WINNER" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  const { data: claim } = await supabase
    .from("reward_claims")
    .select("*")
    .eq("round_id", prediction.round_id)
    .eq("participant_id", prediction.participant_id)
    .maybeSingle();
  if (!claim) {
    return NextResponse.json({ error: "NOT_A_WINNER" }, { status: 403 });
  }

  // FR-6: 멱등성 보장 — 이미 주문이 나간 상태면(리트라이가 아니라 재요청) 기존 걸 그대로 반환
  if (claim.status !== "eligible") {
    return NextResponse.json({ order: { id: claim.id, ...claim }, alreadyClaimed: true });
  }

  const result = await confirmClaim(supabase, claim.id, productId, { recipientName, recipientEmail, message });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await recordEvent("claim_completed", { participantId: prediction.participant_id, campaignId: campaign.id });
  return NextResponse.json({ order: { id: claim.id, ...result.claim }, alreadyClaimed: false });
}
