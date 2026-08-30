import type { SupabaseClient } from "@supabase/supabase-js";
import { getBalance, listProducts, representativePrice } from "@/lib/soda/client";

// FR-2 예산 게이트 계산 로직. budget-check 라우트와 publish 라우트(서버 재검증) 둘 다에서 쓴다.
// 클라이언트단 검증에 의존하지 않는다는 PRD 9절 원칙 때문에 publish에서도 동일 로직을 다시 돈다.
//
// reward_mode별로 계산 방식이 다르다:
// - PRODUCT: 예상 당첨자 수(스폰서 입력) × 카탈로그 평균 단가 — "추정치"
// - CREDIT: 라운드에 건 고정 풀 금액 그대로 — 당첨자가 몇 명이든 지출액이 고정이라 "추정"이 아니라 확정값
//
// 알려진 한계(TODO): credit_currency(예: SGD/GBP)가 계정 잔액 통화(USD)와 다를 수
// 있는데, 실시간 환율 조회 API가 없어서 지금은 통화가 달라도 액면가를 그대로
// 더한다 — currency_mismatch가 true면 sufficient 판정이 부정확할 수 있다는 뜻
// (예: SGD 100을 USD 100처럼 취급). 참고용 추정치이고, 실제 차감액은 주문
// 시점 환율로 결정됨.
//
// PRODUCT 카탈로그 평균 단가는 잔액 통화와 다른 상품을 아예 평균 계산에서
// 빼서(아래 sameCurrencyProducts) 서로 다른 통화 액면가가 섞여 의미 없는
// 값이 나오는 걸 막는다. 마법사 카탈로그 선택기도 잔액 통화 상품만 보여준다.
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

  const balance = await getBalance();

  const products = await listProducts();
  const selectedIds = new Set((catalogItems ?? []).map((c: { product_id: string }) => c.product_id));
  const selectedProducts = products.filter((p) => selectedIds.has(String(p.id)));
  const catalogCurrencies = Array.from(new Set(selectedProducts.map((p) => p.currency)));

  // 평균 단가는 잔액 통화와 같은 상품만으로 계산한다. 서로 다른 통화의 액면가를
  // 그대로 더해서 평균을 내면 숫자 자체가 의미 없어진다 — 예: 30,000원짜리와
  // $20짜리를 섞어 평균 내면 15,010이라는, KRW도 USD도 아닌 값이 나온다.
  // 마법사 카탈로그 선택기가 이제 잔액 통화 상품만 보여주긴 하지만, 그 전에
  // 만들어진 캠페인 데이터를 위해 여기서도 한 번 더 걸러낸다.
  // representativePrice가 null인(고정가/범위가 둘 다 없는) 상품도 계산에서 제외.
  const sameCurrencyProducts = selectedProducts.filter((p) => p.currency === balance.currency);
  const prices = sameCurrencyProducts.map(representativePrice).filter((v): v is number => v !== null);
  const avgRewardValue = prices.length > 0 ? prices.reduce((sum, v) => sum + v, 0) / prices.length : 0;

  const productModeTotal = expectedWinnerTotal * avgRewardValue;
  const creditModeTotal = creditRounds.reduce(
    (sum: number, r: { credit_pool_amount: number | null }) => sum + (r.credit_pool_amount ?? 0),
    0
  );
  const creditCurrencies = Array.from(new Set(creditRounds.map((r) => r.credit_currency).filter(Boolean)));

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
