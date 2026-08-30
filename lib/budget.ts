import type { SupabaseClient } from "@supabase/supabase-js";
import { getBalance, listProducts, representativePrice } from "@/lib/soda/client";

// FR-2 예산 게이트 계산 로직. budget-check 라우트와 publish 라우트(서버 재검증) 둘 다에서 쓴다.
// 클라이언트단 검증에 의존하지 않는다는 PRD 9절 원칙 때문에 publish에서도 동일 로직을 다시 돈다.
//
// reward_mode별로 계산 방식이 다르다:
// - PRODUCT: 예상 당첨자 수(스폰서 입력) × 카탈로그 평균 단가 — "추정치"
// - CREDIT: 라운드에 건 고정 풀 금액 그대로 — 당첨자가 몇 명이든 지출액이 고정이라 "추정"이 아니라 확정값
//
// 알려진 한계(TODO): 카탈로그 상품 통화(예: KRW)나 credit_currency(예: SGD/GBP)가
// 계정 잔액 통화(USD)와 다를 수 있는데, 실시간 환율 조회 API가 없어서 지금은 통화가
// 달라도 액면가를 그대로 더한다 — currency_mismatch가 true면 sufficient 판정이
// 부정확할 수 있다는 뜻(예: KRW 35000을 USD 35000처럼 취급해 실제론 발행 가능한
// 캠페인을 예산 부족으로 잘못 막을 수 있음). 참고용 추정치이고, 실제 차감액은
// 주문 시점 환율로 결정됨.
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
  const selectedProducts = products.filter((p) => selectedIds.has(String(p.id)));
  // representativePrice가 null인(고정가/범위가 둘 다 없는) 상품은 예산 계산에서 제외
  const prices = selectedProducts.map(representativePrice).filter((v): v is number => v !== null);
  const avgRewardValue = prices.length > 0 ? prices.reduce((sum, v) => sum + v, 0) / prices.length : 0;
  const catalogCurrencies = Array.from(new Set(selectedProducts.map((p) => p.currency)));

  const productModeTotal = expectedWinnerTotal * avgRewardValue;
  const creditModeTotal = creditRounds.reduce(
    (sum: number, r: { credit_pool_amount: number | null }) => sum + (r.credit_pool_amount ?? 0),
    0
  );
  const creditCurrencies = Array.from(new Set(creditRounds.map((r) => r.credit_currency).filter(Boolean)));

  const balance = await getBalance();
  // PRODUCT 카탈로그 통화든 CREDIT 통화든, 잔액 통화(보통 USD)와 하나라도 다르면
  // 아래 sufficient 판정은 액면가끼리 비교한 부정확한 추정치다.
  const currencyMismatch =
    catalogCurrencies.some((c) => c !== balance.currency) || creditCurrencies.some((c) => c !== balance.currency);

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
