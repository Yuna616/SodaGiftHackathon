import { NextResponse } from 'next/server';
import { getEventCounts } from '@/lib/analytics';

export async function GET() {
  const counts = getEventCounts();
  return NextResponse.json({ counts });
}
