// 소다기프트 API엔 실시간 환율 조회 엔드포인트가 없다(docs/SodaPick_고객사앱_PRD.md
// 12절에도 "실서비스에서는 환율 조회 API 연동 필요"로 남겨둔 알려진 한계).
// 대신 여기 정적인 기본 환율표를 하나 두고, 인앱 스토어에서 참가자가 원화/엔화/
// 달러 등 서로 다른 통화로 쌓인 적립금을 하나의 지갑(USD 환산 기준)으로 합쳐서
// 통화 상관없이 결제할 수 있게 한다. 실시간 시세가 아니라 데모/스토어 교환용
// 근사치라는 점을 감안해야 한다 — 실제 정산/회계에는 쓰면 안 된다.

// 1 USD ≈ 이 숫자만큼의 해당 통화 (2026-08 기준 대략적인 값)
const RATES_PER_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  KRW: 1380,
  JPY: 149,
  CNY: 7.1,
  HKD: 7.8,
  SGD: 1.34,
  CAD: 1.36,
  AUD: 1.52,
  PHP: 56,
  VND: 24500,
  IDR: 15600,
  TWD: 31.5,
};

// 환율표에 없는 통화는 1:1로 취급한다(모르는 통화를 임의로 왜곡하는 것보다는
// 액면가 그대로 두는 쪽이 덜 위험하다 — 대신 호출부에서 필요하면 경고할 것).
export function toUSD(amount: number, currency: string): number {
  const rate = RATES_PER_USD[currency] ?? 1;
  return amount / rate;
}

export function fromUSD(amountUSD: number, currency: string): number {
  const rate = RATES_PER_USD[currency] ?? 1;
  return amountUSD * rate;
}

export function hasRate(currency: string): boolean {
  return currency in RATES_PER_USD;
}
