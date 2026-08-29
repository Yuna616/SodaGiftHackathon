# 아키텍처.md — SodaPick 시스템 설계 참조

> 선택 이유는 `SodaPick_기술아키텍처.md` 참고. 이 문서는 스키마/라우트/상태머신을 그대로 코드로 옮길 수 있는 수준까지 구체화한 것.

## 1. 시스템 다이어그램

```
 참가자 브라우저                     스폰서 브라우저
      │                                  │
      ▼                                  ▼
 ┌─────────────────────────────────────────────┐
 │   Next.js App Router (app/(participant), app/(sponsor)) │
 ├─────────────────────────────────────────────┤
 │        Next.js API Route Handlers (app/api/*)  │
 │        ── SODA_API_KEY는 이 레이어 안에만 ──     │
 └───────────────┬───────────────┬───────────────┘
                 ▼               ▼
      ┌─────────────────┐  ┌─────────────────────┐
      │ Supabase Postgres│  │ SodaGift Biz API      │
      │ + Auth + Realtime│  │ (Sandbox)             │
      └─────────────────┘  └─────────────────────┘
```

## 2. DB 스키마 (Supabase / Postgres)

```sql
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
-- append-only 강제: update/delete 권한 부여하지 않음 (RLS로 차단)

create table dispute_tickets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id),
  raised_by text not null,
  reason text not null,
  status text not null default 'open', -- open | reviewing | closed
  created_at timestamptz not null default now()
);
```

**RLS 핵심 정책 (요지만)**
- `resolution_audit_logs`: INSERT만 허용, UPDATE/DELETE 정책 자체를 만들지 않음 → 판정 불변성을 DB 권한으로 강제.
- `rounds`: `correct_option_index` UPDATE는 `status = 'closed_pending_resolution'`일 때만 허용하는 정책 함수로 감싸고, 성공 시 트리거로 `status`를 `resolved`로 전환.
- `reward_claims.external_reference_id`는 UNIQUE 제약이 곧 중복지급 방지의 최후 방어선.

## 3. 상태 머신

```
Round.status:
  upcoming → open → closed_pending_resolution → resolved
  (resolved 이후 되돌리는 전이 자체가 존재하지 않음 — FR-5)

RewardClaim.status:
  eligible → product_selected → order_placed → fulfilled
                                          └──→ failed → (재시도) → order_placed
```

## 4. 내부 API 라우트

| 라우트 | 메서드 | 설명 | 비고 |
|---|---|---|---|
| `/api/campaigns` | POST | 캠페인 초안 생성 | 스폰서 인증 필요 |
| `/api/campaigns/[id]` | PATCH | 초안 수정 | `status='draft'`일 때만 허용 |
| `/api/campaigns/[id]/budget-check` | GET | 예산 게이트 체크 | 내부에서 `GET /v1/accounts/balance` 호출 후 예상 소요액과 비교 |
| `/api/campaigns/[id]/publish` | POST | 캠페인 발행 | budget-check 통과 못하면 400 |
| `/api/rounds/[id]/resolve` | POST | 라운드 판정 확정 | `status='closed_pending_resolution'`만 허용, 성공 시 `predictions.is_correct` 일괄 계산 + `reward_claims` 생성 + `resolution_audit_logs` 기록 |
| `/api/predictions` | POST | 예측 제출 | `unique(round_id, participant_id)` 위반 시 409, 기존 선택 반환 |
| `/api/products` | GET | 카탈로그 조회 프록시 | `GET /v1/products` 캐시(TTL 5분) |
| `/api/claims/[id]/confirm` | POST | 리워드 상품 확정 + 발송 | 서버가 `external_reference_id` 생성 후 `POST /v1/orders` 호출 |
| `/api/claims/[id]/status` | GET | 발송 상태 확인 | 서버가 `GET /v1/orders/{id}` 호출 후 DB 갱신, Realtime으로 전파 |
| `/api/claims/[id]/retry` | POST | 실패건 재시도 | 동일 `external_reference_id`로 `POST /v1/orders` 재호출 |

## 5. 소다기프트 외부 API 매핑

| 내부 라우트 | 외부 호출 | 캐시/빈도 |
|---|---|---|
| `/api/products` | `GET /v1/products` | 5분 TTL 캐시 |
| `/api/campaigns/[id]/budget-check` | `GET /v1/accounts/balance` | 캐시 없음, 게이트 진입 시마다 |
| `/api/claims/[id]/confirm` | `POST /v1/orders` | 캐시 없음, 클레임당 1회 (멱등키로 보호) |
| `/api/claims/[id]/status` | `GET /v1/orders/{id}` | 서버가 짧은 간격(예: 3초)으로 폴링, 완료되면 중단 |
| `/api/claims/[id]/retry` | `POST /v1/orders` (동일 참조ID) | 실패건 한정 |

## 6. Realtime 채널

| 채널 | 용도 | 구독 주체 |
|---|---|---|
| `predictions:round_id=eq.{id}` | 실시간 컨센서스 % 계산용 | 참가자 앱 (캠페인 상세 화면) |
| `reward_claims:campaign_id=eq.{id}` | 지급 현황 실시간 갱신 | 스폰서 앱 (지급 모니터링 화면) |

## 7. 인증

- 참가자: Supabase Auth 매직링크 (비밀번호 없음, `participants` 테이블과 `auth.users`를 email로 매칭)
- 스폰서: Supabase Auth 이메일+비밀번호 (내부 인원이라 매직링크 대신 일반 로그인으로 충분)
