import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCampaign } from '@/lib/repo';
import { recordEvent } from '@/lib/analytics';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { campaignId, winningOptionIds } = body as { campaignId?: string; winningOptionIds?: string[] };
  if (!campaignId || !winningOptionIds || winningOptionIds.length === 0) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND' }, { status: 404 });
  }

  const db = getDb();
  db.prepare("UPDATE campaigns SET status = 'resolved', reward_option_ids = ? WHERE id = ?").run(
    JSON.stringify(winningOptionIds),
    campaignId
  );

  const winners = db
    .prepare(
      `SELECT DISTINCT participant_id FROM predictions WHERE campaign_id = ? AND selected_option IN (${winningOptionIds
        .map(() => '?')
        .join(',')})`
    )
    .all(campaignId, ...winningOptionIds) as unknown as { participant_id: string }[];

  for (const w of winners) {
    // 실제 이메일/푸시 발송 대신 데모용 시뮬레이션 로그. 당첨 사실은 /my 인앱 배너로 노출.
    console.log(`[알림 시뮬레이션] participant=${w.participant_id} campaign=${campaignId} 당첨 안내 발송`);
    recordEvent('result_notified', { participantId: w.participant_id, campaignId });
  }

  return NextResponse.json({ ok: true, winnerCount: winners.length });
}
