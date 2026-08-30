'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import { track } from '@/lib/track';
import { toDisplayProducts, toVariableAmountOptions, type VariableAmountOption } from '@/lib/products';
import type { PublicCampaign, PublicPrediction, Product } from '@/lib/types';
import type { SodaProduct } from '@/lib/soda/client';

export default function ClaimProductSelectPage() {
  const { predictionId } = useParams<{ predictionId: string }>();
  const router = useRouter();

  const [prediction, setPrediction] = useState<PublicPrediction | null>(null);
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [creditOptions, setCreditOptions] = useState<VariableAmountOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const isCreditMode = campaign?.prize_type === 'amount';

  useEffect(() => {
    if (!predictionId) return;
    fetch(`/api/predictions/${predictionId}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (data.error) return;
        setPrediction(data.prediction);
        setCampaign(data.campaign);
        setIsWinner(data.isWinner);
        if (data.claimOrder) {
          router.replace(`/claim/${predictionId}/complete?orderId=${data.claimOrder.id}`);
          return;
        }
        if (!data.isWinner) return;
        track('claim_started', { participantId: data.participant.id, campaignId: data.campaign.id });

        const productsRes = await fetch('/api/products');
        const productsData = await productsRes.json();
        const allProducts = (productsData.products ?? []) as SodaProduct[];

        if (data.campaign.prize_type === 'amount') {
          setCreditOptions(toVariableAmountOptions(allProducts, data.campaign.prize_currency));
        } else {
          const catalogRes = await fetch(`/api/campaigns/${data.campaign.id}/catalog`);
          const catalogData = await catalogRes.json();
          const allowedIds = new Set((catalogData.items ?? []).map((i: { product_id: string }) => i.product_id));
          setProducts(toDisplayProducts(allProducts).filter((p) => allowedIds.has(p.id)));
        }
      });
  }, [predictionId, router]);

  async function handleNext() {
    if (!selectedProduct) return;
    if (!isCreditMode) {
      setChecking(true);
      setNotice(null);
      const res = await fetch(`/api/products/${selectedProduct}/availability`);
      const data = await res.json();
      setChecking(false);
      if (data.status !== 'ON_SALE') {
        setNotice('Oops, this item just sold out. Please choose another one');
        setProducts((prev) =>
          prev.map((p) => (p.id === selectedProduct ? { ...p, stock_status: 'DISCONTINUED' } : p))
        );
        setSelectedProduct(null);
        return;
      }
    }
    const chosen = isCreditMode
      ? creditOptions.find((o) => o.id === selectedProduct)
      : products.find((p) => p.id === selectedProduct);
    const name = chosen ? ("name" in chosen ? chosen.name : "") : "";
    const brand = chosen ? ("brand" in chosen ? chosen.brand : "") : "";
    router.push(
      `/claim/${predictionId}/delivery?productId=${selectedProduct}&name=${encodeURIComponent(name)}&brand=${encodeURIComponent(brand)}`
    );
  }

  if (isWinner === false) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-500">This prediction isn't eligible for a prize</p>
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
      <p className="text-xs text-gray-400 mb-1">1/3 · Choose a prize</p>
      <h1 className="text-lg font-bold text-gray-900 mb-1">Congratulations! 🎉</h1>
      <p className="text-sm text-gray-500 mb-5">
        Your prediction for &quot;{campaign.title}&quot; was correct.{' '}
        {isCreditMode
          ? `Choose any brand within your ${campaign.prize_currency} budget`
          : 'Choose the gift you\'d like to receive'}
      </p>

      {notice && (
        <div className="mb-3 rounded-xl bg-rose-50 text-rose-600 text-xs px-3 py-2">{notice}</div>
      )}

      <div className="flex flex-col gap-2 mb-6">
        {isCreditMode
          ? creditOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedProduct(o.id)}
                className={`w-full text-left rounded-xl border p-3.5 flex items-center gap-3 transition ${
                  selectedProduct === o.id ? 'border-soda-500 bg-soda-50' : 'border-gray-200 bg-white'
                }`}
              >
                {o.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">{o.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{o.brand}</p>
                </div>
              </button>
            ))
          : products.map((p) => (
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
        {checking ? 'Checking stock...' : 'Next'}
      </button>
    </div>
  );
}
