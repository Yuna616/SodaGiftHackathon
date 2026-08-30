'use client';

import type { AnalyticsEventName } from './types';

export function track(
  eventName: AnalyticsEventName,
  opts: { participantId?: string; campaignId?: string; metadata?: Record<string, unknown> } = {}
) {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName, ...opts }),
    keepalive: true,
  }).catch(() => {});
}
