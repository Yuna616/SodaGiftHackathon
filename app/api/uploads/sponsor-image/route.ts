import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 고객사 콘솔 대시보드의 프로필 편집(아바타/배너 이미지)용.
// campaign-image 업로드와 같은 검증 규칙, 버킷만 sponsor-images로 분리.

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ALLOWED_KINDS = ["avatar", "banner"];

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const kind = formData?.get("kind");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file 필드가 필요합니다" }, { status: 400 });
  }
  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind)) {
    return NextResponse.json({ error: "kind는 avatar 또는 banner여야 합니다" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "PNG/JPEG/WEBP/GIF 이미지만 업로드할 수 있습니다" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "이미지는 5MB 이하만 업로드할 수 있습니다" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${kind}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("sponsor-images")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("sponsor-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
