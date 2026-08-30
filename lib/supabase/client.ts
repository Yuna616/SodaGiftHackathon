'use client';

import { createBrowserClient } from "@supabase/ssr";

// 브라우저 전용. Google OAuth 로그인/세션 조회에 쓴다.
// 참가자 데이터(참여/리워드) 자체는 여전히 서버 API 라우트 + 서비스 롤 클라이언트를 거친다 —
// 이 클라이언트는 인증 상태(로그인/로그아웃/세션)만 다룬다.
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Google이 유일한 가입 경로 — Supabase 대시보드에서 Google Provider만 켜고
// 이메일/비밀번호 가입은 비활성화해 둔다(대시보드 설정, 코드 밖).
export async function signInWithGoogle(nextPath = "/my") {
  const supabase = createBrowserSupabaseClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}

export async function signOutOfGoogle() {
  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signOut();
}
