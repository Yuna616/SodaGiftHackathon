import { NextRequest, NextResponse } from "next/server";
import { listNotifications, countUnreadNotifications, syncNotificationsForParticipant } from "@/lib/repo";

export const dynamic = "force-dynamic";

// 참가자 앱: 활동알림 목록 + 안 읽은 개수. 조회 시점에 순위/마감 상태를 먼저
// 갱신해서(syncNotificationsForParticipant) 알림함을 열 때마다 최신 상태를 보여준다.
export async function GET(req: NextRequest) {
  const participantId = req.nextUrl.searchParams.get("participant_id");
  if (!participantId) {
    return NextResponse.json({ error: "MISSING_PARTICIPANT_ID" }, { status: 400 });
  }
  await syncNotificationsForParticipant(participantId).catch(() => {});
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(participantId),
    countUnreadNotifications(participantId),
  ]);
  return NextResponse.json({ notifications, unreadCount });
}
