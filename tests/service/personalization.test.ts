import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../../lib/personalization/catalog";
import {
  decide,
  programs,
  approvedConnectionIds,
  summarize,
} from "../../lib/personalization/engine";
import {
  inputSchema,
  emptyMemory,
  poses,
  supports,
  type SessionInput,
} from "../../lib/personalization/types";
import { safeSummary } from "../../lib/personalization/ai";
import {
  nextMidnightKST,
  currentKSTDay,
  isExpired,
} from "../../worker/retention";
import { nicknameSchema } from "../../lib/service/nickname";
const input = (patch: Partial<SessionInput> = {}) =>
  inputSchema.parse({
    purpose: "daily",
    area: "back",
    habits: ["retract"],
    current: ["upper_back", "reach_comfort"],
    poses: poses.map((x) => x[0]),
    supports: supports.map((x) => x[0]),
    confirmedAt: Date.now(),
    ...patch,
  });
test("94 registrations and exact 149 purpose approvals exclude O09 from all new recommendations", () => {
  assert.equal(catalog.length, 94);
  assert.equal(approvedConnectionIds.length, 149);
  assert.equal(
    approvedConnectionIds.filter((s) => s.startsWith("daily:")).length,
    70,
  );
  assert.ok(!approvedConnectionIds.some((s) => s.endsWith(":O09")));
  assert.equal(catalog.find((c) => c.catalogId === "D31")!.pose, "chair");
});
for (const p of programs)
  test(
    "real engine composes " + p.id + " without invented pain patterns",
    () => {
      const d = decide(
        input({
          purpose: p.purpose as SessionInput["purpose"],
          area: undefined,
          habits: [],
          current: [p.purpose === "warmup" ? "prep_comfort" : "today_ok"],
          sport: p.sport as SessionInput["sport"],
          profile: p.profile as SessionInput["profile"],
          minutes: p.minutesChoice as 5 | 10 | undefined,
          preference: (p.focus as SessionInput["preference"]) ?? "all",
        }),
        emptyMemory(),
      );
      assert.deepEqual(
        d.selected,
        p.items.map((i) => i.catalogId),
      );
      assert.equal(d.program!.plannedSeconds, p.plannedSeconds);
      assert.equal(d.program!.stepCount, p.items.length);
      assert.equal(d.program!.distinctMovementCount, new Set(d.selected).size);
    },
  );
test("daily requires related habits AND actual current clues and movement comfort; selection order is stable", () => {
  assert.deepEqual(decide(input(), emptyMemory()).selected, ["O02"]);
  assert.equal(
    decide(input({ habits: ["unknown"], current: ["unknown"] }), emptyMemory())
      .selected.length,
    0,
  );
  assert.equal(
    decide(input({ current: ["upper_back"] }), emptyMemory()).selected.length,
    0,
  );
  const a = input({
    habits: ["retract", "screen"],
    current: ["upper_back", "reach_comfort", "neck_fatigue"],
  });
  assert.deepEqual(
    decide(a, emptyMemory()).selected,
    decide(
      {
        ...a,
        habits: [...a.habits].reverse(),
        current: [...a.current].reverse(),
      },
      emptyMemory(),
    ).selected,
  );
});
test("first adverse reaction excludes aliases; an unknown direction does not ban all unrelated movements", () => {
  const m = emptyMemory();
  m.constraints = [{ catalogId: "O02", directions: [], evidenceIds: ["one"] }];
  const d = decide(input(), m);
  assert.ok(!d.selected.some((id) => ["O02", "D24"].includes(id)));
  const rotation = decide(
    input({
      habits: ["one_direction"],
      current: ["torso_limited", "rotation_comfort"],
    }),
    m,
  );
  assert.ok(rotation.selected.length);
});
test("visited families cannot masquerade as new alternatives and repeated same never increases dosage", () => {
  const first = decide(input(), emptyMemory());
  assert.equal(
    decide(input(), emptyMemory(), first.selected).selected.length,
    0,
  );
  const c = catalog.find((c) => c.catalogId === "O02")!;
  assert.ok(c.dose.holdSeconds <= 30);
});
test("P18/P19 alone never prescribe an opposite direction as pain treatment", () => {
  for (const token of ["flex_bad_ext_good", "ext_bad_flex_good"])
    assert.equal(
      decide(
        input({
          area: "lower",
          habits: ["sitting", "standing"],
          current: [token],
        }),
        emptyMemory(),
      ).selected.length,
      0,
    );
});
test("normal lying never expands to floor/quadruped; mixed floor requires explicit wrist and knee support", () => {
  const plain = input({
    purpose: "leisure",
    area: undefined,
    habits: [],
    current: ["today_ok"],
    profile: "lying",
    minutes: 10,
    poses: ["supine"],
    supports: ["dryFloor"],
  });
  const d = decide(plain, emptyMemory());
  assert.ok(d.selected.length);
  assert.ok(
    d.selected.every(
      (id) => catalog.find((c) => c.catalogId === id)!.pose === "supine",
    ),
  );
  assert.equal(
    decide({ ...plain, profile: "mixedFloor" }, emptyMemory()).selected.length,
    0,
  );
});
test("warmup defaults have no chair/tool requirements and retain distinct floor movements",()=>{
 const d=decide(input({purpose:"warmup",sport:"hiking",area:undefined,habits:[],current:[],poses:[],supports:[]}),emptyMemory());assert.ok(d.selected.includes("W13"));assert.ok(!d.selected.includes("D33"));assert.ok(d.selected.length>=4);
});
test("unavailable supports, towel and W16 head support stay mandatory", () => {
  const m = emptyMemory();
  const d = decide(
    input({
      area: "calf",
      habits: ["standing"],
      current: ["calf_limited", "calf_bent_comfort"],
      poses: ["chair"],
      supports: ["chair"],
    }),
    m,
  );
  assert.ok(!d.selected.includes("D31"));
  const withTowel = decide(
    input({
      area: "calf",
      habits: ["standing"],
      current: ["calf_limited", "calf_bent_comfort"],
      poses: ["chair"],
      supports: ["chair", "towel"],
    }),
    m,
  );
  assert.ok(withTowel.selected.includes("D31"));
  const warm = decide(
    input({
      purpose: "warmup",
      sport: "swimming",
      current: ["prep_comfort"],
      habits: [],
      poses: ["standing"],
      supports: ["dryFloor", "space"],
    }),
    m,
  );
  assert.equal(warm.selected.length, 4);
});
test("all purposes stop on sudden deterioration, radiation or dizziness", () => {
  for (const purpose of ["daily", "warmup", "leisure"] as const)
    for (const token of ["sudden_worse", "radiating", "dizzy"])
      assert.equal(
        decide(
          input({
            purpose,
            area: purpose === "daily" ? "lower" : undefined,
            sport: "running",
            habits: purpose === "daily" ? ["sitting"] : [],
            minutes: 5,
            current: [token],
          }),
          emptyMemory(),
        ).reason,
        "blocked",
      );
});
test("none/unknown conflicts and cross-area injected answers are rejected server side", () => {
  assert.throws(() =>
    decide(input({ habits: ["none", "retract"] }), emptyMemory()),
  );
  assert.throws(() =>
    decide(input({ area: "ankle", habits: ["clench"] }), emptyMemory()),
  );
});
test("KST expiry is next midnight for both 00:10 and 23:50, including exact boundary", () => {
  const expected = Date.parse("2026-10-19T15:00:00Z");
  for (const t of ["2026-10-18T15:10:00Z", "2026-10-19T14:50:00Z"])
    assert.equal(nextMidnightKST(Date.parse(t)), expected);
  assert.equal(currentKSTDay(expected - 1), "2026-10-19");
  assert.equal(currentKSTDay(expected), "2026-10-20");
  assert.ok(!isExpired({ expiresAt: expected }, expected - 1));
  assert.ok(isExpired({ expiresAt: expected }, expected));
  assert.equal(nextMidnightKST(expected), expected + 86400000);
});
test("nickname trims and counts visible characters, requires 2, and preserves existing character policy", () => {
  for (const v of ["", " ", "가", "a", "😀😀"])
    assert.equal(nicknameSchema.safeParse(v).success, false);
  assert.equal(nicknameSchema.parse("  두글  "), "두글");
  assert.ok(nicknameSchema.safeParse("가".repeat(20)).success);
  assert.equal(nicknameSchema.safeParse("가".repeat(21)).success, false);
});
test("session summaries deduplicate alternative items and keep bundle feelings at one experience", () => {
  const m = emptyMemory();
  m.bundles = [
    {
      sessionId: "one",
      catalogIds: ["W01", "W02"],
      purpose: "warmup",
      reaction: "ready",
      at: Date.now(),
      patterns: ["P21"],
      focus: [],
      minutes: null,
    },
  ];
  assert.equal(summarize(m).sevenDays.sessions, 1);
});
test("AI remains optional and invalid prescriptions/evidence/timeouts fall back without changing rules", async () => {
  assert.equal(
    (await safeSummary(undefined, { patterns: [], evidence: [] }, false))
      .aiUsed,
    false,
  );
  assert.equal(
    (
      await safeSummary(
        {
          summarize: async () => ({
            tags: ["P99"],
            observations: [],
            evidenceIds: [],
          }),
        },
        { patterns: ["P01"], evidence: [] },
        true,
      )
    ).aiUsed,
    false,
  );
  assert.equal(
    (
      await safeSummary(
        { summarize: async () => new Promise(() => {}) },
        { patterns: [], evidence: [] },
        true,
        10,
      )
    ).aiUsed,
    false,
  );
});
