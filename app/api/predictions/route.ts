import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaign,
  upsertParticipant,
  findPrediction,
  createPrediction,
  findInviteByToken,
  completeInvite,
  bumpMultiplier,
} from '@/lib/repo';
import { recordEvent } from '@/lib/analytics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { campaignId, email, selectedOption, inviteToken } = body as {
    campaignId?: string;
    email?: string;
    selectedOption?: string;
    inviteToken?: string;
  };

  if (!campaignId || !email || !selectedOption) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
  }

  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND' }, { status: 404 });
  }
  // 주지사항: 제출 진행 중 캠페인이 마감된 경우 서버에서 마감 시각 기준으로 최종 검증
  if (campaign.status !== 'active' || new Date(campaign.end_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'CAMPAIGN_CLOSED' }, { status: 409 });
  }
  if (!campaign.options.some((o) => o.id === selectedOption)) {
    return NextResponse.json({ error: 'INVALID_OPTION' }, { status: 400 });
  }

  const { participant, isNew } = upsertParticipant(email);

  const existing = findPrediction(participant.id, campaignId);
  if (existing) {
    return NextResponse.json({ prediction: existing, participant, alreadySubmitted: true });
  }

  const prediction = createPrediction(participant.id, campaignId, selectedOption);
  recordEvent('prediction_submitted', { participantId: participant.id, campaignId });

  // 초대 리워드 처리: 신규 참가자일 때만 초대 완료로 인정 (부정 획득 방지)
  if (inviteToken) {
    const invite = findInviteByToken(inviteToken);
    if (invite && invite.campaign_id === campaignId && invite.status === 'pending' && isNew) {
      completeInvite(inviteToken, email);
      const inviterPrediction = findPrediction(invite.inviter_participant_id, campaignId);
      if (inviterPrediction) {
        bumpMultiplier(inviterPrediction.id);
      }
      recordEvent('invite_completed', {
        participantId: invite.inviter_participant_id,
        campaignId,
        metadata: { inviteeParticipantId: participant.id },
      });
    }
  }

  return NextResponse.json({ prediction, participant, alreadySubmitted: false });
}
