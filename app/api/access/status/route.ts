import { getKstDate, getOrCreateGuest, getSessionMember, json } from "@/lib/server-auth";
import { getDatabase } from "@/lib/server-db";

type UsageRow = { routine_id: string; opened_at: string };

export async function GET(request: Request) {
  try {
    const member = await getSessionMember(request);
    if (member) return json({ member, guest: null });

    const guest = getOrCreateGuest(request);
    const usage = await getDatabase()
      .prepare(
        `SELECT routine_id, opened_at
         FROM guest_routine_usage
         WHERE guest_id = ? AND kst_date = ?
         LIMIT 1`,
      )
      .bind(guest.guestId, getKstDate())
      .first<UsageRow>();

    return json(
      {
        member: null,
        guest: usage
          ? { used: true, routineId: usage.routine_id, openedAt: usage.opened_at }
          : { used: false, routineId: null, openedAt: null },
      },
      {},
      guest.cookie,
    );
  } catch {
    return json({ error: "이용 상태를 확인하지 못했습니다." }, { status: 500 });
  }
}
