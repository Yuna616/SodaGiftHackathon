'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { track } from '@/lib/track';
import type { ClaimOrder, Participant } from '@/lib/types';

export default function ClaimCompletePage() {
  return (
    <Suspense fallback={<div className="p-4"><div className="h-40 rounded-2xl bg-gray-100 animate-pulse" /></div>}>
      <ClaimCompleteContent />
    </Suspense>
  );
}

function ClaimCompleteContent() {
  const { predictionId } = useParams<{ predictionId: string }>();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<ClaimOrder | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);

  useEffect(() => {
    if (!orderId || !predictionId) return;
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((data) => setOrder(data.order ?? null));
    fetch(`/api/predictions/${predictionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.participant) setParticipant(data.participant);
      });
  }, [orderId, predictionId]);

  if (!order) {
    return (
      <div className="p-4">
        <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col items-center text-center pt-10">
      <p className="text-4xl mb-3">🎁</p>
      <h1 className="text-lg font-bold text-gray-900 mb-1">Gift sent!</h1>
      <p className="text-sm text-gray-500 mb-8">It'll arrive soon at your registered email</p>

      <div className="w-full rounded-2xl border-2 border-soda-400 bg-soda-50 p-5 mb-4">
        <p className="text-sm font-semibold text-gray-900 mb-1">Just like this gift, send one to a friend too</p>
        <p className="text-xs text-soda-600 mb-4">You can send a gift directly on SodaPick</p>
        <Link
          href={participant ? `/gift/new?senderParticipantId=${participant.id}` : '#'}
          onClick={() => participant && track('sender_cta_clicked', { participantId: participant.id, metadata: { stage: 'clicked' } })}
          className="block w-full rounded-xl bg-black text-white font-semibold py-3 text-sm"
        >
          Send a gift to a friend
        </Link>
      </div>

      <Link href="/" className="text-xs text-gray-400 underline">
        See other campaigns
      </Link>
    </div>
  );
}
