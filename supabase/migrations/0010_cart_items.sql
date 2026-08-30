-- 인앱 스토어 장바구니. 상품 상세에서 "장바구니에 담기"로 쌓아두고, 실제 결제는
-- 장바구니 화면에서 한 번에 한다. 상품명/가격/이미지는 담을 때 스냅샷으로
-- 저장한다 — 이후 소다기프트 쪽 가격이 바뀌어도 장바구니에 보이는 금액이
-- 흔들리지 않게(결제 시점에 다시 한 번 실제 재고/가격을 검증한다).

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  product_id text not null,
  product_name text not null,
  product_image_url text,
  brand text,
  unit_price numeric not null,
  currency text not null,
  quantity int not null default 1 check (quantity > 0),
  recipient_email text not null,
  recipient_name text,
  is_gift boolean not null default false,
  created_at timestamptz not null default now()
);

create index cart_items_participant_id_idx on cart_items (participant_id);
