import { readFileSync } from "node:fs";
import type { AreaCode } from "../app/jikkot-data";
import type { fiveAreasSpec } from "../app/five-areas-spec";

// Independent oracle: parse the user document rather than the production
// compiled conditions, so a transcription or condition compiler error fails.
const document = readFileSync("docs/five-areas-request.md", "utf8");
export const suppliedSpec: typeof fiveAreasSpec = JSON.parse(
  document.match(/```json\n([\s\S]*?)\n```/)![1],
);
export function referenceRecommendation(
  area: AreaCode,
  habits: string[],
  recent: string[],
) {
  const h = new Set(habits), r = new Set(recent);
  const all = new Set([...h, ...r]);
  const composites = suppliedSpec.compositeConditions as Record<string, readonly (readonly string[])[]>;
  const matched = (key: string): boolean => {
    if (key === "ALWAYS") return true;
    if (key === "NR") return r.size === 0 || r.has("R_NONE") || r.has("R_UNKNOWN");
    const groups = composites[key];
    return groups ? groups.every((group) => group.some((id) => all.has(id))) : all.has(key);
  };
  const row = suppliedSpec.rules[area].find((rule) => rule.when.every((group) => group.some(matched)))!;
  const used = new Set<string>();
  const collect = (key: string) => {
    if (key === "ALWAYS" || key === "NR") return;
    const groups = composites[key];
    if (groups) groups.forEach((group) => group.filter((id) => all.has(id)).forEach((id) => used.add(id)));
    else if (all.has(key)) used.add(key);
  };
  row.when.forEach((group) => group.filter(matched).forEach(collect));
  return {
    routineNumber: row.routine,
    ruleId: row.id,
    matchedHabitIds: [...used].filter((id) => h.has(id)),
    matchedRecentActionIds: [...used].filter((id) => r.has(id)),
  };
}
