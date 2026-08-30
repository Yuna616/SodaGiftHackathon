// DB 테이블 타입 모음
// 출처: docs/architecture.md 2절(DB 스키마)
// 컨벤션(docs/stack.md): status 컬럼은 텍스트 enum이 아니라 여기 as const 유니온 타입으로만 다룬다.

export const SPONSOR_STATUS = ["active", "suspended"] as const;
export type SponsorStatus = (typeof SPONSOR_STATUS)[number];

export const CAMPAIGN_STATUS = ["draft", "active", "ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[number];

export const ROUND_STATUS = [
  "upcoming",
  "open",
  "closed_pending_resolution",
  "resolved",
] as const;
export type RoundStatus = (typeof ROUND_STATUS)[number];

export const REWARD_CLAIM_STATUS = [
  "eligible",
  "product_selected",
  "order_placed",
  "fulfilled",
  "failed",
] as const;
export type RewardClaimStatus = (typeof REWARD_CLAIM_STATUS)[number];

export const DISPUTE_TICKET_STATUS = ["open", "reviewing", "closed"] as const;
export type DisputeTicketStatus = (typeof DISPUTE_TICKET_STATUS)[number];

// 0002 마이그레이션: 라운드별 보상 방식. PRODUCT = 카탈로그 상품 지급(기존),
// CREDIT = 라운드에 건 고정 풀 금액을 정답자 수로 나눠 갖는 배당형.
export const REWARD_MODE = ["PRODUCT", "CREDIT"] as const;
export type RewardMode = (typeof REWARD_MODE)[number];

export interface Sponsor {
  id: string;
  name: string;
  contact_email: string;
  status: SponsorStatus;
  created_at: string;
}

export interface Campaign {
  id: string;
  sponsor_id: string;
  title: string;
  artist_name: string | null;
  prize_pool_total: number;
  prize_pool_spent: number;
  starts_at: string | null;
  ends_at: string | null;
  status: CampaignStatus;
  mission_url: string | null; // 참여 전 방문해야 하는 사이트, null이면 미션 없음
  created_at: string;
}

export interface CampaignCatalogItem {
  id: string;
  campaign_id: string;
  product_id: string; // 소다기프트 GET /v1/products 의 id
  is_sponsor_pick: boolean;
}

export interface Round {
  id: string;
  campaign_id: string;
  round_number: number;
  question_text: string;
  options: string[]; // 4지선다
  resolution_criteria: string | null;
  reward_mode: RewardMode;
  expected_winner_count: number | null; // PRODUCT 모드에서만 필수, 스폰서 직접 입력 (자동 계산 아님)
  credit_pool_amount: number | null; // CREDIT 모드에서만 필수
  credit_currency: string | null; // CREDIT 모드: 이 통화 안에서 당첨자가 브랜드를 직접 고른다
  correct_option_index: number | null; // null until resolved
  opens_at: string;
  closes_at: string;
  resolved_at: string | null;
  status: RoundStatus;
}

export interface Participant {
  id: string;
  email: string;
  country: string | null;
  referral_code: string;
  invited_by: string | null;
  created_at: string;
}

export interface Prediction {
  id: string;
  round_id: string;
  participant_id: string;
  selected_option_index: number;
  submitted_at: string;
  is_correct: boolean | null; // resolve 시점에 일괄 채움
}

export interface RewardClaim {
  id: string;
  round_id: string;
  campaign_id: string;
  participant_id: string;
  status: RewardClaimStatus;
  selected_product_id: string | null;
  external_reference_id: string; // FR-6: 중복지급 방지
  soda_order_id: string | null;
  soda_order_item_id: string | null;
  payout_amount: number | null; // CREDIT 모드: 정답자 수로 나눈 실수령액
  payout_currency: string | null; // CREDIT 모드에서만 채워짐
  created_at: string;
  updated_at: string;
}

export interface MissionCompletion {
  id: string;
  campaign_id: string;
  participant_id: string;
  completed_at: string;
}

export interface ResolutionAuditLog {
  id: string;
  round_id: string;
  resolved_by: string; // sponsor user id
  correct_option_index: number;
  resolved_at: string;
}

export interface DisputeTicket {
  id: string;
  round_id: string;
  raised_by: string;
  reason: string;
  status: DisputeTicketStatus;
  created_at: string;
}
