# 인수인계: participants status 컬럼 + Google OAuth 연동

작업일: 2026-08-29 ~ 2026-08-30
브랜치: `ovver89` (origin에 push됨, `develop`보다 3개 커밋 앞섬: `5f5c260`, `55508b5`, `0caae98`)
PR: 아직 안 열림 (본문 초안은 이 문서 맨 아래 "PR 설명 초안" 참고, base `develop` / head `ovver89` 제안)

## 요청 배경

사용자가 두 가지를 요청함:
1. User 테이블을 새로 만들어서 리워드 테이블(reward_claims), 이벤트 참여 테이블(predictions)과
   연동되게 하고 싶다.
2. Supabase에 기본 User 테이블 + 활성/비활성 상태 컬럼을 추가. Google 로그인이 유일한
   회원가입 방법이고, 로그인하면 기본적으로 active 상태가 되어야 한다.

## 결정 사항 (AskUserQuestion으로 확인함)

- **새 테이블 대신 기존 `participants` 테이블에 컬럼 추가**를 선택함. `participants`가 이미
  `predictions`(이벤트 참여), `reward_claims`/`gift_orders`(리워드)와 다 연동돼 있어서 사실상
  User 테이블 역할을 하고 있었음. 별도 `users` 테이블을 만들거나 `participants`를 통째로
  리네임하는 옵션도 제시했지만, 컬럼 추가가 변경 범위가 가장 작아서 선택됨.
- **실제 Supabase Auth Google OAuth까지 연동**하기로 함 (스키마만 준비하고 mock 로그인을
  유지하는 옵션도 있었으나, 실제 연동을 선택).

## 구현 완료된 것

### DB
- `supabase/migrations/0006_participant_status_google_auth.sql`
  - `participants.status` (`active` | `inactive`, 기본값 `active`)
  - `participants.auth_user_id` (uuid, `auth.users(id)` 참조, unique, `on delete set null`)
  - `auth.users` INSERT 트리거(`handle_new_auth_user`): Google 로그인 최초 1회 시 이메일
    기준으로 `participants`를 upsert하고 `auth_user_id` 연결, `status`를 `active`로 세팅.
  - **주의**: 이 마이그레이션은 로컬에 파일만 만들어 놓은 상태다. Supabase 프로젝트에
    실제로 적용(마이그레이션 실행)됐는지는 다음 세션에서 반드시 확인해야 함. 대시보드
    SQL Editor에서 직접 실행했거나 `supabase db push`를 돌렸어야 반영됨.

### 타입
- `lib/types.ts`: `PARTICIPANT_STATUS`/`ParticipantStatus` 추가, `Participant`에
  `status`/`auth_user_id` 필드 추가.

### Supabase Auth 연동 (신규 파일)
- `lib/supabase/client.ts`: 브라우저 클라이언트, `signInWithGoogle(nextPath)`,
  `signOutOfGoogle()`.
- `lib/supabase/server.ts`: 기존 `createServiceRoleClient`는 유지, `createServerAuthClient()`
  추가(요청 쿠키에서 로그인 세션 읽기용).
- `lib/supabase/middleware.ts` + 루트 `middleware.ts`: OAuth 세션 쿠키 갱신.
- `app/auth/callback/route.ts`: Google 리다이렉트 콜백, `code` → 세션 교환 후
  `next` 쿼리로 리다이렉트(기본 `/my`), 실패 시 `/my?login_error=1`.
- `app/(participant)/my/page.tsx`: 로그인 버튼을 mock `GoogleAccountPicker` 대신 실제
  `signInWithGoogle('/my')` 호출로 교체. 페이지 진입 시 localStorage 세션이 없으면 실제
  Supabase Auth 세션(`getUser()`)을 확인해서 참가자 레코드를 확보하고 localStorage
  세션도 같이 세팅(기존 `lib/session.ts` 캐시와 병행 사용).
- `package.json`에 `@supabase/ssr` 추가 (`npm install`로 설치 완료).

`npx tsc --noEmit` 통과 확인함.

## 의도적으로 안 건드린 것

- `app/(participant)/campaigns/[id]/page.tsx`의 미션 게이트 로그인은 여전히 mock
  `GoogleAccountPicker`를 씀. 페이지 이동 없이 같은 화면에서 바로 이어지는 흐름(미션
  방문 → 돌아와서 바로 제출)이라, 실제 OAuth 리다이렉트로 바꾸려면 "로그인 후 원래
  하려던 동작을 재개하는" 로직을 따로 설계해야 해서 이번 범위에서 뺌. 다음 작업 후보.
- `participants` 테이블에 RLS는 안 켬. 기존 컨벤션대로 서비스 롤 클라이언트로만 접근.

## 테스트 진행 상황 (막힌 지점)

로컬 dev 서버(`localhost:3000`)에서 `/my` 접속 → "Google 계정으로 로그인" 버튼 테스트 중이었음.

1. `middleware.ts`를 새로 추가한 뒤 기존에 떠 있던 dev 서버가 라우팅을 못 잡아서 `/`가
   404 났었음 → dev 서버 재시작(`kill` 후 `npm run dev`)으로 해결됨. **앞으로도
   `middleware.ts` 같은 파일을 새로 추가/수정하면 dev 서버 재시작이 필요할 수 있음.**
2. 로그인 버튼을 눌렀더니 `{"code":400,"error_code":"validation_failed","msg":"Unsupported
   provider: provider is not enabled"}` 에러 → Supabase 대시보드에서 Google Provider가
   꺼져 있어서 발생. 예상된 에러.
3. 사용자가 Supabase 대시보드 Authentication → Providers → Google 화면을 열었음. Provider
   토글은 켜져 있는데 **Client IDs / Client Secret이 비어 있는 상태**. Callback URL은
   `https://dvxduwesmbctacgodauy.supabase.co/auth/v1/callback` (Supabase 프로젝트 ref:
   `dvxduwesmbctacgodauy`).
4. Google Cloud Console(`console.cloud.google.com`)에서 OAuth 클라이언트를 만드는 중이었음.
   "Google Auth Platform"(새 UI)의 Branding/Audience/Contact Information/Clients 단계를
   안내함. **마지막으로 확인된 화면은 "Project configuration → App Information" 단계**로,
   아직 OAuth consent screen 설정이 끝나지 않았고 Clients 메뉴에서 실제 OAuth 클라이언트
   ID/Secret 발급 전임.

### 다음 세션에서 이어서 할 일

1. Google Cloud Console에서 OAuth consent screen(Audience에서 External + 테스트 사용자로
   본인 이메일 등록) 마무리 → Clients 메뉴에서 OAuth 클라이언트 ID 생성(Web application,
   redirect URI: `https://dvxduwesmbctacgodauy.supabase.co/auth/v1/callback`).
2. 발급된 Client ID / Client Secret을 Supabase 대시보드 Google Provider 설정에 입력하고 저장.
3. Supabase 대시보드 Authentication → URL Configuration → Redirect URLs에
   `http://localhost:3000/auth/callback` 등록 확인.
4. `supabase/migrations/0006_participant_status_google_auth.sql`이 실제 프로젝트에 적용됐는지
   확인(안 됐으면 적용).
5. 브라우저에서 `localStorage.clear()`로 기존 mock 세션(`sodapick_session`) 지우고 `/my`에서
   실제 로그인 end-to-end 테스트.
6. Supabase Table Editor/SQL Editor에서 `participants` 테이블에 로그인한 계정이
   `status = active`, `auth_user_id` 채워진 채로 생겼는지 확인:
   ```sql
   select id, email, status, auth_user_id, created_at from participants order by created_at desc limit 5;
   ```
7. (선택) 캠페인 상세 화면 미션 게이트도 실제 OAuth로 전환할지 결정.
8. 커밋된 3개 커밋을 `develop`으로 PR 올릴지 결정 (`gh pr create --base develop --head ovver89`).

## PR 설명 초안

제목:
```
feat(participant): 참여 미션 게이트, 마이페이지 개편, Google 로그인 연동
```

본문:
```markdown
### Summary
이번 변경에서는 유저앱 참여 플로우를 정리했다. 참여 미션(외부 페이지 방문)이 있는 캠페인은
방문을 완료해야 예측을 제출하도록 서버에서 막았고, 캠페인 상세 화면에는 지금 할 행동 하나만
보여주는 플로팅 PICK 바를 추가했다. 마이페이지는 누적 리워드, 상품 수령 내역, 이벤트 참여
내역을 한 화면에서 보여주는 구조로 새로 짰다. 로그인은 mock 계정 선택 시트에서 실제 Supabase
Auth 기반 Google OAuth로 전환했고, participants 테이블에 계정 상태(active/inactive) 컬럼을
추가했다.

주요 변경 사항
- 참여 미션 게이트: `campaigns.mission_url`이 있는 캠페인은 `mission_completions`에 완료
  기록이 없으면 예측 제출 API(`/api/predictions`)가 `MISSION_REQUIRED`로 거부한다. 클릭스루
  방식(실제 방문 여부는 검증하지 않음)이고, `mission_url`이 없으면 게이트 없이 바로 제출된다.
- 캠페인 상세 화면(`app/(participant)/campaigns/[id]/page.tsx`)에 플로팅 PICK
  바(`FloatingPickBar`) 추가. 이 화면에서는 하단 탭 내비게이션(`BottomNav`)을 숨긴다.
- 마이페이지(`app/(participant)/my/page.tsx`) 전면 개편: 누적 획득 리워드 카드, 수령한 상품
  리스트(`/my/rewards/[claimId]`), 이벤트 참여 내역을 한 화면에 표시. 쓰지 않던
  `/api/leaderboard` 라우트는 제거했다.
- Supabase 캐싱 버그 수정: `mission_completions` 조회에서 `select("completed_at")` +
  `maybeSingle()` 조합이 항상 빈 값을 반환하는 현상이 있어 `select("*")`로 우회했다.
- Google OAuth(Supabase Auth) 실연동
  - `participants`에 `status`(active/inactive, 기본값 active)와 `auth_user_id`(auth.users
    참조) 컬럼 추가 (`supabase/migrations/0006_participant_status_google_auth.sql`)
  - `auth.users`에 새 계정이 생기면 트리거가 이메일 기준으로 `participants`를 upsert하고
    `auth_user_id`를 연결, `status`를 `active`로 세팅한다. Google이 유일한 가입 경로가
    되도록 설계했다(이메일/비밀번호 provider는 대시보드에서 꺼야 함, 코드 밖 설정).
  - `@supabase/ssr` 추가, 브라우저/서버 클라이언트(`lib/supabase/client.ts`,
    `lib/supabase/server.ts`), 세션 갱신 미들웨어(`middleware.ts`,
    `lib/supabase/middleware.ts`), OAuth 콜백 라우트(`app/auth/callback/route.ts`) 추가.
  - 마이페이지 로그인 버튼을 실제 `signInWithGoogle()` 호출로 교체.
- 디자인 톤 변경: `soda` 팔레트를 오렌지 계열에서 스카이블루 계열로 교체, 스타일 레퍼런스
  이미지 추가.
- `docs/SodaPick_유저앱_PRD.md`를 위 변경 사항(미션 게이트, PICK 바, Google 로그인 전환)에
  맞춰 갱신.

### Test
- `npx tsc --noEmit` 통과
- 로컬 dev 서버에서 `/`, `/my` 라우트 정상 응답 확인
- (수동) 마이페이지 Google 로그인 버튼 클릭, 실제 구글 계정 선택 화면까지 리다이렉트 확인.
  이후 단계는 Supabase 대시보드 Google Provider 설정이 끝나야 끝까지 검증 가능.

### Notes
- 캠페인 상세 화면의 미션 게이트 로그인은 아직 mock `GoogleAccountPicker`를 그대로 쓴다.
  페이지 이동 없이 같은 화면에서 바로 이어지는 흐름이라, 실제 OAuth 리다이렉트로 바꾸려면
  로그인 후 원래 하려던 동작(방문/제출)을 재개하는 로직을 별도로 설계해야 해서 이번
  범위에서는 뺐다.
- Google OAuth를 실제로 쓰려면 Google Cloud Console에서 OAuth 클라이언트를 발급하고,
  Supabase 대시보드에서 Google Provider 활성화와 redirect URL 등록이 필요하다(대시보드
  작업, 코드 밖).
- participants 테이블은 RLS를 켜지 않았다. 기존 컨벤션과 동일하게 서비스 롤 클라이언트로만
  접근한다.
```
