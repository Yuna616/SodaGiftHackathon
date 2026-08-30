import { NextRequest, NextResponse } from 'next/server';
import { findParticipantByEmail, listPredictionsForParticipant, getClaimOrderByPrediction } from '@/lib/repo';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email } = body as { email?: string };
  if (!email) {
    return NextResponse.json({ error: 'MISSING_EMAIL' }, { status: 400 });
  }
  const participant = findParticipantByEmail(email);
  if (!participant) {
    return NextResponse.json({ error: 'PARTICIPANT_NOT_FOUND' }, { status: 404 });
  }
  const predictions = listPredictionsForParticipant(participant.id).map((p) => {
    const isResolved = p.campaign.status === 'resolved';
    const isWinner = isResolved && p.campaign.reward_option_ids.includes(p.selected_option);
    const claimOrder = getClaimOrderByPrediction(p.id) ?? null;
    return { ...p, isResolved, isWinner, claimOrder };
  });
  return NextResponse.json({ participant, predictions });
}
