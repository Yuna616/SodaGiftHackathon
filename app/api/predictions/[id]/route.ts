import { NextRequest, NextResponse } from "next/server";
import { getPrediction, getCampaign, getParticipant, getClaimOrderByPrediction } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prediction = await getPrediction(params.id);
  if (!prediction) {
    return NextResponse.json({ error: "PREDICTION_NOT_FOUND" }, { status: 404 });
  }
  const campaign = await getCampaign(prediction.campaign_id);
  const participant = await getParticipant(prediction.participant_id);
  if (!campaign || !participant) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const isWinner = campaign.status === "resolved" && campaign.reward_option_ids.includes(prediction.selected_option);
  const claimOrder = (await getClaimOrderByPrediction(prediction.id)) ?? null;
  return NextResponse.json({ prediction, campaign, participant, isWinner, claimOrder });
}
