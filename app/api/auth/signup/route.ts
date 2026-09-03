import {
  assertSameOrigin,
  createPasswordRecord,
  json,
  normalizeUsername,
  prepareSession,
  validateCredentials,
} from "@/lib/server-auth";
import { getDatabase } from "@/lib/server-db";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return json({ error: "요청을 확인할 수 없습니다." }, { status: 403 });

  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = normalizeUsername(body.username ?? "");
    const password = body.password ?? "";
    const validationError = validateCredentials(username, password);
    if (validationError) return json({ error: validationError }, { status: 400 });

    const existing = await getDatabase()
      .prepare("SELECT id FROM members WHERE username = ? LIMIT 1")
      .bind(username)
      .first();
    if (existing) return json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });

    const memberId = crypto.randomUUID();
    const passwordRecord = await createPasswordRecord(password);
    const session = await prepareSession(memberId, request);
    await getDatabase().batch([
      getDatabase()
        .prepare(
          `INSERT INTO members
           (id, username, password_hash, password_salt, password_iterations, tier)
           VALUES (?, ?, ?, ?, ?, 'member')`,
        )
        .bind(memberId, username, passwordRecord.hash, passwordRecord.salt, passwordRecord.iterations),
      getDatabase()
        .prepare(
          "INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)",
        )
        .bind(session.tokenHash, memberId, session.expiresAt),
    ]);

    return json({ member: { id: memberId, username, tier: "member" } }, { status: 201 }, session.cookie);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique/i.test(message)) return json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    return json({ error: "회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
