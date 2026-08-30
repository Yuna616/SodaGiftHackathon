// 소다기프트 Biz API를 호출하는 유일한 모듈.
// 규칙(docs/stack.md): SODA_API_KEY는 이 파일 밖에서 절대 import하지 않는다.
// 다른 곳에서 소다기프트를 호출하고 싶으면 반드시 이 모듈의 함수를 거친다.
//
// 응답은 그대로 흘려보내지 않고 zod로 검증한 뒤 우리 타입으로 매핑해서 반환한다
// (외부 API 스펙 변경에 대한 방어막).

import { z } from "zod";
import { createHash } from "node:crypto";

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
// 응답 필드는 샌드박스 실호출로 확인함(2026-08-29). 카탈로그 UI에 필요한 필드만 추림.

const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  name_ko: z.string().nullable().optional(),
  country_code: z.string().nullable(),
  // 고정가 상품은 amount, 금액 범위 선택형 상품(예: 가변 금액권)은 amount가 null이고
  // min_amount/max_amount로 대신 표시됨 — 둘 다 실호출로 확인함(2026-08-29)
  amount: z.number().nullable(),
  min_amount: z.number().nullable().optional(),
  max_amount: z.number().nullable().optional(),
  currency: z.string(),
  image_url: z.string().nullable(),
  availability: z.string(), // 예: "ON_SALE"
  // 소다기프트 category(브랜드 카테고리)는 460개 상품이 7개로만 갈려서 UX상 너무 세분화됨.
  // 카탈로그 화면 분류는 category 대신 type으로 한다 (GIFT_CARD/DIGITAL_VOUCHER/MERCHANDISE,
  // 실호출로 확인함 2026-08-29).
  type: z.string(),
  category: z.object({
    id: z.number(),
    name: z.string(),
  }),
});
export type SodaProduct = z.infer<typeof productSchema>;

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  GIFT_CARD: "디지털 기프트 카드",
  DIGITAL_VOUCHER: "디지털 바우처",
  MERCHANDISE: "실물상품",
};

export async function listProducts(): Promise<SodaProduct[]> {
  const raw = await sodaFetch<{ products: unknown[] }>("/v1/products");
  return raw.products.map((item) => productSchema.parse(item));
}

// 예산 계산 등에서 쓸 대표 단가. 고정가면 amount, 가변가면 min/max 평균, 둘 다
// 없으면 null(예산 계산 대상에서 제외해야 함을 의미).
export function representativePrice(p: SodaProduct): number | null {
  if (p.amount !== null) return p.amount;
  if (p.min_amount !== null && p.min_amount !== undefined && p.max_amount !== null && p.max_amount !== undefined) {
    return (p.min_amount + p.max_amount) / 2;
  }
  return null;
}

// ── GET /v1/accounts/balance ────────────────────────────────
// FR-2: 예산 게이트 — 발행 API 호출 시점에 서버에서 최종 재검증
// 응답 필드는 샌드박스 실호출로 확인함(2026-08-29): { amount, currency, payment_method }

const balanceSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  payment_method: z.string(),
});
export type SodaBalance = z.infer<typeof balanceSchema>;

export async function getBalance(): Promise<SodaBalance> {
  const raw = await sodaFetch<unknown>("/v1/accounts/balance");
  return balanceSchema.parse(raw);
}

// ── external_reference_id 생성 ──────────────────────────────
// FR-6: 지급 실패 재시도 시에도 동일한 값으로 재호출해 중복지급 방지.
// 실호출로 확인함(2026-08-29): 영숫자만 허용(하이픈·언더스코어 불가), 길이 1~100자.
// UUID 세 개(campaign/round/participant)를 하이픈만 제거해 이어붙이면 104자로
// 100자 제한을 넘어서 400이 남 — 그래서 SHA-256 해시로 줄인다(sp + 64 hex = 66자).
//
// round_id를 반드시 포함해야 한다 — campaign_id+participant_id만 쓰면 같은 참가자가
// 같은 캠페인의 다른 라운드에서 또 당첨될 때 값이 겹쳐서 reward_claims의
// external_reference_id UNIQUE 제약(FR-6, 0001_init.sql)에 걸린다.
export function buildExternalReferenceId(
  campaignId: string,
  roundId: string,
  participantId: string
): string {
  const hash = createHash("sha256").update(`${campaignId}:${roundId}:${participantId}`).digest("hex");
  return `sp${hash}`;
}

// ── POST /v1/orders ─────────────────────────────────────────
// 응답 필드는 샌드박스 실호출로 확인함(2026-08-29).
// 가변 금액권(representativePrice가 min/max인 상품)은 item.custom_amount(스네이크케이스,
// 상품 통화 기준 금액)를 함께 보내야 한다 — 크레딧 배당 지급에 사용.

const createOrderInputSchema = z.object({
  productId: z.union([z.string(), z.number()]),
  customAmount: z.number().positive().optional(), // 가변 금액권 전용
  delivery: z.object({
    method: z.literal("EMAIL"),
    recipient: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  }),
  message: z.string().optional(),
  externalReferenceId: z.string().regex(/^[a-zA-Z0-9]+$/, "external_reference_id는 영숫자만 허용됩니다"),
});
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

const createOrderResponseSchema = z.object({
  id: z.number(),
  status: z.string(), // "COMPLETED" 등
  order_item: z.object({
    id: z.number(),
    status: z.string(),
  }),
  total_price_charged: z.object({ amount: z.number(), currency: z.string() }),
  external_reference_id: z.string(),
});

const getOrderResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
  external_reference_id: z.string(),
  total_price_charged: z.object({ amount: z.number(), currency: z.string() }),
  // GET 응답은 POST와 달리 order_items가 배열이다 (실호출로 확인함)
  order_items: z.array(
    z.object({
      id: z.number(),
      status: z.string(),
      delivery: z
        .object({
          link: z.string().nullable().optional(),
        })
        .passthrough()
        .optional(),
    })
  ),
});

// createOrder/getOrderStatus 둘 다 이 정규화된 형태로 반환한다 — POST/GET 응답 구조가
// 서로 달라서(order_item 단수 vs order_items 배열) 호출부는 이걸로 통일해서 쓰면 된다.
export type SodaOrder = {
  id: number;
  status: string;
  orderItemId: number;
  orderItemStatus: string;
  totalCharged: { amount: number; currency: string };
  claimLink?: string | null;
};

export async function createOrder(input: CreateOrderInput): Promise<SodaOrder> {
  const parsed = createOrderInputSchema.parse(input);
  const raw = await sodaFetch<unknown>("/v1/orders", {
    method: "POST",
    body: JSON.stringify({
      item: {
        id: parsed.productId,
        ...(parsed.customAmount !== undefined ? { custom_amount: parsed.customAmount } : {}),
      },
      delivery: {
        method: parsed.delivery.method,
        recipient: parsed.delivery.recipient,
        sender: { name: "SodaPick" },
      },
      message: parsed.message,
      external_reference_id: parsed.externalReferenceId,
    }),
  });
  const order = createOrderResponseSchema.parse(raw);
  return {
    id: order.id,
    status: order.status,
    orderItemId: order.order_item.id,
    orderItemStatus: order.order_item.status,
    totalCharged: order.total_price_charged,
  };
}

// ── GET /v1/orders/{id} ─────────────────────────────────────
// 지급 상태 확인용, 서버가 짧은 간격으로 폴링 후 완료되면 중단

export async function getOrderStatus(orderId: number): Promise<SodaOrder> {
  const raw = await sodaFetch<unknown>(`/v1/orders/${orderId}`);
  const order = getOrderResponseSchema.parse(raw);
  const item = order.order_items[0];
  return {
    id: order.id,
    status: order.status,
    orderItemId: item?.id ?? 0,
    orderItemStatus: item?.status ?? order.status,
    totalCharged: order.total_price_charged,
    claimLink: item?.delivery?.link ?? null,
  };
}
