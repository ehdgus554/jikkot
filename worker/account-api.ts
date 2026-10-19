import { z } from "zod";
import { summarize } from "../lib/personalization/engine";
import type { Memory } from "../lib/personalization/types";
import { createHash } from "node:crypto";
import { consentPolicy, operationalPolicy } from "../lib/service/policy";
import { deleteHealthData, nextMidnightKST, trackGuest } from "./retention";
import type { FirestoreRest, SparkEnv, Transaction } from "./firestore-rest";
import type { ApiRequest, ApiResponse, Identity } from "./spark-api";
type Route = (
  method: "get" | "post",
  path: string,
  handler: (req: ApiRequest, res: ApiResponse) => Promise<unknown>,
) => void;
type Fail = (status: number, code: string, message: string) => never;
const policyCache = new Map<string, { region: string; until: number }>();
export { nicknameSchema } from "../lib/service/nickname";
import { nicknameSchema } from "../lib/service/nickname";
export const validConsents = z
  .object({
    privacy: z.literal(true),
    healthPersonalization: z.literal(true),
    nonMedical: z.literal(true),
    version: z.literal(consentPolicy.version),
  })
  .strict();
export async function currentHealthConsent(
  db: FirestoreRest,
  uid: string,
  kind: string,
  tx?: Transaction,
) {
  const ref = db.doc(
    `${kind === "guest" ? "guestConsents" : "profiles"}/${uid}`,
  );
  const row = (await (tx ? tx.get(ref) : ref.get())).data();
  const c = kind === "guest" ? row : row?.consents;
  return (
    (kind === "guest" || nicknameSchema.safeParse(row?.nickname).success) &&
    c?.version === consentPolicy.version &&
    c?.privacy === true &&
    c?.healthPersonalization === true &&
    c?.nonMedical === true &&
    (kind !== "guest" || row!.expiresAt > Date.now())
  );
}
export function registerAccount({
  route,
  token,
  db,
  fail,
  env,
}: {
  route: Route;
  token: (r: ApiRequest) => Promise<Identity>;
  db: FirestoreRest;
  fail: Fail;
  env: SparkEnv;
}) {
  route("get", "/service-policy", async (_req, res) => {
    const key = env.FIREBASE_PROJECT_ID!;
    let cached = policyCache.get(key);
    if (!cached || cached.until < Date.now()) {
      const region = db.emulatorOrigin
        ? "local-emulator"
        : String((await db.request("")).locationId ?? "");
      if (!region)
        fail(
          503,
          "POLICY_UNVERIFIED",
          "저장 위치를 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
        );
      cached = { region, until: Date.now() + 300000 };
      policyCache.set(key, cached);
    }
    const cleanup = (await db.doc("cleanupStatus/guests").get()).data();
    res.json({
      ...operationalPolicy,
      version: consentPolicy.version,
      storageRegion: cached.region,
      processingVerified: true,
      reviewedForLaunch:
        cached.region !== "local-emulator" &&
        !!cleanup?.checkedAt &&
        Date.now() - cleanup.checkedAt < 1800000 &&
        cleanup.failed === 0,
      cleanup: {
        lastCheckedAt: cleanup?.checkedAt ?? null,
        lastFailed: cleanup?.failed ?? null,
      },
      technicalLogging:
        "Worker 애플리케이션 요청 로그는 수집하지 않습니다. 삭제 상태는 건강 내용 없이 집계합니다. 인증·보안 접속 메타데이터는 Google Firebase와 Cloudflare의 처리방침·계약에 따라 처리됩니다.",
    });
  });
  route("post", "/records/:id/delete", async (req, res) => {
    const t = await token(req);
    const id = z.string().uuid().parse(req.params.id);
    const profile = (await db.doc(`profiles/${t.uid}`).get()).data();
    if (
      !profile?.active ||
      profile.authProvider !== t.firebase.sign_in_provider
    )
      fail(403, "MEMBER_REQUIRED", "회원 계정을 확인해주세요.");
    const ref = db.doc(`profiles/${t.uid}/records/${id}`),
      sub = db.doc(`submissions/${id}`),
      op = db.doc(`operations/${id}`),
      mem = db.doc(`personalMemory/${t.uid}`);
    await db.runTransaction(async (tx) => {
      const rows = await Promise.all([ref, sub, op, mem].map((r) => tx.get(r)));
      const row = rows[0].data() ?? rows[1].data() ?? rows[2].data();
      if (row?.owner && row.owner !== t.uid)
        fail(403, "OWNER_MISMATCH", "본인의 기록만 삭제할 수 있어요.");
      const rec = row?.recommendationId
        ? db.doc(`recommendations/${row.recommendationId}`)
        : null;
      const recommendation = rec ? (await tx.get(rec)).data() : null;
      for (let i = 0; i < 3; i++) {
        const data = rows[i].data();
        if (data && (!data.owner || data.owner === t.uid))
          tx.delete([ref, sub, op][i]);
      }
      if (rec && recommendation?.owner === t.uid) tx.delete(rec);
      const memory = rows[3].data() as Memory | undefined;
      if (memory) {
        memory.constraints = memory.constraints
          .map((c) => ({
            ...c,
            evidenceIds: c.evidenceIds.filter((x) => x !== `legacy:${id}`),
          }))
          .filter((c) => c.evidenceIds.length);
        memory.revision++;
        tx.set(mem, { ...memory, summary: summarize(memory) });
      }
    });
    res.json({ ok: true });
  });
  route("post", "/account/consent", async (req, res) => {
    const t = await token(req);
    const c = validConsents.parse(req.body);
    const ref = db.doc(`profiles/${t.uid}`);
    const p = (await ref.get()).data();
    if (!p?.active || p.authProvider !== t.firebase.sign_in_provider)
      fail(403, "MEMBER_REQUIRED", "가입 절차를 완료해주세요.");
    await ref.set({ ...p, consents: { ...c, at: Date.now() } });
    res.json({ ok: true });
  });
  route("post", "/account/nickname", async (req, res) => {
    const t = await token(req);
    const name = nicknameSchema.parse(req.body.nickname);
    const ref = db.doc(`profiles/${t.uid}`);
    const index = db.doc(
      `nicknames/${createHash("sha256").update(name.normalize("NFKC").toLocaleLowerCase("ko")).digest("hex")}`,
    );
    await db.runTransaction(async (tx) => {
      const p = (await tx.get(ref)).data();
      const reserved = (await tx.get(index)).data();
      if (!p?.active || p.authProvider !== t.firebase.sign_in_provider)
        fail(403, "MEMBER_REQUIRED", "회원 계정을 확인해주세요.");
      if (p!.nickname)
        fail(409, "NICKNAME_ALREADY_SET", "이미 등록된 닉네임이 있어요.");
      if (reserved && reserved.uid !== t.uid)
        fail(409, "DUPLICATE", "이미 사용 중인 닉네임이에요.");
      tx.set(ref, { ...p, nickname: name });
      tx.set(index, { uid: t.uid, active: true });
    });
    res.json({ ok: true });
  });
  route("post", "/account/health/revoke", async (req, res) => {
    const t = await token(req);
    const ref = db.doc(`profiles/${t.uid}`);
    const p = (await ref.get()).data();
    if (!p?.active || p.authProvider !== t.firebase.sign_in_provider)
      fail(403, "MEMBER_REQUIRED", "회원 계정을 확인해주세요.");
    // Deny new sensitive operations before deleting, including during retries.
    await ref.set({
      ...p,
      consents: { ...p!.consents, healthPersonalization: false },
    });
    const complete = await deleteHealthData(db, t.uid, true);
    res.json({ complete });
  });
  route("post", "/account/delete", async (req, res) => {
    const t = await token(req);
    if (Date.now() / 1000 - t.auth_time > 300)
      fail(401, "REAUTH_REQUIRED", "계정을 삭제하기 전에 다시 인증해주세요.");
    const ref = db.doc(`profiles/${t.uid}`),
      job = db.doc(`accountDeletion/${t.uid}`);
    const p = (await ref.get()).data(),
      oldJob = (await job.get()).data();
    if (p && p.authProvider !== t.firebase.sign_in_provider)
      fail(
        403,
        "LOGIN_METHOD_MISMATCH",
        "처음 가입한 로그인 방법을 사용해주세요.",
      );
    if (t.firebase.sign_in_provider === "anonymous")
      fail(403, "MEMBER_REQUIRED", "비회원은 동의 철회를 이용해주세요.");
    if (p) await ref.set({ ...p, active: false, deleting: true });
    await job.set({
      requestedAt: oldJob?.requestedAt ?? Date.now(),
      status: "pending",
    });
    try {
      if (!(await deleteHealthData(db, t.uid, true))) {
        res.json({ complete: false });
        return;
      }
      const indices = [
        ...(p?.nickname
          ? [
              `nicknames/${createHash("sha256").update(p.nickname.normalize("NFKC").toLocaleLowerCase("ko")).digest("hex")}`,
            ]
          : []),
        ...(p?.username
          ? [
              `usernames/${createHash("sha256").update(p.username).digest("hex")}`,
            ]
          : []),
      ];
      await db.runTransaction(async (tx) => {
        const rows = await Promise.all(indices.map((i) => tx.get(db.doc(i))));
        rows.forEach((r, i) => {
          if (r.data()?.uid === t.uid) tx.delete(db.doc(indices[i]));
        });
        tx.delete(ref);
      });
      const expiresAt = nextMidnightKST();
      await db.runTransaction(async (tx) => {
        const track = await trackGuest(tx, db, t.uid, expiresAt, [job.path]);
        track();
        tx.set(job, {
          owner: t.uid,
          policyVersion: consentPolicy.version,
          expiresAt,
          status: "finishing",
        });
      });
      const origin = db.emulatorOrigin
        ? "http://127.0.0.1:9099/identitytoolkit.googleapis.com"
        : "https://identitytoolkit.googleapis.com";
      const deleted = await fetch(
        `${origin}/v1/accounts:delete?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY ?? "")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: req.bearer }),
        },
      );
      if (!deleted.ok)
        fail(
          503,
          "AUTH_DELETE_FAILED",
          "기록은 삭제했지만 인증 계정 삭제를 완료하지 못했어요. 다시 시도해주세요.",
        );
      await job.delete().catch(() => {}); // Non-health receipt is already queued for expiry if this delete fails.
      res.json({ complete: true });
    } catch (error) {
      await job.set({
        ...((await job.get()).data() ?? {}),
        requestedAt: oldJob?.requestedAt ?? Date.now(),
        status: "retry",
        error: "DELETE_FAILED",
      });
      throw error;
    }
  });
  route("get", "/review/cleanup-status", async (req, res) => {
    const t = await token(req);
    if (
      env.DEPLOYMENT_STAGE !== "review" ||
      env.REVIEW_ENABLED !== "true" ||
      !(env.REVIEW_ALLOWED_UIDS ?? "").split(",").includes(t.uid)
    )
      fail(403, "REVIEW_FORBIDDEN", "검토 권한이 필요합니다.");
    res.json(
      (await db.doc("cleanupStatus/guests").get()).data() ?? {
        checkedAt: null,
      },
    );
  });
}
