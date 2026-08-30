import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 캐싱된 상태로 응답하면 안 됨 — Next.js가 fetch()를 기본 캐싱해서 최신 DB 상태 대신
// 오래된 응답을 돌려주는 문제가 실제로 있었음(예: 지급 현황 화면이 새 클레임을 안 보여줌).
export const dynamic = "force-dynamic";

// 캠페인 생성 마법사 2단계(라운드별 질문 설계, PRD 5.3)에서 사용.
// architecture.md 4절 라우트 표엔 없지만 마법사 흐름상 반드시 필요해 추가함.
//
// PRD 12절(오픈 이슈, 확정): 예상 당첨자 수는 스폰서가 여기서 직접 입력한다.
// 0 이하 입력은 저장 불가.
//
// reward_mode 확장: PRODUCT(카탈로그 상품 지급, 기존)과 CREDIT(라운드에 건 고정
// 풀 금액을 정답자 수로 나눠 갖는 배당형) 중 라운드마다 선택. 0003 마이그레이션의
// rounds_reward_mode_fields_check DB 제약과 동일한 조건을 여기서도 검증한다.
//
// CREDIT은 통화만 정한다 — 특정 브랜드 상품권을 스폰서가 미리 고정하지 않는다.
// 소다기프트엔 범용 현금 개념이 없고 가변금액 상품권도 전부 브랜드 락인이라,
// 당첨자가 그 통화 안에서 원하는 브랜드를 클레임 확정 시점에 직접 고른다
// (/api/claims/[id]/confirm).

const baseRoundSchema = {
  round_number: z.number().int().positive(),
  question_text: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(8),
  resolution_criteria: z.string().optional(),
  opens_at: z.string().datetime(),
  closes_at: z.string().datetime(),
};

const createRoundSchema = z.discriminatedUnion("reward_mode", [
  z.object({
    reward_mode: z.literal("PRODUCT"),
    expected_winner_count: z.number().int().positive(),
    ...baseRoundSchema,
  }),
  z.object({
    reward_mode: z.literal("CREDIT"),
    credit_pool_amount: z.number().positive(),
    credit_currency: z.string().min(1),
    ...baseRoundSchema,
  }),
]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = createRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // 발행된 캠페인은 라운드 추가 불가 (FR-3와 동일한 원칙: 발행 후 구성 고정)
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", params.id)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  }
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "발행된 캠페인은 라운드를 추가할 수 없습니다" }, { status: 400 });
  }

  // insert가 아니라 upsert: 마법사에서 예산 확인 단계로 갔다가 "이전 화면으로
  // 돌아가기"로 되돌아와 값을 고친 뒤 다시 "다음"을 누르면, 같은 campaign_id +
  // round_number로 또 저장을 시도하면서 rounds_campaign_id_round_number_key
  // unique 제약을 건드리는 문제가 있었다. draft 상태에서 재제출은 그냥 덮어쓰는
  // 게 맞는 동작이라 upsert로 멱등하게 만든다.
  const { data, error } = await supabase
    .from("rounds")
    .upsert(
      { ...parsed.data, campaign_id: params.id, status: "upcoming" },
      { onConflict: "campaign_id,round_number" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ round: data }, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("campaign_id", params.id)
    .order("round_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rounds: data });
}
