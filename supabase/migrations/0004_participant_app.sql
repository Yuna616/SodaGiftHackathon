-- 유저(참가자) 앱 통합: 팀원이 SQLite로 따로 만든 프로토타입을 Supabase 기반으로 이식.
-- (참가자 화면은 캠페인당 라운드 1개만 쓴다고 가정 — 다중 라운드 UI는 이후 과제)

alter table campaigns
  add column category text not null default '',
  add column thumbnail_url text not null default '',
  add column media_url text not null default '',
  add column media_type text not null default 'image' check (media_type in ('image', 'video'));

alter table rounds
  add column prize_label text; -- PRODUCT 모드 표시용 문구. null이면 프론트에서 기본값 사용

alter table predictions
  add column multiplier numeric not null default 1; -- 초대 성공 시 1씩 증가

create table invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  inviter_participant_id uuid not null references participants(id),
  invitee_email text,
  campaign_id uuid not null references campaigns(id),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

create table gift_orders (
  id uuid primary key default gen_random_uuid(),
  sender_participant_id uuid not null references participants(id),
  product_id text not null,
  recipient_email text not null,
  recipient_name text,
  message text,
  external_reference_id text not null unique,
  soda_order_id text,
  soda_order_item_id text,
  status text not null default 'order_placed' check (status in ('order_placed', 'fulfilled', 'failed')),
  created_at timestamptz not null default now()
);

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  participant_id uuid references participants(id),
  campaign_id uuid references campaigns(id),
  metadata jsonb,
  created_at timestamptz not null default now()
);
