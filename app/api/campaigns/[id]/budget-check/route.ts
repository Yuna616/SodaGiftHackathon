import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { computeBudgetCheck } from "@/lib/budget";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// FR-2: 캠페인 발행은 예산 게이트를 통과해야만 가능하다
// PRD 5.5: 현재 잔액 vs (라운드별 예상 당첨자 수 합계 × 카탈로그 평균 단가)
// 캐시 없이 진입할 때마다 실시간 계산 (PRD 9절 비기능 요구사항)

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();
  try {
    const result = await computeBudgetCheck(supabase, params.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
