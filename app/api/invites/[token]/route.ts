import { NextRequest, NextResponse } from "next/server";
import { findInviteByToken, getCampaign } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const invite = await findInviteByToken(params.token);
  if (!invite) {
    return NextResponse.json({ error: "INVITE_NOT_FOUND" }, { status: 404 });
  }
  const campaign = await getCampaign(invite.campaign_id);
  return NextResponse.json({ invite, campaign });
}
