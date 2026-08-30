import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface CampaignRow {
  id: string;
  reward_option_ids: string;
}

export async function GET() {
  const db = getDb();
  const resolvedCampaigns = db
    .prepare("SELECT id, reward_option_ids FROM campaigns WHERE status = 'resolved'")
    .all() as unknown as CampaignRow[];

  const winCountByParticipant = new Map<string, number>();
  const predictionStmt = db.prepare(
    'SELECT participant_id, selected_option FROM predictions WHERE campaign_id = ?'
  );
  for (const campaign of resolvedCampaigns) {
    const rewardIds: string[] = JSON.parse(campaign.reward_option_ids);
    const predictions = predictionStmt.all(campaign.id) as unknown as { participant_id: string; selected_option: string }[];
    for (const p of predictions) {
      if (rewardIds.includes(p.selected_option)) {
        winCountByParticipant.set(p.participant_id, (winCountByParticipant.get(p.participant_id) ?? 0) + 1);
      }
    }
  }

  const participantStmt = db.prepare('SELECT email FROM participants WHERE id = ?');
  const ranking = [...winCountByParticipant.entries()]
    .map(([participantId, wins]) => {
      const row = participantStmt.get(participantId) as unknown as { email: string } | undefined;
      const email = row?.email ?? '알 수 없음';
      const masked = email.replace(/^(.{2}).+(@.+)$/, '$1***$2');
      return { participantId, wins, email: masked };
    })
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5);

  return NextResponse.json({ ranking });
}
