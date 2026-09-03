import {
  assertSameOrigin,
  clearSessionCookie,
  json,
  sessionTokenHash,
} from "@/lib/server-auth";
import { getDatabase } from "@/lib/server-db";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return json({ error: "요청을 확인할 수 없습니다." }, { status: 403 });
  const tokenHash = await sessionTokenHash(request);
  if (tokenHash) {
    await getDatabase().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return json({ ok: true }, {}, clearSessionCookie(request));
}
