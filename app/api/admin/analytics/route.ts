import { NextResponse } from "next/server";
import { getEventCounts } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const counts = await getEventCounts();
  return NextResponse.json({ counts });
}
