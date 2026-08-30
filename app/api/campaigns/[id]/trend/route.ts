import { NextRequest, NextResponse } from "next/server";
import { getConsensusTrend } from "@/lib/repo";

export const dynamic = "force-dynamic";

// 참가자 앱: 선택 비중 추이 그래프용
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const points = await getConsensusTrend(params.id);
  return NextResponse.json({ points });
}
