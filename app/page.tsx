// 메인 페이지: 유저(참가자) 화면과 고객사(스폰서) 화면 진입점을 나눈다.
// 유저 페이지는 다른 팀원이 (participant) 라우트 그룹에서 작업 중 — 여기서는 자리만 잡아둔다.

export default function Home() {
  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>SodaPick</h1>
      <p style={{ color: "#666" }}>K팝 컴백 예측 캠페인</p>

      <div style={{ display: "grid", gap: 16, marginTop: 32 }}>
        <a
          href="/campaigns/new"
          style={{
            display: "block",
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 12,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <h2 style={{ margin: 0 }}>고객사 (스폰서)</h2>
          <p style={{ margin: "8px 0 0", color: "#666" }}>
            캠페인 생성, 라운드 판정, 지급 현황을 관리합니다.
          </p>
        </a>

        {/* TODO: (participant) 라우트가 준비되면 실제 링크로 교체 */}
        <div
          style={{
            display: "block",
            padding: 20,
            border: "1px dashed #ccc",
            borderRadius: 12,
            color: "#999",
          }}
        >
          <h2 style={{ margin: 0 }}>유저 (참가자)</h2>
          <p style={{ margin: "8px 0 0" }}>다른 팀원이 작업 중입니다. 준비되는 대로 연결할 예정입니다.</p>
        </div>
      </div>
    </main>
  );
}
