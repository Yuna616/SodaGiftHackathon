'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { toDisplayProducts } from '@/lib/products';
import type { GiftOrder, Product } from '@/lib/types';
import type { SodaProduct } from '@/lib/soda/client';

export default function GiftNewPage() {
  return (
    <Suspense fallback={<div className="p-4"><div className="h-24 rounded-2xl bg-gray-100 animate-pulse" /></div>}>
      <GiftNewContent />
    </Suspense>
  );
}

function GiftNewContent() {
  const searchParams = useSearchParams();
  const senderParticipantId = searchParams.get('senderParticipantId');

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<GiftOrder | null>(null);

  useEffect(() => {
    fetch('/api/products?country_code=KR')
      .then((r) => r.json())
      .then((data) => setProducts(toDisplayProducts((data.products ?? []) as SodaProduct[])));
  }, []);

  async function handleSend() {
    if (!senderParticipantId || !selectedProduct || !recipientEmail) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/gift-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderParticipantId, productId: selectedProduct, recipientEmail, recipientName, message }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error === 'PRODUCT_DISCONTINUED' ? '방금 품절된 상품이에요. 다른 상품을 선택해주세요' : '발송에 실패했어요');
      return;
    }
    setOrder(data.order);
  }

  if (!senderParticipantId) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">잘못된 접근이에요</div>
    );
  }

  if (order) {
    return (
      <div className="p-4 flex flex-col items-center text-center pt-12">
        <p className="text-4xl mb-3">💌</p>
        <h1 className="text-lg font-bold text-gray-900 mb-1">선물을 보냈어요!</h1>
        <p className="text-sm text-gray-500 mb-8">{recipientEmail}으로 곧 도착할 거예요</p>
        <Link href="/" className="text-sm text-soda-600 font-semibold underline">
          SodaPick 캠페인 보러가기
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-gray-900 mb-1">친구에게 선물하기</h1>
      <p className="text-sm text-gray-500 mb-5">SodaPick에서 받은 기쁨을 친구에게도 전해보세요</p>

      <p className="text-xs font-semibold text-gray-500 mb-2">상품 선택</p>
      <div className="flex flex-col gap-2 mb-5">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            selected={selectedProduct === p.id}
            onClick={() => setSelectedProduct(p.id)}
          />
        ))}
      </div>

      <label className="block text-xs font-medium text-gray-500 mb-1">받는 분 이메일</label>
      <input
        type="email"
        value={recipientEmail}
        onChange={(e) => setRecipientEmail(e.target.value)}
        placeholder="friend@example.com"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3 outline-none focus:border-soda-400"
      />

      <label className="block text-xs font-medium text-gray-500 mb-1">받는 분 이름 (선택)</label>
      <input
        type="text"
        value={recipientName}
        onChange={(e) => setRecipientName(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3 outline-none focus:border-soda-400"
      />

      <label className="block text-xs font-medium text-gray-500 mb-1">메시지 (선택)</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="제 예측이 맞았어요, 당신도 한번 참여해보세요!"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-4 outline-none focus:border-soda-400 resize-none"
        rows={3}
      />

      {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}

      <button
        onClick={handleSend}
        disabled={!selectedProduct || !recipientEmail || submitting}
        className="w-full rounded-xl bg-black text-white font-semibold py-3 text-sm disabled:opacity-40"
      >
        {submitting ? '보내는 중...' : '선물 보내기'}
      </button>
    </div>
  );
}
