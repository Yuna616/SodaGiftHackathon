-- 참가자 계정 상태 컬럼 + 실제 Google OAuth(Supabase Auth) 연동.
-- Google 로그인이 유일한 가입 경로가 되도록 Supabase 대시보드에서 Google Provider만
-- 켜고 이메일/비밀번호 가입은 막는다(대시보드 설정, 이 마이그레이션 범위 밖).
-- auth.users에 새 계정이 생기면(=Google 로그인 최초 1회) 트리거가 participants 행을
-- 만들거나 기존 이메일과 매칭해서 auth_user_id를 연결하고 status를 active로 세운다.

alter table participants
  add column status text not null default 'active' check (status in ('active', 'inactive')),
  add column auth_user_id uuid unique references auth.users(id) on delete set null;

create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.participants (email, auth_user_id, status)
  values (new.email, new.id, 'active')
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        status = 'active';
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
