'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSession, setSession } from '@/lib/session';
import { createBrowserSupabaseClient, signInWithGoogle } from '@/lib/supabase/client';
import type { PublicCampaign, PublicPrediction, ClaimOrder } from '@/lib/types';
import type { SodaProduct } from '@/lib/soda/client';

type PredictionRow = PublicPrediction & {
  campaign: PublicCampaign;
  isResolved: boolean;
  isWinner: boolean;
  claimOrder: ClaimOrder | null;
};

interface ProductInfo {
  name: string;
  brand: string;
  image_url: string | null;
}

const CLAIM_STATUS_LABEL: Record<ClaimOrder['status'], { text: string; className: string }> = {
  ISSUED: { text: '지급 완료', className: 'bg-emerald-50 text-emerald-600' },
  FAILED: { text: '지급 실패', className: 'bg-rose-50 text-rose-500' },
};

// 리워드 통화가 캠페인마다 다를 수 있는데(현재 데모 데이터는 GBP), 마이페이지 요약은
// 통화 변환 없이 숫자 그대로 $ 표기로 통일한다 — 실제 환전은 하지 않는 단순화.
function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MyPage() {
  const [participant, setParticipant] = useState<{ id: string; email: string } | null>(null);
  const [predictions, setPredictions] = useState<PredictionRow[] | null>(null);
  const [productMap, setProductMap] = useState<Record<string, ProductInfo>>({});
  const [loading, setLoading] = useState(true);

  function loadParticipant(email: string) {
    setLoading(true);
    return fetch('/api/participants/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.participant) {
          setParticipant(data.participant);
          setPredictions(data.predictions ?? []);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, ProductInfo> = {};
        for (const p of (data.products ?? []) as SodaProduct[]) {
          map[String(p.id)] = {
            name: p.name_ko ?? p.name,
            brand: p.brand?.name ?? p.category.name,
            image_url: p.image_url,
          };
        }
        setProductMap(map);
      })
      .catch(() => {});

    const session = getSession();
    if (session) {
      loadParticipant(session.email);
      return;
    }

    // localStorage 세션이 없으면(예: Google 로그인 콜백 직후 첫 진입) 실제 Supabase Auth
    // 세션에서 이메일을 읽어와 participants 레코드를 확보한다. 로그인 자체를 안 한 유저는
    // getUser()가 null을 반환하고 아래에서 로그인 버튼 화면으로 빠진다.
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
        await loadParticipant(email);
      })
      .catch(() => setLoading(false));
  }, []);

  const claims = useMemo(
    () =>
      (predictions ?? [])
        .filter((p): p is PredictionRow & { claimOrder: ClaimOrder } => !!p.claimOrder && p.claimOrder.status !== 'FAILED'),
    [predictions]
  );
  const amountClaims = useMemo(() => claims.filter((p) => p.claimOrder.payout_amount != null), [claims]);
  const productClaims = useMemo(() => claims.filter((p) => p.claimOrder.selected_product_id), [claims]);
  const totalAmount = useMemo(
    () => amountClaims.reduce((sum, p) => sum + (p.claimOrder.payout_amount ?? 0), 0),
    [amountClaims]
  );

  if (loading) {
    return (
      <div className="p-4">
        <div className="h-6 w-24 rounded bg-gray-100 animate-pulse mb-4" />
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse mb-4" />
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="p-4 flex flex-col items-center justify-center pt-32">
        <button
          onClick={() => signInWithGoogle('/my')}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
        >
          Google 계정으로 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="pt-2 mb-5">
        <h1 className="text-lg font-bold text-gray-900">마이페이지</h1>
        <p className="text-xs text-gray-400 mt-0.5">{participant.email}</p>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">획득 리워드</h2>

        <div className="rounded-2xl bg-black p-5 mb-3">
          <p className="text-xs text-gray-400 mb-1">누적 획득 리워드</p>
          <p className="text-3xl font-extrabold text-white">{formatUsd(totalAmount)}</p>
        </div>

        {amountClaims.length > 0 && (
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 mb-4">
            {amountClaims.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm text-gray-800">{p.campaign.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.claimOrder.created_at)}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  {formatUsd(p.claimOrder.payout_amount ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs font-semibold text-gray-500 mb-2">상품 리스트</p>
        {productClaims.length === 0 ? (
          <p className="text-xs text-gray-400">아직 받은 상품이 없어요</p>
        ) : (
          <div className="flex flex-col gap-2">
            {productClaims.map((p) => {
              const info = p.claimOrder.selected_product_id ? productMap[p.claimOrder.selected_product_id] : undefined;
              const status = CLAIM_STATUS_LABEL[p.claimOrder.status];
              return (
                <Link
                  key={p.id}
                  href={`/my/rewards/${p.claimOrder.id}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 active:bg-gray-50 transition"
                >
                  {info?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={info.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-11 w-11 shrink-0 rounded-lg bg-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{info?.name ?? '상품 정보 확인 중'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{info?.brand ?? p.campaign.title}</p>
                  </div>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-1 shrink-0 ${status.className}`}>
                    {status.text}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-2">이벤트 참여 내역</h2>
        {!predictions || predictions.length === 0 ? (
          <p className="text-xs text-gray-400">아직 참여한 이벤트가 없어요</p>
        ) : (
          <div className="flex flex-col gap-2">
            {predictions.map((p) => {
              const label = !p.isResolved
                ? { text: '진행중', className: 'bg-blue-50 text-blue-500' }
                : p.isWinner
                  ? { text: 'Win', className: 'bg-amber-100 text-amber-700' }
                  : { text: 'Lose', className: 'bg-gray-100 text-gray-400' };
              return (
                <Link
                  key={p.id}
                  href={`/campaigns/${p.campaign.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 p-3 active:bg-gray-50 transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{p.campaign.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.campaign.options.find((o) => o.id === p.selected_option)?.label}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${label.className}`}>
                    {label.text}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
