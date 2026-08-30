import { NextResponse } from "next/server";
import { getBalance } from "@/lib/soda/client";

export const dynamic = "force-dynamic";

// 대시보드 지갑 잔액 요약 카드용 (PRD 5.1)
export async function GET() {
  try {
    const balance = await getBalance();
    return NextResponse.json({ balance: balance.amount, currency: balance.currency });
  } catch (err) {
    return NextResponse.json(
      { error: `소다기프트 잔액 조회 실패: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
