import { createHash } from "node:crypto";
import { z } from "zod";
import { catalog, movement } from "../lib/personalization/catalog";
import {
  decide,
  normalizeInput,
  summarize,
} from "../lib/personalization/engine";
import { currentChoices, habitChoices } from "../lib/personalization/questions";
import {
  inputSchema,
  emptyMemory,
  VERSION,
  type Memory,
  type Session,
  type Reaction,
} from "../lib/personalization/types";
import {
  awardGrowth,
  kstWeek,
  newGrowth,
  newWeekly,
  type Growth,
  type WeeklyGrowth,
} from "../lib/personalization/growth";
import { openAiAdapter, safeSummary } from "../lib/personalization/ai";
import { kstDate } from "../lib/service/recommendation";
import type { ApiRequest, ApiResponse } from "./spark-api";
import type { FirestoreRest, SparkEnv } from "./firestore-rest";

type Actor = { uid: string; kind: "member" | "guest" };
type Route = (
  method: "get" | "post",
  pattern: string,
  handle: (req: ApiRequest, res: ApiResponse) => Promise<unknown>,
) => void;
type Fail = (status: number, code: string, message: string) => never;
const uuid = z.string().uuid();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const consentVersion = "personalization-draft-v1";
const eventSchema = z
  .object({
    eventId: uuid,
    action: z.enum([
      "complete",
      "skip",
      "stop",
      "pause",
      "resume",
      "feedback",
      "next",
      "followup",
      "correct",
    ]),
    itemId: uuid.optional(),
    reaction: z
      .enum(["better", "same", "worse", "ready", "insufficient", "refreshed"])
      .optional(),
    steps: z.array(z.number().int().min(0).max(20)).max(20).default([]),
    stepsState: z.enum(["selected", "unknown", "unanswered"]).optional(),
    skipReason: z.enum(["space", "support", "time", "other"]).optional(),
    followup: z
      .enum(["continued_comfort", "same", "uncomfortable", "unknown"])
      .optional(),
  })
  .strict();
function allowedReaction(purpose: string, reaction: Reaction) {
  return (
    purpose === "daily"
      ? ["better", "same", "worse"]
      : purpose === "warmup"
        ? ["ready", "insufficient", "worse"]
        : ["refreshed", "same", "worse"]
  ).includes(reaction);
}
function publicSession(session: Session) {
  return {
    id: session.id,
    kind: session.kind,
    review: session.review,
    input: session.input,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    feedback: session.feedback,
    feedbackSubmitted: session.feedbackSubmitted,
    completedAt: session.completedAt,
    nextState: session.nextState ?? null,
    followup: session.followup ?? null,
    feedbackAt: session.feedbackAt ?? null,
    items: session.items.map((item) => ({
      ...item,
      directions: [],
      movement: { ...item.movement, directions: [] },
    })),
  };
}
function directionsFor(id: string, steps: number[]) {
  const item = catalog.find((c) => c.catalogId === id)!;
  if (!steps.length) return [];
  if (id === "O02")
    return [
      ...new Set(
        steps.flatMap((i) => (i === 2 ? ["neck_flexion"] : ["reach_forward"])),
      ),
    ];
  if (id === "O04")
    return [
      ...new Set(
        steps.flatMap((i) => (i === 0 ? ["arm_behind"] : ["torso_rotation"])),
      ),
    ];
  return item.directions;
}
function remember(memory: Memory, session: Session) {
  memory.experiences = memory.experiences.filter(
    (e) => e.sessionId !== session.id,
  );
  for (const item of session.items) {
    if (item.state === "pending") continue;
    memory.experiences.push({
      sessionId: session.id,
      catalogId: item.movement.catalogId,
      at: item.feedbackAt ?? item.performedAt ?? session.createdAt,
      purpose: session.input.purpose,
      area: session.input.area ?? null,
      patterns: session.decision.patterns,
      reaction: item.reaction,
      performed: item.state === "completed",
      directions: item.directions,
      ...(item.skipReason === "space" || item.skipReason === "support"
        ? { environmentSkip: true }
        : {}),
    });
  }
  memory.constraints = memory.constraints
    .map((c) => ({
      ...c,
      evidenceIds: c.evidenceIds.filter((e) => !e.startsWith(session.id + ":")),
    }))
    .filter((c) => c.evidenceIds.length);
  for (const e of memory.experiences.filter(
    (e) => e.sessionId === session.id && e.reaction === "worse",
  )) {
    const key = `${e.sessionId}:${e.catalogId}`;
    const old = memory.constraints.find(
      (c) =>
        c.catalogId === e.catalogId &&
        JSON.stringify(c.directions) === JSON.stringify(e.directions),
    );
    if (old) old.evidenceIds.push(key);
    else
      memory.constraints.push({
        catalogId: e.catalogId,
        directions: e.directions,
        evidenceIds: [key],
      });
  }
  memory.bundles = (memory.bundles ?? []).filter(
    (b) => b.sessionId !== session.id,
  );
  if (
    session.input.purpose !== "daily" &&
    session.feedbackSubmitted &&
    session.feedback
  )
    memory.bundles.push({
      sessionId: session.id,
      catalogIds: session.items
        .filter((i) => i.state === "completed")
        .map((i) => i.movement.catalogId),
      purpose: session.input.purpose,
      reaction: session.feedback,
      at: session.feedbackAt ?? session.updatedAt,
      patterns: session.decision.patterns,
      focus: session.input.focus,
      minutes: session.input.minutes ?? null,
    });
  if (
    session.input.purpose === "daily" &&
    session.followup?.value === "uncomfortable"
  ) {
    const last = session.items.at(-1)!;
    memory.constraints.push({
      catalogId: last.movement.catalogId,
      directions: [],
      evidenceIds: [`${session.id}:followup:${last.movement.catalogId}`],
    });
  }
  memory.revision++;
}
/** Keep new memory current while the approved legacy daily flow remains public. */
export async function rememberLegacyReaction(
  db: FirestoreRest,
  uid: string,
  submissionId: string,
  routineId: string,
  reaction: string,
  changes: readonly string[] = [],
) {
  const item = catalog.find((c) => c.old?.id === routineId);
  if (!item) return;
  const ref = db.doc(`personalMemory/${uid}`);
  await db.runTransaction(async (tx) => {
    const memory = (await tx.get(ref)).data() as Memory | undefined;
    // First access imports all legacy records; do not replace them with a partial bootstrap.
    if (!memory) return;
    const evidence = `legacy:${submissionId}`;
    const previous = JSON.stringify(memory.constraints);
    memory.constraints = memory.constraints
      .map((c) => ({
        ...c,
        evidenceIds: c.evidenceIds.filter((id) => id !== evidence),
      }))
      .filter((c) => c.evidenceIds.length);
    if (reaction === "worse") {
      const steps = changes
        .flatMap((id) =>
          /^step-\d+$/.test(id) ? [Number(id.slice(5)) - 1] : [],
        )
        .filter((i) => i >= 0 && i < item.steps.length);
      memory.constraints.push({
        catalogId: item.catalogId,
        directions: directionsFor(item.catalogId, steps),
        evidenceIds: [evidence],
      });
    }
    if (JSON.stringify(memory.constraints) === previous) return;
    memory.revision++;
    tx.set(ref, { ...memory, summary: summarize(memory) });
  });
}
export function registerPersonalization({
  route,
  actor,
  fail,
  db,
  env,
}: {
  route: Route;
  actor: (req: ApiRequest, memberOnly?: boolean) => Promise<Actor>;
  fail: Fail;
  db: FirestoreRest;
  env: SparkEnv;
}) {
  const sessionRef = (a: Actor, id: string) =>
    db.doc(
      `${a.kind === "member" ? "profiles" : "guestSessions"}/${a.uid}/sessions/${id}`,
    );
  const memoryRef = (a: Actor, review = false) =>
    db.doc(`${review ? "reviewMemory" : "personalMemory"}/${a.uid}`);
  async function reviewAllowed(a: Actor) {
    return (
      a.kind === "member" &&
      env.DEPLOYMENT_STAGE === "review" &&
      env.REVIEW_ENABLED === "true" &&
      (env.REVIEW_ALLOWED_UIDS ?? "")
        .split(",")
        .map((x) => x.trim())
        .includes(a.uid)
    );
  }
  async function requireReview(a: Actor) {
    if (!(await reviewAllowed(a)))
      fail(403, "REVIEW_FORBIDDEN", "검토 권한이 필요합니다.");
  }
  async function loadMemory(a: Actor, review = false): Promise<Memory> {
    if (a.kind === "guest") return emptyMemory();
    const saved = (await memoryRef(a, review).get()).data();
    if (saved) return saved as Memory;
    const memory = emptyMemory();
    if (!review) {
      // Import facts conservatively. Never rewrite or infer fields in legacy snapshots.
      let cursor: { at: number; id: string } | null = null;
      for (;;) {
        let query = db
          .collection(`profiles/${a.uid}/records`)
          .orderBy("createdAt", "desc")
          .orderBy("__name__", "desc");
        if (cursor) query = query.startAfter(cursor.at, cursor.id);
        const legacy = await query.limit(100).get();
        for (const row of legacy.docs) {
          const r = row.data()!;
          const c = catalog.find((c) => c.old?.id === r.snapshot?.routine?.id);
          if (!c || r.feedback !== "worse") continue;
          const steps = (Array.isArray(r.changes) ? r.changes : [])
            .flatMap((x: { id?: string }) =>
              /^step-\d+$/.test(x.id ?? "") ? [Number(x.id!.slice(5)) - 1] : [],
            )
            .filter((x: number) => x >= 0 && x < c.steps.length);
          memory.constraints.push({
            catalogId: c.catalogId,
            directions: directionsFor(c.catalogId, steps),
            evidenceIds: [`legacy:${row.id}`],
          });
        }
        if (legacy.docs.length < 100) break;
        const last = legacy.docs.at(-1)!;
        cursor = { at: last.data()!.createdAt, id: last.id };
      }
    }
    return db.runTransaction(async (tx) => {
      const ref = memoryRef(a, review);
      const existing = (await tx.get(ref)).data() as Memory | undefined;
      if (existing) return existing;
      tx.create(ref, { ...memory, summary: summarize(memory) });
      return memory;
    });
  }
  route("get", "/personalization/context", async (req, res) => {
    const a = await actor(req);
    const review = req.query.review === "true";
    if (review) await requireReview(a);
    const pref =
      a.kind === "member"
        ? (
            await db
              .doc(
                `${review ? "reviewPreferences" : "personalPreferences"}/${a.uid}`,
              )
              .get()
          ).data()
        : null;
    const memory = await loadMemory(a, review);
    const consent =
      a.kind === "member"
        ? (await db.doc(`personalConsents/${a.uid}`).get()).exists
        : true;
    const growth =
      env.GROWTH_ENABLED === "true" && pref?.showGrowth
        ? (
            await db
              .doc(`${review ? "reviewGrowth" : "personalGrowth"}/${a.uid}`)
              .get()
          ).data()
        : null;
    res.json({
      version: VERSION,
      reviewAllowed: await reviewAllowed(a),
      preferences: pref ?? {},
      hasNewSessions: memory.experiences.length > 0 || !!memory.bundles?.length,
      consent,
      consentVersion,
      summary:
        a.kind === "member"
          ? {
              sevenDays: summarize(memory).sevenDays.sessions,
              thirtyDays: summarize(memory).thirtyDays.sessions,
            }
          : null,
      aiAvailable: !!(
        env.AI_ENABLED === "true" &&
        env.AI_API_KEY &&
        env.AI_MODEL
      ),
      growth: growth ?? null,
      growthAvailable: env.GROWTH_ENABLED === "true",
    });
  });
  route("post", "/personalization/consent", async (req, res) => {
    const a = await actor(req, true);
    z.object({
      version: z.literal(consentVersion),
      personalization: z.literal(true),
      ai: z.boolean().default(false),
    })
      .strict()
      .parse(req.body);
    await db
      .doc(`personalConsents/${a.uid}`)
      .set({ ...req.body, confirmedAt: Date.now(), policyReviewed: false });
    res.json({ ok: true });
  });
  route("post", "/personalization/preferences", async (req, res) => {
    const a = await actor(req, true);
    const b = z
      .object({
        habits: z.record(z.array(z.string()).max(30)).default({}),
        showGrowth: z.boolean().default(false),
        sport: z.string().max(30).nullable().default(null),
        review: z.boolean().default(false),
      })
      .strict()
      .parse(req.body);
    if (b.review) await requireReview(a);
    if (
      Object.keys(b.habits).some(
        (k) =>
          ![
            /^(head|neck|shoulder|back|lower|thigh|hamstring|knee|calf|ankle)$/,
          ].some((r) => r.test(k)),
      ) ||
      Object.values(b.habits)
        .flat()
        .some((id) => !habitChoices.some((q) => q.id === id))
    )
      fail(400, "INVALID_INPUT", "습관 선택을 확인해주세요.");
    await db
      .doc(`${b.review ? "reviewPreferences" : "personalPreferences"}/${a.uid}`)
      .set({ ...b, version: VERSION, confirmedAt: Date.now() });
    res.json({ ok: true });
  });
  route("get", "/review/catalog", async (req, res) => {
    const a = await actor(req, true);
    await requireReview(a);
    res.json({
      version: VERSION,
      items: catalog,
      questions: { habits: habitChoices, current: currentChoices },
    });
  });
  route("post", "/personalization/sessions", async (req, res) => {
    const a = await actor(req);
    const b = z
      .object({ sessionId: uuid, input: inputSchema })
      .strict()
      .parse(req.body);
    const input = normalizeInput(b.input);
    if (input.review) await requireReview(a);
    if (a.kind === "guest" && input.purpose !== "daily")
      fail(403, "MEMBER_REQUIRED", "이 콘텐츠는 로그인 후 이용할 수 있어요.");
    if (
      a.kind === "guest" &&
      !(await db.doc(`guestConsents/${a.uid}`).get()).exists
    )
      fail(403, "CONSENT_REQUIRED", "서비스 안내에 동의해주세요.");
    if (
      a.kind === "member" &&
      !(await db.doc(`personalConsents/${a.uid}`).get()).exists
    )
      fail(
        403,
        "PERSONALIZATION_CONSENT",
        "개인화 기록 이용 안내를 확인해주세요.",
      );
    const initial = await loadMemory(a, input.review);
    const ref = sessionRef(a, b.sessionId);
    const memoryDoc = memoryRef(a, input.review);
    const dayRef = db.doc(`guestDays/${hash(a.uid + ":" + kstDate())}`);
    const result = await db.runTransaction(async (tx) => {
      const existing = (await tx.get(ref)).data() as Session | undefined;
      const stored = (await tx.get(memoryDoc)).data() as Memory | undefined;
      const usage = a.kind === "guest" ? (await tx.get(dayRef)).data() : null;
      if (existing) {
        if (existing.owner !== a.uid || existing.kind !== a.kind)
          fail(403, "OWNER_MISMATCH", "본인의 세션만 이용할 수 있어요.");
        if (JSON.stringify(existing.input) !== JSON.stringify(input))
          fail(409, "ID_REUSE", "새 이용을 시작해주세요.");
        return existing;
      }
      const decision = decide(input, stored ?? initial);
      if (decision.reason === "blocked")
        fail(
          422,
          "AUTOMATIC_EXCLUDED",
          "현재 상태에는 자동 동작 안내를 제공하기 어려워요. 적절한 전문가에게 상태를 확인해주세요.",
        );
      if (!decision.selected.length)
        fail(
          422,
          "NO_MATCH",
          "지금 확인된 조건에 맞는 동작이 없어요. 답변·가능한 자세를 확인하거나 다음에 다시 이용해주세요.",
        );
      if (usage)
        fail(
          409,
          "DAILY_LIMIT",
          "오늘의 체험을 마쳤어요. 내일 다시 이용해주세요.",
        );
      const now = Date.now();
      const session: Session = {
        id: b.sessionId,
        owner: a.uid,
        kind: a.kind,
        review: input.review,
        input,
        createdAt: now,
        updatedAt: now,
        status: "active",
        completedAt: null,
        items: decision.selected.map((id) => ({
          itemId: crypto.randomUUID(),
          movement: movement(catalog.find((c) => c.catalogId === id)!),
          state: "pending",
          reaction: null,
          directions: [],
          steps: [],
          skipReason: null,
        })),
        feedback: null,
        feedbackSubmitted: false,
        visited: decision.selected,
        decision,
      };
      tx.create(ref, session);
      if (a.kind === "member" && !stored) tx.set(memoryDoc, initial);
      if (a.kind === "guest")
        tx.create(dayRef, {
          owner: a.uid,
          recommendationId: b.sessionId,
          sessionId: b.sessionId,
          date: kstDate(),
          consumedAt: now,
        });
      return session;
    });
    res.json(publicSession(result));
  });
  route("get", "/personalization/sessions/:id", async (req, res) => {
    const a = await actor(req);
    const s = (await sessionRef(a, uuid.parse(req.params.id)).get()).data() as
      | Session
      | undefined;
    if (!s || s.owner !== a.uid || s.kind !== a.kind)
      return fail(404, "NOT_FOUND", "이용 기록을 찾을 수 없어요.");
    if (s.review) await requireReview(a);
    res.json(publicSession(s));
  });
  route("get", "/review/sessions/:id", async (req, res) => {
    const a = await actor(req, true);
    await requireReview(a);
    const s = (await sessionRef(a, uuid.parse(req.params.id)).get()).data() as
      | Session
      | undefined;
    if (!s || s.owner !== a.uid)
      fail(404, "NOT_FOUND", "본인의 검토 기록만 확인할 수 있어요.");
    res.json(s);
  });
  route("post", "/personalization/sessions/:id/events", async (req, res) => {
    const a = await actor(req);
    const b = eventSchema.parse(req.body);
    const sid = uuid.parse(req.params.id);
    const ref = sessionRef(a, sid);
    const base = (await ref.get()).data() as Session | undefined;
    if (!base || base.owner !== a.uid || base.kind !== a.kind)
      return fail(404, "NOT_FOUND", "본인의 이용 기록만 변경할 수 있어요.");
    if (base.review) await requireReview(a);
    const memoryDoc = memoryRef(a, base.review);
    const initial = await loadMemory(a, base.review);
    const eventRef = db.doc(`personalSubmissions/${b.eventId}`);
    const week = kstWeek(Date.now());
    const growthPrefix = base.review ? "reviewGrowth" : "personalGrowth";
    const growthRef = db.doc(`${growthPrefix}/${a.uid}`),
      weekRef = db.doc(`${growthPrefix}/${a.uid}/weeks/${week}`);
    const eventHash = hash(JSON.stringify(b));
    const result = await db.runTransaction(async (tx) => {
      const session = (await tx.get(ref)).data() as Session;
      const old = (await tx.get(eventRef)).data();
      const memory = ((await tx.get(memoryDoc)).data() ??
        structuredClone(initial)) as Memory;
      const growth = ((await tx.get(growthRef)).data() ??
        newGrowth()) as Growth;
      const weekly = ((await tx.get(weekRef)).data() ??
        newWeekly()) as WeeklyGrowth;
      if (old) {
        if (
          old.owner !== a.uid ||
          old.sessionId !== sid ||
          old.hash !== eventHash
        )
          fail(409, "SUBMISSION_CONFLICT", "이미 사용한 제출 번호예요.");
        return session;
      }
      if (a.kind === "guest") remember(memory, session);
      const item = b.itemId
        ? session.items.find((i) => i.itemId === b.itemId)
        : undefined;
      if (b.itemId && !item) fail(400, "INVALID_ITEM", "동작을 확인해주세요.");
      if (["complete", "skip"].includes(b.action)) {
        if (!item || session.status !== "active")
          return fail(409, "NOT_ACTIVE", "진행 중인 동작을 확인해주세요.");
        if (item.state === "pending") {
          item.state = b.action === "complete" ? "completed" : "skipped";
          item.skipReason = b.skipReason ?? null;
          item.performedAt = Date.now();
        }
        if (session.items.every((i) => i.state !== "pending")) {
          session.status = session.items.some((i) => i.state === "completed")
            ? "completed"
            : "stopped";
          session.completedAt = Date.now();
        }
      } else if (b.action === "pause") {
        if (session.status !== "active")
          fail(409, "NOT_ACTIVE", "진행 중일 때 잠시 멈출 수 있어요.");
        session.status = "paused";
      } else if (b.action === "resume") {
        if (session.status !== "paused")
          fail(409, "NOT_PAUSED", "잠시 멈춘 상태를 확인해주세요.");
        session.status = "active";
      } else if (b.action === "stop") {
        if (!["active", "paused"].includes(session.status))
          fail(409, "NOT_ACTIVE", "진행 중인 이용만 중단할 수 있어요.");
        session.status = "stopped";
        session.completedAt = Date.now();
        if (item && item.state === "pending") item.state = "stopped";
      } else if (b.action === "feedback" || b.action === "correct") {
        if (!b.reaction || !allowedReaction(session.input.purpose, b.reaction))
          return fail(
            400,
            "INVALID_REACTION",
            "이 콘텐츠의 느낌을 선택해주세요.",
          );
        if (!["completed", "stopped"].includes(session.status))
          fail(
            409,
            "NOT_COMPLETED",
            "수행 또는 중단 상태를 먼저 기록해주세요.",
          );
        if (
          !session.items.some((i) => ["completed", "stopped"].includes(i.state))
        )
          fail(
            409,
            "NOT_PERFORMED",
            "직접 시도한 동작이 있을 때 느낌을 기록할 수 있어요.",
          );
        if (session.feedbackSubmitted && b.action !== "correct")
          fail(409, "ALREADY_SUBMITTED", "이미 느낌을 기록했어요.");
        if (b.action === "correct" && a.kind !== "member")
          fail(403, "MEMBER_REQUIRED", "회원 기록만 정정할 수 있어요.");
        if (
          session.input.purpose === "daily" &&
          b.itemId &&
          item !== session.items.at(-1)
        )
          fail(400, "INVALID_ITEM", "현재 수행한 동작에서 선택해주세요.");
        const feedbackItem =
          session.input.purpose === "daily" ? session.items.at(-1) : item;
        if (
          b.steps.length &&
          (!feedbackItem ||
            b.steps.some((i) => i >= feedbackItem.movement.steps.length))
        )
          fail(400, "INVALID_STEPS", "실제 수행 단계에서 선택해주세요.");
        if (
          b.reaction === "worse" &&
          item &&
          !["completed", "stopped"].includes(item.state)
        )
          fail(400, "NOT_PERFORMED", "실제 시도한 동작에서 선택해주세요.");
        session.feedback = b.reaction;
        session.feedbackSubmitted = true;
        session.feedbackAt = Date.now();
        if (session.input.purpose === "daily") {
          const target = session.items.at(-1)!;
          target.reaction = b.reaction;
          target.steps = b.steps;
          target.directions =
            b.reaction === "worse"
              ? directionsFor(target.movement.catalogId, b.steps)
              : [];
          target.feedbackAt = Date.now();
          target.stepsState =
            b.stepsState ?? (b.steps.length ? "selected" : "unanswered");
        } else if (b.reaction === "worse" && item) {
          item.reaction = "worse";
          item.steps = b.steps;
          item.directions = directionsFor(item.movement.catalogId, b.steps);
          item.feedbackAt = Date.now();
          item.stepsState =
            b.stepsState ?? (b.steps.length ? "selected" : "unanswered");
        }
        // Bundle positives are intentionally never copied onto individual movements.
      } else if (b.action === "next") {
        if (
          session.input.purpose !== "daily" ||
          !session.feedbackSubmitted ||
          !["same", "worse"].includes(session.feedback ?? "")
        )
          fail(409, "NEXT_UNAVAILABLE", "피드백을 기록한 뒤 이어갈 수 있어요.");
        const decision = decide(session.input, memory, session.visited);
        session.decision = decision;
        session.nextState = decision.selected.length ? "ready" : "none";
        if (decision.selected.length) {
          const c = catalog.find((c) => c.catalogId === decision.selected[0])!;
          session.items.push({
            itemId: crypto.randomUUID(),
            movement: movement(c),
            state: "pending",
            reaction: null,
            directions: [],
            steps: [],
            skipReason: null,
          });
          session.visited.push(c.catalogId);
          session.status = "active";
          session.feedback = null;
          session.feedbackSubmitted = false;
          session.completedAt = null;
        }
      } else if (b.action === "followup") {
        if (
          !session.feedbackSubmitted ||
          !["completed", "stopped"].includes(session.status)
        )
          fail(409, "NOT_COMPLETED", "직접 이용한 뒤 느낌을 기록해주세요.");
        if (a.kind !== "member" || !b.followup)
          fail(400, "INVALID_FOLLOWUP", "후속 느낌을 확인해주세요.");
        if (session.followup)
          fail(409, "ALREADY_SUBMITTED", "후속 느낌을 이미 남겼어요.");
        Object.assign(session, {
          followup: { value: b.followup, at: Date.now() },
        });
      }
      session.updatedAt = Date.now();
      remember(memory, session);
      tx.set(ref, session);
      tx.create(eventRef, {
        owner: a.uid,
        kind: a.kind,
        sessionId: sid,
        hash: eventHash,
        createdAt: Date.now(),
      });
      // Guest memory stays within the session; it never becomes a long-term profile.
      if (a.kind === "member")
        tx.set(memoryDoc, { ...memory, summary: summarize(memory) });
      if (
        a.kind === "member" &&
        env.GROWTH_ENABLED === "true" &&
        session.input.growth &&
        session.input.purpose === "leisure" &&
        ["complete", "feedback"].includes(b.action)
      ) {
        const award = awardGrowth(
          growth,
          weekly,
          sid,
          week,
          b.action === "complete" && session.status === "completed",
          b.action === "feedback" && session.feedbackSubmitted,
        );
        tx.set(growthRef, award.state);
        tx.set(weekRef, award.weekly);
      }
      return session;
    });
    res.json(publicSession(result));
  });
  route("get", "/personalization/records", async (req, res) => {
    const a = await actor(req, true);
    let query = db
      .collection(`profiles/${a.uid}/sessions`)
      .orderBy("createdAt", "desc")
      .orderBy("__name__", "desc");
    if (req.query.after !== undefined || req.query.afterId !== undefined) {
      const cursor = z
        .object({ after: z.coerce.number().int().min(0), afterId: uuid })
        .parse(req.query);
      query = query.startAfter(cursor.after, cursor.afterId);
    }
    const data = await query.limit(21).get();
    const rows = data.docs
      .slice(0, 20)
      .map((d) => publicSession(d.data() as Session));
    const last = data.docs[19];
    res.json({
      records: rows.filter((s) => !s.review),
      reviewRecords: (await reviewAllowed(a))
        ? rows.filter((s) => s.review)
        : [],
      nextCursor:
        data.docs.length > 20
          ? { createdAt: last.data()!.createdAt, id: last.id }
          : null,
    });
  });
  route("post", "/personalization/sessions/:id/delete", async (req, res) => {
    const a = await actor(req, true);
    const sid = uuid.parse(req.params.id);
    const ref = sessionRef(a, sid);
    const session = (await ref.get()).data() as Session | undefined;
    if (!session) {
      res.json({ ok: true });
      return;
    }
    if (session.review) await requireReview(a);
    const memoryDoc = memoryRef(a, session.review);
    await db.runTransaction(async (tx) => {
      await tx.get(ref);
      const memory = ((await tx.get(memoryDoc)).data() ??
        emptyMemory()) as Memory;
      memory.experiences = memory.experiences.filter(
        (e) => e.sessionId !== sid,
      );
      memory.bundles = (memory.bundles ?? []).filter(
        (b) => b.sessionId !== sid,
      );
      memory.constraints = memory.constraints
        .map((c) => ({
          ...c,
          evidenceIds: c.evidenceIds.filter((id) => !id.startsWith(sid + ":")),
        }))
        .filter((c) => c.evidenceIds.length);
      memory.revision++;
      tx.delete(ref);
      tx.set(memoryDoc, { ...memory, summary: summarize(memory) });
    });
    res.json({ ok: true });
  });
  route("post", "/personalization/ai-summary", async (req, res) => {
    const a = await actor(req, true);
    const consent = (await db.doc(`personalConsents/${a.uid}`).get()).data();
    const memory = await loadMemory(a);
    const evidence = memory.experiences
      .filter((e) => e.reaction !== null)
      .slice(-20);
    const result = await safeSummary(
      env.AI_ENABLED === "true"
        ? openAiAdapter(env.AI_API_KEY, env.AI_MODEL)
        : undefined,
      {
        patterns: [...new Set(evidence.flatMap((e) => e.patterns))],
        evidence: evidence.map((e) => ({
          id: `${e.sessionId}:${e.catalogId}`,
          reaction: e.reaction,
          purpose: e.purpose,
        })),
      },
      consent?.ai === true,
    );
    // No cache of health state; nothing survives deletion in a second derived store.
    res.json({ aiUsed: result.aiUsed, source: result.source });
  });
}
