import { NextRequest, NextResponse } from "next/server";
import { upsertParticipant } from "@/lib/repo";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Google 계정 선택 직후, 예측 제출 전에 participant_id를 미리 확보하기 위한 엔드포인트.
// 미션(사이트 방문) 완료 기록은 participant_id 기준이라, 미션 체크/방문 링크를 만들려면
// 예측을 실제로 제출하기 전에 참가자 레코드가 먼저 있어야 한다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { email } = (body ?? {}) as { email?: string };
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }
  const { participant } = await upsertParticipant(email);
  return NextResponse.json({ participant });
}
