'use client';

// 장바구니 — 최종 결제가 이루어지는 화면. 담아둔 항목별 수량 조절/삭제,
// 잔액은 lib/exchangeRates 기본 환율로 전부 USD 환산해서 하나로 합쳐 보여준다
// (원화로 딴 적립금으로 엔화 상품을 사는 것처럼 통화를 넘나드는 결제가 가능해야
// 해서). "결제하기"를 누르면 한 번에 정산한다.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSession, setSession } from '@/lib/session';
import { createBrowserSupabaseClient, signInWithGoogle } from '@/lib/supabase/client';
import { toUSD } from '@/lib/exchangeRates';

type Participant = { id: string; email: string };

type CartItem = {
  id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  brand: string | null;
  unit_price: number;
  currency: string;
  quantity: number;
  recipient_email: string;
  recipient_name: string | null;
  is_gift: boolean;
};

type CheckoutResult = {
  placedOrders: { cartItemId: string; productName: string; sodaOrderId: string }[];
  failedItems: { cartItemId: string; productName: string; error: string }[];
};

export default function CartPage() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [balanceUSD, setBalanceUSD] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  function load(participantId: string) {
    Promise.all([
      fetch(`/api/cart?participantId=${participantId}`).then((r) => r.json()),
      fetch(`/api/participants/${participantId}/wallet`).then((r) => r.json()),
    ]).then(([cartData, walletData]) => {
      setItems(cartData.items ?? []);
      setBalanceUSD(walletData.balanceUSD ?? 0);
    });
  }

  useEffect(() => {
    const session = getSession();
    if (session) {
      setParticipant({ id: session.participantId, email: session.email });
      load(session.participantId);
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
        load(identified.participant.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updateQuantity(itemId: string, quantity: number) {
    if (!participant) return;
    setUpdatingId(itemId);
    try {
      if (quantity <= 0) {
        await fetch(`/api/cart/${itemId}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/cart/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity }),
        });
      }
      load(participant.id);
    } finally {
      setUpdatingId(null);
    }
  }

  const totalUSD = useMemo(
    () => (items ?? []).reduce((sum, item) => sum + toUSD(item.unit_price * item.quantity, item.currency), 0),
    [items]
  );
  const canCheckout = !!items && items.length > 0 && balanceUSD >= totalUSD;

  async function handleCheckout() {
    if (!participant || !canCheckout) return;
    setCheckingOut(true);
    setError(null);
    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Checkout failed');
        return;
      }
      setResult(data);
      load(participant.id);
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading || items === null) {
    return (
      <div className="p-4">
        <div className="mb-4 h-6 w-20 animate-pulse rounded bg-gray-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="flex flex-col items-center justify-center p-4 pt-32">
        <p className="mb-4 text-sm text-gray-500">Sign in to view your cart</p>
        <button
          onClick={() => signInWithGoogle('/store/cart')}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="p-4 pt-8 text-center">
        <p className="mb-3 text-4xl">🎁</p>
        <h1 className="mb-1 text-lg font-bold text-gray-900">
          {result.placedOrders.length} item{result.placedOrders.length > 1 ? 's' : ''} redeemed!
        </h1>
        <p className="mb-6 text-sm text-gray-500">They'll arrive soon at your registered email</p>

        {result.failedItems.length > 0 && (
          <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-left">
            <p className="mb-2 text-sm font-semibold text-rose-700">Some items couldn't be processed</p>
            {result.failedItems.map((f) => (
              <p key={f.cartItemId} className="text-xs text-rose-600">
                {f.productName} — {f.error}
              </p>
            ))}
          </div>
        )}

        <Link href="/store" className="text-sm font-semibold text-soda-600 underline">
          Keep browsing the store
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Cart</h1>
        <p className="mt-0.5 text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">
          Your cart is empty.
          <Link href="/store" className="mt-2 block font-semibold text-soda-600 underline">
            Browse the store
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4">
          {items.map((item) => {
            const lineTotalUSD = toUSD(item.unit_price * item.quantity, item.currency);
            return (
              <div key={item.id} className="flex gap-3 rounded-2xl border border-gray-100 p-3">
                <div className="h-16 w-16 shrink-0 rounded-xl bg-gray-100">
                  {item.product_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.product_image_url} alt="" className="h-full w-full rounded-xl object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-gray-400">{item.brand}</p>
                  <p className="mb-0.5 truncate text-sm font-medium text-gray-800">{item.product_name}</p>
                  <p className="mb-1.5 text-xs text-gray-400">
                    {item.is_gift ? `🎁 Gift to ${item.recipient_email}` : 'For me'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        disabled={updatingId === item.id}
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="h-7 w-7 rounded-full border border-gray-200 text-sm text-gray-600 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        disabled={updatingId === item.id}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-7 w-7 rounded-full border border-gray-200 text-sm text-gray-600 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-bold text-gray-900">${lineTotalUSD.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-5 px-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Total <span className="text-gray-300">· ~${balanceUSD.toFixed(2)} available</span>
              </span>
              <span className={`font-bold ${canCheckout ? 'text-gray-900' : 'text-rose-500'}`}>
                ~${totalUSD.toFixed(2)}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">
              Different currencies are converted at a default exchange rate into a single balance (not live rates)
            </p>
          </div>

          {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}

          <div className="fixed bottom-16 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur">
            <div className="tab-bar p-4">
              <button
                onClick={handleCheckout}
                disabled={!canCheckout || checkingOut}
                className="w-full rounded-xl bg-black py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {checkingOut ? 'Processing...' : canCheckout ? 'Checkout' : 'Insufficient balance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
