import test from "node:test";
import assert from "node:assert/strict";
import {
  areas,
  routes,
  getRoutine,
  habits,
  recentActions,
} from "../../app/jikkot-data";
import {
  makeRecommendation,
  isAllowed,
  nextRecommendation,
  recentQuestions,
  habitQuestions,
  kstDate,
  CONTENT_VERSION,
  type Answers,
  type ContentExtensions,
} from "../../lib/service/recommendation";
import { fresh, restore } from "../../lib/service/progress";
const a: Answers = {
  mode: "seated",
  area: "NECK",
  habits: ["HB04"],
  recent: ["RA02"],
};
test("preserves original route/slot priority and habit ranking for representative MVP inputs", () => {
  for (const area of areas)
    for (const q of recentQuestions(area.id, []))
      for (const h of habitQuestions(area.id))
        for (const mode of ["seated", "standing", "lying"] as const) {
          const value = { area: area.id, mode, recent: [q.id], habits: [h.id] };
          const recentTags = value.recent.map(
            (id) => recentActions.find((q) => q.id === id)!.tag as string,
          );
          const habitTags = value.habits.map(
            (id) => habits.find((q) => q.id === id)!.tag as string,
          );
          const route =
            routes[area.id].find((r) =>
              r.tags.some((t) => recentTags.includes(t)),
            ) ?? routes[area.id].at(-1)!;
          // Independent extraction of the old algorithm's first nonempty slot. No UI-specific copies.
          const expected = [route.relax, route.move, route.control]
            .map(
              (ids) =>
                ids
                  .map(getRoutine)
                  .filter((r) => r && isAllowed(r, mode))
                  .map((r, index) => ({
                    r: r!,
                    index,
                    match: r!.clusters.some((t) => habitTags.includes(t))
                      ? 1
                      : 0,
                  }))
                  .sort((x, y) => y.match - x.match || x.index - y.index)[0]?.r,
            )
            .find(Boolean)!;
          const actual = makeRecommendation(value);
          assert.equal(actual.routine.id, expected.id);
          assert.ok(isAllowed(actual.routine, mode));
        }
});
test("question adapter excludes none, supports multiselect and injects conditional content only", () => {
  assert.ok(!habitQuestions("NECK").some((q) => q.id === "HB99"));
  assert.ok(!recentQuestions("NECK", []).some((q) => q.id === "RA99"));
  const fixture: ContentExtensions = {
    recentQuestions: [{ area: "NECK", allHabits: ["HB04"], ids: ["RA03"] }],
  };
  assert.deepEqual(
    recentQuestions("NECK", ["HB04"], fixture).map((q) => q.id),
    ["RA03"],
  );
  assert.equal(recentQuestions("NECK", [], fixture).length, 5);
});
test("KST midnight and restoration are separate from usage consumption", () => {
  assert.equal(kstDate(new Date("2026-10-06T14:59:59Z")), "2026-10-06");
  assert.equal(kstDate(new Date("2026-10-06T15:00:00Z")), "2026-10-07");
});
test("progress rejects other account, expiry, schema, content and credentials never persist", () => {
  const owner = { kind: "member" as const, id: "A" };
  const p = fresh(owner);
  assert.equal(restore(JSON.stringify(p), owner)?.screen, "home");
  assert.equal(restore(JSON.stringify(p), { kind: "member", id: "B" }), null);
  assert.equal(restore(JSON.stringify({ ...p, updatedAt: 0 }), owner), null);
  assert.equal(
    restore(JSON.stringify({ ...p, contentVersion: "old" }), owner),
    null,
  );
  assert.equal(
    restore(JSON.stringify({ ...p, schemaVersion: 0 }), owner),
    null,
  );
  assert.ok(
    !(
      "password" in
      restore(JSON.stringify({ ...p, password: "do-not-store" }), owner)!
    ),
  );
  assert.equal(p.contentVersion, CONTENT_VERSION);
});
test("same/worse fixture branches enforce posture and other-area links; empty production returns no next", () => {
  assert.equal(nextRecommendation(a, "MV009", "NECK:0", "same", []), null);
  const fixture: ContentExtensions = {
    related: { "NECK:0": [{ area: "SHOULDER", routineId: "MV012" }] },
    changes: {
      MV009: [{ id: "change-1", label: "검증용 선택", nextRoutineId: "MV005" }],
    },
  };
  assert.equal(
    nextRecommendation(a, "MV009", "NECK:0", "same", [], fixture)?.id,
    "MV012",
  );
  assert.equal(
    nextRecommendation(a, "MV009", "NECK:0", "worse", ["change-1"], fixture)
      ?.id,
    "MV005",
  );
  assert.equal(
    nextRecommendation(a, "MV009", "NECK:0", "worse", [], fixture),
    null,
  );
});
