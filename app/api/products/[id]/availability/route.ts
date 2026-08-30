import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability } from '@/lib/sodagift-mock';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const status = checkAvailability(params.id);
  if (!status) {
    return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ status });
}
