import { getDb, newId } from './db';
import type {
  Campaign,
  CampaignWithConsensus,
  ConsensusTrendPoint,
  Participant,
  Prediction,
  Invite,
} from './types';

interface CampaignRow {
  id: string;
  title: string;
  category: string;
  options: string;
  resolution_criteria: string;
  start_at: string;
  end_at: string;
  status: string;
  reward_option_ids: string;
  sponsor_name: string;
  sponsor_logo_url: string | null;
  prize_type: string;
  prize_label: string;
  prize_amount: number | null;
  winner_count: number;
  thumbnail_url: string;
  media_url: string;
  media_type: string;
  created_at: string;
}

function parseCampaign(row: CampaignRow): Campaign {
  return {
    ...row,
    status: row.status as Campaign['status'],
    media_type: row.media_type as Campaign['media_type'],
    prize_type: row.prize_type as Campaign['prize_type'],
    options: JSON.parse(row.options),
    reward_option_ids: JSON.parse(row.reward_option_ids),
  };
}

function attachConsensus(campaign: Campaign): CampaignWithConsensus {
  const db = getDb();
  const rows = db
    .prepare('SELECT selected_option, COUNT(*) as c FROM predictions WHERE campaign_id = ? GROUP BY selected_option')
    .all(campaign.id) as unknown as { selected_option: string; c: number }[];
  const total = rows.reduce((sum, r) => sum + r.c, 0);
  const counts: Record<string, number> = {};
  const consensus: Record<string, number> = {};
  for (const opt of campaign.options) {
    const found = rows.find((r) => r.selected_option === opt.id);
    counts[opt.id] = found?.c ?? 0;
    consensus[opt.id] = total > 0 ? Math.round(((found?.c ?? 0) / total) * 1000) / 10 : 0;
  }
  return { ...campaign, total_predictions: total, counts, consensus };
}

export function listCampaigns(
  category?: string,
  sort: 'ending' | 'popular' = 'ending'
): CampaignWithConsensus[] {
  const db = getDb();
  let rows: CampaignRow[];
  if (category && category !== 'all') {
    rows = db
      .prepare('SELECT * FROM campaigns WHERE category = ? ORDER BY end_at ASC')
      .all(category) as unknown as CampaignRow[];
  } else {
    rows = db.prepare('SELECT * FROM campaigns ORDER BY end_at ASC').all() as unknown as CampaignRow[];
  }
  const campaigns = rows.map(parseCampaign).map(attachConsensus);
  if (sort === 'popular') {
    campaigns.sort((a, b) => b.total_predictions - a.total_predictions);
  }
  return campaigns;
}

export function getCampaign(id: string): Campaign | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as unknown as CampaignRow | undefined;
  return row ? parseCampaign(row) : null;
}

export function getCampaignWithConsensus(id: string): CampaignWithConsensus | null {
  const campaign = getCampaign(id);
  if (!campaign) return null;
  return attachConsensus(campaign);
}

export function getConsensusTrend(id: string): ConsensusTrendPoint[] {
  const campaign = getCampaign(id);
  if (!campaign) return [];
  const db = getDb();
  const predictions = db
    .prepare('SELECT selected_option, submitted_at FROM predictions WHERE campaign_id = ? ORDER BY submitted_at ASC')
    .all(id) as unknown as { selected_option: string; submitted_at: string }[];
  if (predictions.length === 0) return [];

  const points: ConsensusTrendPoint[] = [];
  const runningCounts: Record<string, number> = {};
  for (const opt of campaign.options) runningCounts[opt.id] = 0;

  points.push({
    at: campaign.start_at,
    total: 0,
    percents: Object.fromEntries(campaign.options.map((o) => [o.id, 0])),
  });

  let total = 0;
  for (const p of predictions) {
    if (runningCounts[p.selected_option] === undefined) continue;
    runningCounts[p.selected_option] += 1;
    total += 1;
    const percents: Record<string, number> = {};
    for (const opt of campaign.options) {
      percents[opt.id] = Math.round((runningCounts[opt.id] / total) * 1000) / 10;
    }
    // SQLite datetime('now')는 "YYYY-MM-DD HH:MM:SS" 형식의 UTC 문자열 -> ISO로 정규화
    const at = p.submitted_at.includes('T') ? p.submitted_at : `${p.submitted_at.replace(' ', 'T')}.000Z`;
    points.push({ at, total, percents });
  }
  return points;
}

export function findParticipantByEmail(email: string): Participant | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM participants WHERE email = ?').get(email.toLowerCase().trim()) as
    | Participant
    | undefined;
  return row ?? null;
}

export function getParticipant(id: string): Participant | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM participants WHERE id = ?').get(id) as unknown as Participant | undefined;
  return row ?? null;
}

export function upsertParticipant(email: string, country?: string): { participant: Participant; isNew: boolean } {
  const db = getDb();
  const normalized = email.toLowerCase().trim();
  const existing = findParticipantByEmail(normalized);
  if (existing) return { participant: existing, isNew: false };
  const id = newId('ptc');
  db.prepare('INSERT INTO participants (id, email, country) VALUES (?, ?, ?)').run(
    id,
    normalized,
    country ?? null
  );
  return { participant: getParticipant(id)!, isNew: true };
}

export function findPrediction(participantId: string, campaignId: string): Prediction | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM predictions WHERE participant_id = ? AND campaign_id = ?')
    .get(participantId, campaignId) as unknown as Prediction | undefined;
  return row ?? null;
}

export function getPrediction(id: string): Prediction | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM predictions WHERE id = ?').get(id) as unknown as Prediction | undefined;
  return row ?? null;
}

export function createPrediction(participantId: string, campaignId: string, selectedOption: string): Prediction {
  const db = getDb();
  const id = newId('pred');
  db.prepare(
    'INSERT INTO predictions (id, participant_id, campaign_id, selected_option, multiplier) VALUES (?, ?, ?, ?, 1)'
  ).run(id, participantId, campaignId, selectedOption);
  return getPrediction(id)!;
}

export function bumpMultiplier(predictionId: string): void {
  const db = getDb();
  db.prepare('UPDATE predictions SET multiplier = multiplier + 1 WHERE id = ?').run(predictionId);
}

export function listPredictionsForParticipant(participantId: string): (Prediction & { campaign: Campaign })[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM predictions WHERE participant_id = ? ORDER BY submitted_at DESC')
    .all(participantId) as unknown as Prediction[];
  return rows.map((r) => ({ ...r, campaign: getCampaign(r.campaign_id)! })).filter((r) => r.campaign);
}

export function getClaimOrderByPrediction(predictionId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM claim_orders WHERE prediction_id = ?').get(predictionId) as unknown as     | import('./types').ClaimOrder
    | undefined;
}

export function getClaimOrder(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM claim_orders WHERE id = ?').get(id) as unknown as     | import('./types').ClaimOrder
    | undefined;
}

export function findInviteByToken(token: string): Invite | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM invites WHERE token = ?').get(token) as unknown as Invite | undefined;
  return row ?? null;
}

export function getOrCreateInvite(inviterParticipantId: string, campaignId: string): Invite {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM invites WHERE inviter_participant_id = ? AND campaign_id = ? AND invitee_email IS NULL')
    .get(inviterParticipantId, campaignId) as unknown as Invite | undefined;
  if (existing) return existing;
  const id = newId('inv');
  const token = newId('tok');
  db.prepare(
    'INSERT INTO invites (id, token, inviter_participant_id, campaign_id, status) VALUES (?, ?, ?, ?, ?)'
  ).run(id, token, inviterParticipantId, campaignId, 'pending');
  return findInviteByToken(token)!;
}

export function countCompletedInvites(inviterParticipantId: string, campaignId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) as c FROM invites WHERE inviter_participant_id = ? AND campaign_id = ? AND status = 'completed'"
    )
    .get(inviterParticipantId, campaignId) as unknown as { c: number };
  return row.c;
}

export function completeInvite(token: string, inviteeEmail: string): Invite | null {
  const db = getDb();
  const invite = findInviteByToken(token);
  if (!invite || invite.status === 'completed') return invite;
  db.prepare("UPDATE invites SET status = 'completed', invitee_email = ? WHERE token = ?").run(
    inviteeEmail,
    token
  );
  return findInviteByToken(token);
}
