import assert from "node:assert/strict";
import {
  areas,
  getRoutine,
  routines,
  allowedRoutineNumbers,
} from "../app/jikkot-data";
import {
  makeRecommendation,
  habitQuestions,
  recentQuestions,
  validateAnswers,
  nextRecommendation,
  CONTENT_VERSION,
} from "../lib/service/recommendation";
import { decisionTrees, effectiveRules } from "../lib/service/decision-trees";
import { suppliedSpec, referenceRecommendation } from "./five-areas-reference";
export function validSubsets(ids: string[], specials: string[]) {
  const normal = ids.filter((id) => !specials.includes(id));
  return [
    ...Array.from({ length: 2 ** normal.length - 1 }, (_, index) =>
      normal.filter((_, bit) => (index + 1) & (1 << bit)),
    ),
    ...specials.map((id) => [id]),
  ];
}
export function validateContent() {
  let checked = 0;
  const reached = new Set<number>();
  const branches = new Map<string, number>();
  const fallbackRoutines = new Set<number>(),
    specificRoutines = new Set<number>();
  assert.equal(routines.length, 11);
  assert.deepEqual(
    areas.map(({ id, label }) => ({ id, label })),
    suppliedSpec.bodyAreas,
  );
  assert.equal(new Set(routines.map((routine) => routine.id)).size, 11);
  assert.equal(new Set(routines.map((routine) => routine.image)).size, 11);
  for (const area of areas) {
    assert.deepEqual(
      habitQuestions(area.id).map(({ id }) => id),
      [...suppliedSpec.habitProfiles[area.id], "H_UNKNOWN"],
    );
    assert.deepEqual(
      recentQuestions(area.id, []).map(({ id }) => id),
      [...suppliedSpec.recentProfiles[area.id], "R_NONE", "R_UNKNOWN"],
    );
    assert.deepEqual(
      allowedRoutineNumbers[area.id],
      suppliedSpec.allowedRoutines[area.id],
    );
    const habitSets = validSubsets(
      habitQuestions(area.id).map((question) => question.id),
      ["H_UNKNOWN"],
    );
    const recentSets = validSubsets(
      recentQuestions(area.id, []).map((question) => question.id),
      ["R_NONE", "R_UNKNOWN"],
    );
    for (const habits of habitSets)
      for (const recent of recentSets) {
        const input = validateAnswers({
          mode: "seated",
          area: area.id,
          habits,
          recent,
        });
        const result = makeRecommendation(input);
        const reference = referenceRecommendation(
          area.id,
          input.habits,
          input.recent,
        );
        assert.equal(result.routine.displayNumber, reference.routineNumber);
        assert.equal(result.ruleId, reference.ruleId);
        assert.deepEqual(
          [...result.matchedHabitIds].sort(),
          [...reference.matchedHabitIds].sort(),
        );
        assert.deepEqual(
          [...result.matchedRecentActionIds].sort(),
          [...reference.matchedRecentActionIds].sort(),
        );
        const effective = effectiveRules(area.tree, {
          habits: new Set(input.habits),
          recent: new Set(input.recent),
        });
        assert.equal(
          effective.length,
          1,
          `${area.id}: exactly one mutually exclusive final branch`,
        );
        assert.equal(effective[0].id, result.ruleId);
        assert.ok(
          allowedRoutineNumbers[area.id].includes(result.routine.displayNumber),
        );
        assert.equal(
          getRoutine(result.routineId)?.displayNumber,
          result.routine.displayNumber,
        );
        assert.ok(
          result.routine.name &&
            result.routine.steps.length >= 2 &&
            result.routine.image.endsWith(".png"),
        );
        assert.equal(result.contentVersion, CONTENT_VERSION);
        assert.ok(
          result.matchedHabitIds.every((id) => input.habits.includes(id)),
        );
        assert.ok(
          result.matchedRecentActionIds.every((id) =>
            input.recent.includes(id),
          ),
        );
        assert.equal(
          result.reasonText.split(/[.!?]/).filter((part) => part.trim()).length,
          2,
        );
        assert.doesNotMatch(
          result.reasonText,
          /H_|R_|jikkot11|분기|알고리즘|점수/,
        );
        const permuted = makeRecommendation({
          ...input,
          habits: [...input.habits, ...input.habits].reverse(),
          recent: [...input.recent, ...input.recent].reverse(),
        });
        assert.equal(permuted.routineId, result.routineId);
        assert.deepEqual(permuted.matchedHabitIds, result.matchedHabitIds);
        assert.deepEqual(
          permuted.matchedRecentActionIds,
          result.matchedRecentActionIds,
        );
        assert.equal(permuted.reasonText, result.reasonText);
        reached.add(result.routine.displayNumber);
        branches.set(result.ruleId, (branches.get(result.ruleId) ?? 0) + 1);
        (effective[0].isDefault ? fallbackRoutines : specificRoutines).add(
          result.routine.displayNumber,
        );
        checked++;
      }
    for (const rule of decisionTrees[area.tree])
      assert.ok(branches.get(rule.id), `Unreachable final branch: ${rule.id}`);
    // Alternative paths keep the same area mapping and never return the current move.
    const sample = validateAnswers({
      area: area.id,
      habits: ["H_UNKNOWN"],
      recent: ["R_NONE"],
    });
    for (const number of allowedRoutineNumbers[area.id]) {
      const routine = routines.find((item) => item.displayNumber === number)!;
      for (const feedback of ["same", "worse"] as const) {
        const next = nextRecommendation(sample, routine.id, "", feedback, []);
        assert.equal(
          next,
          null,
          "No approved alternative mapping: never fall through to broad area candidates",
        );
      }
    }
  }
  assert.equal(reached.size, 11);
  assert.equal(
    checked,
    42544,
    "Exactly the supplied non-empty, exclusive UI combinations",
  );
  assert.equal(branches.size, 46);
  return {
    checked,
    branches: branches.size,
    reachableNumbers: [...reached].sort((a, b) => a - b),
    fallbackNumbers: [...fallbackRoutines].sort((a, b) => a - b),
    specificNumbers: [...specificRoutines].sort((a, b) => a - b),
  };
}
if (process.argv[1]?.endsWith("validate-content.ts"))
  console.log(
    "PASS: approved jikkot11 content",
    JSON.stringify(validateContent()),
  );
