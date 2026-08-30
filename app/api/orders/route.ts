import { NextRequest, NextResponse } from 'next/server';
import { getDb, newId } from '@/lib/db';
import { getPrediction, getCampaign, getParticipant, getClaimOrderByPrediction } from '@/lib/repo';
import { checkAvailability, submitOrder } from '@/lib/sodagift-mock';
import { recordEvent } from '@/lib/analytics';
import type { ClaimOrder } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { predictionId, productId, recipientName, recipientEmail, message } = body as {
    predictionId?: string;
    productId?: string;
    recipientName?: string;
    recipientEmail?: string;
    message?: string;
  };

  if (!predictionId || !productId || !recipientName || !recipientEmail) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  const prediction = getPrediction(predictionId);
  if (!prediction) {
    return NextResponse.json({ error: 'PREDICTION_NOT_FOUND' }, { status: 404 });
  }
  const campaign = getCampaign(prediction.campaign_id);
  const participant = getParticipant(prediction.participant_id);
  if (!campaign || !participant) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const isWinner = campaign.status === 'resolved' && campaign.reward_option_ids.includes(prediction.selected_option);
  if (!isWinner) {
    return NextResponse.json({ error: 'NOT_A_WINNER' }, { status: 403 });
  }

  // FR-6: 멱등성 보장, 재호출 시 기존 주문 반환
  const existing = getClaimOrderByPrediction(predictionId);
  if (existing) {
    return NextResponse.json({ order: existing, alreadyClaimed: true });
  }

  const availability = checkAvailability(productId);
  if (availability !== 'ON_SALE') {
    return NextResponse.json({ error: 'PRODUCT_DISCONTINUED' }, { status: 409 });
  }

  const externalReferenceId = `sodapick_${campaign.id}_${participant.id}`;
  const result = submitOrder({
    productId,
    recipientName,
    recipientEmail,
    senderName: 'SodaPick',
    message: message || '축하합니다! 예측에 성공하셨어요 🎉',
    externalReferenceId,
  });

  const db = getDb();
  const id = newId('claim');
  db.prepare(
    `INSERT INTO claim_orders (id, prediction_id, selected_product_id, external_reference_id, soda_order_id, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, predictionId, productId, externalReferenceId, result.sodaOrderId, result.status);

  const order = db.prepare('SELECT * FROM claim_orders WHERE id = ?').get(id) as unknown as ClaimOrder;
  recordEvent('claim_completed', { participantId: participant.id, campaignId: campaign.id });

  return NextResponse.json({ order, alreadyClaimed: false });
}
