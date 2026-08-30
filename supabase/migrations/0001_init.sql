-- SodaPick 초기 스키마
-- 출처: docs/architecture.md 2절(DB 스키마) 그대로, expected_winner_count만 추가
-- (docs/SodaPick_고객사앱_PRD.md 12절: 예상 당첨자 수는 스폰서가 라운드 설계 단계에서 직접 입력)

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text not null,
  status text not null default 'active', -- active | suspended
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id),
  title text not null,
  artist_name text,
  prize_pool_total numeric not null default 0,
  prize_pool_spent numeric not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft', -- draft | active | ended
  created_at timestamptz not null default now()
);

create table campaign_catalog_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  product_id text not null,          -- 소다기프트 GET /v1/products 의 id
  is_sponsor_pick boolean not null default false,
  unique (campaign_id, product_id)
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  round_number int not null,
  question_text text not null,
  options jsonb not null,             -- ["옵션1","옵션2","옵션3","옵션4"]
  resolution_criteria text,
  expected_winner_count int not null, -- 예산 게이트 계산용, 스폰서가 라운드 설계 단계에서 직접 입력 (자동 계산 아님)
  correct_option_index int,           -- null until resolved
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  resolved_at timestamptz,
  status text not null default 'upcoming',
    -- upcoming | open | closed_pending_resolution | resolved
  unique (campaign_id, round_number)
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  country text,
  referral_code text not null unique default substr(md5(random()::text), 1, 8),
  invited_by uuid references participants(id),
  created_at timestamptz not null default now()
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id),
  participant_id uuid not null references participants(id),
  selected_option_index int not null,
  submitted_at timestamptz not null default now(),
  is_correct boolean,                 -- resolve 시점에 일괄 채움
  unique (round_id, participant_id)   -- FR-3: 동일 참가자 재제출 방지
);

create table reward_claims (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id),
  campaign_id uuid not null references campaigns(id),
  participant_id uuid not null references participants(id),
  status text not null default 'eligible',
    -- eligible | product_selected | order_placed | fulfilled | failed
  selected_product_id text,
  external_reference_id text not null unique,  -- FR-6: 중복지급 방지 (DB 레벨 방어)
  soda_order_id text,
  soda_order_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, participant_id)
);

create table resolution_audit_logs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id),
  resolved_by uuid not null,           -- sponsor user id
  correct_option_index int not null,
  resolved_at timestamptz not null default now()
);

create table dispute_tickets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id),
  raised_by text not null,
  reason text not null,
  status text not null default 'open', -- open | reviewing | closed
  created_at timestamptz not null default now()
);

-- ── RLS: 판정 불변성 (FR-5) ──────────────────────────────────
-- resolution_audit_logs는 INSERT만 허용하고 UPDATE/DELETE 정책 자체를
-- 만들지 않는다 → 판정 불변성을 DB 권한으로 강제.
alter table resolution_audit_logs enable row level security;

create policy "resolution_audit_logs_insert_only"
  on resolution_audit_logs for insert
  to authenticated
  with check (true);

-- rounds.correct_option_index는 status가 'closed_pending_resolution'일
-- 때만 채워질 수 있고, 채워지는 순간 status를 resolved로 전환한다.
-- 이후 재수정 경로 자체가 없다(트리거가 이미 채워진 값의 재변경을 막는다).
create or replace function check_round_resolvable()
returns trigger as $$
begin
  if new.correct_option_index is distinct from old.correct_option_index then
    if old.correct_option_index is not null then
      raise exception 'round % already resolved, correct_option_index is immutable', old.id;
    end if;
    if old.status <> 'closed_pending_resolution' then
      raise exception 'round % is not in closed_pending_resolution status', old.id;
    end if;
    new.status := 'resolved';
    new.resolved_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_round_resolve
  before update on rounds
  for each row
  execute function check_round_resolvable();
