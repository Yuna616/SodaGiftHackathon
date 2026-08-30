import { NextRequest, NextResponse } from "next/server";
import { getClaimOrder } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await getClaimOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ order });
}
