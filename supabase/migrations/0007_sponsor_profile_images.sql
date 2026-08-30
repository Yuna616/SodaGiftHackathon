-- 고객사 콘솔 대시보드에서 프로필(이름/아바타)과 헤더(배너) 이미지를 직접
-- 바꿀 수 있게 sponsors에 이미지 컬럼을 추가하고, 업로드용 스토리지 버킷을 만든다.
-- campaign-images와 분리해서 캠페인 썸네일과 스폰서 프로필 이미지가 섞이지 않게 한다.

alter table sponsors
  add column avatar_url text not null default '',
  add column banner_url text not null default '';

insert into storage.buckets (id, name, public)
values ('sponsor-images', 'sponsor-images', true)
on conflict (id) do nothing;
