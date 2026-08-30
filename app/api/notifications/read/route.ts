import { NextRequest, NextResponse } from "next/server";
import { markNotificationsRead } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { participantId, ids } = (body ?? {}) as { participantId?: string; ids?: string[] };
  if (!participantId) {
    return NextResponse.json({ error: "MISSING_PARTICIPANT_ID" }, { status: 400 });
  }
  await markNotificationsRead(participantId, ids);
  return NextResponse.json({ ok: true });
}
