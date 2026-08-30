import { NextRequest, NextResponse } from 'next/server';
import { getCampaignWithConsensus } from '@/lib/repo';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const campaign = getCampaignWithConsensus(params.id);
  if (!campaign) {
    return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}
