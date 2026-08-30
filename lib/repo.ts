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
  AppNotification,
  CampaignSort,
} from "@/lib/types";

function sb(): SupabaseClient {
  return createServiceRoleClient();
}

// PostgREST(Supabase)는 명시적으로 페이지네이션하지 않으면 한 쿼리당 최대 1000행만
// 돌려준다(프로젝트 db-max-rows 기본값). predictions처럼 캠페인이 인기를 끌수록
// 계속 늘어나는 테이블을 range() 없이 그냥 조회하면 1000건을 넘는 순간부터
// 조용히 잘려서 참여자 수·비중이 실제보다 작게 나온다 — 반드시 끝까지 페이지네이션한다.
const SUPABASE_PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  page: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await page(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }
  return all;
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
    // PRODUCT/CREDIT 둘 다 "예상 당첨 인원"을 스폰서가 입력해두면 그대로 보여준다.
    // CREDIT은 실제 당첨자 수가 판정 시점 정답자 수로 정해지긴 하지만, 목록에서는
    // 스폰서가 설계한 예상치를 "최대 N명"처럼 안내용으로 노출한다.
    winner_count: round.expected_winner_count,
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
  const predictions = await fetchAllRows<{ selected_option_index: number }>(async (from, to) =>
    supabase.from("predictions").select("selected_option_index").eq("round_id", pub.round_id).range(from, to)
  );
  return { ...pub, ...computeConsensus(pub.options, predictions.map((p) => p.selected_option_index)) };
}

// listCampaigns는 참가자 홈에서 매번 부르는 경로라 N+1 쿼리에 특히 민감하다.
// 이전엔 캠페인마다 fetchCampaignAndRound(캠페인/라운드/스폰서 3번) + attachConsensus(1번),
// 총 1 + 4N번의 요청을 순차(await 반복문)로 날려서 캠페인이 늘수록 홈 화면이 선형으로
// 느려졌다 — round/sponsor/predictions를 캠페인 id들 기준으로 한 번씩만 배치 조회하도록
// 고쳐서 캠페인 개수와 무관하게 쿼리 4번으로 끝나게 한다.
// "추천순" 점수: 참여자 수를 남은 시간으로 나눠서 지금 활발하게 몰리고 있는
// 캠페인(참여는 많은데 마감까지 얼마 안 남은 것)을 위로 끌어올린다. 순수 인기순/
// 마감임박순과는 다른, 두 신호를 함께 보는 기본 정렬 기준.
function recommendedScore(c: PublicCampaignWithConsensus): number {
  const hoursLeft = Math.max((new Date(c.end_at).getTime() - Date.now()) / (1000 * 60 * 60), 1);
  return c.total_predictions / hoursLeft;
}

export async function listCampaigns(
  category?: string,
  sort: CampaignSort = "recommended"
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
  const predictions =
    roundIds.length > 0
      ? await fetchAllRows<{ round_id: string; selected_option_index: number }>(async (from, to) =>
          supabase
            .from("predictions")
            .select("round_id, selected_option_index")
            .in("round_id", roundIds)
            .range(from, to)
        )
      : [];

  const indexesByRoundId = new Map<string, number[]>();
  for (const p of predictions) {
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
  } else if (sort === "ending") {
    results.sort((a, b) => new Date(a.end_at).getTime() - new Date(b.end_at).getTime());
  } else {
    results.sort((a, b) => recommendedScore(b) - recommendedScore(a));
  }

  // 마감된(활성이 아닌) 캠페인은 정렬 기준과 무관하게 항상 활성 캠페인보다 아래에
  // 노출한다 — 위에서 정한 정렬 순서는 각 그룹 안에서만 유지(stable sort + filter).
  const active = results.filter((c) => c.status === "active");
  const inactive = results.filter((c) => c.status !== "active");
  return [...active, ...inactive];
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
  const predictions = await fetchAllRows<{ selected_option_index: number; submitted_at: string }>(async (from, to) =>
    supabase
      .from("predictions")
      .select("selected_option_index, submitted_at")
      .eq("round_id", campaign.round_id)
      .order("submitted_at", { ascending: true })
      .range(from, to)
  );
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

// ── 활동알림 (0007 마이그레이션) ─────────────────────────────
// 별도 크론 없이, 참가자가 실제로 접점을 만드는 시점(예측 제출 / 알림함 조회)에
// 라운드 상태를 확인해서 필요하면 알림을 만든다. 순위/마감 상태는
// campaign_option_rank_state, rounds.deadline_notified_at에 "마지막으로 통지한
// 상태"를 저장해두고 그 값과 달라졌을 때만 새로 알림을 쌓는 식으로 중복 발송을 막는다.

const DEADLINE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

function toAppNotification(row: {
  id: string;
  participant_id: string;
  campaign_id: string;
  type: string;
  title: string;
  body: string;
  is_win: boolean | null;
  read_at: string | null;
  created_at: string;
}, campaignTitle: string): AppNotification {
  return {
    id: row.id,
    participant_id: row.participant_id,
    campaign_id: row.campaign_id,
    campaign_title: campaignTitle,
    type: row.type as AppNotification["type"],
    title: row.title,
    body: row.body,
    is_win: row.is_win,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

// 라운드 하나에 대해 순위 변동 / 마감 임박 알림이 필요한지 확인하고, 필요하면
// 해당 라운드의 참가자 전원에게 알림을 만든다.
export async function ensureRoundNotifications(roundId: string): Promise<void> {
  const supabase = sb();
  const { data: round } = await supabase.from("rounds").select("*").eq("id", roundId).single();
  if (!round || round.status === "closed_pending_resolution" || round.status === "resolved") return;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title")
    .eq("id", round.campaign_id)
    .single();
  if (!campaign) return;

  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, participant_id, selected_option_index")
    .eq("round_id", roundId);
  const rows = predictions ?? [];
  const options: string[] = round.options;

  // 1) 순위 변동 감지
  if (rows.length > 0) {
    const counts: Record<number, number> = {};
    options.forEach((_, i) => (counts[i] = 0));
    for (const p of rows) counts[p.selected_option_index] = (counts[p.selected_option_index] ?? 0) + 1;

    const ranked = Object.entries(counts)
      .map(([idx, count]) => ({ idx: Number(idx), count }))
      .sort((a, b) => b.count - a.count || a.idx - b.idx);
    const rankByIdx = new Map<number, number>(ranked.map((r, i) => [r.idx, i + 1]));

    const { data: states } = await supabase
      .from("campaign_option_rank_state")
      .select("*")
      .eq("round_id", roundId);
    const stateByIdx = new Map((states ?? []).map((s) => [s.option_index as number, s]));

    for (const optIdx of options.map((_, i) => i)) {
      const newRank = rankByIdx.get(optIdx)!;
      const prevState = stateByIdx.get(optIdx);

      if (prevState && prevState.last_rank !== newRank) {
        const direction = newRank < prevState.last_rank ? "상승" : "하락";
        const affected = rows.filter((p) => p.selected_option_index === optIdx);
        if (affected.length > 0) {
          await supabase.from("notifications").insert(
            affected.map((p) => ({
              participant_id: p.participant_id,
              campaign_id: campaign.id,
              type: "rank_change",
              title: "순위가 바뀌었어요",
              body: `"${campaign.title}"에서 선택하신 "${options[optIdx]}"의 순위가 ${prevState.last_rank}위에서 ${newRank}위로 ${direction}했어요.`,
            }))
          );
        }
      }

      await supabase.from("campaign_option_rank_state").upsert(
        { round_id: roundId, campaign_id: campaign.id, option_index: optIdx, last_rank: newRank, updated_at: new Date().toISOString() },
        { onConflict: "round_id,option_index" }
      );
    }
  }

  // 2) 마감 임박(D-1) 알림 — 라운드당 한 번만
  if (!round.deadline_notified_at) {
    const msLeft = new Date(round.closes_at).getTime() - Date.now();
    if (msLeft > 0 && msLeft <= DEADLINE_SOON_WINDOW_MS && rows.length > 0) {
      await supabase.from("notifications").insert(
        rows.map((p) => ({
          participant_id: p.participant_id,
          campaign_id: campaign.id,
          type: "deadline_soon",
          title: "마감이 하루 남았어요",
          body: `"${campaign.title}" 이벤트가 곧 마감돼요. 결과 발표를 놓치지 마세요.`,
        }))
      );
      await supabase.from("rounds").update({ deadline_notified_at: new Date().toISOString() }).eq("id", roundId);
    }
  }
}

// 판정 확정 직후(POST /api/rounds/[id]/resolve) 호출 — 정답/오답 참가자 전원에게
// Win/Lose 결과 알림을 만든다. 정답자에게는 리워드 안내 문구를 함께 넣는다.
//
// winnerParticipantIds: 정답자 중 실제로 reward_claims가 생긴(=보상을 받는)
// 참가자 id 집합. 정답자가 최대 당첨자 수를 넘으면 무작위 선정에서 밀린 정답자가
// 생길 수 있어서(rounds/[id]/resolve), "정답 맞힘"과 "실제 당첨"을 구분해야 한다.
export async function createResultNotifications(
  roundId: string,
  correctOptionIndex: number,
  winnerParticipantIds: Set<string>
): Promise<void> {
  const supabase = sb();
  const { data: round } = await supabase.from("rounds").select("*").eq("id", roundId).single();
  if (!round) return;
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title")
    .eq("id", round.campaign_id)
    .single();
  if (!campaign) return;

  const { data: predictions } = await supabase
    .from("predictions")
    .select("participant_id, selected_option_index")
    .eq("round_id", roundId);

  const rewardText =
    round.reward_mode === "CREDIT"
      ? `${round.credit_pool_amount?.toLocaleString() ?? ""}${round.credit_currency ?? ""} 상당의 리워드를 정답자들과 나눠 받아요.`
      : `${round.prize_label ?? "상품"}을 받을 수 있어요.`;

  const rows = (predictions ?? []).map((p) => {
    const isCorrect = p.selected_option_index === correctOptionIndex;
    const isWin = isCorrect && winnerParticipantIds.has(p.participant_id);
    // 정답은 맞혔지만 최대 당첨자 수 초과로 추첨에서 밀린 경우 — WIN도 LOSE도
    // 아닌 세 번째 케이스라 is_win은 false로 두되(보상을 못 받으니), 본문은
    // 그냥 틀린 것과 다르게 안내한다.
    const missedByDraw = isCorrect && !isWin;
    return {
      participant_id: p.participant_id,
      campaign_id: campaign.id,
      type: "result" as const,
      is_win: isWin,
      title: isWin ? `"${campaign.title}" 결과 발표: WIN` : `"${campaign.title}" 결과 발표: LOSE`,
      body: isWin
        ? `축하해요! 예측이 적중했어요. ${rewardText}`
        : missedByDraw
          ? "예측은 적중했지만 아쉽게도 당첨자 추첨에서 밀렸어요."
          : "아쉽지만 이번엔 예측이 빗나갔어요. 다음 이벤트에 도전해보세요.",
    };
  });
  if (rows.length === 0) return;
  await supabase.from("notifications").insert(rows);
}

export async function listNotifications(participantId: string): Promise<AppNotification[]> {
  const supabase = sb();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const campaignIds = Array.from(new Set(rows.map((r) => r.campaign_id)));
  const { data: campaigns } = await supabase.from("campaigns").select("id, title").in("id", campaignIds);
  const titleById = new Map((campaigns ?? []).map((c) => [c.id, c.title as string]));

  return rows.map((r) => toAppNotification(r, titleById.get(r.campaign_id) ?? ""));
}

export async function countUnreadNotifications(participantId: string): Promise<number> {
  const supabase = sb();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .is("read_at", null);
  return count ?? 0;
}

export async function markNotificationsRead(participantId: string, ids?: string[]): Promise<void> {
  const supabase = sb();
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("participant_id", participantId)
    .is("read_at", null);
  if (ids && ids.length > 0) query = query.in("id", ids);
  await query;
}

// 참가자가 예측을 걸어둔, 아직 안 끝난 라운드들에 대해 순위/마감 알림을 갱신한다.
// 알림함을 열 때마다 호출해서 시간이 지나면서 생기는 변화(마감 임박 등)도 놓치지 않게 한다.
export async function syncNotificationsForParticipant(participantId: string): Promise<void> {
  const supabase = sb();
  const { data: predictions } = await supabase
    .from("predictions")
    .select("round_id, rounds!inner(status)")
    .eq("participant_id", participantId);
  const openRoundIds = (predictions ?? [])
    .filter((p) => {
      const status = (p as unknown as { rounds: { status: string } }).rounds.status;
      return status !== "closed_pending_resolution" && status !== "resolved";
    })
    .map((p) => p.round_id as string);
  const roundIds = Array.from(new Set(openRoundIds));
  for (const roundId of roundIds) {
    await ensureRoundNotifications(roundId);
  }
}
