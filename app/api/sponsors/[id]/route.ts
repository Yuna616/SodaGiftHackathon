import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 고객사 콘솔 대시보드 프로필 편집: 이름/아바타/배너만 수정 가능.
// contact_email, status 같은 필드는 여기서 안 건드린다(인증 붙기 전까지는 손댈 이유가 없음).
const updateSponsorSchema = z
  .object({
    name: z.string().min(1).optional(),
    avatar_url: z.string().optional(),
    banner_url: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "수정할 값이 없습니다" });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = updateSponsorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("sponsors")
    .update(parsed.data)
    .eq("id", params.id)
    .select("id, name, contact_email, status, avatar_url, banner_url, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "SPONSOR_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ sponsor: data });
}
