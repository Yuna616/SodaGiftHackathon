import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, type AnalyticsEventName } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { eventName, participantId, campaignId, metadata } = body as {
    eventName?: string;
    participantId?: string;
    campaignId?: string;
    metadata?: Record<string, unknown>;
  };
  if (!eventName || !ANALYTICS_EVENTS.includes(eventName as AnalyticsEventName)) {
    return NextResponse.json({ error: 'INVALID_EVENT' }, { status: 400 });
  }
  recordEvent(eventName as AnalyticsEventName, { participantId, campaignId, metadata });
  return NextResponse.json({ ok: true });
}
