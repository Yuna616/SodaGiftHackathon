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
      setError(data.error === 'PRODUCT_DISCONTINUED' ? 'This item just sold out. Please choose another one' : 'Failed to send');
      return;
    }
    setOrder(data.order);
  }

  if (!senderParticipantId) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">Invalid access</div>
    );
  }

  if (order) {
    return (
      <div className="p-4 flex flex-col items-center text-center pt-12">
        <p className="text-4xl mb-3">💌</p>
        <h1 className="text-lg font-bold text-gray-900 mb-1">Gift sent!</h1>
        <p className="text-sm text-gray-500 mb-8">It'll arrive soon at {recipientEmail}</p>
        <Link href="/" className="text-sm text-soda-600 font-semibold underline">
          See SodaPick campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-gray-900 mb-1">Send a gift to a friend</h1>
      <p className="text-sm text-gray-500 mb-5">Share the joy you got from SodaPick with a friend</p>

      <p className="text-xs font-semibold text-gray-500 mb-2">Choose a product</p>
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

      <label className="block text-xs font-medium text-gray-500 mb-1">Recipient email</label>
      <input
        type="email"
        value={recipientEmail}
        onChange={(e) => setRecipientEmail(e.target.value)}
        placeholder="friend@example.com"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3 outline-none focus:border-soda-400"
      />

      <label className="block text-xs font-medium text-gray-500 mb-1">Recipient name (optional)</label>
      <input
        type="text"
        value={recipientName}
        onChange={(e) => setRecipientName(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3 outline-none focus:border-soda-400"
      />

      <label className="block text-xs font-medium text-gray-500 mb-1">Message (optional)</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="My prediction was right, you should try it too!"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-4 outline-none focus:border-soda-400 resize-none"
        rows={3}
      />

      {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}

      <button
        onClick={handleSend}
        disabled={!selectedProduct || !recipientEmail || submitting}
        className="w-full rounded-xl bg-black text-white font-semibold py-3 text-sm disabled:opacity-40"
      >
        {submitting ? 'Sending...' : 'Send gift'}
      </button>
    </div>
  );
}
