import type { HabitId, RecentActionId } from "../../app/jikkot-data.js";
export type Condition =
  | { kind: "habit"; id: HabitId }
  | { kind: "recent"; id: RecentActionId }
  | { kind: "all" | "any"; conditions: readonly Condition[] }
  | { kind: "no-specific-recent" }
  | { kind: "always" };
const h = (id: HabitId): Condition => ({ kind: "habit", id });
const r = (id: RecentActionId): Condition => ({ kind: "recent", id });
const all = (...conditions: Condition[]): Condition => ({
  kind: "all",
  conditions,
});
const any = (...conditions: Condition[]): Condition => ({
  kind: "any",
  conditions,
});
const N = all(r("R_HEAD_TURN"), any(h("H_SIDE_SCREEN"), h("H_SHRUG")));
const U = r("R_OVERHEAD"),
  L = r("R_HOLD_LOAD"),
  O = all(r("R_ONE_HAND"), h("H_ONE_FORWARD"));
const B = any(r("R_COMPUTER_BOTH"), r("R_DRIVE")),
  P = r("R_PHONE"),
  C = r("R_PUSH_CHEST");
const J = any(r("R_CLENCH"), r("R_CHEW"));
const H_NECK = any(h("H_SIDE_SCREEN"), h("H_SHRUG"), h("H_ELBOW"));
const H_FRONT_BOTH = h("H_BOTH_FRONT");
const H_JAW = any(h("H_CLENCH"), h("H_GRIND"), h("H_CHEW"));
const noRecent: Condition = { kind: "no-specific-recent" };
const fallback: Condition = { kind: "always" };
export type TreeName =
  | "lower"
  | "between"
  | "inner"
  | "upper"
  | "general"
  | "neck"
  | "front"
  | "rear"
  | "top"
  | "rounded"
  | "head";
export type DecisionRule = {
  id: string;
  condition: Condition;
  routineNumber: number;
  excludedRuleIds: readonly string[];
  isDefault: boolean;
};
function rules(
  tree: TreeName,
  entries: readonly [string, Condition, number][],
): DecisionRule[] {
  return entries.map(([name, condition, routineNumber], index) => ({
    id: `${tree}-${name}`,
    condition,
    routineNumber,
    excludedRuleIds: entries
      .slice(0, index)
      .map(([prior]) => `${tree}-${prior}`),
    isDefault: condition.kind === "always",
  }));
}
// Order is the supplied content decision tree, not ranking, scores or tie-breaking.
export const decisionTrees: Record<TreeName, readonly DecisionRule[]> = {
  lower: rules("lower", [["default", fallback, 1]]),
  between: rules("between", [
    ["neck-turn", N, 3],
    ["overhead", U, 5],
    ["load-front", all(L, H_FRONT_BOTH), 8],
    ["pinch-computer", all(h("H_PINCH"), B), 2],
    ["phone", P, 6],
    ["computer", B, 2],
    ["one-hand", r("R_ONE_HAND"), 6],
    ["load", L, 8],
    ["habit-overhead", all(noRecent, h("H_OVERHEAD")), 5],
    ["habit-neck", all(noRecent, H_NECK), 3],
    ["habit-pinch", all(noRecent, h("H_PINCH")), 2],
    ["default", fallback, 2],
  ]),
  inner: rules("inner", [
    ["neck-turn", N, 3],
    ["one-forward", O, 4],
    ["overhead", U, 5],
    ["load", L, 8],
    ["phone", P, 6],
    ["computer-front", all(B, H_FRONT_BOTH), 7],
    ["one-hand", r("R_ONE_HAND"), 4],
    ["computer", B, 2],
    ["habit-one-forward", all(noRecent, h("H_ONE_FORWARD")), 4],
    ["habit-neck", all(noRecent, H_NECK), 3],
    ["habit-overhead", all(noRecent, h("H_OVERHEAD")), 5],
    ["default", fallback, 2],
  ]),
  upper: rules("upper", [
    ["neck-turn", N, 3],
    ["load", L, 8],
    ["overhead-habit", all(U, h("H_OVERHEAD")), 6],
    ["pinch-computer", all(h("H_PINCH"), B), 2],
    ["computer-front", all(B, H_FRONT_BOTH), 7],
    ["phone-one-hand", any(P, r("R_ONE_HAND")), 6],
    ["computer", B, 2],
    ["habit-neck", all(noRecent, H_NECK), 3],
    ["habit-front", all(noRecent, H_FRONT_BOTH), 7],
    ["default", fallback, 2],
  ]),
  general: rules("general", [
    ["neck-turn", N, 3],
    ["load", L, 8],
    ["computer-front", all(B, H_FRONT_BOTH), 7],
    ["phone-one-hand", any(P, r("R_ONE_HAND")), 6],
    ["habit-neck", all(noRecent, H_NECK), 3],
    ["habit-front", all(noRecent, H_FRONT_BOTH), 7],
    ["default", fallback, 6],
  ]),
  neck: rules("neck", [
    ["turn-shrug", any(r("R_HEAD_TURN"), r("R_SHRUG")), 3],
    ["load", L, 8],
    ["bag", r("R_BAG_CARRY"), 3],
    ["computer", B, 7],
    ["habit-neck", all(noRecent, H_NECK), 3],
    ["habit-carry", all(noRecent, h("H_CARRY")), 8],
    ["default", fallback, 3],
  ]),
  front: rules("front", [
    ["chest", C, 11],
    ["one-forward", O, 4],
    ["overhead", U, 5],
    ["phone", P, 6],
    ["one-hand", r("R_ONE_HAND"), 4],
    ["computer-one-forward", all(B, h("H_ONE_FORWARD")), 4],
    ["computer", B, 6],
    ["habit-chest", all(noRecent, h("H_CHEST_PUSH")), 11],
    ["habit-one-forward", all(noRecent, h("H_ONE_FORWARD")), 4],
    ["habit-arms-close", all(noRecent, h("H_ARMS_CLOSE")), 6],
    ["habit-overhead", all(noRecent, h("H_OVERHEAD")), 5],
    ["default", fallback, 4],
  ]),
  rear: rules("rear", [
    ["overhead-load", any(U, L), 5],
    ["habit-overhead", all(noRecent, h("H_OVERHEAD")), 5],
    ["default", fallback, 6],
  ]),
  top: rules("top", [
    ["turn-shrug", any(r("R_HEAD_TURN"), r("R_SHRUG")), 3],
    ["load", L, 8],
    ["overhead", U, 5],
    ["bag", r("R_BAG_CARRY"), 3],
    ["computer", B, 7],
    ["habit-neck", all(noRecent, H_NECK), 3],
    ["habit-carry", all(noRecent, h("H_CARRY")), 8],
    ["habit-overhead", all(noRecent, h("H_OVERHEAD")), 5],
    ["default", fallback, 7],
  ]),
  rounded: rules("rounded", [
    ["chest", C, 11],
    ["load", L, 8],
    ["front-work", any(B, P, r("R_ONE_HAND")), 7],
    ["habit-chest", all(noRecent, h("H_CHEST_PUSH")), 11],
    ["default", fallback, 7],
  ]),
  head: rules("head", [
    ["jaw", J, 10],
    ["turn-shrug", any(r("R_HEAD_TURN"), r("R_SHRUG")), 9],
    ["computer-side-screen", all(B, h("H_SIDE_SCREEN")), 9],
    ["habit-jaw", H_JAW, 10],
    ["habit-turn-shrug", any(h("H_SIDE_SCREEN"), h("H_SHRUG")), 9],
    ["default", fallback, 10],
  ]),
};
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
  if (condition.kind === "any")
    return matches.find((value) => value !== null) ?? null;
  if (matches.some((value) => value === null)) return null;
  return {
    habits: [...new Set(matches.flatMap((value) => value!.habits))],
    recent: [...new Set(matches.flatMap((value) => value!.recent))],
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
