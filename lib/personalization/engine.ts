import { catalog, type Content } from "./catalog";
import releaseRules from "./release/connection-rules.json";
import connections from "./release/publication-connections.json";
import programs from "./release/programs.json";
import replacements from "./release/replacement-pools.json";
import { validateQuestionInput } from "./questions";
import {
  VERSION,
  areas,
  type SessionInput,
  type Memory,
  type Decision,
  type Dose,
} from "./types";
export const approvedConnectionIds: readonly string[] =
  connections.approvedConnectionIds;
export const patternRules = releaseRules.rules;
export { programs };
const regionNames = Object.fromEntries(areas);
const knownDirections = new Set(catalog.flatMap((c) => c.directions));
export function normalizeInput(input: SessionInput): SessionInput {
  validateQuestionInput(input);
  if (input.purpose === "daily" && !input.area)
    throw Error("불편 부위를 선택해주세요.");
  if (input.purpose === "warmup" && !input.sport)
    throw Error("운동 종류를 선택해주세요.");
  if (input.purpose === "leisure" && !input.minutes)
    throw Error("사용할 시간을 선택해주세요.");
  if (input.avoidDirections.some((d) => !knownDirections.has(d)))
    throw Error("피할 움직임을 확인해주세요.");
  if (Math.abs(Date.now() - input.confirmedAt) > 86400000)
    throw Error("오늘 가능한 조건을 다시 확인해주세요.");
  return {
    ...input,
    habits: [...input.habits].sort(),
    current: [...input.current].sort(),
    supports: [...input.supports].sort(),
  };
}
export function capabilities(input: SessionInput) {
  return new Set<string>([...input.poses, ...input.supports]);
}
function excluded(
  item: Content,
  input: SessionInput,
  memory: Memory,
  visited: string[],
): string | null {
  const caps = capabilities(input);
  if (!approvedConnectionIds.includes(`${input.purpose}:${item.catalogId}`))
    return "purpose-not-published";
  if (!input.poses.includes(item.pose)) return "posture-unavailable";
  const alternatives = item.supportAlternatives as string[][];
  if (
    alternatives.length
      ? !alternatives.some((xs) => xs.every((s) => caps.has(s)))
      : item.supports.some((s) => !caps.has(s))
  )
    return "support-unavailable";
  if (item.requiredExplicitCapabilities.some((s) => !caps.has(s)))
    return "explicit-capability-missing";
  if (
    visited.some(
      (id) => catalog.find((c) => c.catalogId === id)?.family === item.family,
    )
  )
    return "already-performed-family";
  if (
    memory.constraints.some(
      (c) =>
        c.catalogId === item.catalogId ||
        catalog.find((x) => x.catalogId === c.catalogId)?.family ===
          item.family ||
        c.directions.some((d) => item.directions.includes(d)),
    )
  )
    return "adverse-history";
  if (input.avoidDirections.some((d) => item.directions.includes(d)))
    return "current-direction-limit";
  if (
    input.current.includes("flex_bad_ext_good") &&
    item.directions.some((d) => ["spine_flexion", "hip_hinge"].includes(d))
  )
    return "current-flexion-discomfort";
  if (
    input.current.includes("ext_bad_flex_good") &&
    item.directions.includes("spine_extension")
  )
    return "current-extension-discomfort";
  if (input.current.includes("fatigue") && item.movementType.includes("활성"))
    return "fatigue-no-extra-load";
  return null;
}
export function decide(
  raw: SessionInput,
  memory: Memory,
  visited: string[] = [],
): Decision {
  const input = normalizeInput(raw);
  const result: Decision = {
    version: VERSION,
    selected: [],
    patterns: [],
    excluded: [],
    appliedRules: [],
    memoryRevision: memory.revision,
    reason: "no-match",
  };
  if (
    ["sudden_worse", "radiating", "dizzy"].some((s) =>
      input.current.includes(s),
    )
  )
    return {
      ...result,
      reason: "blocked",
      appliedRules: ["automatic-recommendation-exclusion"],
    };
  const rules = patternRules.filter(
    (r) =>
      r.id !== "P21" &&
      r.habits.some((h) => input.habits.includes(h)) &&
      r.current.every((c) => input.current.includes(c)) &&
      (!("anyCurrent" in r) ||
        !r.anyCurrent ||
        r.anyCurrent.some((c) => input.current.includes(c))),
  );
  result.patterns = rules.map((r) => r.id);
  result.appliedRules = result.patterns.map((p) => "pattern:" + p);
  const usable = catalog.filter((c) => {
    const reason = excluded(c, input, memory, visited);
    if (reason) result.excluded.push({ id: c.catalogId, reason });
    return !reason;
  });
  if (input.purpose === "daily") {
    const priority = rules.flatMap((r) => r.candidates);
    const candidates = usable.filter(
      (c) =>
        priority.includes(c.catalogId) &&
        c.linkedRegions.some((r) =>
          input.area === "hamstring"
            ? /햄스트링|허벅지 뒤/.test(r)
            : r.includes(regionNames[input.area!]),
        ) &&
        c.comfort.every((t) => input.current.includes(t)),
    );
    const rank = (c: Content) => {
      const history = memory.experiences.filter(
        (e) =>
          e.catalogId === c.catalogId &&
          e.performed &&
          e.purpose === "daily" &&
          e.area === input.area &&
          e.patterns.some((p) => result.patterns.includes(p)) &&
          e.at > Date.now() - 30 * 86400000,
      );
      return (
        (history.filter((e) => e.reaction === "same").length >= 2 ? 1000 : 0) -
        (history.some((e) => e.reaction === "better") ? 100 : 0) +
        priority.indexOf(c.catalogId)
      );
    };
    candidates.sort((a, b) => rank(a) - rank(b));
    if (candidates[0]) result.selected = [candidates[0].catalogId];
  } else {
    if (
      !input.current.includes("today_ok") &&
      !input.current.includes("prep_comfort") &&
      !input.current.includes("small_comfort")
    )
      return result;
    const profile =
      input.profile ??
      (input.poses.includes("chair")
        ? "chair"
        : input.poses.includes("standing")
          ? "standing"
          : "lying");
    if (
      profile === "mixedFloor" &&
      !["floor", "wrist", "knee"].every((c) => capabilities(input).has(c))
    )
      return result;
    const program = programs.find(
      (p) =>
        p.purpose === input.purpose &&
        (input.purpose === "warmup"
          ? p.sport === input.sport
          : p.profile === profile &&
            p.minutesChoice === input.minutes &&
            p.focus === input.preference),
    );
    if (!program) return result;
    if (input.purpose === "warmup" && !input.current.includes("prep_comfort"))
      return result;
    const selected: NonNullable<Decision["sequence"]> = [];
    const families = new Map<string, string>();
    let adjustments = 0;
    for (const step of program.items) {
      let item = usable.find((c) => c.catalogId === step.catalogId);
      if (!item && adjustments < 2) {
        const pool =
          (replacements as Record<string, string[]>)[step.catalogId] ?? [];
        item = pool
          .map((id) => usable.find((c) => c.catalogId === id))
          .find((c) => c && !families.has(c.family));
        if (item) adjustments++;
      }
      if (!item || !item.includeInDefaultBundles) continue;
      // Only explicitly numbered rounds may repeat a movement, never a different alias in its family.
      const prior = families.get(item.family);
      if (prior && (prior !== item.catalogId || step.round === 1)) continue;
      if (item.catalogId !== step.catalogId && prior) continue;
      const dose = (
        "dose" in step && step.dose && item.catalogId === step.catalogId
          ? step.dose
          : item.dose
      ) as Dose;
      selected.push({ id: item.catalogId, dose, round: step.round });
      families.set(item.family, item.catalogId);
    }
    if (!selected.length) return result;
    // Walking alone is not a completed sport preparation; preserve a usable dynamic core.
    if (
      input.purpose === "warmup" &&
      selected.filter((s) => s.id !== "W11").length < 2
    )
      return result;
    result.sequence = selected;
    result.selected = selected.map((s) => s.id);
    const originalTime = program.items.reduce(
      (n, s) =>
        n +
        (
          ("dose" in s && s.dose
            ? s.dose
            : catalog.find((c) => c.catalogId === s.catalogId)!.dose) as Dose
        ).plannedSeconds,
      0,
    );
    const transitionBudget=Math.max(0,program.plannedSeconds-originalTime);
    result.program = {
      id: program.id,
      name: program.name,
      plannedSeconds:
        selected.reduce((n, s) => n + s.dose.plannedSeconds, 0) +
        Math.round((transitionBudget * selected.length) / program.items.length),
      stepCount: selected.length,
      distinctMovementCount: new Set(result.selected).size,
      partial: selected.length !== program.items.length || adjustments > 0,
      ...(program.sportSpecificStart
        ? { sportSpecificStart: program.sportSpecificStart.text }
        : {}),
    };
    if (input.purpose === "warmup") result.patterns.push("P21");
    result.appliedRules.push("program:" + program.id);
  }
  result.reason = result.selected.length ? "ready" : "no-match";
  return result;
}
export function summarize(memory: Memory, now = Date.now()) {
  const eligible = memory.experiences.filter(
    (x) => x.performed && x.reaction !== null,
  );
  const window = (days: number) => {
    const rows = [...eligible, ...(memory.bundles ?? [])].filter(
      (x) => x.at >= now - days * 86400000,
    );
    return {
      sessions: new Set(rows.map((x) => x.sessionId)).size,
      days: new Set(
        rows.map((x) =>
          new Date(x.at + 9 * 3600000).toISOString().slice(0, 10),
        ),
      ).size,
      evidenceIds: rows.map(
        (x) => `${x.sessionId}:${"catalogId" in x ? x.catalogId : "bundle"}`,
      ),
    };
  };
  return {
    revision: memory.revision,
    lastUpdated: now,
    sevenDays: window(7),
    thirtyDays: window(30),
  };
}
