import test from "node:test";
import assert from "node:assert/strict";
import { decide, summarize, warmups } from "../../lib/personalization/engine";
import { catalog, canonicalFamilies } from "../../lib/personalization/catalog";
import {
  emptyMemory,
  inputSchema,
  type SessionInput,
  poses,
  supports,
} from "../../lib/personalization/types";
import { safeSummary } from "../../lib/personalization/ai";
import {
  awardGrowth,
  kstWeek,
  newGrowth,
  newWeekly,
} from "../../lib/personalization/growth";
const input = (patch: Partial<SessionInput> = {}): SessionInput => ({
  purpose: "daily",
  area: "back",
  habits: ["retract"],
  current: ["upper_back", "reach_comfort"],
  poses: poses.map((x) => x[0]),
  supports: supports.map((x) => x[0]),
  focus: [],
  review: true,
  growth: false,
  confirmedAt: Date.now(),
  ...patch,
});
test("same back region follows two explicit habit/current conditions, not shared area tags", () => {
  assert.deepEqual(decide(input(), emptyMemory()).selected, ["O02"]);
  const p01 = input({
    habits: ["arm_front"],
    current: [
      "chest_stiff",
      "chest_open_comfort",
      "external_comfort",
      "touch_comfort",
    ],
  });
  assert.deepEqual(decide(p01, emptyMemory()).selected, ["O04"]);
  assert.deepEqual(
    decide(input({ habits: ["unknown"], current: ["unknown"] }), emptyMemory())
      .selected,
    [],
  );
});
test("one adverse reaction immediately excludes forward-reaching alternatives without banning unrelated rotations", () => {
  const memory = emptyMemory();
  memory.constraints = [
    {
      catalogId: "O02",
      directions: ["reach_forward"],
      evidenceIds: ["one:O02"],
    },
  ];
  const d = decide(input(), memory);
  assert.ok(!d.selected.includes("O02") && !d.selected.includes("D24"));
  for (const id of ["O02", "D24", "O05", "D23", "Y01", "Y03"])
    assert.equal(
      d.excluded.find((x) => x.id === id)?.reason,
      "adverse-history",
    );
  const rotation = decide(
    input({
      habits: ["one_direction"],
      current: ["torso_limited", "rotation_comfort"],
    }),
    memory,
  );
  assert.ok(rotation.selected.some((id) => ["D02", "D13"].includes(id)));
});
test("required current clues and movement-specific comfortable experience cannot be inferred from sitting or missing answers", () => {
  const noClue = decide(
    input({ area: "lower", habits: ["sitting"], current: ["none"] }),
    emptyMemory(),
  );
  assert.equal(noClue.selected.length, 0);
  const noComfort = decide(
    input({ habits: ["arm_front"], current: ["chest_stiff"] }),
    emptyMemory(),
  );
  assert.equal(noComfort.selected.length, 0);
  const none = inputSchema.parse(
    input({ habits: ["none"], current: ["none"] }),
  );
  const unknown = inputSchema.parse(
    input({ habits: ["unknown"], current: ["unknown"] }),
  );
  const unanswered = inputSchema.parse(input({ habits: [], current: [] }));
  assert.notDeepEqual(none, unknown);
  assert.notDeepEqual(unknown, unanswered);
});
test("multi-select order is deterministic and exclusive/contradictory answers are rejected", () => {
  const a = input({
    habits: ["arm_front", "screen"],
    current: [
      "chest_stiff",
      "upper_back",
      "chest_open_comfort",
      "extension_comfort",
    ],
  });
  assert.deepEqual(
    decide(a, emptyMemory()),
    decide(
      {
        ...a,
        habits: [...a.habits].reverse(),
        current: [...a.current].reverse(),
      },
      emptyMemory(),
    ),
  );
  assert.throws(() =>
    decide(input({ habits: ["none", "screen"] }), emptyMemory()),
  );
  assert.throws(() =>
    decide(input({ current: ["today_ok", "chest_stiff"] }), emptyMemory()),
  );
});
test("positive observations only rank context-matched candidates after adverse constraints", () => {
  const a = input({
    habits: ["arm_front"],
    current: [
      "chest_stiff",
      "chest_open_comfort",
      "external_comfort",
      "touch_comfort",
    ],
  });
  const memory = emptyMemory();
  memory.experiences = [
    {
      sessionId: "positive",
      catalogId: "O11",
      at: Date.now(),
      purpose: "daily",
      area: "back",
      patterns: ["P01"],
      reaction: "better",
      directions: [],
      performed: true,
    },
  ];
  assert.deepEqual(decide(a, memory).selected, ["O11"]);
  memory.constraints = [
    { catalogId: "O11", directions: [], evidenceIds: ["older-worse"] },
  ];
  assert.ok(!decide(a, memory).selected.includes("O11"));
});
test("soccer today okay keeps sport roles and never forces two additions from historic shoulder visits", () => {
  const a = input({
    purpose: "warmup",
    sport: "football",
    area: undefined,
    habits: [],
    current: ["today_ok", "prep_comfort"],
    poses: ["standing"],
  });
  const memory = emptyMemory();
  memory.experiences = Array.from({ length: 10 }, (_, i) => ({
    sessionId: `old-${i}`,
    catalogId: "O04",
    at: Date.now(),
    purpose: "daily",
    area: "shoulder",
    patterns: ["P01"],
    reaction: "better",
    directions: [],
    performed: true,
  }));
  assert.deepEqual(decide(a, memory).selected, warmups.football);
});
test("swimming without floor support returns a real unsupported result instead of inventing a standing replacement", () => {
  const d = decide(
    input({
      purpose: "warmup",
      sport: "swimming",
      area: undefined,
      habits: [],
      current: ["today_ok", "prep_comfort"],
      poses: ["standing"],
    }),
    emptyMemory(),
  );
  assert.equal(d.selected.length, 0);
  for (const id of warmups.swimming)
    assert.equal(
      d.excluded.find((x) => x.id === id)?.reason,
      "posture-unavailable",
    );
});
const broad = (): SessionInput =>
  input({
    purpose: "leisure",
    area: undefined,
    minutes: 10,
    habits: [
      "arm_front",
      "screen",
      "one_direction",
      "sitting",
      "standing",
      "legs_together",
      "immobile",
      "one_side",
      "retract",
      "arms_up",
    ],
    current: [
      "chest_stiff",
      "chest_open_comfort",
      "external_comfort",
      "touch_comfort",
      "upper_back",
      "extension_comfort",
      "torso_limited",
      "rotation_comfort",
      "hip_front",
      "hip_extend_comfort",
      "hip_back",
      "knee_hug_comfort",
      "cross_comfort",
      "hamstring_local",
      "hamstring_comfort",
      "inner_thigh",
      "abduct_comfort",
      "side_local",
      "sidebend_comfort",
      "arm_raise_comfort",
      "stiff",
      "small_comfort",
      "both_directions_comfort",
      "reach_comfort",
      "lat_stiff",
    ],
  });
test("leisure durations produce different bounded compositions, no family duplication or invented approved time", () => {
  const a = broad();
  const five = decide({ ...a, minutes: 5 }, emptyMemory()),
    ten = decide(a, emptyMemory());
  assert.equal(five.selected.length, 4);
  assert.ok(ten.selected.length > five.selected.length);
  const families = ten.selected.map(
    (id) => catalog.find((x) => x.catalogId === id)!.family,
  );
  assert.equal(new Set(families).size, families.length);
  assert.equal(canonicalFamilies.D12, canonicalFamilies.W16);
  assert.equal(canonicalFamilies.Y04, canonicalFamilies.W14);
});
test("lying-only and unsupported wrists never receive standing/quadruped content; D31 remains excluded even in review", () => {
  const a = { ...broad(), poses: ["supine" as const], supports: [] };
  const d = decide(a, emptyMemory());
  assert.ok(d.selected.length > 0);
  assert.ok(
    d.selected.every(
      (id) => catalog.find((c) => c.catalogId === id)!.pose === "supine",
    ),
  );
  assert.equal(
    d.excluded.find((c) => c.id === "D31")?.reason,
    "support-unconfirmed",
  );
});
test("draft warmups cannot become production-approved and all paths obey the sudden deterioration gate", () => {
  const a = input({
    purpose: "warmup",
    sport: "running",
    area: undefined,
    current: ["prep_comfort"],
    habits: [],
    review: false,
  });
  assert.equal(decide(a, emptyMemory()).selected.length, 0);
  for (const purpose of ["daily", "warmup", "leisure"] as const)
    assert.equal(
      decide(
        input({
          purpose,
          sport: "running",
          minutes: 5,
          current: ["sudden_worse"],
        }),
        emptyMemory(),
      ).reason,
      "blocked",
    );
});
test("alternatives retain applicable filters and never repeat visited families", () => {
  const a = input({
    habits: ["arm_front"],
    current: [
      "chest_stiff",
      "chest_open_comfort",
      "external_comfort",
      "touch_comfort",
    ],
  });
  const d = decide(a, emptyMemory(), ["O04", "O06", "O07", "O08", "O11"]);
  assert.ok(
    !d.selected.some((id) => ["O04", "O06", "O07", "O08", "O11"].includes(id)),
  );
});
test("summary counts sessions and different KST days rather than multiplying alternative items", () => {
  const memory = emptyMemory();
  memory.experiences = ["O04", "O06", "O11"].map((catalogId) => ({
    sessionId: "one",
    catalogId,
    at: Date.now(),
    purpose: "daily",
    area: "back",
    patterns: ["P01"],
    reaction: "same",
    directions: [],
    performed: true,
  }));
  const summary = summarize(memory);
  assert.equal(summary.sevenDays.sessions, 1);
  assert.equal(summary.sevenDays.days, 1);
});
test("AI absent, wrong evidence, extra prescriptions and timeouts always fall back to rules", async () => {
  const ctx = {
    patterns: ["P01"],
    evidence: [{ id: "one", reaction: "worse", purpose: "daily" }],
  };
  assert.equal((await safeSummary(undefined, ctx, true)).aiUsed, false);
  assert.equal(
    (
      await safeSummary(
        {
          summarize: async () => ({
            tags: ["P02"],
            observations: [],
            evidenceIds: ["one"],
          }),
        },
        ctx,
        true,
      )
    ).aiUsed,
    false,
  );
  assert.equal(
    (
      await safeSummary(
        {
          summarize: async () => ({
            tags: ["P01"],
            observations: [],
            evidenceIds: ["one"],
            movement: "new",
          }),
        },
        ctx,
        true,
      )
    ).aiUsed,
    false,
  );
  assert.equal(
    (
      await safeSummary(
        { summarize: async () => new Promise(() => {}) },
        ctx,
        true,
        10,
      )
    ).aiUsed,
    false,
  );
  assert.equal(
    (
      await safeSummary(
        {
          summarize: async () => ({
            tags: ["P01"],
            observations: ["adverse_history"],
            evidenceIds: ["one"],
          }),
        },
        ctx,
        true,
      )
    ).aiUsed,
    true,
  );
});
test("growth rewards are 50 plus 10 per KST week, independent of feedback valence, and stopping can precede completion", () => {
  const week = "2026-10-12";
  let g = awardGrowth(newGrowth(), newWeekly(), "stopped", week, false, true);
  assert.equal(g.added, 10);
  g = awardGrowth(g.state, g.weekly, "completed", week, true, true);
  assert.equal(g.added, 50);
  assert.equal(g.state.xp, 60);
  g = awardGrowth(g.state, g.weekly, "repeated", week, true, true);
  assert.equal(g.added, 0);
  assert.equal(g.weekly.xp, 60);
  assert.equal(kstWeek(Date.parse("2026-10-18T14:59:59Z")), "2026-10-12");
  assert.equal(kstWeek(Date.parse("2026-10-18T15:00:00Z")), "2026-10-19");
});
