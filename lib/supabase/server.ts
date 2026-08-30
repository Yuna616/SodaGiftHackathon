import { createClient } from "@supabase/supabase-js";

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
  });
}
