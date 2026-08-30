import { NextRequest, NextResponse } from "next/server";
import { listProducts } from "@/lib/soda/client";

export const dynamic = "force-dynamic";

// 참가자 앱 클레임 2단계에서 "방금 품절됐는지" 재확인용.
// 소다기프트엔 상품 단건 조회 API가 따로 없어서 전체 목록에서 찾는다.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const products = await listProducts();
    const product = products.find((p) => String(p.id) === params.id);
    if (!product) {
      return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ status: product.availability });
  } catch (err) {
    return NextResponse.json(
      { error: `소다기프트 카탈로그 조회 실패: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
