'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSession, setSession } from '@/lib/session';
import { createBrowserSupabaseClient, signInWithGoogle } from '@/lib/supabase/client';
import CountdownTimer from '@/components/CountdownTimer';
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
  ISSUED: { text: 'Delivered', className: 'bg-emerald-50 text-emerald-600' },
  FAILED: { text: 'Failed', className: 'bg-rose-50 text-rose-500' },
};

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

// 캠페인마다 리워드 통화가 다를 수 있어서(GBP/JPY/USD...) 개별 내역은 실제
// 통화 그대로 표기한다. 상단 "누적 획득 리워드" 총액만 lib/exchangeRates
// 기본 환율로 USD 환산해서 하나로 합친다(/api/participants/:id/wallet).
function formatAmount(amount: number, currency: string | null): string {
  return `${currency ?? ''} ${amount.toLocaleString()}`.trim();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MyPage() {
  const [participant, setParticipant] = useState<{ id: string; email: string } | null>(null);
  const [predictions, setPredictions] = useState<PredictionRow[] | null>(null);
  const [productMap, setProductMap] = useState<Record<string, ProductInfo>>({});
  const [walletBalanceUSD, setWalletBalanceUSD] = useState(0);
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
          fetch(`/api/participants/${data.participant.id}/wallet`)
            .then((r) => r.json())
            .then((wallet) => setWalletBalanceUSD(wallet.balanceUSD ?? 0));
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

  const livePicks = useMemo(() => (predictions ?? []).filter((p) => !p.isResolved), [predictions]);
  const entryHistory = useMemo(() => (predictions ?? []).filter((p) => p.isResolved), [predictions]);
  const winCount = useMemo(() => entryHistory.filter((p) => p.isWinner).length, [entryHistory]);
  const hitRate = entryHistory.length > 0 ? Math.round((winCount / entryHistory.length) * 100) : 0;

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
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pb-8">
      <div className="mb-[22px] flex items-center gap-3.5 pt-6">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gray-100 text-xl">👤</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[20px] font-extrabold leading-[1.25] tracking-[-0.3px] text-ink">
            {participant.email.split('@')[0]}
          </div>
          <div className="mt-[3px] truncate text-[12.5px] font-medium text-[#8B9199]">{participant.email}</div>
        </div>
      </div>

      <div className="mb-3 rounded-[28px] bg-ink px-[22px] py-6 text-white">
        <div className="mb-2.5 text-[12.5px] font-semibold opacity-60">Total rewards earned</div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-[42px] font-extrabold leading-none tracking-[-1.5px]">{formatUsd(walletBalanceUSD)}</span>
        </div>
        <div className="mt-2 text-[11.5px] font-medium opacity-45">
          Balance you can spend in the Store (converted to USD at the base rate)
        </div>
        <Link
          href="/store"
          className="mt-[18px] block w-full rounded-2xl bg-accent py-[15px] text-center text-[15px] font-extrabold text-[#052F3B]"
        >
          Spend in the Store
        </Link>
      </div>

      {amountClaims.length > 0 && (
        <div className="mb-3 rounded-xl border border-gray-200 divide-y divide-gray-100">
          {amountClaims.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2.5">
              <div>
                <p className="text-sm text-gray-800">{p.campaign.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.claimOrder.created_at)}</p>
              </div>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {formatAmount(p.claimOrder.payout_amount ?? 0, p.claimOrder.payout_currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-[26px] flex gap-2.5">
        {[
          { v: String(entryHistory.length), k: 'Results' },
          { v: String(winCount), k: 'Wins' },
          { v: `${hitRate}%`, k: 'Hit rate' },
        ].map((s) => (
          <div key={s.k} className="flex-1 rounded-[20px] bg-white p-[15px_14px] shadow-[0_2px_10px_rgba(20,22,26,.04)]">
            <div className="text-[20px] font-extrabold tracking-[-0.5px] text-ink">{s.v}</div>
            <div className="mt-1 text-[11.5px] font-semibold text-[#9AA0A8]">{s.k}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px] font-extrabold tracking-[-0.3px] text-ink">Live picks</h2>
        <span className="text-[12.5px] font-bold text-accent-dark">{livePicks.length} open</span>
      </div>
      {livePicks.length === 0 ? (
        <p className="mb-[26px] text-xs text-gray-400">No live picks right now</p>
      ) : (
        <div className="mb-[26px] flex flex-col gap-2.5">
          {livePicks.map((p) => (
            <Link
              key={p.id}
              href={`/campaigns/${p.campaign.id}`}
              className="block rounded-[22px] bg-white p-4 shadow-[0_2px_10px_rgba(20,22,26,.04)]"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="text-[14.5px] font-bold leading-[1.4] text-ink">{p.campaign.title}</div>
                <CountdownTimer endAt={p.campaign.end_at} className="shrink-0 text-[11.5px] text-danger" />
              </div>
              <div className="mt-1.5 text-[12.5px] text-[#8B9199]">
                Your pick ·{' '}
                <span className="font-bold text-accent-dark">
                  {p.campaign.options.find((o) => o.id === p.selected_option)?.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px] font-extrabold tracking-[-0.3px] text-ink">Results</h2>
        {entryHistory.length > 0 && (
          <span className="text-[12.5px] font-semibold text-[#9AA0A8]">
            {winCount} won · {entryHistory.length - winCount} lost
          </span>
        )}
      </div>
      <p className="-mt-1.5 mb-3 text-[11.5px] text-[#9AA0A8]">Campaigns that have closed and announced a winner</p>
      {entryHistory.length === 0 ? (
        <p className="mb-[26px] text-xs text-gray-400">No results yet — check back once a campaign closes</p>
      ) : (
        <div className="mb-[26px] rounded-[22px] bg-white p-1.5 shadow-[0_2px_10px_rgba(20,22,26,.04)]">
          {entryHistory.map((p) => {
            // 당첨됐는데 아직 리워드를 안 받은(claimOrder 없는) 경우엔 캠페인
            // 상세로 보내는 대신 클레임 플로우로 바로 이어준다 — 안 그러면
            // "Win" 뱃지만 뜨고 실제로 리워드를 받으러 갈 방법이 없었다.
            const needsClaim = p.isWinner && !p.claimOrder;
            const label = p.isWinner
              ? needsClaim
                ? { text: 'Claim reward →', className: 'bg-accent text-white' }
                : { text: 'Win', className: 'bg-amber-100 text-amber-700' }
              : { text: 'Lose', className: 'bg-gray-100 text-gray-400' };
            return (
              <Link
                key={p.id}
                href={needsClaim ? `/claim/${p.id}` : `/campaigns/${p.campaign.id}`}
                className="flex items-center gap-3 rounded-2xl px-[15px] py-3.5 active:bg-gray-50 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{p.campaign.title}</div>
                  <div className="mt-1 text-xs font-medium text-[#9AA0A8]">
                    {p.campaign.options.find((o) => o.id === p.selected_option)?.label} · {formatDate(p.campaign.end_at)}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold ${label.className}`}>
                  {label.text}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 text-[17px] font-extrabold tracking-[-0.3px] text-ink">My items</h2>
      {productClaims.length === 0 ? (
        <div className="rounded-[22px] border-[1.5px] border-dashed border-[#DFE2E6] px-5 py-7 text-center">
          <div className="text-sm font-bold text-[#6B7280]">No items yet</div>
          <div className="mt-1.5 text-[12.5px] leading-[1.6] text-[#9AA0A8]">
            Win a prediction and your gift cards will pile up here
          </div>
        </div>
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
                  <p className="text-sm font-medium text-gray-800 truncate">{info?.name ?? 'Checking product info'}</p>
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
    </div>
  );
}
