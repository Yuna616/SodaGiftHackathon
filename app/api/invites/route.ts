import { NextRequest, NextResponse } from "next/server";
import { getOrCreateInvite, countCompletedInvites, getCampaign, findPrediction } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { participantId, campaignId } = (body ?? {}) as { participantId?: string; campaignId?: string };
  if (!participantId || !campaignId) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }
  const invite = await getOrCreateInvite(participantId, campaignId);
  const completedCount = await countCompletedInvites(participantId, campaignId);
  const prediction = await findPrediction(participantId, campaignId);
  return NextResponse.json({
    token: invite.token,
    completedCount,
    multiplier: prediction?.multiplier ?? 1,
  });
}
