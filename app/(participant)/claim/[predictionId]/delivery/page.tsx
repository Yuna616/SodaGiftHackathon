'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { Participant } from '@/lib/types';

export default function ClaimDeliveryPage() {
  return (
    <Suspense fallback={<div className="p-4"><div className="h-24 rounded-2xl bg-gray-100 animate-pulse" /></div>}>
      <ClaimDeliveryContent />
    </Suspense>
  );
}

function ClaimDeliveryContent() {
  const { predictionId } = useParams<{ predictionId: string }>();
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');
  const productName = searchParams.get('name') ?? '';
  const productBrand = searchParams.get('brand') ?? '';
  const router = useRouter();

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!predictionId) return;
    fetch(`/api/predictions/${predictionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setParticipant(data.participant);
        setRecipientEmail(data.participant.email);
        setRecipientName(data.participant.email.split('@')[0]);
      });
  }, [predictionId]);

  async function handleConfirm() {
    if (!productId || !recipientEmail) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predictionId, productId, recipientName, recipientEmail, message }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError('수령 처리에 실패했어요. 다시 시도해주세요');
      return;
    }
    router.push(`/claim/${predictionId}/complete?orderId=${data.order.id}`);
  }

  if (!productId) {
    return (
      <div className="p-4">
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-xs text-gray-400 mb-1">2/3 · 배송 정보</p>
      <h1 className="text-lg font-bold text-gray-900 mb-5">받으실 정보를 확인해주세요</h1>

      <div className="rounded-xl bg-gray-50 p-3 mb-5">
        <p className="text-sm font-medium text-gray-800">{productName}</p>
        <p className="text-xs text-gray-400 mt-0.5">{productBrand}</p>
      </div>

      <label className="block text-xs font-medium text-gray-500 mb-1">수령 이메일</label>
      <input
        type="email"
        value={recipientEmail}
        onChange={(e) => setRecipientEmail(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3 outline-none focus:border-soda-400"
      />

      <label className="block text-xs font-medium text-gray-500 mb-1">받는 분 이름</label>
      <input
        type="text"
        value={recipientName}
        onChange={(e) => setRecipientName(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3 outline-none focus:border-soda-400"
      />

      <label className="block text-xs font-medium text-gray-500 mb-1">메시지 카드 (선택)</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="축하합니다! 예측에 성공하셨어요"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-4 outline-none focus:border-soda-400 resize-none"
        rows={3}
      />

      {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={!recipientEmail || submitting}
        className="w-full rounded-xl bg-black text-white font-semibold py-3 text-sm disabled:opacity-40"
      >
        {submitting ? '처리 중...' : '최종 확인'}
      </button>
      {participant && <p className="text-[11px] text-gray-400 mt-2 text-center">{participant.email} 계정으로 처리돼요</p>}
    </div>
  );
}
