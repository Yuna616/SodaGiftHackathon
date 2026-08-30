import { NextResponse } from "next/server";
import { listProducts, type SodaProduct } from "@/lib/soda/client";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// architecture.md 5절: GET /v1/products 캐시(TTL 5분) 프록시
// 프로세스 메모리 캐시라서 서버리스 인스턴스가 재생성되면 다시 채워진다 — 해커톤 스코프엔 충분

let cache: { data: SodaProduct[]; expiresAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ products: cache.data });
  }

  try {
    const products = await listProducts();
    cache = { data: products, expiresAt: Date.now() + TTL_MS };
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json(
      { error: `소다기프트 카탈로그 조회 실패: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
