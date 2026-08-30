// 참가자 앱(클레임/선물하기)에서 쓰는 상품 표시 어댑터.
// `/api/products`는 스폰서 카탈로그 화면(원본 SodaProduct 형태 그대로 씀)과
// 공유하는 라우트라 응답을 못 바꾼다 — 대신 참가자 쪽 컴포넌트(ProductCard 등)가
// 기대하는 단순한 Product 모양으로 클라이언트에서 변환한다.
//
// 클라이언트 컴포넌트에서 써도 안전하다 — SodaProduct는 타입만 가져온다(런타임 코드 없음).

import type { SodaProduct } from "@/lib/soda/client";
import type { Product } from "@/lib/types";

function toDisplayProduct(p: SodaProduct): Product {
  return {
    id: String(p.id),
    name: p.name_ko ?? p.name,
    brand: p.brand?.name ?? p.category.name,
    price: p.amount ?? 0,
    country_code: p.country_code ?? "KR",
    stock_status: p.availability === "ON_SALE" ? "ON_SALE" : "DISCONTINUED",
    image_url: p.image_url,
  };
}

// 참가자 화면(클레임/선물하기)은 고정가 상품만 다룬다 — 가변 금액권은 금액을
// 직접 입력해야 해서 이 단순 목록형 UI에 안 맞는다(크레딧 배당 라운드 전용 플로우).
export function toDisplayProducts(products: SodaProduct[]): Product[] {
  return products.filter((p) => p.amount !== null).map(toDisplayProduct);
}

// CREDIT 모드 클레임 전용 — 지정된 통화의 가변금액 상품권 목록(브랜드 선택용).
export interface VariableAmountOption {
  id: string;
  name: string;
  brand: string;
  currency: string;
  image_url: string | null;
}

export function toVariableAmountOptions(products: SodaProduct[], currency: string): VariableAmountOption[] {
  return products
    .filter((p) => p.amount === null && p.min_amount != null && p.max_amount != null && p.currency === currency)
    .map((p) => ({
      id: String(p.id),
      name: p.name_ko ?? p.name,
      brand: p.brand?.name ?? p.category.name,
      currency: p.currency,
      image_url: p.image_url,
    }));
}
