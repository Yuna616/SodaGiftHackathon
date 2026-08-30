// TODO: 인증 붙기 전까지 seed된 데모 스폰서 id 하드코딩.
// 이 계정은 대시보드에서 "관리자 뷰"로 취급되어(app/api/sponsors/[id]/campaigns/route.ts)
// sponsor_id와 무관하게 전체 캠페인을 본다 — 실제 캠페인은 각자의 sponsor_id(HYBE,
// Netflix 등)를 그대로 유지하므로 참가자 화면의 브랜드명은 안 바뀐다.
export const DEMO_SPONSOR_ID = "72495905-2368-41a3-8eba-fef7a07fcc21";
