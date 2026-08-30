'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import { track } from '@/lib/track';
import type { Campaign, Prediction, Product } from '@/lib/types';

export default function ClaimProductSelectPage() {
  const { predictionId } = useParams<{ predictionId: string }>();
  const router = useRouter();

  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!predictionId) return;
    fetch(`/api/predictions/${predictionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setPrediction(data.prediction);
        setCampaign(data.campaign);
        setIsWinner(data.isWinner);
        if (data.claimOrder) {
          router.replace(`/claim/${predictionId}/complete?orderId=${data.claimOrder.id}`);
          return;
        }
        if (data.isWinner) {
          track('claim_started', { participantId: data.participant.id, campaignId: data.campaign.id });
        }
      });
    fetch('/api/products?country_code=KR')
      .then((r) => r.json())
      .then((data) => setProducts(data.products ?? []));
  }, [predictionId, router]);

  async function handleNext() {
    if (!selectedProduct) return;
    setChecking(true);
    setNotice(null);
    const res = await fetch(`/api/products/${selectedProduct}/availability`);
    const data = await res.json();
    setChecking(false);
    if (data.status !== 'ON_SALE') {
      setNotice('앗, 방금 품절된 상품이에요. 다른 상품을 선택해주세요');
      setProducts((prev) =>
        prev.map((p) => (p.id === selectedProduct ? { ...p, stock_status: 'DISCONTINUED' } : p))
      );
      setSelectedProduct(null);
      return;
    }
    router.push(`/claim/${predictionId}/delivery?productId=${selectedProduct}`);
  }

  if (isWinner === false) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-500">이 예측은 당첨 대상이 아니에요</p>
      </div>
    );
  }

  if (!prediction || !campaign) {
    return (
      <div className="p-4">
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-xs text-gray-400 mb-1">1/3 · 상품 선택</p>
      <h1 className="text-lg font-bold text-gray-900 mb-1">축하합니다! 🎉</h1>
      <p className="text-sm text-gray-500 mb-5">
        "{campaign.title}" 예측에 성공하셨어요. 받고 싶은 기프티콘을 골라주세요
      </p>

      {notice && (
        <div className="mb-3 rounded-xl bg-rose-50 text-rose-600 text-xs px-3 py-2">{notice}</div>
      )}

      <div className="flex flex-col gap-2 mb-6">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            selected={selectedProduct === p.id}
            onClick={() => setSelectedProduct(p.id)}
          />
        ))}
      </div>

      <button
        onClick={handleNext}
        disabled={!selectedProduct || checking}
        className="w-full rounded-xl bg-black text-white font-semibold py-3 text-sm disabled:opacity-40"
      >
        {checking ? '재고 확인 중...' : '다음'}
      </button>
    </div>
  );
}
