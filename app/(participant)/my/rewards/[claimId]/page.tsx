'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { SodaProduct } from '@/lib/soda/client';
import type { PublicCampaign } from '@/lib/types';

interface RawClaim {
  id: string;
  campaign_id: string;
  status: 'eligible' | 'product_selected' | 'order_placed' | 'fulfilled' | 'failed';
  selected_product_id: string | null;
  external_reference_id: string;
  soda_order_id: string | null;
  payout_amount: number | null;
  payout_currency: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<RawClaim['status'], string> = {
  eligible: '대기중',
  product_selected: '상품 선택됨',
  order_placed: '주문 완료',
  fulfilled: '지급 완료',
  failed: '실패',
};

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RewardDetailPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const router = useRouter();

  const [claim, setClaim] = useState<RawClaim | null>(null);
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [product, setProduct] = useState<{ name: string; brand: string; image_url: string | null } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!claimId) return;
    fetch(`/api/claims/${claimId}/status`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.claim) {
          setNotFound(true);
          return;
        }
        setClaim(data.claim);
        fetch(`/api/campaigns/${data.claim.campaign_id}`)
          .then((r) => r.json())
          .then((c) => setCampaign(c.campaign ?? null))
          .catch(() => {});
        if (data.claim.selected_product_id) {
          fetch('/api/products')
            .then((r) => r.json())
            .then((p) => {
              const found = (p.products ?? []).find(
                (item: SodaProduct) => String(item.id) === data.claim.selected_product_id
              );
              if (found) {
                setProduct({
                  name: found.name_ko ?? found.name,
                  brand: found.brand?.name ?? found.category.name,
                  image_url: found.image_url,
                });
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setNotFound(true));
  }, [claimId]);

  if (notFound) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-400 mb-4">리워드 정보를 찾을 수 없어요</p>
        <button onClick={() => router.push('/my')} className="text-sm text-soda-600 font-semibold underline">
          마이페이지로
        </button>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-4">
        <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  const hasHistoryStep = claim.updated_at !== claim.created_at;

  return (
    <div className="p-4">
      <button onClick={() => router.push('/my')} className="text-sm text-gray-400 mb-4">
        ← 마이페이지
      </button>

      <div className="rounded-2xl border border-gray-200 p-4 mb-5">
        <div className="flex items-center gap-3 mb-4">
          {product?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-xl bg-gray-100" />
          )}
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate">{product?.name ?? '상품 정보 확인 중'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{product?.brand ?? campaign?.title}</p>
          </div>
        </div>

        {claim.payout_amount != null && (
          <p className="text-2xl font-extrabold text-gray-900 mb-3">{formatUsd(claim.payout_amount)}</p>
        )}

        <span
          className={`inline-block text-xs font-semibold rounded-full px-2.5 py-1 ${
            claim.status === 'fulfilled' || claim.status === 'order_placed'
              ? 'bg-emerald-50 text-emerald-600'
              : claim.status === 'failed'
                ? 'bg-rose-50 text-rose-500'
                : 'bg-gray-100 text-gray-500'
          }`}
        >
          {STATUS_LABEL[claim.status]}
        </span>
      </div>

      {campaign && (
        <div className="rounded-xl bg-gray-50 p-3 mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-1">획득한 이벤트</p>
          <p className="text-sm text-gray-800">{campaign.title}</p>
        </div>
      )}

      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 mb-2">히스토리</p>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="h-2 w-2 rounded-full bg-soda-500" />
              {hasHistoryStep && <span className="w-px flex-1 bg-gray-200 mt-1" />}
            </div>
            <div className="pb-3">
              <p className="text-sm text-gray-800">리워드 확정</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(claim.created_at)}</p>
            </div>
          </div>
          {hasHistoryStep && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-2 w-2 rounded-full bg-soda-500" />
              </div>
              <div>
                <p className="text-sm text-gray-800">{STATUS_LABEL[claim.status]}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(claim.updated_at)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 p-3 text-[11px] text-gray-400 space-y-1 break-all">
        <p>참조번호 {claim.external_reference_id}</p>
        {claim.soda_order_id && <p>주문번호 {claim.soda_order_id}</p>}
      </div>
    </div>
  );
}
