-- CREDIT 모드도 PRODUCT처럼 "최대 당첨자 수"를 지정할 수 있어야 한다. 지금까지
-- expected_winner_count는 PRODUCT 모드에서만 필수였고 예산 게이트 추정용으로만
-- 쓰였는데(실제 당첨자 수를 제한하지 않았음), 이제 두 모드 모두 필수로 바꾸고
-- 실제 상한으로도 쓴다 — 정답자 수가 이 값을 넘으면 판정 확정 시점에 무작위로
-- 당첨자를 뽑는다(app/api/rounds/[id]/resolve/route.ts).
--
-- lib/repo.ts의 PublicCampaign.winner_count는 이미 두 모드 모두 expected_winner_count를
-- 그대로 내려주고 있었다(주석 참고) — DB 제약이 여기 뒤늦게 맞춰지는 것.

alter table rounds drop constraint rounds_reward_mode_fields_check;

alter table rounds
  add constraint rounds_reward_mode_fields_check check (
    expected_winner_count is not null
    and (
      (reward_mode = 'PRODUCT')
      or
      (reward_mode = 'CREDIT' and credit_pool_amount is not null and credit_currency is not null)
    )
  );
