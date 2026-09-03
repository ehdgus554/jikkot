import {
  assertSameOrigin,
  findMemberForLogin,
  json,
  normalizeUsername,
  prepareSession,
  validateCredentials,
  verifyPassword,
} from "@/lib/server-auth";
import { getDatabase } from "@/lib/server-db";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return json({ error: "요청을 확인할 수 없습니다." }, { status: 403 });

  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = normalizeUsername(body.username ?? "");
    const password = body.password ?? "";
    const validationError = validateCredentials(username, password);
    if (validationError) return json({ error: "아이디 또는 비밀번호를 확인해주세요." }, { status: 401 });

    const member = await findMemberForLogin(username);
    if (!member || !(await verifyPassword(password, member))) {
      return json({ error: "아이디 또는 비밀번호를 확인해주세요." }, { status: 401 });
    }

    const session = await prepareSession(member.id, request);
    await getDatabase()
      .prepare("INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)")
      .bind(session.tokenHash, member.id, session.expiresAt)
      .run();

    return json(
      { member: { id: member.id, username: member.username, tier: member.tier } },
      {},
      session.cookie,
    );
  } catch {
    return json({ error: "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
