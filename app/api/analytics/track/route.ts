import { NextRequest, NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { eventName, participantId, campaignId, metadata } = (body ?? {}) as {
    eventName?: string;
    participantId?: string;
    campaignId?: string;
    metadata?: Record<string, unknown>;
  };
  if (!eventName || !(ANALYTICS_EVENTS as readonly string[]).includes(eventName)) {
    return NextResponse.json({ error: "INVALID_EVENT" }, { status: 400 });
  }
  await recordEvent(eventName as AnalyticsEventName, { participantId, campaignId, metadata });
  return NextResponse.json({ ok: true });
}
