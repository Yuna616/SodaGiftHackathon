import { NextRequest, NextResponse } from 'next/server';
import { listCampaigns } from '@/lib/repo';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') ?? undefined;
  const sort = (searchParams.get('sort') as 'ending' | 'popular') ?? 'ending';
  const campaigns = listCampaigns(category, sort);
  return NextResponse.json({ campaigns });
}
