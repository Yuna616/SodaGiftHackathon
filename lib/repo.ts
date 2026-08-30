// 참가자(유저) 앱 데이터 레이어. 원래 팀원이 SQLite(better-sqlite3 스타일)로 짠
// lib/repo.ts를 Supabase로 이식한 것 — 함수 시그니처는 최대한 그대로 유지해서
// 페이지/컴포넌트 쪽 코드는 거의 안 건드리게 했다(다만 전부 async로 바뀜).
//
// 서버 전용(API Route Handler에서만 import) — createServiceRoleClient를 쓴다.
//
// 참가자 화면은 캠페인당 라운드 1개(round_number=1)만 본다고 가정한다.
// 스폰서 쪽 다중 라운드 캠페인은 이 화면에 아직 안 나온다 — 이후 과제.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  Campaign as CampaignRow,
  Round as RoundRow,
  Participant,
  PublicCampaign,
  PublicCampaignWithConsensus,
  PublicPrediction,
  ConsensusTrendPoint,
  ClaimOrder,
  Invite,
  CampaignOption,
} from "@/lib/types";

function sb(): SupabaseClient {
  return createServiceRoleClient();
}

function optionsOf(round: RoundRow): CampaignOption[] {
  return round.options.map((label, i) => ({ id: String(i), label }));
}

function deriveStatus(round: RoundRow): "active" | "ended" | "resolved" {
  if (round.status === "resolved") return "resolved";
  if (round.status === "closed_pending_resolution") return "ended";
  if (new Date(round.closes_at).getTime() < Date.now()) return "ended";
  return "active";
}

function toPublicCampaign(campaign: CampaignRow, round: RoundRow, sponsorName: string): PublicCampaign {
  return {
    id: campaign.id,
    round_id: round.id,
    title: campaign.title,
    category: campaign.category,
    options: optionsOf(round),
    resolution_criteria: round.resolution_criteria ?? "",
    start_at: round.opens_at,
    end_at: round.closes_at,
    status: deriveStatus(round),
    reward_option_ids: round.correct_option_index !== null ? [String(round.correct_option_index)] : [],
    sponsor_name: sponsorName,
    sponsor_logo_url: null,
    prize_type: round.reward_mode === "CREDIT" ? "amount" : "item",
    prize_label: round.prize_label ?? (round.reward_mode === "CREDIT" ? "크레딧 배당" : "카탈로그 상품 중 선택"),
    prize_amount: round.reward_mode === "CREDIT" ? round.credit_pool_amount : null,
    prize_currency: round.reward_mode === "CREDIT" ? round.credit_currency : null,
    winner_count: round.reward_mode === "PRODUCT" ? round.expected_winner_count : null,
    thumbnail_url: campaign.thumbnail_url,
    media_url: campaign.media_url,
    media_type: campaign.media_type,
    mission_url: campaign.mission_url,
    created_at: campaign.created_at,
  };
}

// campaigns + 그 캠페인의 1번 라운드 + 스폰서명을 한 번에 가져온다.
async function fetchCampaignAndRound(
  campaignId: string
): Promise<{ campaign: CampaignRow; round: RoundRow; sponsorName: string } | null> {
  const supabase = sb();
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return null;
  const { data: round } = await supabase
    .from("rounds")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("round_number", 1)
    .maybeSingle();
  if (!round) return null;
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("name")
    .eq("id", campaign.sponsor_id)
    .maybeSingle();
  return { campaign, round, sponsorName: sponsor?.name ?? "" };
}

// options/예측 목록만 있으면 순수 계산으로 끝나는 부분 — 쿼리를 몇 번 하든 이 함수
// 자체는 DB를 안 건드린다. attachConsensus(단건)와 listCampaigns(다건, 배치 쿼리)가
// 같이 쓴다.
function computeConsensus(
  options: CampaignOption[],
  selectedOptionIndexes: number[]
): { total_predictions: number; counts: Record<string, number>; consensus: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const opt of options) counts[opt.id] = 0;
  for (const idx of selectedOptionIndexes) {
    const key = String(idx);
    if (key in counts) counts[key] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const consensus: Record<string, number> = {};
  for (const opt of options) {
    consensus[opt.id] = total > 0 ? Math.round((counts[opt.id] / total) * 1000) / 10 : 0;
  }
  return { total_predictions: total, counts, consensus };
}

async function attachConsensus(pub: PublicCampaign): Promise<PublicCampaignWithConsensus> {
  const supabase = sb();
  const { data: predictions } = await supabase
    .from("predictions")
    .select("selected_option_index")
    .eq("round_id", pub.round_id);
  return { ...pub, ...computeConsensus(pub.options, (predictions ?? []).map((p) => p.selected_option_index)) };
}

// listCampaigns는 참가자 홈에서 매번 부르는 경로라 N+1 쿼리에 특히 민감하다.
// 이전엔 캠페인마다 fetchCampaignAndRound(캠페인/라운드/스폰서 3번) + attachConsensus(1번),
// 총 1 + 4N번의 요청을 순차(await 반복문)로 날려서 캠페인이 늘수록 홈 화면이 선형으로
// 느려졌다 — round/sponsor/predictions를 캠페인 id들 기준으로 한 번씩만 배치 조회하도록
// 고쳐서 캠페인 개수와 무관하게 쿼리 4번으로 끝나게 한다.
export async function listCampaigns(
  category?: string,
  sort: "ending" | "popular" = "ending"
): Promise<PublicCampaignWithConsensus[]> {
  const supabase = sb();
  let query = supabase.from("campaigns").select("*").neq("status", "draft");
  if (category && category !== "all") query = query.eq("category", category);
  const { data: campaigns } = await query;
  if (!campaigns || campaigns.length === 0) return [];

  const campaignIds = campaigns.map((c) => c.id);
  const sponsorIds = Array.from(new Set(campaigns.map((c) => c.sponsor_id)));

  const [{ data: rounds }, { data: sponsors }] = await Promise.all([
    supabase.from("rounds").select("*").in("campaign_id", campaignIds).eq("round_number", 1),
    supabase.from("sponsors").select("id, name").in("id", sponsorIds),
  ]);

  const roundByCampaignId = new Map((rounds ?? []).map((r) => [r.campaign_id, r as RoundRow]));
  const sponsorNameById = new Map((sponsors ?? []).map((s) => [s.id, s.name as string]));

  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: predictions } =
    roundIds.length > 0
      ? await supabase.from("predictions").select("round_id, selected_option_index").in("round_id", roundIds)
      : { data: [] as { round_id: string; selected_option_index: number }[] };

  const indexesByRoundId = new Map<string, number[]>();
  for (const p of predictions ?? []) {
    const list = indexesByRoundId.get(p.round_id) ?? [];
    list.push(p.selected_option_index);
    indexesByRoundId.set(p.round_id, list);
  }

  const results: PublicCampaignWithConsensus[] = [];
  for (const campaign of campaigns) {
    const round = roundByCampaignId.get(campaign.id);
    if (!round) continue; // 라운드가 아직 없는 캠페인(비정상 상태) — 목록에서 제외
    const pub = toPublicCampaign(campaign, round, sponsorNameById.get(campaign.sponsor_id) ?? "");
    results.push({ ...pub, ...computeConsensus(pub.options, indexesByRoundId.get(round.id) ?? []) });
  }

  if (sort === "popular") {
    results.sort((a, b) => b.total_predictions - a.total_predictions);
  } else {
    results.sort((a, b) => new Date(a.end_at).getTime() - new Date(b.end_at).getTime());
  }
  return results;
}

export async function getCampaign(id: string): Promise<PublicCampaign | null> {
  const bundle = await fetchCampaignAndRound(id);
  if (!bundle) return null;
  return toPublicCampaign(bundle.campaign, bundle.round, bundle.sponsorName);
}

export async function getCampaignWithConsensus(id: string): Promise<PublicCampaignWithConsensus | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;
  return attachConsensus(campaign);
}

export async function getConsensusTrend(id: string): Promise<ConsensusTrendPoint[]> {
  const campaign = await getCampaign(id);
  if (!campaign) return [];
  const supabase = sb();
  const { data: predictions } = await supabase
    .from("predictions")
    .select("selected_option_index, submitted_at")
    .eq("round_id", campaign.round_id)
    .order("submitted_at", { ascending: true });
  if (!predictions || predictions.length === 0) return [];

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
    const key = String(p.selected_option_index);
    if (!(key in runningCounts)) continue;
    runningCounts[key] += 1;
    total += 1;
    const percents: Record<string, number> = {};
    for (const opt of campaign.options) {
      percents[opt.id] = Math.round((runningCounts[opt.id] / total) * 1000) / 10;
    }
    points.push({ at: p.submitted_at, total, percents });
  }
  return points;
}

export async function hasMissionCompleted(campaignId: string, participantId: string): Promise<boolean> {
  const supabase = sb();
  // select("*") 유지 — mission_completions에서 좁은 컬럼 지정 + maybeSingle() 조합이
  // 에러 없이 항상 빈 값을 반환하는 현상이 있었다(app/api/campaigns/[id]/missions/status
  // 라우트에서도 동일하게 우회함).
  const { data } = await supabase
    .from("mission_completions")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .maybeSingle();
  return !!data;
}

export async function findParticipantByEmail(email: string): Promise<Participant | null> {
  const supabase = sb();
  const { data } = await supabase
    .from("participants")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  return data ?? null;
}

export async function getParticipant(id: string): Promise<Participant | null> {
  const supabase = sb();
  const { data } = await supabase.from("participants").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function upsertParticipant(
  email: string,
  country?: string
): Promise<{ participant: Participant; isNew: boolean }> {
  const normalized = email.toLowerCase().trim();
  const existing = await findParticipantByEmail(normalized);
  if (existing) return { participant: existing, isNew: false };
  const supabase = sb();
  const { data, error } = await supabase
    .from("participants")
    .insert({ email: normalized, country: country ?? null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { participant: data, isNew: true };
}

function toPublicPrediction(row: {
  id: string;
  round_id: string;
  campaign_id: string;
  participant_id: string;
  selected_option_index: number;
  multiplier: number;
  submitted_at: string;
}): PublicPrediction {
  return {
    id: row.id,
    participant_id: row.participant_id,
    campaign_id: row.campaign_id,
    round_id: row.round_id,
    selected_option: String(row.selected_option_index),
    multiplier: row.multiplier,
    submitted_at: row.submitted_at,
  };
}

export async function findPrediction(participantId: string, campaignId: string): Promise<PublicPrediction | null> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return null;
  const supabase = sb();
  const { data } = await supabase
    .from("predictions")
    .select("*")
    .eq("round_id", campaign.round_id)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (!data) return null;
  return toPublicPrediction({ ...data, campaign_id: campaignId });
}

export async function getPrediction(id: string): Promise<PublicPrediction | null> {
  const supabase = sb();
  const { data } = await supabase.from("predictions").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: round } = await supabase.from("rounds").select("campaign_id").eq("id", data.round_id).single();
  if (!round) return null;
  return toPublicPrediction({ ...data, campaign_id: round.campaign_id });
}

export async function createPrediction(
  participantId: string,
  campaignId: string,
  selectedOptionId: string
): Promise<PublicPrediction> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  const supabase = sb();
  const { data, error } = await supabase
    .from("predictions")
    .insert({
      round_id: campaign.round_id,
      participant_id: participantId,
      selected_option_index: Number(selectedOptionId),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toPublicPrediction({ ...data, campaign_id: campaignId });
}

export async function bumpMultiplier(predictionId: string): Promise<void> {
  const supabase = sb();
  const { data } = await supabase.from("predictions").select("multiplier").eq("id", predictionId).single();
  if (!data) return;
  await supabase
    .from("predictions")
    .update({ multiplier: data.multiplier + 1 })
    .eq("id", predictionId);
}

export async function listPredictionsForParticipant(
  participantId: string
): Promise<(PublicPrediction & { campaign: PublicCampaign })[]> {
  const supabase = sb();
  const { data: predictions } = await supabase
    .from("predictions")
    .select("*, rounds!inner(campaign_id)")
    .eq("participant_id", participantId)
    .order("submitted_at", { ascending: false });

  const results: (PublicPrediction & { campaign: PublicCampaign })[] = [];
  for (const row of predictions ?? []) {
    const campaignId = (row as unknown as { rounds: { campaign_id: string } }).rounds.campaign_id;
    const campaign = await getCampaign(campaignId);
    if (!campaign) continue;
    results.push({ ...toPublicPrediction({ ...row, campaign_id: campaignId }), campaign });
  }
  return results;
}

function toClaimOrder(claim: {
  id: string;
  round_id: string;
  participant_id: string;
  selected_product_id: string | null;
  external_reference_id: string;
  soda_order_id: string | null;
  status: string;
  payout_amount?: number | null;
  payout_currency?: string | null;
  created_at: string;
}): ClaimOrder | null {
  // eligible/product_selected는 "아직 주문 안 됨" — teammate 원본 의미(claim_orders row
  // 없음)와 맞추기 위해 null로 취급한다.
  if (claim.status === "eligible" || claim.status === "product_selected") return null;
  return {
    id: claim.id,
    prediction_id: "", // 호출부에서 채워 넣음(참가자 예측 id를 여기서 알 방법이 없음)
    selected_product_id: claim.selected_product_id,
    external_reference_id: claim.external_reference_id,
    soda_order_id: claim.soda_order_id,
    status: claim.status === "failed" ? "FAILED" : "ISSUED",
    payout_amount: claim.payout_amount ?? null,
    payout_currency: claim.payout_currency ?? null,
    created_at: claim.created_at,
  };
}

export async function getClaimOrderByPrediction(predictionId: string): Promise<ClaimOrder | null> {
  const prediction = await getPrediction(predictionId);
  if (!prediction) return null;
  const supabase = sb();
  const { data } = await supabase
    .from("reward_claims")
    .select("*")
    .eq("round_id", prediction.round_id)
    .eq("participant_id", prediction.participant_id)
    .maybeSingle();
  if (!data) return null;
  const order = toClaimOrder(data);
  return order ? { ...order, prediction_id: predictionId } : null;
}

export async function getClaimOrder(id: string): Promise<ClaimOrder | null> {
  const supabase = sb();
  const { data } = await supabase.from("reward_claims").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return toClaimOrder(data);
}

export async function findInviteByToken(token: string): Promise<Invite | null> {
  const supabase = sb();
  const { data } = await supabase.from("invites").select("*").eq("token", token).maybeSingle();
  return data ?? null;
}

export async function getOrCreateInvite(inviterParticipantId: string, campaignId: string): Promise<Invite> {
  const supabase = sb();
  const { data: existing } = await supabase
    .from("invites")
    .select("*")
    .eq("inviter_participant_id", inviterParticipantId)
    .eq("campaign_id", campaignId)
    .is("invitee_email", null)
    .maybeSingle();
  if (existing) return existing;

  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await supabase
    .from("invites")
    .insert({ token, inviter_participant_id: inviterParticipantId, campaign_id: campaignId, status: "pending" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function countCompletedInvites(inviterParticipantId: string, campaignId: string): Promise<number> {
  const supabase = sb();
  const { count } = await supabase
    .from("invites")
    .select("id", { count: "exact", head: true })
    .eq("inviter_participant_id", inviterParticipantId)
    .eq("campaign_id", campaignId)
    .eq("status", "completed");
  return count ?? 0;
}

export async function completeInvite(token: string, inviteeEmail: string): Promise<Invite | null> {
  const invite = await findInviteByToken(token);
  if (!invite || invite.status === "completed") return invite;
  const supabase = sb();
  await supabase.from("invites").update({ status: "completed", invitee_email: inviteeEmail }).eq("token", token);
  return findInviteByToken(token);
}
