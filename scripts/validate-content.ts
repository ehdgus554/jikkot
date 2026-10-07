import assert from "node:assert/strict";
import { areas, routes, getRoutine, type AreaCode } from "../app/jikkot-data";
import {
  makeRecommendation,
  habitQuestions,
  recentQuestions,
  isAllowed,
  extensions,
  type Answers,
  type ContentExtensions,
} from "../lib/service/recommendation";
function subsets(ids: string[]) {
  return Array.from({ length: 2 ** ids.length - 1 }, (_, i) =>
    ids.filter((_, j) => (i + 1) & (1 << j)),
  );
}
let checked = 0;
for (const area of areas)
  for (const mode of ["seated", "standing", "lying"] as const)
    for (const habits of subsets(habitQuestions(area.id).map((q) => q.id)))
      for (const recent of subsets(
        recentQuestions(area.id, habits).map((q) => q.id),
      )) {
        const answers: Answers = { area: area.id, mode, recent, habits };
        const result = makeRecommendation(answers);
        assert.ok(isAllowed(result.routine, mode));
        const route = routes[area.id][Number(result.pattern.split(":")[1])];
        assert.ok(
          [...route.relax, ...route.move, ...route.control].includes(
            result.routine.id,
          ),
        );
        checked++;
      }
export function validateExtensions(content: ContentExtensions) {
  for (const condition of content.recentQuestions ?? []) {
    assert.ok(areas.some((a) => a.id === condition.area));
    assert.ok(
      condition.allHabits.every((id) =>
        habitQuestions(condition.area).some((q) => q.id === id),
      ),
    );
    assert.ok(
      condition.ids.length &&
        condition.ids.every((id) =>
          recentQuestions(condition.area, []).some((q) => q.id === id),
        ),
    );
  }
  for (const [pattern, links] of Object.entries(content.related ?? {})) {
    const [area, index] = pattern.split(":");
    assert.ok(areas.some((a) => a.id === area));
    assert.ok(routes[area as AreaCode][Number(index)]);
    for (const link of links) {
      const r = getRoutine(link.routineId);
      assert.ok(r && link.area !== area && r.areas.includes(link.area));
      for (const mode of ["seated", "standing", "lying"] as const)
        assert.ok(
          isAllowed(r, mode),
          `unsupported related posture: ${pattern}/${mode}`,
        );
    }
  }
  for (const [source, questions] of Object.entries(content.changes ?? {})) {
    const original = getRoutine(source);
    assert.ok(original);
    assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
    for (const q of questions) {
      assert.ok(q.label);
      if (q.nextRoutineId) {
        const r = getRoutine(q.nextRoutineId);
        assert.ok(r);
        for (const mode of ["seated", "standing", "lying"] as const)
          if (isAllowed(original, mode))
            assert.ok(
              isAllowed(r, mode),
              `unsupported change posture: ${source}/${mode}`,
            );
      }
    }
  }
}
validateExtensions(extensions);
console.log(
  `PASS: ${checked} nonempty multiselect/posture/area combinations and extension links. No unrelated fallback.`,
);
