# 기술.md — SodaPick 개발 참조

> 선택 이유는 `SodaPick_기술아키텍처.md` 참고. 이 문서는 실제로 손 움직일 때 펼쳐두는 참조용.

## 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| 스타일 | Tailwind CSS |
| DB/Auth/Realtime | Supabase (Postgres) |
| 외부 API | 소다기프트 Biz API (Sandbox: `https://biz-sandbox-api.sodagift.com`) |
| 배포 | Vercel (Next.js) + Supabase Cloud |
| AI 코딩 도구 | Claude Code |

## 프로젝트 구조

```
sodapick/
├─ app/
│  ├─ (participant)/                # 모바일 우선
│  │  ├─ campaigns/[id]/page.tsx     # 5.2 캠페인 상세
│  │  ├─ campaigns/[id]/submit/page.tsx  # 5.3 예측 제출
│  │  ├─ claims/[id]/page.tsx        # 5.7~5.9 클레임 전체
│  │  └─ me/page.tsx                 # 5.5 마이페이지
│  ├─ (sponsor)/                    # 데스크탑 우선
│  │  ├─ dashboard/page.tsx          # 5.1
│  │  ├─ campaigns/new/page.tsx      # 5.2 생성 마법사
│  │  ├─ campaigns/[id]/rounds/page.tsx     # 5.7 판정 콘솔
│  │  └─ campaigns/[id]/report/page.tsx     # 5.9
│  └─ api/
│     ├─ campaigns/route.ts
│     ├─ campaigns/[id]/publish/route.ts
│     ├─ campaigns/[id]/budget-check/route.ts
│     ├─ rounds/[id]/resolve/route.ts
│     ├─ predictions/route.ts
│     ├─ products/route.ts                 # GET /v1/products 프록시
│     ├─ claims/[id]/confirm/route.ts      # POST /v1/orders 트리거
│     └─ claims/[id]/retry/route.ts
├─ lib/
│  ├─ supabase/ (client.ts, server.ts)
│  ├─ soda/ (client.ts — SODA-API-KEY 사용하는 유일한 모듈)
│  └─ types.ts                        # DB 테이블 타입
└─ supabase/
   └─ migrations/                     # 아키텍처.md의 SQL 그대로
```

**규칙: `lib/soda/client.ts` 밖에서는 `SODA_API_KEY`를 절대 import하지 않는다.** 다른 곳에서 소다기프트를 호출하고 싶으면 반드시 이 모듈의 함수를 거친다.

## 환경변수 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # 서버 전용, 클라이언트 번들에 절대 포함 금지
SODA_API_KEY=                    # 서버 전용
SODA_API_BASE_URL=https://biz-sandbox-api.sodagift.com
```

## 로컬 개발 시작

```bash
npx create-next-app@latest sodapick --typescript --tailwind --app
cd sodapick
npm install @supabase/supabase-js @supabase/ssr
npx supabase init
npx supabase db push          # supabase/migrations 적용
npm run dev
```

## 코딩 컨벤션

- API Route Handler는 항상 `zod`로 요청 body 검증 후 처리 (`npm install zod`)
- 소다기프트 응답은 그대로 클라이언트에 흘려보내지 않고, 필요한 필드만 골라 우리 타입으로 매핑해서 반환 (외부 API 스펙 변경에 대한 방어막)
- 서버 액션/라우트 함수명은 PRD의 FR 번호를 주석으로 남긴다 (`// FR-5: 판정 확정 후 재수정 불가`) — 리뷰할 때 요구사항 대조가 빨라짐
- 상태값(`status` 컬럼)은 전부 텍스트 enum이 아니라 `as const` TS 유니온 타입으로 `lib/types.ts`에 한 곳에 모아둔다

## 자주 쓰는 소다기프트 호출 (참고용 curl)

```bash
# 카탈로그 조회
curl https://biz-sandbox-api.sodagift.com/v1/products \
  -H "SODA-API-KEY: $SODA_API_KEY"

# 주문 생성 (가변금액 상품권은 item.custom_amount 필수, external_reference_id는 영숫자만)
curl -X POST https://biz-sandbox-api.sodagift.com/v1/orders \
  -H "SODA-API-KEY: $SODA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "item": { "id": "<product_id>", "custom_amount": <가변금액 상품권일 때만> },
    "delivery": { "method": "EMAIL", "recipient": { "name": "...", "email": "..." } },
    "message": "...",
    "external_reference_id": "sodapick<campaign_id><round_id><participant_id>"
  }'

# 잔액 확인
curl https://biz-sandbox-api.sodagift.com/v1/accounts/balance \
  -H "SODA-API-KEY: $SODA_API_KEY"
```
