'use client';

// 인앱 스토어 홈. 상품을 눌러서 상세 화면(/store/[productId])으로 들어가고,
// 거기서 수량을 정해 장바구니에 담는다. 결제는 장바구니(/store/cart)에서
// 한 번에 한다 — 이 화면 자체엔 지갑 잔액을 안 보여준다(마이페이지에 이미
// 있고, 여기는 그냥 쇼핑몰처럼 구경하는 화면).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toDisplayProducts } from '@/lib/products';
import { toUSD } from '@/lib/exchangeRates';
import { getSession, setSession } from '@/lib/session';
import { createBrowserSupabaseClient, signInWithGoogle } from '@/lib/supabase/client';
import type { Product } from '@/lib/types';
import type { SodaProduct } from '@/lib/soda/client';

// 지갑이 USD 환산 기준으로 하나로 합쳐져 있어서, 가격도 상품 원래 통화 대신
// 전부 USD로 통일해서 보여준다 — 화면 전체에서 "이게 지갑 얼마만큼인지"가
// 바로 비교되게(기본 환율, 실시간 시세 아님).
function formatUSD(amount: number, currency: string): string {
  return `$${toUSD(amount, currency).toFixed(2)}`;
}

type Participant = { id: string; email: string };

// lib/soda/client.ts는 클라이언트 컴포넌트에서 값 import 금지(SODA_API_KEY,
// node:crypto가 같이 딸려온다) — 라벨만 필요해서 여기 따로 둔다. 스폰서 쪽
// 마법사도 같은 이유로 로컬에 똑같이 정의해서 쓴다.
const TYPE_LABELS: Record<string, string> = {
  GIFT_CARD: '기프트카드',
  DIGITAL_VOUCHER: '디지털 바우처',
  MERCHANDISE: '실물상품',
};
const TYPE_ORDER = ['GIFT_CARD', 'DIGITAL_VOUCHER', 'MERCHANDISE'];

const BANNERS = [
  { emoji: '🎁', title: '리워드로 득템하기', sub: '예측에 성공해서 모은 적립금, 여기서 바로 교환해요' },
  { emoji: '🔥', title: '신상품 업데이트', sub: '소다기프트 카탈로그가 매일 새로 채워져요' },
  { emoji: '💌', title: '친구에게 선물하기', sub: '상품 상세에서 바로 다른 사람에게 보낼 수 있어요' },
];

export default function StorePage() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  function loadCartCount(participantId: string) {
    fetch(`/api/cart?participantId=${participantId}`)
      .then((r) => r.json())
      .then((data) => {
        const items: { quantity: number }[] = data.items ?? [];
        setCartCount(items.reduce((sum, i) => sum + i.quantity, 0));
      });
  }

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => setProducts(toDisplayProducts((data.products ?? []) as SodaProduct[])));

    const session = getSession();
    if (session) {
      setParticipant({ id: session.participantId, email: session.email });
      loadCartCount(session.participantId);
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
        loadCartCount(identified.participant.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 지갑이 통화 상관없이 하나로 합쳐져서(기본 환율 환산) 결제되니까, 구경하는
  // 목록도 통화로 먼저 걸러둘 이유가 없다 — 카테고리(상품 종류)로만 나눈다.
  const typeKeys = useMemo(() => {
    const present = new Set(products.map((p) => p.type));
    return [...TYPE_ORDER.filter((t) => present.has(t)), ...[...present].filter((t) => !TYPE_ORDER.includes(t))];
  }, [products]);
  const visibleProducts = useMemo(
    () => (activeType ? products.filter((p) => p.type === activeType) : products),
    [products, activeType]
  );

  if (loading) {
    return (
      <div className="p-4">
        <div className="mb-4 h-6 w-16 animate-pulse rounded bg-gray-100" />
        <div className="mb-4 h-28 animate-pulse rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="flex flex-col items-center justify-center p-4 pt-32">
        <p className="mb-4 text-sm text-gray-500">로그인하면 스토어를 이용할 수 있어요</p>
        <button
          onClick={() => signInWithGoogle('/store')}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
        >
          Google 계정으로 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-6 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">스토어</h1>
          <p className="mt-0.5 text-sm text-gray-500">모은 리워드로 상품권을 교환해보세요</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/store/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg"
          >
            🛒
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-soda-500 px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* 배너 — 오늘의 특가처럼 가짜 할인율을 지어내지 않고, 스토어/기능 안내 톤으로만
          구성. 손으로 넘기는 스크롤바 대신 시간에 따라 자동으로 넘어가는 캐러셀. */}
      <BannerCarousel />

      <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setActiveType(null)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
            activeType === null ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          전체
        </button>
        {typeKeys.map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeType === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {TYPE_LABELS[t] ?? t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        {visibleProducts.map((p) => {
          const soldOut = p.stock_status === 'DISCONTINUED';
          return (
            <Link
              key={p.id}
              href={soldOut ? '#' : `/store/${p.id}`}
              aria-disabled={soldOut}
              className={`overflow-hidden rounded-2xl border border-gray-100 bg-white text-left transition ${
                soldOut ? 'pointer-events-none opacity-50' : 'active:scale-[0.98]'
              }`}
            >
              <div className="relative aspect-square w-full bg-gray-100">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
                {soldOut && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    품절
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-[11px] text-gray-400">{p.brand}</p>
                <p className="mb-1 line-clamp-2 text-sm text-gray-800">{p.name}</p>
                <p className="text-sm font-bold text-gray-900">
                  {formatUSD(p.price, p.currency)}
                </p>
              </div>
            </Link>
          );
        })}
        {visibleProducts.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-gray-400">해당 카테고리에 상품이 없어요</p>
        )}
      </div>
    </div>
  );
}

const BANNER_INTERVAL_MS = 4000;

function BannerCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % BANNERS.length), BANNER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="px-4">
      <div className="relative overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {BANNERS.map((b) => (
            <div key={b.title} className="w-full shrink-0 bg-gradient-to-br from-soda-500 to-soda-600 p-4 text-white">
              <p className="mb-1 text-2xl">{b.emoji}</p>
              <p className="text-sm font-bold">{b.title}</p>
              <p className="mt-0.5 text-xs text-white/80">{b.sub}</p>
            </div>
          ))}
        </div>
        <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
          {BANNERS.map((b, i) => (
            <button
              key={b.title}
              onClick={() => setIndex(i)}
              aria-label={`배너 ${i + 1}번으로 이동`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
