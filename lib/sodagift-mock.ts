import { getDb, newId } from './db';
import type { Product, StockStatus } from './types';

/**
 * SodaGift 기프티콘 발송 API의 mock 구현.
 * PRD 8장 인터페이스(GET /v1/products, GET /v1/products/{id}/availability,
 * POST /v1/orders, GET /v1/orders/{id})와 형태를 맞춰뒀기 때문에, 실제 SODA-API-KEY가
 * 생기면 이 파일의 함수 내부만 실제 fetch 호출로 바꾸면 된다.
 */

export function listProducts(countryCode: string): Product[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM products WHERE country_code = ? ORDER BY price ASC')
    .all(countryCode) as unknown as Product[];
}

export function getProduct(productId: string): Product | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as unknown as Product | undefined;
}

export function checkAvailability(productId: string): StockStatus | null {
  const product = getProduct(productId);
  return product ? product.stock_status : null;
}

export interface SodaOrderInput {
  productId: string;
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  message: string;
  externalReferenceId: string;
}

export interface SodaOrderResult {
  sodaOrderId: string;
  status: 'ISSUED' | 'FAILED';
}

export function submitOrder(input: SodaOrderInput): SodaOrderResult {
  const availability = checkAvailability(input.productId);
  if (availability !== 'ON_SALE') {
    return { sodaOrderId: newId('mockorder'), status: 'FAILED' };
  }
  // 실제 API는 비동기 발송이지만, 데모 안정성을 위해 mock은 즉시 ISSUED 처리한다.
  return { sodaOrderId: newId('mockorder'), status: 'ISSUED' };
}

export function getOrderStatus(sodaOrderId: string): 'ISSUED' | 'FAILED' {
  return sodaOrderId.startsWith('mockorder_') ? 'ISSUED' : 'FAILED';
}
