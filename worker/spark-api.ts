import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { FirestoreRest, type SparkEnv } from "./firestore-rest";
import {
  CONTENT_VERSION,
  validateAnswers,
  makeRecommendation,
  snapshot,
  nextRecommendation,
  kstDate,
  extensions,
  type Answers,
  type Feedback,
  type ContentExtensions,
} from "../lib/service/recommendation.js";
import { consentPolicy, operationalPolicy } from "../lib/service/policy.js";

export type Identity = {
  uid: string;
  email?: string;
  auth_time: number;
  firebase: { sign_in_provider: string };
};
const rateWindows = new Map<string, { start: number; count: number }>();
const googleKeys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
export async function verifyFirebaseToken(
  bearer: string,
  env: SparkEnv,
): Promise<Identity> {
  const { payload } = await jwtVerify(bearer, googleKeys, {
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    audience: env.FIREBASE_PROJECT_ID,
    algorithms: ["RS256"],
  });
  if (
    !payload.sub ||
    payload.sub.length > 128 ||
    typeof payload.auth_time !== "number"
  )
    throw new Error("Invalid identity");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY ?? "")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: bearer }),
    },
  );
  const data = (await response.json()) as {
    users?: { localId: string; disabled?: boolean; validSince?: string }[];
  };
  const user = data.users?.[0];
  if (
    !response.ok ||
    user?.localId !== payload.sub ||
    user.disabled ||
    Number(user.validSince ?? 0) > payload.auth_time
  )
    throw new Error("Expired identity");
  const provider = (
    payload.firebase as { sign_in_provider?: string } | undefined
  )?.sign_in_provider;
  if (!["password", "google.com", "anonymous"].includes(provider ?? ""))
    throw new Error("Unsupported identity");
  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    auth_time: payload.auth_time,
    firebase: { sign_in_provider: provider! },
  };
}
type ApiRequest = {
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, string>;
  path: string;
  bearer?: string;
};
type ApiResponse = { json(value: unknown): void };
export function createSparkApi(
  env: SparkEnv,
  content: ContentExtensions = extensions,
  options: {
    db?: FirestoreRest;
    verify?: (bearer: string) => Promise<Identity>;
  } = {},
) {
  const db = options.db ?? new FirestoreRest(env);
  const handlers: {
    method: string;
    pattern: string;
    handle: (req: ApiRequest, res: ApiResponse) => Promise<unknown>;
  }[] = [];
  const route = (
    method: "get" | "post",
    pattern: string,
    handle: (req: ApiRequest, res: ApiResponse) => Promise<unknown>,
  ) => handlers.push({ method: method.toUpperCase(), pattern, handle });
  class Failure extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  function fail(status: number, code: string, message: string): never {
    throw new Failure(status, code, message);
  }
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const id = z.string().uuid();
  const username = z.string().regex(/^[a-z0-9_]{4,20}$/);
  const nickname = z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[가-힣a-zA-Z0-9_]+$/);
  const consents = z.object({
    privacy: z.literal(true),
    nonMedical: z.literal(true),
    version: z.literal(consentPolicy.version),
  });
  const normalNickname = (s: string) =>
    s.normalize("NFKC").toLocaleLowerCase("ko");

  async function token(req: ApiRequest): Promise<Identity> {
    if (!req.bearer) return fail(401, "AUTH_REQUIRED", "인증이 필요합니다.");
    try {
      return await (options.verify
        ? options.verify(req.bearer)
        : verifyFirebaseToken(req.bearer, env));
    } catch {
      return fail(
        401,
        "AUTH_EXPIRED",
        "인증이 만료되었습니다. 다시 로그인해주세요.",
      );
    }
  }
  route("get", "/health", async (_req, res) =>
    res.json({ ok: true, plan: "spark", contentVersion: CONTENT_VERSION }),
  );
  route("get", "/providers", async (_req, res) =>
    res.json({ google: true, kakao: false, naver: false }),
  );
  async function actor(req: ApiRequest, memberOnly = false) {
    const t = await token(req);
    const p = (await db.doc(`profiles/${t.uid}`).get()).data();
    if (p?.active && p.authProvider !== t.firebase.sign_in_provider)
      fail(
        403,
        "LOGIN_METHOD_MISMATCH",
        "처음 가입한 로그인 방법으로 접속해주세요.",
      );
    if (p?.active)
      return { uid: t.uid, kind: "member" as const, profile: p, token: t };
    if (memberOnly || t.firebase.sign_in_provider !== "anonymous")
      return fail(
        403,
        "MEMBER_REQUIRED",
        "회원가입과 필수 동의를 완료해주세요.",
      );
    return { uid: t.uid, kind: "guest" as const, profile: null, token: t };
  }
  route("get", "/me", async (req, res) => {
    const t = await token(req);
    const p = (await db.doc(`profiles/${t.uid}`).get()).data();
    if (p?.active && p.authProvider !== t.firebase.sign_in_provider)
      fail(
        403,
        "LOGIN_METHOD_MISMATCH",
        "처음 가입한 로그인 방법으로 접속해주세요.",
      );
    res.json({
      member: p?.active
        ? { uid: t.uid, username: p.username, nickname: p.nickname }
        : null,
      kind: p?.active
        ? "member"
        : t.firebase.sign_in_provider === "anonymous"
          ? "guest"
          : "pending",
      guestConsent: (await db.doc(`guestConsents/${t.uid}`).get()).exists,
    });
  });
  route("post", "/availability", async (req, res) => {
    const { kind, value } = z
      .object({ kind: z.enum(["username", "nickname"]), value: z.string() })
      .parse(req.body);
    const normalized =
      kind === "username"
        ? username.parse(value)
        : normalNickname(nickname.parse(value));
    const doc = await db
      .doc(
        `${kind === "username" ? "usernames" : "nicknames"}/${hash(normalized)}`,
      )
      .get();
    const reservation = doc.data();
    res.json({
      available:
        !doc.exists ||
        (!reservation?.active &&
          reservation?.expiresAt instanceof Date &&
          reservation.expiresAt.getTime() < Date.now()),
    });
  });

  async function activate(req: ApiRequest, res: ApiResponse, social: boolean) {
    const t = await token(req);
    if (
      t.firebase.sign_in_provider !== (social ? "google.com" : "password") ||
      !t.email
    )
      fail(
        403,
        "SIGNUP_AUTH_REQUIRED",
        "이메일 또는 구글 인증을 먼저 완료해주세요.",
      );
    const b = z
      .object({
        username: social ? username.optional() : username,
        nickname,
        consents,
      })
      .parse(req.body);
    const profile = db.doc(`profiles/${t.uid}`);
    const refs = [
      db.doc(`nicknames/${hash(normalNickname(b.nickname))}`),
      ...(b.username ? [db.doc(`usernames/${hash(b.username)}`)] : []),
    ];
    await db.runTransaction(async (tx) => {
      const old = (await tx.get(profile)).data();
      if (old?.active) {
        if (old.authProvider !== t.firebase.sign_in_provider)
          fail(
            409,
            "LOGIN_METHOD_MISMATCH",
            "이미 가입한 계정의 로그인 방법을 사용해주세요.",
          );
        return;
      }
      const reserved = await Promise.all(refs.map((ref) => tx.get(ref)));
      if (reserved.some((doc) => doc.exists && doc.data()?.uid !== t.uid))
        fail(409, "DUPLICATE", "이미 사용 중인 아이디 또는 닉네임입니다.");
      tx.set(profile, {
        uid: t.uid,
        authProvider: t.firebase.sign_in_provider,
        username: b.username ?? null,
        nickname: b.nickname,
        email: t.email,
        active: true,
        consents: { ...b.consents, at: Date.now() },
        createdAt: Date.now(),
      });
      for (const ref of refs) tx.set(ref, { uid: t.uid, active: true });
    });
    res.json({ ok: true });
  }
  route("post", "/signup", (req, res) => activate(req, res, false));
  route("post", "/social/activate", (req, res) => activate(req, res, true));
  route("post", "/guest/consent", async (req, res) => {
    const a = await actor(req);
    if (a.kind !== "guest")
      fail(403, "GUEST_REQUIRED", "비회원 전용 요청입니다.");
    z.object({
      nonMedical: z.literal(true),
      version: z.literal(consentPolicy.version),
    }).parse(req.body);
    await db
      .doc(`guestConsents/${a.uid}`)
      .set({ version: consentPolicy.version, at: Date.now() });
    res.json({ ok: true });
  });
  route("post", "/guest/consent/revoke", async (req, res) => {
    const a = await actor(req);
    if (a.kind !== "guest")
      fail(403, "GUEST_REQUIRED", "비회원 전용 요청입니다.");
    await db.doc(`guestConsents/${a.uid}`).delete();
    res.json({ ok: true });
  });
  route("get", "/eligibility", async (req, res) => {
    const a = await actor(req);
    if (a.kind === "member") {
      res.json({ allowed: true });
      return;
    }
    if (!(await db.doc(`guestConsents/${a.uid}`).get()).exists)
      fail(403, "CONSENT_REQUIRED", "비의료 서비스 동의가 필요합니다.");
    const usage = (
      await db.doc(`guestDays/${hash(a.uid + ":" + kstDate())}`).get()
    ).data();
    res.json({
      allowed: !usage,
      recommendationId: usage?.recommendationId ?? null,
    });
  });
  route("post", "/recommendations", async (req, res) => {
    const a = await actor(req);
    const rid = id.parse(req.body.recommendationId);
    let answers: Answers;
    try {
      answers = validateAnswers(req.body.answers, content);
    } catch (e) {
      fail(
        400,
        "INVALID_ANSWERS",
        e instanceof Error ? e.message : "문진을 확인해주세요.",
      );
    }
    if (
      a.kind === "guest" &&
      !(await db.doc(`guestConsents/${a.uid}`).get()).exists
    )
      fail(403, "CONSENT_REQUIRED", "비의료 서비스 동의가 필요합니다.");
    const rec = makeRecommendation(answers!);
    const ref = db.doc(`recommendations/${rid}`);
    const day = kstDate();
    const dayRef = db.doc(`guestDays/${hash(a.uid + ":" + day)}`);
    const result = await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        const r = existing.data()!;
        if (r.owner !== a.uid || r.kind !== a.kind)
          fail(403, "OWNER_MISMATCH", "조회할 수 없는 추천입니다.");
        if (JSON.stringify(r.snapshot.answers) !== JSON.stringify(answers))
          fail(409, "ID_REUSE", "새 추천을 시작해주세요.");
        return r;
      }
      if (a.kind === "guest") {
        const usage = await tx.get(dayRef);
        if (usage.exists) fail(409, "DAILY_LIMIT", "오늘 체험 완료");
      }
      const value = {
        owner: a.uid,
        kind: a.kind,
        recommendationId: rid,
        reason: rec.reason,
        snapshot: snapshot(answers!, rec.routine, rec.pattern, content),
        date: day,
        createdAt: Date.now(),
      };
      tx.create(ref, value);
      if (a.kind === "guest")
        tx.create(dayRef, {
          owner: a.uid,
          recommendationId: rid,
          date: day,
          consumedAt: Date.now(),
        });
      return value;
    });
    res.json(result);
  });
  route("get", "/recommendations/:id", async (req, res) => {
    const a = await actor(req);
    const r = (
      await db.doc(`recommendations/${id.parse(req.params.id)}`).get()
    ).data();
    if (!r || r.owner !== a.uid || r.kind !== a.kind)
      fail(404, "NOT_FOUND", "추천을 찾을 수 없습니다.");
    res.json(r);
  });
  route("post", "/feedback", async (req, res) => {
    const a = await actor(req);
    const b = z
      .object({
        recommendationId: id,
        submissionId: id,
        feedback: z.enum(["better", "same", "worse"]),
      })
      .parse(req.body);
    const recRef = db.doc(`recommendations/${b.recommendationId}`),
      subRef = db.doc(`submissions/${b.submissionId}`);
    await db.runTransaction(async (tx) => {
      const rec = (await tx.get(recRef)).data();
      const old = (await tx.get(subRef)).data();
      if (!rec || rec.owner !== a.uid || rec.kind !== a.kind)
        fail(
          403,
          "OWNER_MISMATCH",
          "본인의 추천에만 피드백을 남길 수 있습니다.",
        );
      if (old) {
        if (
          old.owner !== a.uid ||
          old.recommendationId !== b.recommendationId ||
          old.feedback !== b.feedback
        )
          fail(409, "SUBMISSION_CONFLICT", "이미 제출된 피드백입니다.");
        return;
      }
      if (rec.submissionId)
        fail(409, "ALREADY_SUBMITTED", "이미 제출된 추천입니다.");
      const value = {
        owner: a.uid,
        kind: a.kind,
        ...b,
        snapshot: rec.snapshot,
        createdAt: Date.now(),
        date: kstDate(),
        changes: [],
      };
      tx.create(subRef, value);
      const configuredRetention = Number(operationalPolicy.retentionDays);
      const expiry =
        Number.isInteger(configuredRetention) && configuredRetention > 0
          ? { expiresAt: new Date(Date.now() + configuredRetention * 86400000) }
          : {};
      tx.create(db.doc(`operations/${b.submissionId}`), {
        ...value,
        ...expiry,
        consentVersion: consentPolicy.version,
      });
      tx.update(recRef, { submissionId: b.submissionId, feedback: b.feedback });
      if (a.kind === "member")
        tx.create(db.doc(`profiles/${a.uid}/records/${b.submissionId}`), value);
    });
    res.json({ ok: true });
  });
  route("post", "/next", async (req, res) => {
    const a = await actor(req, true);
    const b = z
      .object({
        recommendationId: id,
        nextRecommendationId: id,
        changes: z.array(z.string()).max(20),
      })
      .parse(req.body);
    const ref = db.doc(`recommendations/${b.recommendationId}`);
    const rec = (await ref.get()).data();
    if (
      !rec ||
      rec.owner !== a.uid ||
      rec.kind !== "member" ||
      !rec.submissionId
    )
      fail(
        403,
        "OWNER_MISMATCH",
        "피드백을 저장한 본인의 추천만 이어갈 수 있습니다.",
      );
    const choices = content.changes?.[rec.snapshot.routine.id] ?? [];
    if (
      b.changes.some((c) => !choices.some((q) => q.id === c)) ||
      new Set(b.changes).size !== b.changes.length ||
      (rec.feedback === "worse" && choices.length > 0 && b.changes.length === 0)
    )
      fail(400, "INVALID_CHANGES", "변화 항목을 선택해주세요.");
    const next = nextRecommendation(
      rec.snapshot.answers,
      rec.snapshot.routine.id,
      rec.snapshot.pattern,
      rec.feedback as Feedback,
      b.changes,
      content,
    );
    const newRef = db.doc(`recommendations/${b.nextRecommendationId}`);
    const result = await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data()!;
      const existing = (await tx.get(newRef)).data();
      if (
        current.nextRecommendationId &&
        current.nextRecommendationId !== b.nextRecommendationId
      )
        fail(409, "NEXT_EXISTS", "이미 다음 추천이 저장되어 있습니다.");
      if (
        existing &&
        (existing.owner !== a.uid || existing.parentId !== b.recommendationId)
      )
        fail(403, "OWNER_MISMATCH", "추천 식별자를 확인해주세요.");
      const changeSnapshots = choices
        .filter((q) => b.changes.includes(q.id))
        .map((q) => ({ id: q.id, label: q.label }));
      tx.update(db.doc(`profiles/${a.uid}/records/${rec.submissionId}`), {
        changes: changeSnapshots,
      });
      tx.update(db.doc(`operations/${rec.submissionId}`), {
        changes: changeSnapshots,
      });
      tx.update(db.doc(`submissions/${rec.submissionId}`), {
        changes: changeSnapshots,
      });
      if (!next) return null;
      const value = existing ?? {
        owner: a.uid,
        kind: "member",
        recommendationId: b.nextRecommendationId,
        parentId: b.recommendationId,
        reason: rec.reason,
        snapshot: snapshot(
          rec.snapshot.answers,
          next,
          rec.snapshot.pattern,
          content,
        ),
        date: kstDate(),
        createdAt: Date.now(),
      };
      if (!existing) tx.create(newRef, value);
      tx.update(ref, { nextRecommendationId: b.nextRecommendationId });
      return value;
    });
    res.json({ recommendation: result });
  });
  route("get", "/records", async (req, res) => {
    const a = await actor(req, true);
    let query = db
      .collection(`profiles/${a.uid}/records`)
      .orderBy("createdAt", "desc")
      .orderBy("__name__", "desc");
    if (req.query.after !== undefined || req.query.afterId !== undefined) {
      const cursor = z
        .object({ after: z.coerce.number().int().min(0), afterId: id })
        .parse(req.query);
      query = query.startAfter(cursor.after, cursor.afterId);
    }
    const data = await query.limit(101).get();
    const rows = data.docs
      .slice(0, 100)
      .map((d) => ({ id: d.id, ...d.data()! }));
    const last = data.docs[99];
    res.json({
      records: rows,
      nextCursor:
        data.docs.length > 100
          ? { createdAt: last.data()!.createdAt, id: last.id }
          : null,
    });
  });

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (origin && origin !== url.origin && !allowed.includes(origin))
      return respond(
        { code: "ORIGIN_DENIED", error: "허용되지 않은 요청입니다." },
        403,
      );
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
      headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      return new Response(null, { status: 204, headers });
    }
    try {
      // Best-effort per-isolate protection; no extra Firestore writes for rate counters.
      const ip = request.headers.get("CF-Connecting-IP") ?? "local";
      const now = Date.now();
      let window = rateWindows.get(ip);
      if (!window || now - window.start >= 60000) {
        if (rateWindows.size >= 10000)
          rateWindows.delete(rateWindows.keys().next().value!);
        window = { start: now, count: 0 };
        rateWindows.set(ip, window);
      }
      if (request.headers.has("CF-Connecting-IP") && ++window.count > 120)
        return respond(
          { code: "RATE_LIMIT", error: "잠시 후 다시 시도해주세요." },
          429,
        );
      const pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
      const route = handlers.find(
        (candidate) =>
          candidate.method === request.method &&
          candidate.pattern.split("/").length === pathname.split("/").length &&
          candidate.pattern
            .split("/")
            .every(
              (part, i) =>
                part.startsWith(":") || part === pathname.split("/")[i],
            ),
      );
      if (!route)
        return respond(
          { code: "NOT_FOUND", error: "요청을 찾을 수 없습니다." },
          404,
        );
      const params = Object.fromEntries(
        route.pattern
          .split("/")
          .flatMap((part, i) =>
            part.startsWith(":")
              ? [[part.slice(1), decodeURIComponent(pathname.split("/")[i])]]
              : [],
          ),
      );
      let body: Record<string, unknown> = {};
      if (request.method === "POST") {
        if (
          !request.headers.get("Content-Type")?.startsWith("application/json")
        )
          return respond(
            { code: "INVALID_INPUT", error: "JSON 요청이 필요합니다." },
            415,
          );
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 16384)
          return respond(
            { code: "INVALID_INPUT", error: "요청이 너무 큽니다." },
            413,
          );
        body = z.record(z.unknown()).parse(JSON.parse(raw));
      }
      let result: unknown = {};
      await route.handle(
        {
          path: pathname,
          body,
          params,
          query: Object.fromEntries(url.searchParams),
          bearer: request.headers
            .get("Authorization")
            ?.match(/^Bearer (.+)$/)?.[1],
        },
        {
          json(value) {
            result = value;
          },
        },
      );
      return respond(result);
    } catch (error) {
      if (error instanceof Failure)
        return respond(
          { code: error.code, error: error.message },
          error.status,
        );
      if (
        error instanceof z.ZodError ||
        error instanceof SyntaxError ||
        error instanceof URIError
      )
        return respond(
          { code: "INVALID_INPUT", error: "입력 항목을 확인해주세요." },
          400,
        );
      console.error("Spark API request failed", {
        type: error instanceof Error ? error.name : "Unknown",
      });
      return respond(
        {
          code: "SERVER_ERROR",
          error: "저장하지 못했습니다. 현재 화면에서 다시 시도해주세요.",
        },
        500,
      );
    }
  };
}
