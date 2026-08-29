// 소다기프트 Biz API를 호출하는 유일한 모듈.
// 규칙(docs/stack.md): SODA_API_KEY는 이 파일 밖에서 절대 import하지 않는다.
// 다른 곳에서 소다기프트를 호출하고 싶으면 반드시 이 모듈의 함수를 거친다.
//
// 응답은 그대로 흘려보내지 않고 zod로 검증한 뒤 우리 타입으로 매핑해서 반환한다
// (외부 API 스펙 변경에 대한 방어막).

import { z } from "zod";

const SODA_API_BASE_URL =
  process.env.SODA_API_BASE_URL ?? "https://biz-sandbox-api.sodagift.com";

function getApiKey(): string {
  const key = process.env.SODA_API_KEY;
  if (!key) {
    throw new Error("SODA_API_KEY가 설정되어 있지 않습니다");
  }
  return key;
}

async function sodaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SODA_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "SODA-API-KEY": getApiKey(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`소다기프트 API 오류 (${res.status} ${path}): ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── GET /v1/products ────────────────────────────────────────
// FR-4(스폰서 앱): 카탈로그 구성 화면에서 사용, /api/products 라우트가 5분 TTL로 캐시

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  country: z.string().optional(),
  imageUrl: z.string().optional(),
});
export type SodaProduct = z.infer<typeof productSchema>;

export async function listProducts(): Promise<SodaProduct[]> {
  const raw = await sodaFetch<{ items: unknown[] }>("/v1/products");
  return raw.items.map((item) => productSchema.parse(item));
}

// ── GET /v1/accounts/balance ────────────────────────────────
// FR-2: 예산 게이트 — 발행 API 호출 시점에 서버에서 최종 재검증

const balanceSchema = z.object({
  balance: z.number(),
  currency: z.string(),
});
export type SodaBalance = z.infer<typeof balanceSchema>;

export async function getBalance(): Promise<SodaBalance> {
  const raw = await sodaFetch<unknown>("/v1/accounts/balance");
  return balanceSchema.parse(raw);
}

// ── POST /v1/orders ─────────────────────────────────────────
// FR-6: 지급 실패 재시도 시에도 동일한 externalReferenceId로 재호출해 중복지급 방지
// TODO: 응답 필드는 샌드박스 실제 호출 결과 보고 orderSchema 확정 필요

const createOrderInputSchema = z.object({
  productId: z.string(),
  delivery: z.object({
    method: z.literal("EMAIL"),
    recipient: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  }),
  message: z.string().optional(),
  externalReferenceId: z.string(),
});
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

const orderSchema = z.object({
  id: z.string(),
  status: z.string(),
});
export type SodaOrder = z.infer<typeof orderSchema>;

export async function createOrder(input: CreateOrderInput): Promise<SodaOrder> {
  const parsed = createOrderInputSchema.parse(input);
  const raw = await sodaFetch<unknown>("/v1/orders", {
    method: "POST",
    body: JSON.stringify({
      item: { id: parsed.productId },
      delivery: {
        method: parsed.delivery.method,
        recipient: parsed.delivery.recipient,
        sender: { name: "SodaPick" },
      },
      message: parsed.message,
      external_reference_id: parsed.externalReferenceId,
    }),
  });
  return orderSchema.parse(raw);
}

// ── GET /v1/orders/{id} ─────────────────────────────────────
// 지급 상태 확인용, 서버가 짧은 간격으로 폴링 후 완료되면 중단

export async function getOrderStatus(orderId: string): Promise<SodaOrder> {
  const raw = await sodaFetch<unknown>(`/v1/orders/${orderId}`);
  return orderSchema.parse(raw);
}
