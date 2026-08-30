-- 크레딧 배당 방식 수정: 스폰서가 라운드 설계 시 브랜드 하나를 미리 정해서
-- 당첨자 전원에게 강제로 지급하는 방식이었는데, 이러면 참가자가 원하는 상품을
-- 고를 수 없다(애초 요구사항과 어긋남). 소다기프트엔 "범용 현금" 개념이 없고
-- 가변금액 상품권도 전부 브랜드 락인이라, 대신 스폰서는 통화만 정하고
-- 당첨자가 그 통화 안에서 원하는 브랜드를 스스로 고르는 방식으로 바꾼다.
--
-- credit_product_id(스폰서가 미리 고정하던 상품권)는 더 이상 안 쓴다 — 대신
-- reward_claims.selected_product_id를 참가자가 클레임 확정 시점에 채운다.

alter table rounds drop constraint rounds_reward_mode_fields_check;
alter table rounds drop column credit_product_id;

alter table rounds
  add constraint rounds_reward_mode_fields_check check (
    (reward_mode = 'PRODUCT' and expected_winner_count is not null)
    or
    (reward_mode = 'CREDIT' and credit_pool_amount is not null and credit_currency is not null)
  );
