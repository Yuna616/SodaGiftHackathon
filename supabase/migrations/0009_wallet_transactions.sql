-- 인앱 스토어: 참가자가 CREDIT 라운드 당첨으로 쌓은 적립금을 실제 소다기프트
-- 상품으로 교환할 수 있게 한다. reward_claims.payout_amount는 "이 라운드에서
-- 얼마를 땄는지"의 기록이고, wallet_transactions는 그 적립/차감 내역을 통화별로
-- 누적 추적하는 원장이다 — 스토어에서 물건을 사면(차감) 잔액이 실제로 줄어야
-- 하는데 reward_claims만으로는 "이미 얼마를 썼는지"를 표현할 수 없어서 분리했다.

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  amount numeric not null,              -- 적립은 +, 차감은 -
  currency text not null,
  reason text not null check (reason in ('credit_reward', 'store_purchase')),
  reward_claim_id uuid references reward_claims(id),
  gift_order_id uuid references gift_orders(id),
  created_at timestamptz not null default now()
);

create index wallet_transactions_participant_id_idx on wallet_transactions (participant_id);
