// 참가자 앱 이벤트 트래킹. 원래 SQLite였던 걸 Supabase analytics_events 테이블로 이식.
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AnalyticsEventName } from "@/lib/types";

export async function recordEvent(
  eventName: AnalyticsEventName,
  opts: { participantId?: string | null; campaignId?: string | null; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("analytics_events").insert({
    event_name: eventName,
    participant_id: opts.participantId ?? null,
    campaign_id: opts.campaignId ?? null,
    metadata: opts.metadata ?? null,
  });
}

export async function getEventCounts(): Promise<{ event_name: string; count: number }[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("analytics_events").select("event_name");
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.event_name, (counts.get(row.event_name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([event_name, count]) => ({ event_name, count }))
    .sort((a, b) => b.count - a.count);
}
