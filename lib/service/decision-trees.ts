import type { AreaCode, HabitId, RecentActionId } from "../../app/jikkot-data.js";
import { mapAreaValues } from "../../app/jikkot-data.js";
import { fiveAreasSpec } from "../../app/five-areas-spec.js";
export type Condition =
  | { kind: "habit"; id: HabitId }
  | { kind: "recent"; id: RecentActionId }
  | { kind: "all" | "any"; conditions: readonly Condition[] }
  | { kind: "no-specific-recent" }
  | { kind: "always" };
export type TreeName = AreaCode;
export type DecisionRule = {
  id: string;
  condition: Condition;
  routineNumber: number;
  excludedRuleIds: readonly string[];
  isDefault: boolean;
};
type Groups = readonly (readonly string[])[];
function conditionFor(key: string): Condition {
  if (key === "ALWAYS") return { kind: "always" };
  if (key === "NR") return { kind: "no-specific-recent" };
  const composite = (fiveAreasSpec.compositeConditions as Record<string, Groups>)[key];
  if (composite) return groupsCondition(composite);
  if (Object.hasOwn(fiveAreasSpec.habits, key)) return { kind: "habit", id: key as HabitId };
  if (Object.hasOwn(fiveAreasSpec.recentActions, key)) return { kind: "recent", id: key as RecentActionId };
  throw new Error(`Unknown content condition: ${key}`);
}
// Outer groups are AND, inner groups are OR. No scores or candidate sorting.
function groupsCondition(groups: Groups): Condition {
  return { kind: "all", conditions: groups.map((group) => ({ kind: "any", conditions: group.map(conditionFor) })) };
}
export const decisionTrees = mapAreaValues<readonly DecisionRule[]>((area) => {
  const rows = fiveAreasSpec.rules[area];
  return rows.map((row, index) => ({
    id: row.id,
    condition: groupsCondition(row.when),
    routineNumber: row.routine,
    excludedRuleIds: rows.slice(0, index).map((prior) => prior.id),
    isDefault: row.when.flat().includes("ALWAYS"),
  }));
});
export type Signals = {
  habits: ReadonlySet<string>;
  recent: ReadonlySet<string>;
};
export type MatchedSignals = { habits: string[]; recent: string[] };
export function matchCondition(
  condition: Condition,
  input: Signals,
): MatchedSignals | null {
  if (condition.kind === "always") return { habits: [], recent: [] };
  if (condition.kind === "no-specific-recent")
    return !input.recent.size ||
      input.recent.has("R_NONE") ||
      input.recent.has("R_UNKNOWN")
      ? { habits: [], recent: [] }
      : null;
  if (condition.kind === "habit")
    return input.habits.has(condition.id)
      ? { habits: [condition.id], recent: [] }
      : null;
  if (condition.kind === "recent")
    return input.recent.has(condition.id)
      ? { habits: [], recent: [condition.id] }
      : null;
  const matches = condition.conditions.map((child) =>
    matchCondition(child, input),
  );
  if (condition.kind === "any" && matches.every((value) => value === null)) return null;
  if (condition.kind === "all" && matches.some((value) => value === null)) return null;
  return {
    habits: [...new Set(matches.flatMap((value) => value?.habits ?? []))],
    recent: [...new Set(matches.flatMap((value) => value?.recent ?? []))],
  };
}
export function effectiveRules(tree: TreeName, input: Signals): DecisionRule[] {
  const rules = decisionTrees[tree];
  const raw = new Map(
    rules.map((rule) => [
      rule.id,
      matchCondition(rule.condition, input) !== null,
    ]),
  );
  return rules.filter(
    (rule) =>
      raw.get(rule.id) &&
      rule.excludedRuleIds.every((prior) => !raw.get(prior)),
  );
}
