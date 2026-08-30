import { NextRequest, NextResponse } from 'next/server';
import { getClaimOrder } from '@/lib/repo';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = getClaimOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ order });
}
