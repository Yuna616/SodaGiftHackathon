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

// 0006 마이그레이션: Google OAuth(Supabase Auth)로 가입하면 트리거가 자동으로 active를 세팅.
// 정지 등 비활성화는 운영자가 수동으로 inactive로 바꾸는 용도.
export const PARTICIPANT_STATUS = ["active", "inactive"] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUS)[number];

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
  // 0004 마이그레이션: 참가자 앱(목록/상세 카드) 표시용
  category: string;
  thumbnail_url: string;
  media_url: string;
  media_type: "image" | "video";
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
  prize_label: string | null; // 0004: PRODUCT 모드 표시용 문구, null이면 프론트 기본값 사용
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
  // 0006 마이그레이션: Google OAuth 연동
  status: ParticipantStatus;
  auth_user_id: string | null; // auth.users.id, Google 로그인 전이면 null
  created_at: string;
}

export interface Prediction {
  id: string;
  round_id: string;
  participant_id: string;
  selected_option_index: number;
  multiplier: number; // 0004 마이그레이션: 초대 성공 시 1씩 증가, 리워드 배수로 쓰임(현재는 표시용)
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

// ── 참가자(유저) 앱 전용 타입 ─────────────────────────────────
// 원래 팀원이 SQLite 프로토타입에서 쓰던 형태를 최대한 그대로 유지해서
// (Supabase로 이식하며) 컴포넌트 쪽 코드를 거의 안 건드리게 했다. 다만 스폰서
// 쪽 Campaign/Prediction과 이름이 겹치는 건 Public 접두사로 구분한다.
//
// 참가자 화면은 캠페인당 라운드 1개(round_number=1)만 본다고 가정한다 —
// campaigns 테이블과 그 캠페인의 라운드 1개를 합쳐서 보여주는 합성 뷰.

export type PublicCampaignStatus = "active" | "ended" | "resolved";

export interface CampaignOption {
  id: string; // rounds.options 배열의 인덱스를 문자열로 (예: "0"~"3")
  label: string;
}

export interface PublicCampaign {
  id: string; // campaigns.id (라운드 id 아님 — URL 안정성을 위해)
  round_id: string; // 내부적으로 필요(예측 제출 시)
  title: string;
  category: string;
  options: CampaignOption[];
  resolution_criteria: string;
  start_at: string;
  end_at: string;
  status: PublicCampaignStatus;
  reward_option_ids: string[]; // 확정 전 빈 배열, 확정 후 [correct_option_index를 문자열로]
  sponsor_name: string;
  sponsor_logo_url: string | null;
  prize_type: "item" | "amount"; // PRODUCT -> item, CREDIT -> amount
  prize_label: string;
  prize_amount: number | null; // CREDIT일 때 credit_pool_amount
  prize_currency: string | null; // CREDIT일 때만
  winner_count: number | null; // PRODUCT: expected_winner_count. CREDIT: 알 수 없음(null)
  thumbnail_url: string;
  media_url: string;
  media_type: "image" | "video";
  mission_url: string | null; // 참여 전 방문해야 하는 스폰서 지정 페이지, null이면 미션 없음
  created_at: string;
}

export interface PublicCampaignWithConsensus extends PublicCampaign {
  total_predictions: number;
  counts: Record<string, number>;
  consensus: Record<string, number>;
}

export interface ConsensusTrendPoint {
  at: string;
  total: number;
  percents: Record<string, number>;
}

// 참가자 화면에서 쓰는 예측 뷰 — DB의 predictions.selected_option_index를
// 문자열 id(CampaignOption.id)로 바꿔서 내려준다.
export interface PublicPrediction {
  id: string;
  participant_id: string;
  campaign_id: string;
  round_id: string;
  selected_option: string;
  multiplier: number;
  submitted_at: string;
}

export type ClaimOrderStatus = "ISSUED" | "FAILED";

// reward_claims를 참가자 화면(클레임 완료 카드 등)에 맞게 단순화한 뷰
export interface ClaimOrder {
  id: string; // reward_claims.id
  prediction_id: string;
  selected_product_id: string | null;
  external_reference_id: string;
  soda_order_id: string | null;
  status: ClaimOrderStatus;
  payout_amount: number | null; // CREDIT 모드에서만 값이 있음
  payout_currency: string | null;
  created_at: string;
}

export type InviteStatus = "pending" | "completed";

export interface Invite {
  id: string;
  token: string;
  inviter_participant_id: string;
  invitee_email: string | null;
  campaign_id: string;
  status: InviteStatus;
  created_at: string;
}

// 참가자 화면(상품 카드, 클레임, 선물하기)에서 쓰는 소다기프트 상품 뷰.
// SodaProduct(lib/soda/client.ts)를 이 모양으로 매핑해서 내려준다 — 고정가
// 상품만 대상으로 한다(가변금액 상품권은 별도 금액 입력 UI가 필요해서 제외).
export type StockStatus = "ON_SALE" | "DISCONTINUED";

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  country_code: string;
  stock_status: StockStatus;
  image_url: string | null;
}

export type GiftOrderStatus = "order_placed" | "fulfilled" | "failed";

export interface GiftOrder {
  id: string;
  sender_participant_id: string;
  product_id: string;
  recipient_email: string;
  recipient_name: string | null;
  message: string | null;
  external_reference_id: string;
  soda_order_id: string | null;
  status: GiftOrderStatus;
  created_at: string;
}

// 0007 마이그레이션: 활동알림(진행 현황 순위 변동 / 마감 임박 / 결과 발표)
export const NOTIFICATION_TYPES = ["rank_change", "deadline_soon", "result"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface AppNotification {
  id: string;
  participant_id: string;
  campaign_id: string;
  campaign_title: string;
  type: NotificationType;
  title: string;
  body: string;
  is_win: boolean | null;
  read_at: string | null;
  created_at: string;
}

export const ANALYTICS_EVENTS = [
  "campaign_viewed",
  "prediction_submitted",
  "invite_link_shared",
  "invite_completed",
  "result_notified",
  "claim_started",
  "claim_completed",
  "sender_cta_clicked",
  "mission_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
