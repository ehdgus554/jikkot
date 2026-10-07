import { initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import express, { type Request, type Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
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
} from "../../lib/service/recommendation.js";
import { consentPolicy, operationalPolicy } from "../../lib/service/policy.js";
initializeApp();
const db = getFirestore(),
  auth = getAuth();
const emulator = Boolean(
  process.env.FUNCTIONS_EMULATOR && process.env.FIREBASE_AUTH_EMULATOR_HOST,
);
const kakaoSecret = defineSecret("KAKAO_CLIENT_SECRET"),
  naverSecret = defineSecret("NAVER_CLIENT_SECRET");
export function createApi(content: ContentExtensions = extensions) {
  const app = express();
  app.disable("x-powered-by");
  // Google Functions is served behind its trusted ingress proxy; use the nearest forwarded hop.
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "16kb" }));
  const origins = () =>
    (
      process.env.ALLOWED_ORIGINS ??
      (emulator ? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787" : "")
    )
      .split(",")
      .filter(Boolean);
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
  const password = z.string().min(8).max(72);
  const consents = z.object({
    privacy: z.literal(true),
    nonMedical: z.literal(true),
    version: z.literal(consentPolicy.version),
  });
  const normalNickname = (s: string) =>
    s.normalize("NFKC").toLocaleLowerCase("ko");
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && !origins().includes(origin)) {
      res
        .status(403)
        .json({ code: "ORIGIN_DENIED", error: "허용되지 않은 요청입니다." });
      return;
    }
    if (origin) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
    }
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
      res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.status(204).end();
      return;
    }
    next();
  });
  async function token(req: Request): Promise<DecodedIdToken> {
    const bearer = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) return fail(401, "AUTH_REQUIRED", "인증이 필요합니다.");
    try {
      return await auth.verifyIdToken(bearer, true);
    } catch {
      return fail(
        401,
        "AUTH_EXPIRED",
        "인증이 만료되었습니다. 다시 로그인해주세요.",
      );
    }
  }
  async function actor(req: Request, memberOnly = false) {
    const t = await token(req);
    if (t.firebase.sign_in_provider === "google.com")
      fail(403, "SOCIAL_EXCHANGE_REQUIRED", "소셜 로그인을 완료해주세요.");
    const p = (await db.doc(`profiles/${t.uid}`).get()).data();
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
  async function throttle(req: Request, scope: string, max = 20) {
    const key = hash(`${scope}:${req.ip}`);
    const ref = db.doc(`rateLimits/${key}`);
    const now = Date.now();
    await db.runTransaction(async (tx) => {
      const old = (await tx.get(ref)).data();
      const fresh = !old || now - old.start > 60000;
      const count = fresh ? 1 : old.count + 1;
      if (count > max) fail(429, "RATE_LIMIT", "잠시 후 다시 시도해주세요.");
      tx.set(ref, {
        start: fresh ? now : old.start,
        count,
        expiresAt: new Date(now + 86400000),
      });
    });
  }
  function phoneProof(t: DecodedIdToken) {
    if (
      !t.phone_number ||
      t.firebase.sign_in_provider !== "phone" ||
      Date.now() / 1000 - t.auth_time > 300
    )
      fail(403, "PHONE_REQUIRED", "휴대폰을 다시 인증해주세요.");
    return t.phone_number!;
  }
  const route = (
    method: "get" | "post",
    path: string,
    handler: (req: Request, res: Response) => Promise<unknown>,
  ) =>
    app[method](path, (req, res) => {
      void handler(req, res).catch((err) => {
        if (err instanceof z.ZodError) {
          res.status(400).json({
            code: "INVALID_INPUT",
            error: "입력 항목을 확인해주세요.",
          });
          return;
        }
        if (err instanceof Failure) {
          res.status(err.status).json({ code: err.code, error: err.message });
          return;
        }
        // Never log request bodies, passwords, verification codes or bearer tokens.
        console.error("request failed", {
          path: req.path,
          type: err instanceof Error ? err.name : "Unknown",
        });
        res.status(500).json({
          code: "SERVER_ERROR",
          error: "저장하지 못했습니다. 현재 화면에서 다시 시도해주세요.",
        });
      });
    });
  route("get", "/health", async (_req, res) =>
    res.json({ ok: true, contentVersion: CONTENT_VERSION }),
  );
  route("get", "/providers", async (_req, res) =>
    res.json({
      google: true,
      kakao: Boolean(
        process.env.KAKAO_CLIENT_ID &&
        process.env.KAKAO_CLIENT_SECRET &&
        process.env.PUBLIC_API_URL,
      ),
      naver: Boolean(
        process.env.NAVER_CLIENT_ID &&
        process.env.NAVER_CLIENT_SECRET &&
        process.env.PUBLIC_API_URL,
      ),
    }),
  );
  route("get", "/me", async (req, res) => {
    const t = await token(req);
    const p = (await db.doc(`profiles/${t.uid}`).get()).data();
    if (t.firebase.sign_in_provider === "google.com") {
      res.json({ member: null, kind: "pending", guestConsent: false });
      return;
    }
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
    await throttle(req, "availability", 40);
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
          reservation?.expiresAt?.toMillis() < Date.now()),
    });
  });
  route("post", "/login", async (req, res) => {
    if (!emulator && !process.env.FIREBASE_WEB_API_KEY)
      fail(503, "LOGIN_NOT_CONFIGURED", "로그인 연결을 준비 중입니다.");
    await throttle(req, "login", 10);
    const body = z.object({ username, password }).parse(req.body);
    const mapping = (
      await db.doc(`usernames/${hash(body.username)}`).get()
    ).data();
    if (!mapping?.active)
      fail(401, "LOGIN_FAILED", "아이디 또는 비밀번호를 확인해주세요.");
    const user = await auth.getUser(mapping.uid);
    const endpoint = emulator
      ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
      : "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";
    const result = await fetch(
      `${endpoint}?key=${process.env.FIREBASE_WEB_API_KEY ?? (emulator ? "demo-key" : "")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: body.password,
          returnSecureToken: true,
        }),
      },
    );
    const proof = (await result.json()) as { localId?: string };
    if (!result.ok || proof.localId !== user.uid)
      fail(401, "LOGIN_FAILED", "아이디 또는 비밀번호를 확인해주세요.");
    res.json({ customToken: await auth.createCustomToken(user.uid) });
  });
  route("post", "/signup", async (req, res) => {
    await throttle(req, "signup", 10);
    const t = await token(req);
    const phone = phoneProof(t);
    const b = z
      .object({
        username,
        nickname,
        email: z.string().email().max(254),
        password,
        consents,
      })
      .parse(req.body);
    const refs = [
      db.doc(`usernames/${hash(b.username)}`),
      db.doc(`nicknames/${hash(normalNickname(b.nickname))}`),
      db.doc(`phoneOwners/${hash(phone)}`),
    ];
    const profile = db.doc(`profiles/${t.uid}`);
    const completed = (await profile.get()).data();
    if (completed?.active) {
      if (
        completed.username !== b.username ||
        completed.nickname !== b.nickname ||
        completed.email !== b.email
      )
        fail(409, "ALREADY_MEMBER", "이미 가입된 계정입니다.");
      res.json({ customToken: await auth.createCustomToken(t.uid) });
      return;
    }
    // Auth/Firestore are not one transaction. Reserve -> Auth update -> atomic finalize.
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(profile);
      if (existing.data()?.active)
        fail(409, "ALREADY_MEMBER", "이미 가입된 계정입니다.");
      for (const ref of refs) {
        const d = await tx.get(ref);
        if (
          d.exists &&
          d.data()?.uid !== t.uid &&
          (d.data()?.active ||
            !d.data()?.expiresAt ||
            d.data()!.expiresAt.toMillis() > Date.now())
        )
          fail(
            409,
            "DUPLICATE",
            "이미 사용 중인 아이디·닉네임·전화번호입니다.",
          );
      }
      for (const ref of refs)
        tx.set(ref, {
          uid: t.uid,
          active: false,
          reservedAt: Date.now(),
          expiresAt: new Date(Date.now() + 900000),
        });
    });
    try {
      await auth.updateUser(t.uid, {
        email: b.email,
        password: b.password,
        displayName: b.nickname,
      });
      await db.runTransaction(async (tx) => {
        const docs = await Promise.all(refs.map((ref) => tx.get(ref)));
        if (docs.some((d) => d.data()?.uid !== t.uid))
          fail(409, "RESERVATION_LOST", "가입을 다시 시도해주세요.");
        tx.set(profile, {
          uid: t.uid,
          username: b.username,
          nickname: b.nickname,
          email: b.email,
          phoneHash: hash(phone),
          active: true,
          consents: { ...b.consents, at: Date.now() },
          createdAt: Date.now(),
        });
        for (const ref of refs) tx.set(ref, { uid: t.uid, active: true });
      });
      res.json({ customToken: await auth.createCustomToken(t.uid) });
    } catch (error) {
      // Keep the verified phone account for retry; remove only this attempt's pending reservations.
      const active = (await profile.get()).data()?.active;
      if (!active) {
        await db.runTransaction(async (tx) => {
          const docs = await Promise.all(refs.map((ref) => tx.get(ref)));
          docs.forEach((d, i) => {
            if (d.data()?.uid === t.uid && !d.data()?.active)
              tx.delete(refs[i]);
          });
        });
        await auth.updateUser(t.uid, {
          password: randomBytes(32).toString("base64url"),
          providersToUnlink: ["password"],
        });
      }
      if ((error as { code?: string }).code === "auth/email-already-exists")
        fail(
          409,
          "EMAIL_EXISTS",
          "이미 가입에 사용된 이메일입니다. 기존 계정으로 로그인해주세요.",
        );
      throw error;
    }
  });
  route("post", "/social/google", async (req, res) => {
    const t = await token(req);
    if (t.firebase.sign_in_provider !== "google.com")
      fail(403, "GOOGLE_REQUIRED", "구글 인증을 먼저 완료해주세요.");
    const proof = await auth.getUser(t.uid);
    const provider = proof.providerData.find(
      (p) => p.providerId === "google.com",
    );
    if (!provider)
      fail(403, "GOOGLE_REQUIRED", "구글 계정을 확인하지 못했습니다.");
    // Firebase may internally link a trusted Google email to a password UID.
    // Business identity remains isolated by verified provider subject, never by email.
    const uid = `google_${hash(provider.uid).slice(0, 40)}`;
    try {
      await auth.getUser(uid);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found")
        throw error;
      try {
        await auth.createUser({
          uid,
          displayName: provider.displayName ?? "회원",
        });
      } catch (error) {
        if ((error as { code?: string }).code !== "auth/uid-already-exists")
          throw error;
      }
    }
    await auth.setCustomUserClaims(uid, { verifiedSocial: "google" });
    res.json({ customToken: await auth.createCustomToken(uid) });
  });
  route("post", "/social/activate", async (req, res) => {
    const t = await token(req);
    if (t.firebase.sign_in_provider !== "custom")
      fail(403, "SOCIAL_REQUIRED", "소셜 인증을 먼저 완료해주세요.");
    const user = await auth.getUser(t.uid);
    if (!user.customClaims?.verifiedSocial)
      fail(403, "SOCIAL_REQUIRED", "확인되지 않은 인증입니다.");
    const c = consents.parse(req.body.consents);
    const p = db.doc(`profiles/${t.uid}`);
    await db.runTransaction(async (tx) => {
      const old = await tx.get(p);
      if (old.data()?.active) return;
      const base =
        (user.displayName ?? "회원")
          .normalize("NFKC")
          .replace(/[^가-힣a-zA-Z0-9_]/g, "")
          .slice(0, 6) || "회원";
      let displayName = "";
      let reserved: ReturnType<typeof db.doc> | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = `${base}_${hash(t.uid + ":" + attempt).slice(0, 12)}`;
        const ref = db.doc(`nicknames/${hash(normalNickname(candidate))}`);
        const existing = await tx.get(ref);
        if (!existing.exists || existing.data()?.uid === t.uid) {
          displayName = candidate;
          reserved = ref;
          break;
        }
      }
      if (!reserved)
        fail(409, "NICKNAME_CONFLICT", "가입을 다시 시도해주세요.");
      tx.set(reserved, { uid: t.uid, active: true });
      tx.set(p, {
        uid: t.uid,
        nickname: displayName,
        email: user.email ?? null,
        username: null,
        active: true,
        consents: { ...c, at: Date.now() },
        createdAt: Date.now(),
      });
    });
    res.json({ ok: true });
  });
  route("post", "/recovery", async (req, res) => {
    await throttle(req, "recovery", 10);
    const t = await token(req);
    const phone = phoneProof(t);
    const b = z
      .object({
        action: z.enum(["username", "password"]),
        password: password.optional(),
      })
      .parse(req.body);
    const owner = (await db.doc(`phoneOwners/${hash(phone)}`).get()).data();
    if (!owner?.active || owner.uid !== t.uid)
      fail(
        404,
        "NO_ACCOUNT",
        "인증한 전화번호와 연결된 직접 가입 계정이 없습니다.",
      );
    const p = (await db.doc(`profiles/${t.uid}`).get()).data();
    if (!p?.active || p.phoneHash !== hash(phone))
      fail(403, "RECOVERY_DENIED", "계정 소유권을 확인하지 못했습니다.");
    if (b.action === "username") {
      res.json({ username: p.username });
      return;
    }
    if (!b.password)
      fail(400, "PASSWORD_REQUIRED", "새 비밀번호를 입력해주세요.");
    await auth.updateUser(t.uid, { password: b.password });
    await auth.revokeRefreshTokens(t.uid);
    res.json({ ok: true });
  });
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
      const configuredRetention = Number(
        process.env.OPERATION_RETENTION_DAYS ?? operationalPolicy.retentionDays,
      );
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
      .map((d) => ({ id: d.id, ...d.data() }));
    const last = data.docs[99];
    res.json({
      records: rows,
      nextCursor:
        data.docs.length > 100
          ? { createdAt: last.data().createdAt, id: last.id }
          : null,
    });
  });
  // Provider routes are installed separately; only verified provider responses can create tokens.
  function providerConfig(provider: "kakao" | "naver") {
    const clientId =
      process.env[provider === "kakao" ? "KAKAO_CLIENT_ID" : "NAVER_CLIENT_ID"];
    const secret =
      provider === "kakao" ? kakaoSecret.value() : naverSecret.value();
    const base = process.env.PUBLIC_API_URL;
    if (!clientId || !secret || !base)
      fail(
        503,
        "PROVIDER_NOT_CONFIGURED",
        "이 로그인 방법은 연결 준비 중입니다. 다른 방법을 선택해주세요.",
      );
    return { clientId, secret, callback: `${base}/oauth/${provider}/callback` };
  }
  route("get", "/oauth/:provider/start", async (req, res) => {
    await throttle(req, "oauth", 10);
    const provider = z.enum(["kakao", "naver"]).parse(req.params.provider);
    const origin = z.string().parse(req.query.origin),
      challenge = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(req.query.challenge);
    if (!origins().includes(origin))
      fail(403, "ORIGIN_DENIED", "허용되지 않은 주소입니다.");
    const config = providerConfig(provider);
    const state = randomBytes(32).toString("hex");
    const browser = randomBytes(32).toString("hex");
    await db.doc(`oauthStates/${hash(state)}`).create({
      provider,
      origin,
      challenge,
      browser: hash(browser),
      expiresAt: Date.now() + 600000,
    });
    res.cookie("jikkot_oauth", browser, {
      httpOnly: true,
      secure: !emulator,
      sameSite: "lax",
      maxAge: 600000,
      path: "/",
    });
    const url = new URL(
      provider === "kakao"
        ? "https://kauth.kakao.com/oauth/authorize"
        : "https://nid.naver.com/oauth2.0/authorize",
    );
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callback,
      response_type: "code",
      state,
    }).toString();
    res.redirect(url.toString());
  });
  route("get", "/oauth/:provider/callback", async (req, res) => {
    const provider = z.enum(["kakao", "naver"]).parse(req.params.provider);
    const state = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(req.query.state);
    const stateRef = db.doc(`oauthStates/${hash(state)}`);
    const cookies = req.get("cookie") ?? "";
    const browser = cookies.match(/(?:^|;\s*)jikkot_oauth=([^;]+)/)?.[1] ?? "";
    const saved = await db.runTransaction(async (tx) => {
      const s = (await tx.get(stateRef)).data();
      if (
        !s ||
        s.provider !== provider ||
        s.expiresAt < Date.now() ||
        s.browser !== hash(browser)
      )
        fail(
          403,
          "INVALID_STATE",
          "인증 요청이 만료되었거나 유효하지 않습니다. 다시 시도해주세요.",
        );
      tx.delete(stateRef);
      return s;
    });
    res.clearCookie("jikkot_oauth", { path: "/" });
    const finish = new URL(saved.origin);
    finish.pathname = "/";
    if (req.query.error) {
      finish.searchParams.set("oauthError", "cancelled");
      res.redirect(finish.toString());
      return;
    }
    try {
      const code = z.string().min(1).max(4096).parse(req.query.code);
      const c = providerConfig(provider);
      const endpoint =
        provider === "kakao"
          ? "https://kauth.kakao.com/oauth/token"
          : "https://nid.naver.com/oauth2.0/token";
      const exchange = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: c.clientId,
          client_secret: c.secret,
          redirect_uri: c.callback,
          code,
          state,
        }),
      });
      const providerToken = (await exchange.json()) as {
        access_token?: string;
      };
      if (!exchange.ok || !providerToken.access_token)
        fail(401, "PROVIDER_FAILED", "인증을 완료하지 못했습니다.");
      const response = await fetch(
        provider === "kakao"
          ? "https://kapi.kakao.com/v2/user/me"
          : "https://openapi.naver.com/v1/nid/me",
        { headers: { Authorization: `Bearer ${providerToken.access_token}` } },
      );
      const body = (await response.json()) as {
        id?: number;
        resultcode?: string;
        response?: { id?: string; nickname?: string };
        properties?: { nickname?: string };
      };
      const subject =
        provider === "kakao"
          ? String(body.id ?? "")
          : body.resultcode === "00"
            ? body.response?.id
            : "";
      if (!response.ok || !subject)
        fail(401, "PROVIDER_FAILED", "공급자 계정을 확인하지 못했습니다.");
      // Stable provider subject, never merge accounts on email string equality.
      const uid = `${provider}_${hash(subject).slice(0, 40)}`;
      try {
        await auth.getUser(uid);
      } catch (error) {
        if ((error as { code?: string }).code !== "auth/user-not-found")
          throw error;
        await auth.createUser({
          uid,
          displayName:
            (provider === "kakao"
              ? body.properties?.nickname
              : body.response?.nickname
            )?.slice(0, 20) ?? "회원",
        });
      }
      await auth.setCustomUserClaims(uid, { verifiedSocial: provider });
      const grant = randomBytes(32).toString("hex");
      await db.doc(`oauthGrants/${hash(grant)}`).create({
        uid,
        challenge: saved.challenge,
        expiresAt: Date.now() + 60000,
      });
      finish.searchParams.set("oauthCode", grant);
      res.set("Referrer-Policy", "no-referrer");
      res.redirect(finish.toString());
    } catch {
      finish.searchParams.set("oauthError", "failed");
      res.redirect(finish.toString());
    }
  });
  route("post", "/oauth/exchange", async (req, res) => {
    await throttle(req, "oauth-exchange", 10);
    const b = z
      .object({
        code: z.string().regex(/^[a-f0-9]{64}$/),
        verifier: z.string().min(32).max(128),
      })
      .parse(req.body);
    const ref = db.doc(`oauthGrants/${hash(b.code)}`);
    const uid = await db.runTransaction(async (tx) => {
      const g = (await tx.get(ref)).data();
      if (!g || g.expiresAt < Date.now() || g.challenge !== hash(b.verifier))
        fail(403, "INVALID_GRANT", "인증 요청을 다시 시작해주세요.");
      tx.delete(ref);
      return g.uid as string;
    });
    res.json({ customToken: await auth.createCustomToken(uid) });
  });
  app.use((_req, res) =>
    res.status(404).json({ error: "요청을 찾을 수 없습니다." }),
  );
  return app;
}
export const api = onRequest(
  {
    region: "asia-northeast3",
    secrets: process.env.FUNCTIONS_EMULATOR ? [] : [kakaoSecret, naverSecret],
    maxInstances: 10,
  },
  createApi(),
);
