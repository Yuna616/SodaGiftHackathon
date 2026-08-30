-- 캠페인 메인 이미지 업로드용 Storage 버킷.
-- public=true라 업로드된 파일의 공개 URL을 참가자 앱 카드/상세 화면에서 바로 <img src>로 쓸 수 있다.
-- 업로드 자체는 서버(app/api/uploads/campaign-image, service role)에서만 하므로
-- 별도 storage RLS 정책 없이도 안전함(service role은 RLS를 우회함).
insert into storage.buckets (id, name, public)
values ('campaign-images', 'campaign-images', true)
on conflict (id) do nothing;
