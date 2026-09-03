import {
  assertSameOrigin,
  getKstDate,
  getOrCreateGuest,
  getSessionMember,
  json,
} from "@/lib/server-auth";
import { getDatabase } from "@/lib/server-db";

type UsageRow = { routine_id: string; opened_at: string };

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return json({ error: "요청을 확인할 수 없습니다." }, { status: 403 });

  try {
    const body = (await request.json()) as { routineId?: string };
    const routineId = body.routineId ?? "";
    if (!/^MV(?:00[1-9]|0[12][0-9]|030)$/.test(routineId)) {
      return json({ error: "루틴을 확인할 수 없습니다." }, { status: 400 });
    }

    const member = await getSessionMember(request);
    if (member) return json({ allowed: true, member: true });

    const guest = getOrCreateGuest(request);
    const kstDate = getKstDate();
    try {
      await getDatabase()
        .prepare(
          `INSERT INTO guest_routine_usage (id, guest_id, kst_date, routine_id)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), guest.guestId, kstDate, routineId)
        .run();
      return json({ allowed: true, member: false, routineId }, { status: 201 }, guest.cookie);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/unique/i.test(message)) throw error;
      const usage = await getDatabase()
        .prepare(
          `SELECT routine_id, opened_at
           FROM guest_routine_usage
           WHERE guest_id = ? AND kst_date = ?
           LIMIT 1`,
        )
        .bind(guest.guestId, kstDate)
        .first<UsageRow>();
      return json(
        {
          allowed: false,
          code: "LOGIN_REQUIRED",
          message: "로그인이 필요합니다!",
          firstRoutineId: usage?.routine_id ?? null,
        },
        { status: 403 },
        guest.cookie,
      );
    }
  } catch {
    return json({ error: "루틴 열람 권한을 확인하지 못했습니다." }, { status: 500 });
  }
}
