import type { SupabaseClient } from "@supabase/supabase-js";
import { getBalance, listProducts, representativePrice } from "@/lib/soda/client";

// FR-2 예산 게이트 계산 로직. budget-check 라우트와 publish 라우트(서버 재검증) 둘 다에서 쓴다.
// 클라이언트단 검증에 의존하지 않는다는 PRD 9절 원칙 때문에 publish에서도 동일 로직을 다시 돈다.
//
// reward_mode별로 계산 방식이 다르다:
// - PRODUCT: 예상 당첨자 수(스폰서 입력) × 카탈로그 평균 단가 — "추정치"
// - CREDIT: 라운드에 건 고정 풀 금액 그대로 — 당첨자가 몇 명이든 지출액이 고정이라 "추정"이 아니라 확정값
//
// 알려진 한계(TODO): credit_currency가 계정 잔액 통화(USD)와 다를 수 있는데(예: 소다기프트
// 샌드박스엔 USD 가변금액 상품권이 없어 SGD/GBP만 존재), 실시간 환율 조회 API가 없어서 지금은
// 통화가 달라도 액면가를 그대로 더한다 — 참고용 추정치이고, 실제 차감액은 주문 시점 환율로 결정됨.
export async function computeBudgetCheck(supabase: SupabaseClient, campaignId: string) {
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("reward_mode, expected_winner_count, credit_pool_amount, credit_currency")
    .eq("campaign_id", campaignId);
  if (roundsError) throw new Error(roundsError.message);

  const productRounds = (rounds ?? []).filter((r) => r.reward_mode === "PRODUCT");
  const creditRounds = (rounds ?? []).filter((r) => r.reward_mode === "CREDIT");

  const { data: catalogItems, error: catalogError } = await supabase
    .from("campaign_catalog_items")
    .select("product_id")
    .eq("campaign_id", campaignId);
  if (catalogError) throw new Error(catalogError.message);

  const expectedWinnerTotal = productRounds.reduce(
    (sum: number, r: { expected_winner_count: number | null }) => sum + (r.expected_winner_count ?? 0),
    0
  );

  const products = await listProducts();
  const selectedIds = new Set((catalogItems ?? []).map((c: { product_id: string }) => c.product_id));
  // representativePrice가 null인(고정가/범위가 둘 다 없는) 상품은 예산 계산에서 제외
  const prices = products
    .filter((p) => selectedIds.has(String(p.id)))
    .map(representativePrice)
    .filter((v): v is number => v !== null);
  const avgRewardValue = prices.length > 0 ? prices.reduce((sum, v) => sum + v, 0) / prices.length : 0;

  const productModeTotal = expectedWinnerTotal * avgRewardValue;
  const creditModeTotal = creditRounds.reduce(
    (sum: number, r: { credit_pool_amount: number | null }) => sum + (r.credit_pool_amount ?? 0),
    0
  );
  const creditCurrencies = Array.from(new Set(creditRounds.map((r) => r.credit_currency).filter(Boolean)));

  const balance = await getBalance();
  const currencyMismatch = creditCurrencies.some((c) => c !== balance.currency);

  const estimatedTotal = productModeTotal + creditModeTotal;

  return {
    expected_winner_count_total: expectedWinnerTotal,
    avg_reward_value: avgRewardValue,
    product_mode_total: productModeTotal,
    credit_mode_total: creditModeTotal,
    credit_currencies: creditCurrencies,
    currency_mismatch: currencyMismatch,
    estimated_total: estimatedTotal,
    balance: balance.amount,
    currency: balance.currency,
    sufficient: balance.amount >= estimatedTotal,
  };
}
