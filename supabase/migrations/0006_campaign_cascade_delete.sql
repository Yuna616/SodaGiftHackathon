-- 고객사 콘솔 캠페인 삭제 기능: 임시저장(draft) 캠페인만 삭제 가능하게 API 레벨에서
-- 막을 예정이지만, 그 경우에도 하위 행(라운드/카탈로그/예측 등)이 남아있으면
-- FK 제약(RESTRICT, 기본값)에 걸려 삭제가 실패한다. campaigns/rounds를 참조하는
-- 모든 FK를 ON DELETE CASCADE로 바꿔서 캠페인 하나 지우면 하위 행이 같이 정리되게 한다.
--
-- 발행되어 실제 참가자가 참여한 캠페인은 API 레벨(status='draft' 체크)에서 애초에
-- 삭제 자체를 막기 때문에, 여기서 cascade를 걸어도 판정 불변성(FR-5)에는 영향 없다.

alter table campaign_catalog_items drop constraint campaign_catalog_items_campaign_id_fkey;
alter table campaign_catalog_items add constraint campaign_catalog_items_campaign_id_fkey
  foreign key (campaign_id) references campaigns(id) on delete cascade;

alter table rounds drop constraint rounds_campaign_id_fkey;
alter table rounds add constraint rounds_campaign_id_fkey
  foreign key (campaign_id) references campaigns(id) on delete cascade;

alter table predictions drop constraint predictions_round_id_fkey;
alter table predictions add constraint predictions_round_id_fkey
  foreign key (round_id) references rounds(id) on delete cascade;

alter table reward_claims drop constraint reward_claims_round_id_fkey;
alter table reward_claims add constraint reward_claims_round_id_fkey
  foreign key (round_id) references rounds(id) on delete cascade;

alter table reward_claims drop constraint reward_claims_campaign_id_fkey;
alter table reward_claims add constraint reward_claims_campaign_id_fkey
  foreign key (campaign_id) references campaigns(id) on delete cascade;

alter table resolution_audit_logs drop constraint resolution_audit_logs_round_id_fkey;
alter table resolution_audit_logs add constraint resolution_audit_logs_round_id_fkey
  foreign key (round_id) references rounds(id) on delete cascade;

alter table dispute_tickets drop constraint dispute_tickets_round_id_fkey;
alter table dispute_tickets add constraint dispute_tickets_round_id_fkey
  foreign key (round_id) references rounds(id) on delete cascade;

alter table mission_completions drop constraint mission_completions_campaign_id_fkey;
alter table mission_completions add constraint mission_completions_campaign_id_fkey
  foreign key (campaign_id) references campaigns(id) on delete cascade;

alter table invites drop constraint invites_campaign_id_fkey;
alter table invites add constraint invites_campaign_id_fkey
  foreign key (campaign_id) references campaigns(id) on delete cascade;

alter table analytics_events drop constraint analytics_events_campaign_id_fkey;
alter table analytics_events add constraint analytics_events_campaign_id_fkey
  foreign key (campaign_id) references campaigns(id) on delete cascade;
