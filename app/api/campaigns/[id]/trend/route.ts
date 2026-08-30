import { NextRequest, NextResponse } from 'next/server';
import { getConsensusTrend } from '@/lib/repo';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const points = getConsensusTrend(params.id);
  return NextResponse.json({ points });
}
