-- 보상 방식 확장: 라운드마다 상품형(PRODUCT) / 크레딧 배당형(CREDIT) 중 선택.
-- CREDIT은 스폰서가 라운드에 고정 풀 금액을 걸고, 정답자 수로 나눠 갖는 방식
-- (실제 지급은 소다기프트 가변금액 상품권을 해당 금액만큼 주문해서 처리).
-- 참여 미션: 캠페인당 사이트 방문 1개, 방문해야 예측 제출 가능.

alter table rounds
  add column reward_mode text not null default 'PRODUCT'
    check (reward_mode in ('PRODUCT', 'CREDIT')),
  add column credit_pool_amount numeric,
  add column credit_currency text,
  add column credit_product_id text; -- 지급에 쓸 소다기프트 가변금액 상품권 id

alter table rounds alter column expected_winner_count drop not null;
-- expected_winner_count는 PRODUCT 모드 예산 계산에만 쓰인다. CREDIT 모드는
-- credit_pool_amount 자체가 확정 지출액이라 당첨자 수 추정이 필요 없다.

alter table rounds
  add constraint rounds_reward_mode_fields_check check (
    (reward_mode = 'PRODUCT' and expected_winner_count is not null)
    or
    (reward_mode = 'CREDIT' and credit_pool_amount is not null and credit_currency is not null and credit_product_id is not null)
  );

alter table campaigns
  add column mission_url text; -- 참여 전 방문해야 하는 스폰서 지정 사이트 (null이면 미션 없음)

create table mission_completions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  participant_id uuid not null references participants(id),
  completed_at timestamptz not null default now(),
  unique (campaign_id, participant_id)
);

alter table reward_claims
  add column payout_amount numeric,   -- CREDIT 모드: 정답자 수로 나눈 실수령액
  add column payout_currency text;    -- CREDIT 모드에서만 채워짐 (PRODUCT 모드는 null)
