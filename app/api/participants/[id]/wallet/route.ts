import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { toUSD } from "@/lib/exchangeRates";

export const dynamic = "force-dynamic";

// 인앱 스토어: 참가자의 지갑 잔액. wallet_transactions은 원래 통화(적립 당시
// 라운드의 credit_currency) 그대로 기록해서 "무엇을 얼마나 땄는지"는 정확히
// 남기지만, 실제로 쓸 수 있는 잔액은 lib/exchangeRates의 기본 환율로 전부
// USD 환산해서 하나로 합친다 — 그래야 원화로 딴 적립금으로 엔화 상품을 사는
// 것처럼 통화를 넘나드는 결제가 가능하다(실시간 환율이 아니라 근사치).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("amount, currency")
    .eq("participant_id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byCurrency: Record<string, number> = {};
  let balanceUSD = 0;
  for (const t of data ?? []) {
    const amount = Number(t.amount);
    byCurrency[t.currency] = Math.round(((byCurrency[t.currency] ?? 0) + amount) * 100) / 100;
    balanceUSD += toUSD(amount, t.currency);
  }
  balanceUSD = Math.round(balanceUSD * 100) / 100;

  return NextResponse.json({ balanceUSD, byCurrency });
}
