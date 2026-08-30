import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// 라운드를 closed_pending_resolution으로 전환한다.
// 실서비스에서는 closes_at 지나면 스케줄러가 자동 전환하겠지만(architecture.md 3절
// 상태머신), 스케줄러가 아직 없어서 해커톤 데모용으로 스폰서가 수동 전환하는
// 경로를 열어둔다. resolved 이후로는 전환 자체가 불가(상태 역행 방지).

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("status")
    .eq("id", params.id)
    .single();
  if (roundError || !round) {
    return NextResponse.json({ error: "라운드를 찾을 수 없습니다" }, { status: 404 });
  }
  if (round.status !== "upcoming" && round.status !== "open") {
    return NextResponse.json({ error: "upcoming/open 상태에서만 마감할 수 있습니다" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rounds")
    .update({ status: "closed_pending_resolution" })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ round: data });
}
