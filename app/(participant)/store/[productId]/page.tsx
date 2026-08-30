'use client';

// 스토어 상품 상세: 수량을 정하고 나에게 받을지 다른 사람에게 선물할지 고른 뒤
// 장바구니에 담는다. 실제 결제(소다기프트 주문)는 여기서 안 하고 장바구니에서
// 한 번에 한다.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toDisplayProducts } from '@/lib/products';
import { toUSD } from '@/lib/exchangeRates';
import { getSession, setSession } from '@/lib/session';
import { createBrowserSupabaseClient, signInWithGoogle } from '@/lib/supabase/client';
import type { Product } from '@/lib/types';
import type { SodaProduct } from '@/lib/soda/client';

type Participant = { id: string; email: string };
type RecipientMode = 'self' | 'gift';

export default function StoreProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('self');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => setProducts(toDisplayProducts((data.products ?? []) as SodaProduct[])));

    const session = getSession();
    if (session) {
      setParticipant({ id: session.participantId, email: session.email });
      setLoading(false);
      return;
    }
    createBrowserSupabaseClient()
      .auth.getUser()
      .then(async ({ data }) => {
        const email = data.user?.email;
        if (!email) {
          setLoading(false);
          return;
        }
        const res = await fetch('/api/participants/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const identified = await res.json();
        setSession({ participantId: identified.participant.id, email: identified.participant.email });
        setParticipant({ id: identified.participant.id, email: identified.participant.email });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const product = products?.find((p) => p.id === productId) ?? null;

  async function handleAddToCart() {
    if (!participant || !product) return;
    if (recipientMode === 'gift' && !recipientEmail.trim()) {
      setError('Please enter the recipient\'s email');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          productId: product.id,
          quantity,
          isGift: recipientMode === 'gift',
          recipientEmail: recipientMode === 'gift' ? recipientEmail.trim() : undefined,
          recipientName: recipientMode === 'gift' ? recipientName.trim() || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to add to cart');
        return;
      }
      setAdded(true);
    } finally {
      setAdding(false);
    }
  }

  if (loading || products === null) {
    return (
      <div className="p-4">
        <div className="mb-4 aspect-square animate-pulse rounded-2xl bg-gray-100" />
        <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-gray-100" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="flex flex-col items-center justify-center p-4 pt-32">
        <p className="mb-4 text-sm text-gray-500">Sign in to use the store</p>
        <button
          onClick={() => signInWithGoogle(`/store/${productId}`)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        Product not found.
        <Link href="/store" className="mt-2 block text-soda-600 underline">
          Back to store
        </Link>
      </div>
    );
  }

  const soldOut = product.stock_status === 'DISCONTINUED';
  // 지갑이 USD 환산 기준으로 하나로 합쳐져 있어서 가격도 상품 원래 통화 대신
  // USD로 통일해서 보여준다(기본 환율, 실시간 시세 아님).
  const priceUSD = toUSD(product.price, product.currency);
  const subtotalUSD = priceUSD * quantity;

  return (
    <div className="pb-28">
      <div className="px-4 pt-4">
        <button onClick={() => router.back()} className="mb-2 text-sm text-gray-400">
          ← Back
        </button>
      </div>

      <div className="relative aspect-square w-full bg-gray-100">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="h-full w-full object-cover" />
        ) : null}
        {soldOut && (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            Sold out
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-400">{product.brand}</p>
        <h1 className="mt-0.5 text-lg font-bold text-gray-900">{product.name}</h1>
        <p className="mt-1.5 text-xl font-extrabold text-gray-900">${priceUSD.toFixed(2)}</p>

        {added ? (
          <div className="mt-6 rounded-2xl bg-soda-50 p-4 text-center">
            <p className="text-sm font-semibold text-soda-700">Added to cart</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setAdded(false);
                  setQuantity(1);
                }}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700"
              >
                Keep shopping
              </button>
              <Link
                href="/store/cart"
                className="flex-1 rounded-xl bg-black py-2.5 text-center text-sm font-semibold text-white"
              >
                View cart
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold text-gray-500">Quantity</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-full border border-gray-200 text-lg text-gray-600"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  className="h-9 w-9 rounded-full border border-gray-200 text-lg text-gray-600"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold text-gray-500">Recipient</p>
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                <button
                  onClick={() => setRecipientMode('self')}
                  className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
                    recipientMode === 'self' ? 'bg-gray-900 text-white' : 'text-gray-500'
                  }`}
                >
                  For me
                </button>
                <button
                  onClick={() => setRecipientMode('gift')}
                  className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
                    recipientMode === 'gift' ? 'bg-gray-900 text-white' : 'text-gray-500'
                  }`}
                >
                  Send as gift
                </button>
              </div>

              {recipientMode === 'gift' && (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Recipient's email"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soda-400"
                  />
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Recipient's name (optional)"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soda-400"
                  />
                </div>
              )}
            </div>

            {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}

            <div className="fixed bottom-16 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur">
              <div className="tab-bar flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400">Total {quantity} item{quantity > 1 ? 's' : ''}</p>
                  <p className="text-sm font-bold text-gray-900">
                    ${subtotalUSD.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={soldOut || adding}
                  className="shrink-0 rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {adding ? 'Adding...' : soldOut ? 'Sold out' : 'Add to cart'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
