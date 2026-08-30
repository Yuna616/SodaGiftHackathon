import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 서버 전용(API Route Handler에서만 import). RLS를 우회해야 하는 작업에 쓴다.
// 예: /api/rounds/[id]/resolve — resolution_audit_logs에 append-only 기록,
// reward_claims 일괄 생성은 참가자 세션 권한으로는 할 수 없는 서버측 작업이다.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase 서버 환경변수가 설정되어 있지 않습니다");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    // Next.js가 fetch()를 전역 패치해서 Supabase 클라이언트 내부 요청까지 캐싱하는
    // 경우가 있었다(force-dynamic을 걸어도 특정 select 조합에서 재현됨 — 방금 쓴 값을
    // 못 읽어오는 stale read 문제). PostgREST 호출은 매번 최신 상태를 봐야 하므로
    // 여기서 명시적으로 캐시를 끈다.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

// 서버 컴포넌트/라우트 핸들러 전용. 요청 쿠키에 담긴 Google OAuth 세션(로그인한
// 유저가 누구인지)을 읽는다 — 참가자 데이터 조회에는 여전히 서비스 롤 클라이언트를 쓴다.
export function createServerAuthClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component에서 호출되면 쿠키 set이 무시된다 — 세션 갱신은 middleware가 담당.
          }
        },
      },
    }
  );
}
