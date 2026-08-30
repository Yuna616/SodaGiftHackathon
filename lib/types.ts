export type CampaignStatus = 'active' | 'ended' | 'resolved';

export interface CampaignOption {
  id: string;
  label: string;
}

export type CampaignMediaType = 'image' | 'video';
export type PrizeType = 'item' | 'amount';

export interface Campaign {
  id: string;
  title: string;
  category: string;
  options: CampaignOption[];
  resolution_criteria: string;
  start_at: string;
  end_at: string;
  status: CampaignStatus;
  reward_option_ids: string[];
  created_at: string;
  sponsor_name: string;
  sponsor_logo_url: string | null;
  prize_type: PrizeType;
  prize_label: string;
  prize_amount: number | null;
  winner_count: number;
  thumbnail_url: string;
  media_url: string;
  media_type: CampaignMediaType;
}

export interface CampaignWithConsensus extends Campaign {
  total_predictions: number;
  counts: Record<string, number>;
  consensus: Record<string, number>;
}

export interface ConsensusTrendPoint {
  at: string;
  total: number;
  percents: Record<string, number>;
}

export interface Participant {
  id: string;
  email: string;
  country: string | null;
  created_at: string;
}

export interface Prediction {
  id: string;
  participant_id: string;
  campaign_id: string;
  selected_option: string;
  multiplier: number;
  submitted_at: string;
}

export type InviteStatus = 'pending' | 'completed';

export interface Invite {
  id: string;
  token: string;
  inviter_participant_id: string;
  invitee_email: string | null;
  campaign_id: string;
  status: InviteStatus;
  created_at: string;
}

export type StockStatus = 'ON_SALE' | 'DISCONTINUED';

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  country_code: string;
  stock_status: StockStatus;
}

export type OrderStatus = 'ISSUED' | 'FAILED';

export interface ClaimOrder {
  id: string;
  prediction_id: string;
  selected_product_id: string;
  external_reference_id: string;
  soda_order_id: string;
  status: OrderStatus;
  created_at: string;
}

export interface GiftOrder {
  id: string;
  sender_participant_id: string;
  product_id: string;
  recipient_email: string;
  recipient_name: string | null;
  message: string | null;
  external_reference_id: string;
  soda_order_id: string;
  status: OrderStatus;
  created_at: string;
}

export const ANALYTICS_EVENTS = [
  'campaign_viewed',
  'prediction_submitted',
  'invite_link_shared',
  'invite_completed',
  'result_notified',
  'claim_started',
  'claim_completed',
  'sender_cta_clicked',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
