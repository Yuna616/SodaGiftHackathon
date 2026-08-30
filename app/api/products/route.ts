import { NextRequest, NextResponse } from 'next/server';
import { listProducts } from '@/lib/sodagift-mock';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryCode = searchParams.get('country_code') ?? 'KR';
  const products = listProducts(countryCode);
  return NextResponse.json({ products });
}
