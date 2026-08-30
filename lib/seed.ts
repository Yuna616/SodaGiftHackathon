import { getDb, newId } from './db';

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function hoursFromNow(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function main() {
  const db = getDb();

  const counts = db.prepare('SELECT COUNT(*) as c FROM campaigns').get() as unknown as { c: number };
  if (counts.c > 0) {
    console.log('이미 시드된 데이터가 있어 스킵합니다. (초기화하려면 .data/sodapick.db 삭제 후 재실행)');
    return;
  }

  const insertCampaign = db.prepare(
    `INSERT INTO campaigns (id, title, category, options, resolution_criteria, start_at, end_at, status, reward_option_ids, sponsor_name, sponsor_logo_url, prize_type, prize_label, prize_amount, winner_count, thumbnail_url, media_url, media_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // ---- 캠페인 1: K팝, 진행중, 상품형 리워드 ----
  const camp1Options = [
    { id: 'opt_a', label: 'NOVELUX - Spotlight' },
    { id: 'opt_b', label: 'ECHOWAVE - Neon Tide' },
    { id: 'opt_c', label: 'HARBORLIGHT - Glasswing' },
    { id: 'opt_d', label: 'HUEBLOOM - Aftertaste' },
  ];
  const camp1Id = newId('camp');
  insertCampaign.run(
    camp1Id,
    '이번 주 소다차트 1위는?',
    'kpop',
    JSON.stringify(camp1Options),
    '판정 기준: 멜론차트 이번 주 금요일 오후 6시 기준 1위 곡',
    daysFromNow(-1),
    daysFromNow(3),
    'active',
    '[]',
    '이지스토어',
    null,
    'item',
    '모바일 편의점 상품권',
    null,
    10,
    '/campaigns/kpop-chart.svg',
    '/campaigns/kpop-chart.svg',
    'image'
  );

  // ---- 캠페인 2: e스포츠, 진행중, 금액형(디지털 재화) 리워드 ----
  const camp2Options = [
    { id: 'opt_a', label: 'Team Aurora' },
    { id: 'opt_b', label: 'Ghost Circuit' },
    { id: 'opt_c', label: 'Nova Wolves' },
    { id: 'opt_d', label: 'Crimson Byte' },
  ];
  const camp2Id = newId('camp');
  insertCampaign.run(
    camp2Id,
    '이번 시즌 결승 우승팀은?',
    'esports',
    JSON.stringify(camp2Options),
    '판정 기준: 결승전 종료 직후 공식 대회 결과 발표',
    daysFromNow(-2),
    daysFromNow(5),
    'active',
    '[]',
    '커피프렌즈',
    null,
    'amount',
    '소다포인트',
    10000,
    20,
    '/campaigns/esports-final.svg',
    '/campaigns/esports-final.svg',
    'image'
  );

  // ---- 캠페인 3: K팝, 이미 종료+발표된 과거 캠페인 (마이페이지/리더보드 데모용) ----
  const camp3Options = [
    { id: 'opt_a', label: 'SILVERLINE - Undertow' },
    { id: 'opt_b', label: 'PALEDAWN - Static' },
    { id: 'opt_c', label: 'MONOREEF - Halo' },
    { id: 'opt_d', label: 'ASHVINE - Paper Moon' },
  ];
  const camp3Id = newId('camp');
  insertCampaign.run(
    camp3Id,
    '지난 주 소다차트 1위는?',
    'kpop',
    JSON.stringify(camp3Options),
    '판정 기준: 멜론차트 지난 주 금요일 오후 6시 기준 1위 곡',
    daysFromNow(-10),
    daysFromNow(-7),
    'resolved',
    JSON.stringify(['opt_b']),
    '스윗코너',
    null,
    'item',
    '딸기 생크림 케이크 조각',
    null,
    5,
    '/campaigns/kpop-chart-past.svg',
    '/campaigns/kpop-chart-past.svg',
    'image'
  );

  // ---- 데모 참가자 + 예측 시드 (라벨: 데모 데이터) ----
  const demoEmails = [
    'yuna.demo@example.com',
    'jihu.demo@example.com',
    'minseo.demo@example.com',
    'daeun.demo@example.com',
    'harin.demo@example.com',
    'sua.demo@example.com',
    'jiwoo.demo@example.com',
    'noah.demo@example.com',
    'ella.demo@example.com',
    'kai.demo@example.com',
  ];

  const insertParticipant = db.prepare(
    `INSERT INTO participants (id, email, country) VALUES (?, ?, ?)`
  );
  const insertPrediction = db.prepare(
    `INSERT INTO predictions (id, participant_id, campaign_id, selected_option, multiplier, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const participantIds = demoEmails.map((email) => {
    const id = newId('ptc');
    insertParticipant.run(id, email, 'KR');
    return id;
  });

  // 캠페인1: 컨센서스 %·추이 데모를 위해 옵션별 분포 + 제출 시각을 -20시간~-1시간 사이로 분산
  const camp1Distribution = ['opt_a', 'opt_a', 'opt_a', 'opt_a', 'opt_b', 'opt_b', 'opt_c', 'opt_d'];
  camp1Distribution.forEach((opt, i) => {
    if (!participantIds[i]) return;
    insertPrediction.run(newId('pred'), participantIds[i], camp1Id, opt, 1, hoursFromNow(-20 + i * 2.5));
  });

  // 캠페인2: 다른 분포, -40시간~-2시간 사이로 분산
  const camp2Distribution = ['opt_c', 'opt_c', 'opt_a', 'opt_b', 'opt_c', 'opt_d'];
  camp2Distribution.forEach((opt, i) => {
    if (!participantIds[i]) return;
    insertPrediction.run(newId('pred'), participantIds[i], camp2Id, opt, 1, hoursFromNow(-40 + i * 6));
  });

  // 캠페인3(이미 발표됨, 정답 opt_b): 성공/실패 내역이 보이도록 절반은 정답, 절반은 오답
  const camp3Picks = ['opt_b', 'opt_b', 'opt_b', 'opt_a', 'opt_c', 'opt_d', 'opt_b', 'opt_a', 'opt_c', 'opt_b'];
  camp3Picks.forEach((opt, i) => {
    if (!participantIds[i]) return;
    insertPrediction.run(newId('pred'), participantIds[i], camp3Id, opt, 1, daysFromNow(-9));
  });

  // ---- 상품 카탈로그 (기프티콘 mock, 일부 품절 처리) ----
  const insertProduct = db.prepare(
    `INSERT INTO products (id, name, brand, price, country_code, stock_status) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const products: [string, string, number, 'ON_SALE' | 'DISCONTINUED'][] = [
    ['아이스 아메리카노', '커피프렌즈', 4500, 'ON_SALE'],
    ['딸기 생크림 케이크 조각', '스윗코너', 6800, 'ON_SALE'],
    ['치킨 세트', '바삭당', 22000, 'ON_SALE'],
    ['빙수 세트', '설빙테라스', 12000, 'DISCONTINUED'],
    ['모바일 편의점 상품권', '이지스토어', 5000, 'ON_SALE'],
    ['수제버거 세트', '버거하우스', 11000, 'ON_SALE'],
    ['마카롱 6구 세트', '스윗코너', 15000, 'ON_SALE'],
    ['콜드브루 라지', '커피프렌즈', 5200, 'DISCONTINUED'],
  ];
  products.forEach(([name, brand, price, stock]) => {
    insertProduct.run(newId('prod'), name, brand, price, 'KR', stock);
  });

  console.log('시드 완료');
  console.log(`- 캠페인: ${camp1Id}(진행중), ${camp2Id}(진행중), ${camp3Id}(발표완료)`);
  console.log(`- 데모 참가자 ${participantIds.length}명, 상품 ${products.length}종`);
}

main();
