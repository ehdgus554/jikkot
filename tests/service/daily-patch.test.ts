import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import {
  inputSchema,
  areas,
  emptyMemory,
  type Session,
} from "../../lib/personalization/types";
import {
  DAILY_FLOW,
  dailyQuestions,
} from "../../lib/personalization/daily-questions";
import { decide } from "../../lib/personalization/engine";
import { catalog } from "../../lib/personalization/catalog";
import { recordSummary } from "../../lib/personalization/record-summary";
const daily = (
  pose: string,
  area: string,
  habit = "unknown",
  action = "unknown",
) =>
  inputSchema.parse({
    purpose: "daily",
    flowVersion: DAILY_FLOW,
    poses: [pose],
    area,
    habits: [habit],
    current: [action],
  });
test("30 actual cells and every exposed answer pair produce distinct, image-backed, tool-free routines", async () => {
  const table = [];
  let combinations = 0;
  for (const pose of ["chair", "standing", "supine"])
    for (const [area] of areas) {
      const variants = new Set<string>();
      for (const h of dailyQuestions("habits", area))
        for (const a of dailyQuestions("current", area, [h.id])) {
          const input = daily(pose, area, h.id, a.id),
            d = decide(input, emptyMemory());
          combinations++;
          assert.ok(
            d.selected.length >= 2 && d.selected.length <= 3,
            `${pose}:${area}:${h.id}:${a.id}`,
          );
          const cs = d.selected.map((id) =>
            catalog.find((c) => c.catalogId === id)!,
          );
          assert.equal(new Set(cs.map((c) => c.family)).size, cs.length);
          assert.ok(
            cs.every(
              (c) =>
                c.catalogId !== "O09" &&
                c.pose === pose &&
                c.media.installed &&
                c.supports.every((s) => ["chair", "dryFloor"].includes(s)),
            ),
          );
          assert.deepEqual(decide(input, emptyMemory()).selected, d.selected);
          variants.add(d.selected.join(", "));
        }
      table.push({
        pose,
        area,
        default: decide(daily(pose, area), emptyMemory()).selected,
        orders: [...variants],
      });
    }
  assert.ok(combinations >= 480);
  await mkdir("outputs/patch-2026-10-19", { recursive: true });
  await writeFile(
    "outputs/patch-2026-10-19/30-cells.json",
    JSON.stringify({ combinations, cells: table }, null, 2),
  );
});
test("actual habit and action rankings vary while missing comfort/support tokens are not invented", () => {
  const one = decide(
    daily("chair", "neck", "screen", "recent_look_down"),
    emptyMemory(),
  );
  const two = decide(
    daily("chair", "neck", "shrug", "recent_one_direction"),
    emptyMemory(),
  );
  assert.notDeepEqual(one.selected, two.selected);
  assert.notDeepEqual(
    dailyQuestions("current", "neck", ["screen"]).map((q) => q.id),
    dailyQuestions("current", "neck", ["one_direction"]).map((q) => q.id),
  );
  assert.throws(() =>
    decide(
      { ...daily("chair", "neck"), current: ["neck_back", "turn_comfort"] },
      emptyMemory(),
    ),
  );
  const m = emptyMemory();
  m.constraints = [
    { catalogId: one.selected[0], directions: [], evidenceIds: ["actual"] },
  ];
  assert.ok(
    !decide(daily("chair", "neck"), m).selected.includes(one.selected[0]),
  );
});
test("all eight sports directly compose mixed nonlying programmes with no stated capabilities", () => {
  for (const sport of [
    "running",
    "football",
    "hiking",
    "gym",
    "golf",
    "tennis",
    "swimming",
    "cycling",
  ]) {
    const d = decide(
      inputSchema.parse({ purpose: "warmup", sport }),
      emptyMemory(),
    );
    assert.ok(d.selected.length >= 4, sport);
    assert.ok(
      d.selected.some((id) => ["W13", "W14", "W15"].includes(id)),
      sport,
    );
    assert.ok(
      d.selected.every(
        (id) =>
          !["supine", "side", "prone", "chair"].includes(
            catalog.find((c) => c.catalogId === id)!.pose,
          ),
      ),
    );
  }
});
test("record summary counts all 21+ sessions, unanswered actual work, KST calendar boundaries, bundle reactions, corrections and deletions", () => {
  const now = Date.parse("2026-10-19T15:05:00Z");
  const session = (
    id: number,
    at: number,
    reaction: "better" | "same" | null = null,
  ) =>
    ({
      id: String(id),
      review: false,
      createdAt: at,
      updatedAt: at,
      completedAt: at,
      input: daily("chair", "neck", "screen", "recent_look_down"),
      program: { id: "daily:chair:neck", name: "목 가볍게 풀기" },
      items: [
        {
          state: "completed",
          movement: { catalogId: "D18", name: "턱 뒤로 당기기" },
        },
      ],
      feedbackSubmitted: !!reaction,
      feedback: reaction,
    }) as Session;
  const rows = Array.from({ length: 25 }, (_, i) =>
    session(i, now - i * 1000, i < 3 ? "better" : null),
  );
  rows.push(
    { ...session(26, now), review: true },
    { ...session(27, now), items: [{ state: "pending" }] } as Session,
    session(28, Date.parse("2026-10-12T14:59:00Z")),
  );
  const result = recordSummary(rows, [], now);
  assert.equal(result.thirtyDays.sessions, 26);
  assert.equal(result.sevenDays.sessions, 25);
  assert.equal(result.routines[0].better, 3);
  assert.equal(result.routines[0].unanswered, 23);
  assert.equal(result.areas[0].count, 26);
  const changed = structuredClone(rows);
  changed[0].feedback = "same";
  assert.equal(recordSummary(changed, [], now).routines[0].better, 2);
  assert.equal(
    recordSummary(changed.slice(1), [], now).thirtyDays.sessions,
    25,
  );
  assert.equal(recordSummary([], [], now).thirtyDays.sessions, 0);
  assert.equal(recordSummary([rows[0]], [], now).thirtyDays.sessions, 1);
  assert.equal(
    recordSummary(
      [rows[0]],
      [
        {
          id: "duplicate",
          createdAt: now,
          sessionId: rows[0].id,
          feedback: "better",
        },
      ],
      now,
    ).thirtyDays.sessions,
    1,
  );
});
test("summary preserves exact warmup response labels, real performance dates, and migration duplicates", () => {
  const now = Date.parse("2026-10-19T15:05:00Z"),
    performed = now - 10 * 86400000;
  const s = {
    id: "one",
    review: false,
    createdAt: performed,
    updatedAt: now,
    completedAt: now,
    input: inputSchema.parse({ purpose: "warmup", sport: "running" }),
    items: [
      {
        state: "completed",
        performedAt: performed,
        movement: { catalogId: "W11", name: "제자리 걷기" },
      },
    ],
    feedbackSubmitted: true,
    feedback: "ready",
  } as Session;
  const result = recordSummary(
    [s],
    [{ id: "copy1", sessionId: "one", createdAt: now, feedback: "better" }],
    now,
  );
  assert.equal(result.sevenDays.sessions, 0);
  assert.equal(result.thirtyDays.sessions, 1);
  assert.equal(result.routines[0].ready, 1);
  assert.equal(result.routines[0].better, 0);
  assert.equal(result.areas.length, 0);
  assert.equal(
    recordSummary(
      [],
      [
        { id: "a", recommendationId: "r", createdAt: now, feedback: "same" },
        { id: "b", recommendationId: "r", createdAt: now, feedback: "same" },
      ],
      now,
    ).thirtyDays.sessions,
    1,
  );
});
test("purpose publication audit matches its exact gate and sport posture/support unions reflect real instructions", async () => {
  const { default: publication } =
    await import("../../lib/personalization/release/publication-connections.json");
  const { default: options } =
    await import("../../lib/personalization/release/program-options.json");
  const { programs } = await import("../../lib/personalization/engine");
  assert.deepEqual(
    publication.connections.map((c) => c.connectionId),
    publication.approvedConnectionIds,
  );
  for (const p of programs.filter((p) => p.purpose === "warmup")) {
    const union = [
      ...new Set(
        p.items.flatMap((s) => {
          const c = catalog.find((c) => c.catalogId === s.catalogId)!;
          return [c.pose, ...c.supports];
        }),
      ),
    ].sort();
    assert.deepEqual(p.requiredCapabilities, union);
    assert.deepEqual(
      options.find((o) => o.id === p.id)!.requiredCapabilities,
      union,
    );
  }
  const variants = catalog.filter((c) => c.catalogId.startsWith("N"));
  assert.equal(new Set(variants.map((c) => c.media.sha256)).size, 19);
});
test("sport adverse history replaces the exact floor movement with a tool-free nonlying family and never calls walking alone a full routine", async () => {
  const { programs } = await import("../../lib/personalization/engine");
  const input = inputSchema.parse({ purpose: "warmup", sport: "running" }),
    memory = emptyMemory();
  memory.constraints = [
    {
      catalogId: "W13",
      directions: [],
      evidenceIds: ["actual-floor-discomfort"],
    },
  ];
  const d = decide(input, memory);
  assert.ok(d.selected.length >= 4);
  assert.ok(!d.selected.includes("W13"));
  assert.ok(d.selected.includes("W09"));
  assert.equal(d.program!.partial, true);
  assert.equal(
    d.program!.plannedSeconds,
    d.selected.reduce(
      (n, id) =>
        n + catalog.find((c) => c.catalogId === id)!.dose.plannedSeconds,
      0,
    ),
  );
  memory.constraints = catalog
    .filter((c) => c.catalogId !== "W11")
    .map((c) => ({
      catalogId: c.catalogId,
      directions: [],
      evidenceIds: ["actual"],
    }));
  assert.equal(decide(input, memory).selected.length, 0);
  assert.equal(programs.filter((p) => p.purpose === "leisure").length, 24);
});
test("repeated same reactions change priority only for the same area, posture, habit and recent action", () => {
  const input = daily("chair", "neck", "screen", "recent_look_down"),
    original = decide(input, emptyMemory()),
    first = original.selected[0],
    memory = emptyMemory();
  memory.bundles = [0, 1].map((i) => ({
    sessionId: String(i),
    catalogIds: [first],
    purpose: "daily",
    reaction: "same",
    at: Date.now(),
    patterns: [
      DAILY_FLOW,
      "area:neck",
      "pose:chair",
      "habit:screen",
      "action:recent_look_down",
    ],
    focus: [],
    minutes: null,
  }));
  assert.notEqual(decide(input, memory).selected[0], first);
  for (const [from, to] of [
    ["area:neck", "area:shoulder"],
    ["pose:chair", "pose:standing"],
    ["action:recent_look_down", "action:recent_look_up"],
  ]) {
    const other = structuredClone(memory);
    for (const b of other.bundles!)
      b.patterns = b.patterns.map((p) => (p === from ? to : p));
    assert.deepEqual(decide(input, other).selected, original.selected);
  }
});
test("two is the default; an extra family is included only as a complementary movement type with current answers", () => {
  assert.equal(
    decide(daily("chair", "back"), emptyMemory()).selected.length,
    2,
  );
  const d = decide(
    daily("chair", "back", "retract", "recent_immobile"),
    emptyMemory(),
  );
  assert.equal(d.selected.length, 3);
  const cs = d.selected.map((id) => catalog.find((c) => c.catalogId === id)!);
  assert.ok(cs.slice(0, 2).every((c) => c.movementType !== cs[2].movementType));
  const i = daily("chair", "back");
  const memory = emptyMemory(),
    first = decide(i, memory).selected;
  memory.bundles = [0, 1].map((n) => ({
    sessionId: String(n),
    catalogIds: first,
    purpose: "daily",
    reaction: "same",
    at: Date.now(),
    patterns: [
      DAILY_FLOW,
      "area:back",
      "pose:chair",
      "habit:unknown",
      "action:unknown",
    ],
    focus: [],
    minutes: null,
  }));
  assert.equal(decide(i, memory).selected[0], "D27");
});
