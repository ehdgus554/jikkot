import test from "node:test";
import assert from "node:assert/strict";
import { routines, areas, allowedRoutineNumbers } from "../../app/jikkot-data";
import {
  makeRecommendation,
  nextRecommendation,
  validateAnswers,
  recentQuestions,
  habitQuestions,
  toggleExclusive,
  snapshot,
  kstDate,
  CONTENT_VERSION,
} from "../../lib/service/recommendation";
import { fresh, restore } from "../../lib/service/progress";
import { validateContent } from "../../scripts/validate-content";
import { fiveAreasExamples as examples } from "../fixtures/five-areas-examples";
test("all supplied single and combined examples select the specified approved move", () => {
  for (const [area, habits, recent, expected] of examples) {
    const answers = validateAnswers({
      area,
      habits: [...habits],
      recent: [...recent],
    });
    assert.equal(
      makeRecommendation(answers).routine.displayNumber,
      expected,
      area,
    );
  }
});
test("every valid subset has one exclusive reachable branch, stable ordering and an allowed move", () => {
  const result = validateContent();
  assert.equal(result.checked, 42544);
  assert.equal(result.branches, 46);
  assert.deepEqual(
    result.reachableNumbers,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
});
test("special options are exclusive, empty/unknown inputs normalize to defaults, and recent choices are never hidden", () => {
  assert.deepEqual(toggleExclusive(["H_SHRUG"], "H_UNKNOWN", ["H_UNKNOWN"]), [
    "H_UNKNOWN",
  ]);
  assert.deepEqual(toggleExclusive(["H_UNKNOWN"], "H_SHRUG", ["H_UNKNOWN"]), [
    "H_SHRUG",
  ]);
  assert.deepEqual(
    toggleExclusive(["R_PHONE"], "R_NONE", ["R_NONE", "R_UNKNOWN"]),
    ["R_NONE"],
  );
  assert.deepEqual(
    toggleExclusive(["R_NONE"], "R_UNKNOWN", ["R_NONE", "R_UNKNOWN"]),
    ["R_UNKNOWN"],
  );
  for (const area of areas) {
    assert.deepEqual(
      recentQuestions(area.id, ["H_UNKNOWN"]),
      recentQuestions(
        area.id,
        habitQuestions(area.id).map((item) => item.id),
      ),
    );
    const empty = validateAnswers({ area: area.id, habits: [], recent: [] });
    assert.deepEqual(empty.habits, ["H_UNKNOWN"]);
    assert.deepEqual(empty.recent, ["R_UNKNOWN"]);
    assert.ok(
      allowedRoutineNumbers[area.id].includes(
        makeRecommendation(empty).routine.displayNumber,
      ),
    );
  }
  assert.throws(() =>
    validateAnswers({
      area: "head",
      habits: ["H_UNKNOWN", "H_CLENCH"],
      recent: [],
    }),
  );
  assert.throws(() =>
    validateAnswers({
      area: "head",
      habits: [],
      recent: ["R_NONE", "R_CLENCH"],
    }),
  );
  assert.throws(() =>
    validateAnswers({ area: "lower", habits: ["H_SHRUG"], recent: [] }),
  );
});
test("reasons cite only inputs that determined the winning branch and snapshot new IDs/version/steps", () => {
  const a = validateAnswers({
    area: "back",
    habits: ["H_PINCH", "H_OVERHEAD"],
    recent: ["R_OVERHEAD"],
  });
  const rec = makeRecommendation(a);
  assert.deepEqual(rec.matchedHabitIds, []);
  assert.deepEqual(rec.matchedRecentActionIds, ["R_OVERHEAD"]);
  assert.doesNotMatch(rec.reasonText, /날개뼈를 모으|힘을 주는 습관/);
  const saved = snapshot(a, rec.routine, rec.pattern);
  assert.equal(saved.contentVersion, "jikkot11-v2-fiveareas");
  assert.equal(saved.routine.id, "jikkot11-r05");
  assert.equal(saved.routine.steps.length, 2);
  const head = makeRecommendation(
    validateAnswers({
      area: "head",
      habits: ["H_SIDE_SCREEN", "H_CLENCH"],
      recent: ["R_HEAD_TURN", "R_CLENCH"],
    }),
  );
  assert.doesNotMatch(head.reasonText, /고개|옆 화면/);
});
test("KST dates and progress ownership/version are independent of server usage and old records", () => {
  assert.equal(kstDate(new Date("2026-10-06T14:59:59Z")), "2026-10-06");
  assert.equal(kstDate(new Date("2026-10-06T15:00:00Z")), "2026-10-07");
  const owner = { kind: "member" as const, id: "A" },
    p = fresh(owner);
  assert.equal(restore(JSON.stringify(p), owner)?.screen, "home");
  assert.equal(restore(JSON.stringify(p), { ...owner, id: "B" }), null);
  assert.equal(restore(JSON.stringify({ ...p, updatedAt: 0 }), owner), null);
  assert.equal(
    restore(
      JSON.stringify({ ...p, contentVersion: "mvp-9.1-adapter-v1" }),
      owner,
    ),
    null,
  );
  assert.equal(
    restore(JSON.stringify({ ...p, schemaVersion: 1 }), owner),
    null,
  );
  assert.ok(
    !(
      "password" in
      restore(JSON.stringify({ ...p, password: "private" }), owner)!
    ),
  );
  assert.equal(p.contentVersion, CONTENT_VERSION);
});
test("unfinished detailed-area progress resets only its questionnaire, retaining owner and consent", () => {
  const owner = { kind: "member" as const, id: "old-member" };
  const previous = {
    ...fresh(owner, true),
    screen: "routine",
    contentVersion: "jikkot11-v1",
    answers: {
      mode: "seated",
      area: "front_shoulder",
      habits: ["H_ONE_FORWARD"],
      recent: ["R_ONE_HAND"],
    },
    recommendationId: crypto.randomUUID(),
    routineId: "jikkot11-r04",
  };
  const resumed = restore(JSON.stringify(previous), owner)!;
  assert.equal(resumed.screen, "area");
  assert.deepEqual(resumed.owner, owner);
  assert.equal(resumed.guestConsent, true);
  assert.deepEqual(resumed.answers, { mode: "seated" });
  assert.equal(resumed.recommendationId, undefined);
  assert.equal(resumed.contentVersion, "jikkot11-v2-fiveareas");
  assert.equal(
    restore(JSON.stringify(previous), { ...owner, id: "other" }),
    null,
  );
  assert.throws(() => validateAnswers(previous.answers));
});
test("alternatives stay within approved area mapping, exclude the current move, and never alias old IDs", () => {
  assert.equal(routines.length, 11);
  for (const area of areas) {
    const a = validateAnswers({ area: area.id, habits: [], recent: [] });
    const rec = makeRecommendation(a);
    for (const feedback of ["same", "worse"] as const) {
      const next = nextRecommendation(
        a,
        rec.routine.id,
        rec.pattern,
        feedback,
        [],
      );
      assert.equal(
        next,
        null,
        "Missing approved mapping must terminate for every area",
      );
    }
    assert.equal(nextRecommendation(a, "MV001", "NECK:0", "same", []), null);
    const allVisited = routines
      .filter((routine) =>
        allowedRoutineNumbers[area.id].includes(routine.displayNumber),
      )
      .map((routine) => routine.id);
    assert.equal(
      nextRecommendation(
        a,
        rec.routine.id,
        rec.pattern,
        "same",
        [],
        undefined,
        allVisited,
      ),
      null,
    );
  }
});

test("an explicit alternative must match pattern, feedback and process and exclude visited/out-of-area moves", () => {
  const answers = validateAnswers({
    area: "neck",
    habits: ["H_SHRUG"],
    recent: ["R_HEAD_TURN"],
  });
  const primary = makeRecommendation(answers);
  // Test-only configuration proves the gate; no such clinical mapping is enabled in production.
  const mapping = {
    pattern: primary.pattern,
    currentRoutineId: primary.routine.id,
    feedback: "worse" as const,
    changeIds: ["step-2"],
    nextRoutineId: "jikkot11-r08",
  };
  const content = { alternatives: [mapping] };
  assert.equal(
    nextRecommendation(
      answers,
      primary.routine.id,
      primary.pattern,
      "worse",
      ["step-2"],
      content,
    )?.id,
    "jikkot11-r08",
  );
  assert.equal(
    nextRecommendation(
      answers,
      primary.routine.id,
      "different-pattern",
      "worse",
      ["step-2"],
      content,
    ),
    null,
  );
  assert.equal(
    nextRecommendation(
      answers,
      primary.routine.id,
      primary.pattern,
      "same",
      ["step-2"],
      content,
    ),
    null,
  );
  assert.equal(
    nextRecommendation(
      answers,
      primary.routine.id,
      primary.pattern,
      "worse",
      ["unknown"],
      content,
    ),
    null,
  );
  assert.equal(
    nextRecommendation(
      answers,
      primary.routine.id,
      primary.pattern,
      "worse",
      ["step-2"],
      content,
      [primary.routine.id, "jikkot11-r08"],
    ),
    null,
  );
  assert.equal(
    nextRecommendation(
      answers,
      primary.routine.id,
      primary.pattern,
      "worse",
      ["step-2"],
      { alternatives: [{ ...mapping, nextRoutineId: "jikkot11-r01" }] },
    ),
    null,
  );
});
