import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 예측왕 리더보드: 확정된(resolved) 라운드 기준 정답자 수 상위 5명.
// reward_claims가 정답자에게만 생성된다는 점을 그대로 활용 — 별도 승패 계산 없이
// reward_claims 행 수를 세면 된다.
export async function GET() {
  const supabase = createServiceRoleClient();

  const { data: claims } = await supabase.from("reward_claims").select("participant_id");

  const winCountByParticipant = new Map<string, number>();
  for (const c of claims ?? []) {
    winCountByParticipant.set(c.participant_id, (winCountByParticipant.get(c.participant_id) ?? 0) + 1);
  }

  const topIds = [...winCountByParticipant.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const ranking = await Promise.all(
    topIds.map(async ([participantId, wins]) => {
      const { data } = await supabase.from("participants").select("email").eq("id", participantId).maybeSingle();
      const email = data?.email ?? "알 수 없음";
      const masked = email.replace(/^(.{2}).+(@.+)$/, "$1***$2");
      return { participantId, wins, email: masked };
    })
  );

  return NextResponse.json({ ranking });
}
