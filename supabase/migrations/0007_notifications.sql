-- 활동알림: 순위 변동 / 마감 임박 / 결과 발표
-- 참가자별 알림 목록(notifications) + 순위 변동/마감 임박 중복 발송 방지용 상태 컬럼

create table notifications (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  campaign_id uuid not null references campaigns(id),
  type text not null, -- rank_change | deadline_soon | result
  title text not null,
  body text not null,
  is_win boolean, -- type='result'일 때만 사용
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_participant_idx on notifications (participant_id, created_at desc);

-- 라운드별 옵션 순위 상태 — 직전에 통지한 순위를 기억해서, 실제로 순위가
-- 바뀐 순간에만 알림을 만든다(매 폴링마다 중복 생성되는 것을 방지).
create table campaign_option_rank_state (
  round_id uuid not null references rounds(id),
  campaign_id uuid not null references campaigns(id),
  option_index int not null,
  last_rank int not null,
  updated_at timestamptz not null default now(),
  primary key (round_id, option_index)
);

-- 마감 임박(D-1) 알림은 라운드당 한 번만 발송
alter table rounds add column deadline_notified_at timestamptz;
