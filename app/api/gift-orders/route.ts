import { NextRequest, NextResponse } from 'next/server';
import { getDb, newId } from '@/lib/db';
import { getParticipant } from '@/lib/repo';
import { checkAvailability, submitOrder } from '@/lib/sodagift-mock';
import { recordEvent } from '@/lib/analytics';
import type { GiftOrder } from '@/lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { senderParticipantId, productId, recipientEmail, recipientName, message } = body as {
    senderParticipantId?: string;
    productId?: string;
    recipientEmail?: string;
    recipientName?: string;
    message?: string;
  };

  if (!senderParticipantId || !productId || !recipientEmail) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }
  if (!EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
  }
  const sender = getParticipant(senderParticipantId);
  if (!sender) {
    return NextResponse.json({ error: 'SENDER_NOT_FOUND' }, { status: 404 });
  }

  const availability = checkAvailability(productId);
  if (availability !== 'ON_SALE') {
    return NextResponse.json({ error: 'PRODUCT_DISCONTINUED' }, { status: 409 });
  }

  const externalReferenceId = `sodapick_gift_${sender.id}_${newId('ref')}`;
  const result = submitOrder({
    productId,
    recipientName: recipientName || recipientEmail,
    recipientEmail,
    senderName: sender.email,
    message: message || '제 예측이 맞았어요, 당신도 한번 참여해보세요!',
    externalReferenceId,
  });

  const db = getDb();
  const id = newId('gift');
  db.prepare(
    `INSERT INTO gift_orders (id, sender_participant_id, product_id, recipient_email, recipient_name, message, external_reference_id, soda_order_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    sender.id,
    productId,
    recipientEmail,
    recipientName || null,
    message || null,
    externalReferenceId,
    result.sodaOrderId,
    result.status
  );

  const order = db.prepare('SELECT * FROM gift_orders WHERE id = ?').get(id) as unknown as GiftOrder;
  recordEvent('sender_cta_clicked', {
    participantId: sender.id,
    metadata: { stage: 'completed', giftOrderId: order.id },
  });

  return NextResponse.json({ order });
}
