import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 캠페인 생성 마법사 1단계(기본정보)의 메인 이미지 업로드용.
// 참가자 앱 카드/상세 화면(campaigns.thumbnail_url, media_url)에 그대로 쓰인다.

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file 필드가 필요합니다" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "PNG/JPEG/WEBP/GIF 이미지만 업로드할 수 있습니다" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "이미지는 5MB 이하만 업로드할 수 있습니다" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("campaign-images")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("campaign-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
