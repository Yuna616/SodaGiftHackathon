import { getDb } from './db';
import type { AnalyticsEventName } from './types';

export function recordEvent(
  eventName: AnalyticsEventName,
  opts: { participantId?: string | null; campaignId?: string | null; metadata?: Record<string, unknown> } = {}
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO analytics_events (event_name, participant_id, campaign_id, metadata) VALUES (?, ?, ?, ?)`
  ).run(
    eventName,
    opts.participantId ?? null,
    opts.campaignId ?? null,
    opts.metadata ? JSON.stringify(opts.metadata) : null
  );
}

export function getEventCounts(): { event_name: string; count: number }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT event_name, COUNT(*) as count FROM analytics_events GROUP BY event_name ORDER BY count DESC`
    )
    .all() as unknown as { event_name: string; count: number }[];
}
