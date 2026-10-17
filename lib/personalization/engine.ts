import { catalog, type Content } from "./catalog";
import { validateQuestionInput } from "./questions";
import {
  VERSION,
  type SessionInput,
  type Memory,
  type Decision,
} from "./types";

type Pattern = {
  id: string;
  habits: string[];
  current: string[];
  anyCurrent?: string[];
};
// Content approval does not approve a newly translated connection rule.
// Fill only after source/conditions/dosage review; no client or AI can edit this list.
export const approvedConnectionIds: readonly string[] = [];
// Explicit OR within habits/anyCurrent and AND across the required groups.
export const patternRules: Pattern[] = [
  { id: "P01", habits: ["arm_front"], current: ["chest_stiff"] },
  {
    id: "P02",
    habits: ["shrug", "look_up"],
    current: [],
    anyCurrent: ["neck_side", "neck_back"],
  },
  { id: "P03", habits: ["retract"], current: ["upper_back", "reach_comfort"] },
  {
    id: "P04",
    habits: ["screen"],
    current: [],
    anyCurrent: ["neck_fatigue", "upper_back"],
  },
  {
    id: "P05",
    habits: ["one_direction", "screen"],
    current: [],
    anyCurrent: ["torso_limited", "neck_limited"],
  },
  { id: "P06", habits: ["clench"], current: ["jaw_stiff"] },
  { id: "P07", habits: ["arms_up"], current: ["lat_stiff"] },
  { id: "P08", habits: ["arms_up"], current: ["shoulder_back"] },
  { id: "P09", habits: ["sitting", "stairs"], current: ["hip_front"] },
  { id: "P10", habits: ["sitting", "cross_legs"], current: ["hip_back"] },
  { id: "P11", habits: ["sitting", "bending"], current: ["hamstring_local"] },
  { id: "P12", habits: ["standing"], current: ["waist_effort"] },
  { id: "P13", habits: ["one_side", "cross_legs"], current: ["side_local"] },
  { id: "P14", habits: ["legs_together"], current: ["inner_thigh"] },
  { id: "P15", habits: ["standing", "walking"], current: ["calf_limited"] },
  { id: "P16", habits: ["standing", "walking"], current: ["plantar_local"] },
  { id: "P17", habits: ["increased_load", "walking"], current: ["fatigue"] },
  { id: "P18", habits: ["bending", "sitting"], current: ["flex_bad_ext_good"] },
  { id: "P19", habits: ["standing"], current: ["ext_bad_flex_good"] },
  {
    id: "P20",
    habits: ["immobile", "sitting", "standing"],
    current: ["stiff", "small_comfort"],
  },
];
export const warmups = {
  running: ["W06", "W03", "W07", "W01", "W11"],
  football: ["W03", "W01", "W09", "W10", "W11"],
  hiking: ["W06", "W05", "W07", "W03", "W02"],
  gym: ["W04", "W02", "W05", "W01", "W03"],
  golf: ["W04", "W02", "W07", "W03", "W05"],
  tennis: ["W04", "W10", "W09", "W07", "W02"],
  swimming: ["W14", "W13", "W15", "W16", "W17"],
  cycling: ["W03", "W07", "W05", "W01", "W04"],
};
export const leisureTemplates = [
  ["Y05", "Y02", "Y03", "Y04"],
  ["Y02", "Y06", "Y07", "Y08"],
  ["Y10", "D13", "D12", "Y09"],
  ["Y02", "Y06", "Y12", "Y08"],
];
export const warmupAdjustments = [
  {
    id: "neck-screen",
    areas: ["neck"],
    pattern: "P04",
    current: ["neck_fatigue", "arm_raise_comfort"],
    candidates: ["W17"],
  },
  {
    id: "neck-back",
    areas: ["neck", "back"],
    pattern: "P05",
    current: ["torso_limited", "rotation_comfort"],
    candidates: ["W02"],
  },
  {
    id: "shoulder-front-work",
    areas: ["shoulder"],
    pattern: "P01",
    current: ["chest_stiff", "arm_raise_comfort"],
    candidates: ["W17"],
  },
  {
    id: "back-front-work",
    areas: ["back"],
    pattern: "P01",
    current: ["chest_stiff", "arm_raise_comfort"],
    candidates: ["W17"],
  },
  {
    id: "lower-sitting",
    areas: ["lower"],
    pattern: "P09",
    current: ["hip_front", "hip_extend_comfort"],
    candidates: ["W01", "W03"],
  },
  {
    id: "lower-posterior-hip",
    areas: ["lower"],
    pattern: "P10",
    current: ["hip_back", "knee_hug_comfort"],
    candidates: ["W07"],
  },
  {
    id: "thigh-stairs",
    areas: ["thigh"],
    pattern: "P09",
    current: ["hip_front", "hip_extend_comfort"],
    candidates: ["W01"],
  },
  {
    id: "hamstring-limited",
    areas: ["hamstring"],
    pattern: "P11",
    current: ["hamstring_local", "hamstring_comfort"],
    candidates: ["W16", "W08"],
  },
  {
    id: "knee-neighbor-clue",
    areas: ["knee"],
    pattern: "P14",
    current: ["inner_thigh", "abduct_comfort"],
    candidates: ["W09", "W13"],
  },
  {
    id: "calf-repetition",
    areas: ["calf"],
    pattern: "P15",
    current: ["calf_limited", "calf_straight_comfort"],
    candidates: [],
  },
  {
    id: "ankle-limited",
    areas: ["ankle"],
    pattern: "P15",
    current: ["calf_limited", "calf_bent_comfort"],
    candidates: [],
  },
  {
    id: "head-with-neck",
    areas: ["head"],
    pattern: "P04",
    current: ["neck_fatigue", "arm_raise_comfort"],
    candidates: ["W17"],
  },
] as const;
const regionNames: Record<string, string> = {
  head: "머리",
  neck: "목",
  shoulder: "어깨",
  back: "등",
  lower: "허리",
  thigh: "허벅지",
  hamstring: "햄스트링",
  knee: "무릎",
  calf: "종아리",
  ankle: "발목",
};
const has = (input: SessionInput, id: string) => input.current.includes(id);
function matchesRegion(item: Content, area: string) {
  return item.linkedRegions.some((x) => x.includes(regionNames[area]));
}
export function normalizeInput(input: SessionInput): SessionInput {
  validateQuestionInput(input);
  if (input.purpose === "daily" && !input.area)
    throw new Error("불편 부위를 선택해주세요.");
  if (
    input.purpose === "warmup" &&
    (!input.sport || (input.sport === "gym" && !input.gymFocus))
  )
    throw new Error("운동 종류와 필요한 세부 구분을 선택해주세요.");
  if (input.purpose === "leisure" && !input.minutes)
    throw new Error("사용할 시간을 선택해주세요.");
  if (Math.abs(Date.now() - input.confirmedAt) > 86400000)
    throw new Error("오늘의 상태를 다시 확인해주세요.");
  return {
    ...input,
    habits: [...input.habits].sort(),
    current: [...input.current].sort(),
    poses: [...input.poses].sort(),
    supports: [...input.supports].sort(),
    focus: [...input.focus].sort(),
  };
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
  if (["sudden_worse", "radiating", "dizzy"].some((x) => has(input, x)))
    return {
      ...result,
      reason: "blocked",
      appliedRules: ["automatic-recommendation-exclusion"],
    };
  const patterns = patternRules.filter(
    (r) =>
      r.habits.some((x) => input.habits.includes(x)) &&
      r.current.every((x) => has(input, x)) &&
      (!r.anyCurrent || r.anyCurrent.some((x) => has(input, x))),
  );
  result.patterns = patterns.map((x) => x.id);
  result.appliedRules = patterns.map((x) => `pattern:${x.id}`);
  if (input.purpose === "warmup" && has(input, "prep_comfort"))
    result.patterns.push("P21");
  const base =
    input.purpose === "warmup" && input.sport
      ? warmups[input.sport]
          .filter(
            (id) =>
              input.sport !== "gym" ||
              input.gymFocus !== "upper" ||
              !["W05", "W01"].includes(id),
          )
          .filter(
            (id) =>
              input.sport !== "gym" ||
              input.gymFocus !== "lower" ||
              !["W04"].includes(id),
          )
      : [];
  const adjustmentRules = warmupAdjustments.filter(
    (rule) =>
      rule.areas.some((area) => input.focus.includes(area)) &&
      result.patterns.includes(rule.pattern) &&
      rule.current.every((id) => has(input, id)),
  );
  const usedFamilies = visited.map(
    (id) => catalog.find((x) => x.catalogId === id)?.family,
  );
  const candidates: Content[] = [];
  for (const item of catalog) {
    let reason = "";
    let evidenceIds: string[] = [];
    if (
      !input.review &&
      !approvedConnectionIds.includes(`${input.purpose}:${item.catalogId}`)
    )
      reason = "connection-approval-pending";
    else if (!input.review && item.approval[input.purpose] !== "existing")
      reason = "purpose-approval-pending";
    else if (item.pose === "unconfirmed") reason = "support-unconfirmed";
    else if (!input.poses.includes(item.pose)) reason = "posture-unavailable";
    else if (item.supports.some((x) => !input.supports.includes(x)))
      reason = "support-unavailable";
    else if (input.purpose === "leisure" && item.supports.includes("towel"))
      reason = "equipment-not-bodyweight";
    else if (
      visited.includes(item.catalogId) ||
      usedFamilies.includes(item.family)
    )
      reason = "already-performed-family";
    else {
      const bad = memory.constraints.filter(
        (x) =>
          x.catalogId === item.catalogId ||
          catalog.find((c) => c.catalogId === x.catalogId)?.family ===
            item.family ||
          x.directions.some((d) => item.directions.includes(d)),
      );
      if (bad.length) {
        reason = "adverse-history";
        evidenceIds = bad.flatMap((x) => x.evidenceIds);
      }
    }
    if (
      !reason &&
      has(input, "ext_bad_flex_good") &&
      item.directions.includes("spine_extension")
    )
      reason = "current-extension-discomfort";
    if (
      !reason &&
      has(input, "flex_bad_ext_good") &&
      item.directions.some((d) => ["spine_flexion", "hip_hinge"].includes(d))
    )
      reason = "current-flexion-discomfort";
    if (
      !reason &&
      has(input, "fatigue") &&
      ["activation", "preparation"].includes(item.role)
    )
      reason = "fatigue-no-extra-load";
    if (!reason) {
      const matched = item.patternIds.some(
        (p) => result.patterns.includes(p) && p !== "P21",
      );
      const isBase = base.includes(item.catalogId);
      if (
        input.purpose === "daily" &&
        (item.catalogId.startsWith("W") || item.catalogId.startsWith("Y"))
      )
        reason = "purpose-not-daily";
      else if (input.purpose === "warmup" && !item.catalogId.startsWith("W"))
        reason = "not-dynamic-preparation";
      else if (
        input.purpose === "warmup" &&
        !isBase &&
        !adjustmentRules.some((rule) =>
          (rule.candidates as readonly string[]).includes(item.catalogId),
        )
      )
        reason = "adjustment-conditions-missing";
      else if (input.purpose === "leisure" && item.catalogId.startsWith("W"))
        reason = "not-leisure-role";
      else if (
        input.purpose === "daily" &&
        input.area &&
        !matchesRegion(item, input.area)
      )
        reason = "region-not-linked";
      else if (
        input.purpose === "leisure" &&
        input.focus.length &&
        !input.focus.some((a) => matchesRegion(item, a))
      )
        reason = "focus-not-linked";
      else if (!matched && !isBase) reason = "required-pattern-missing";
      else if (item.comfort.some((x) => !has(input, x)))
        reason = "specific-comfort-not-confirmed";
      else if (item.catalogId === "Y11" && !has(input, "flex_bad_ext_good"))
        reason = "extension-experience-required";
      else if (
        item.catalogId === "W08" &&
        !input.supports.includes("experienced")
      )
        reason = "experience-required";
    }
    if (reason)
      result.excluded.push({
        id: item.catalogId,
        reason,
        ...(evidenceIds.length
          ? { evidenceIds: [...new Set(evidenceIds)] }
          : {}),
      });
    else candidates.push(item);
  }
  const historyRank = (item: Content) => {
    const sameContext = memory.experiences.filter(
      (e) =>
        e.performed &&
        e.catalogId === item.catalogId &&
        e.purpose === input.purpose &&
        e.area === (input.area ?? null) &&
        e.patterns.some((p) => result.patterns.includes(p)),
    );
    const recent = sameContext.filter(
      (e) => e.at >= Date.now() - 30 * 86400000,
    );
    return [
      recent.filter((e) => e.reaction === "same").length >= 2 ? 1 : 0,
      recent.some((e) => e.reaction === "better") ? -1 : 0,
    ];
  };
  candidates.sort((a, b) => {
    const ar = historyRank(a),
      br = historyRank(b);
    return (
      ar[0] - br[0] || ar[1] - br[1] || catalog.indexOf(a) - catalog.indexOf(b)
    );
  });
  let ordered = candidates;
  if (input.purpose === "warmup") {
    const chosen = base
      .map((id) => candidates.find((x) => x.catalogId === id))
      .filter((x): x is Content => !!x);
    // A standing swimming composition has not been reviewed; do not invent one.
    const adjustments = candidates
      .filter(
        (x) =>
          !chosen.includes(x) &&
          adjustmentRules.some((rule) =>
            (rule.candidates as readonly string[]).includes(x.catalogId),
          ),
      )
      .slice(0, 2);
    result.appliedRules.push(
      ...adjustmentRules.map((r) => `adjustment:${r.id}`),
    );
    ordered = [...chosen, ...adjustments];
  }
  if (input.purpose === "leisure") {
    const template = leisureTemplates.flat();
    const previous = (memory.bundles ?? [])
      .filter(
        (b) =>
          b.purpose === "leisure" &&
          b.reaction === "refreshed" &&
          b.minutes === input.minutes &&
          JSON.stringify([...b.focus].sort()) === JSON.stringify(input.focus) &&
          b.patterns.some((p) => result.patterns.includes(p)),
      )
      .sort((a, b) => b.at - a.at)[0];
    if (previous)
      result.appliedRules.push(`positive-bundle:${previous.sessionId}`);
    ordered = [...candidates].sort((a, b) => {
      const pa = input.poses.indexOf(a.pose as never),
        pb = input.poses.indexOf(b.pose as never);
      const preferred = (id: string) =>
        previous?.catalogIds.includes(id)
          ? previous.catalogIds.indexOf(id)
          : -1;
      const ar = preferred(a.catalogId),
        br = preferred(b.catalogId);
      return (
        pa - pb ||
        (ar < 0 ? 100 : ar) - (br < 0 ? 100 : br) ||
        ((template.indexOf(a.catalogId) + 100) % 100) -
          ((template.indexOf(b.catalogId) + 100) % 100) ||
        candidates.indexOf(a) - candidates.indexOf(b)
      );
    });
  }
  const families = new Set<string>();
  for (const item of ordered) {
    if (families.has(item.family)) continue;
    result.selected.push(item.catalogId);
    families.add(item.family);
    if (
      result.selected.length >=
      (input.purpose === "daily"
        ? 1
        : input.purpose === "leisure"
          ? input.minutes === 5
            ? 4
            : 8
          : 7)
    )
      break;
  }
  result.reason = result.selected.length
    ? "ready"
    : input.review
      ? "no-match"
      : candidates.length
        ? "no-match"
        : "not-approved";
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
