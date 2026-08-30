import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// 해커톤 데모용 간이 관리자 판정 화면 뒤에서, 실제로는 스폰서 콘솔이 이미 쓰고 있는
// /api/rounds/[id]/close, /api/rounds/[id]/resolve를 그대로 호출한다 — 판정 로직을
// 두 곳에 따로 두면 FR-5(판정 불변성) 같은 규칙이 갈라질 위험이 있어서다.
//
// 팀원 원본은 정답 옵션을 여러 개(winningOptionIds) 고를 수 있었는데, 스폰서 쪽
// 라운드 설계가 4지선다 중 정답 하나만 지원해서(0001_init.sql) 단일 선택으로 맞췄다.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { campaignId, winningOptionIds } = (body ?? {}) as {
    campaignId?: string;
    winningOptionIds?: string[];
  };
  const winningOptionId = winningOptionIds?.[0];
  if (!campaignId || !winningOptionId) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: campaign } = await supabase.from("campaigns").select("sponsor_id").eq("id", campaignId).single();
  if (!campaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }
  const { data: round } = await supabase
    .from("rounds")
    .select("id, status")
    .eq("campaign_id", campaignId)
    .eq("round_number", 1)
    .maybeSingle();
  if (!round) {
    return NextResponse.json({ error: "ROUND_NOT_FOUND" }, { status: 404 });
  }

  const origin = req.nextUrl.origin;

  if (round.status === "upcoming" || round.status === "open") {
    const closeRes = await fetch(`${origin}/api/rounds/${round.id}/close`, { method: "POST" });
    if (!closeRes.ok) {
      const err = await closeRes.json().catch(() => ({}));
      return NextResponse.json({ error: err.error ?? "라운드 마감 실패" }, { status: closeRes.status });
    }
  }

  const resolveRes = await fetch(`${origin}/api/rounds/${round.id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      correct_option_index: Number(winningOptionId),
      resolved_by: campaign.sponsor_id,
    }),
  });
  const resolveData = await resolveRes.json();
  if (!resolveRes.ok) {
    return NextResponse.json({ error: resolveData.error ?? "판정 확정 실패" }, { status: resolveRes.status });
  }

  const { data: winners } = await supabase
    .from("reward_claims")
    .select("participant_id")
    .eq("round_id", round.id);
  for (const w of winners ?? []) {
    // 실제 이메일/푸시 발송 대신 데모용 로그. 당첨 사실은 /my 인앱 배너로 노출.
    await recordEvent("result_notified", { participantId: w.participant_id, campaignId });
  }

  return NextResponse.json({ ok: true, winnerCount: winners?.length ?? 0 });
}
