import {
  allowedPositions,
  areas,
  getRoutine,
  habits,
  habitIdsByArea,
  recentActions,
  recentActionIdsByArea,
  allowedRoutineNumbers,
  routines,
  type MovementMode,
  type AreaCode,
  type Routine,
} from "../../app/jikkot-data.js";
import {
  decisionTrees,
  matchCondition,
  type TreeName,
  type DecisionRule,
  type MatchedSignals,
} from "./decision-trees.js";
export const CONTENT_VERSION = "jikkot11-v2-fiveareas";
export const postureLabels: Record<MovementMode, string> = {
  seated: "앉아서만 할 수 있음",
  standing: "서서 할 수 있음",
  lying: "누워서 할 수 있음",
};
export const featureFlags = { stretching: false, shopping: false } as const;
export type Answers = {
  mode: MovementMode;
  area: AreaCode;
  habits: string[];
  recent: string[];
};
export type Feedback = "better" | "same" | "worse";
export const feedbackLabels: Record<Feedback, string> = {
  better: "편해졌어요",
  same: "비슷해요",
  worse: "더 불편해요",
};
// Keep the backend function signature compatible; approved questions/branches cannot be overridden.
export type ContentExtensions = {
  alternatives?: {
    pattern: string;
    currentRoutineId: string;
    feedback: "same" | "worse";
    changeIds: readonly string[];
    nextRoutineId: string;
  }[];
  changes?: Record<
    string,
    { id: string; label: string; nextRoutineId?: string }[]
  >;
};
// Process choices quote the approved instructions; they are not alternative mappings.
export const extensions: ContentExtensions = {
  changes: Object.fromEntries(
    routines.map((routine) => [
      routine.id,
      [
        ...routine.steps.map((label, index) => ({
          id: `step-${index + 1}`,
          label,
        })),
        { id: "unknown", label: "잘 모르겠어요" },
      ],
    ]),
  ),
};
export const habitQuestions = (area: AreaCode) =>
  habitIdsByArea[area].map(
    (id) => habits.find((question) => question.id === id)!,
  );
export function recentQuestions(
  area: AreaCode,
  _selected: string[],
  _content?: ContentExtensions,
) {
  void _selected;
  void _content;
  return recentActionIdsByArea[area].map(
    (id) => recentActions.find((question) => question.id === id)!,
  );
}
export function isAllowed(routine: Routine, mode: MovementMode) {
  return routine.positions.some((position) =>
    allowedPositions[mode]?.includes(position),
  );
}
export function normalizeSelection(
  ids: unknown,
  allowed: readonly string[],
  special: readonly string[],
  empty: string,
): string[] {
  if (
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== "string" || !allowed.includes(id))
  )
    throw new Error("선택 항목을 확인해주세요.");
  const selected = new Set<string>(ids);
  if (!selected.size) selected.add(empty);
  if (special.some((id) => selected.has(id)) && selected.size > 1)
    throw new Error("잘 모름·해당 없음은 다른 항목과 함께 선택할 수 없습니다.");
  return allowed.filter((id) => selected.has(id));
}
export function toggleExclusive(
  ids: string[],
  id: string,
  special: readonly string[],
): string[] {
  if (ids.includes(id)) return ids.filter((selected) => selected !== id);
  return special.includes(id)
    ? [id]
    : [...ids.filter((selected) => !special.includes(selected)), id];
}
export function validateAnswers(
  value: unknown,
  _content?: ContentExtensions,
): Answers {
  void _content;
  if (!value || typeof value !== "object")
    throw new Error("문진 답변을 확인해주세요.");
  const a = value as Partial<Answers>;
  const mode = a.mode ?? "seated";
  if (
    !Object.hasOwn(postureLabels, mode) ||
    !areas.some((area) => area.id === a.area)
  )
    throw new Error("불편한 부위를 선택해주세요.");
  const area = a.area!;
  return {
    mode,
    area,
    habits: normalizeSelection(
      a.habits,
      habitIdsByArea[area],
      ["H_UNKNOWN"],
      "H_UNKNOWN",
    ),
    recent: normalizeSelection(
      a.recent,
      recentActionIdsByArea[area],
      ["R_NONE", "R_UNKNOWN"],
      "R_UNKNOWN",
    ),
  };
}
const connectionText: Record<number, string> = {
  1: "엉덩이와 골반 주변을 가볍게 움직이는 동작으로 허리 아래쪽의 뻣뻣함을 풀어보세요.",
  2: "날개뼈 사이를 벌리고 등 위쪽을 부드럽게 늘리는 동작을 추천해요.",
  3: "어깨를 편하게 두고 목과 날개뼈 위쪽을 대각선으로 늘리는 동작을 추천해요.",
  4: "한쪽 가슴과 어깨 앞쪽을 여는 동작으로 움직임을 바꿔보세요.",
  5: "책상에 손을 두고 겨드랑이와 등 주변을 길게 늘리는 동작을 추천해요.",
  6: "팔꿈치를 몸에 붙이고 어깨를 바깥으로 가볍게 움직여보세요.",
  7: "앉아서 가슴을 열고 어깨와 등 주변을 편하게 움직여보세요.",
  8: "앉아서 손깍지 낀 팔을 뒤로 뻗으며 가슴과 어깨 주변을 열어보세요.",
  9: "목 옆을 가볍게 문지르며 긴장감을 풀어보세요.",
  10: "관자놀이에 손끝을 가볍게 대고 턱을 천천히 움직여보세요.",
  11: "쇄골 아래 가슴 윗부분을 어깨 방향으로 부드럽게 쓸어보세요.",
};
export function recommendationReason(
  area: AreaCode,
  routine: Routine,
  matched: MatchedSignals = { habits: [], recent: [] },
) {
  const habitPhrases: Record<string, string> = {
    H_SIDE_SCREEN: "옆 화면을 보려고 고개를 돌리는 습관",
    H_SHRUG: "어깨에 힘이 들어가거나 올라가는 습관",
    H_ELBOW: "한쪽 팔꿈치로 기대는 습관",
    H_BOTH_FRONT: "양팔을 앞에 두고 작업하는 습관",
    H_ONE_FORWARD: "한쪽 팔을 앞으로 뻗어 작업하는 습관",
    H_PINCH: "날개뼈를 모으고 힘을 주는 습관",
    H_OVERHEAD: "팔을 높이 들거나 멀리 뻗는 습관",
    H_CARRY: "가방이나 물건을 오래 드는 습관",
    H_CHEST_PUSH: "가슴 운동이나 물건을 미는 습관",
    H_ARMS_CLOSE: "물건을 몸 앞에 모아 사용하는 습관",
    H_CLENCH: "이를 악무는 습관",
    H_GRIND: "자는 동안 이를 갈거나 악무는 습관",
    H_CHEW: "질긴 음식을 오래 씹는 습관",
  };
  const recentPhrases: Record<string, string> = {
    R_HEAD_TURN: "고개를 한쪽으로 오래 둔 행동",
    R_OVERHEAD: "팔을 위로·멀리 뻗은 행동",
    R_HOLD_LOAD: "물건을 들거나 팔을 든 채 오래 버틴 행동",
    R_ONE_HAND: "한쪽 손으로 마우스나 도구를 오래 사용한 행동",
    R_COMPUTER_BOTH: "양팔을 앞에 두고 오래 작업한 행동",
    R_DRIVE: "오래 운전한 행동",
    R_PHONE: "휴대폰이나 작은 손작업을 오래 한 행동",
    R_PUSH_CHEST: "물건을 밀거나 가슴 운동을 한 행동",
    R_CLENCH: "이를 악문 행동",
    R_CHEW: "껌이나 질긴 음식을 오래 씹은 행동",
    R_SHRUG: "어깨에 힘을 준 채 일한 행동",
    R_BAG_CARRY: "한쪽 어깨로 가방을 오래 멘 행동",
  };
  const phrases = [
    ...matched.habits.map((id) => habitPhrases[id]),
    ...matched.recent.map((id) => recentPhrases[id]),
  ]
    .filter(Boolean)
    .slice(0, 2);
  const areaName = areas.find((item) => item.id === area)!.label;
  const objectParticle =
    (areaName.charCodeAt(areaName.length - 1) - 0xac00) % 28 === 0
      ? "를"
      : "을";
  const intro = phrases.length
    ? `${phrases.join("과 ")}을 선택했어요.`
    : `선택한 ${areaName}${objectParticle} 편하게 움직일 수 있는 동작을 준비했어요.`;
  return `${intro} ${connectionText[routine.displayNumber]}`;
}
function treeFor(area: AreaCode): TreeName {
  return areas.find((item) => item.id === area)!.tree;
}
export function makeRecommendation(input: Answers) {
  const answers = validateAnswers(input);
  const signals = {
    habits: new Set(answers.habits),
    recent: new Set(answers.recent),
  };
  let chosen: DecisionRule | undefined,
    matched: MatchedSignals | null = null;
  for (const rule of decisionTrees[treeFor(answers.area)]) {
    matched = matchCondition(rule.condition, signals);
    if (matched) {
      chosen = rule;
      break;
    }
  }
  if (!chosen || !matched) throw new Error("추천 분기를 찾을 수 없습니다.");
  const routine = routines.find(
    (item) => item.displayNumber === chosen.routineNumber,
  )!;
  if (!allowedRoutineNumbers[answers.area].includes(chosen.routineNumber))
    throw new Error("부위에 맞지 않는 추천입니다.");
  const reason = recommendationReason(answers.area, routine, matched);
  return {
    routine,
    routineId: routine.id,
    ruleId: chosen.id,
    pattern: chosen.id,
    matchedHabitIds: matched.habits,
    matchedRecentActionIds: matched.recent,
    reasonText: reason,
    reason,
    contentVersion: CONTENT_VERSION,
  };
}
export function recommendRoutine(input: {
  bodyAreaId: AreaCode;
  habitIds: Iterable<string>;
  recentActionIds: Iterable<string>;
}) {
  return makeRecommendation({
    mode: "seated",
    area: input.bodyAreaId,
    habits: [...input.habitIds],
    recent: [...input.recentActionIds],
  });
}
export function nextRecommendation(
  input: Answers,
  current: string,
  _pattern: string,
  feedback: Feedback,
  _changes: string[],
  _content?: ContentExtensions,
  visited: readonly string[] = [current],
) {
  if (feedback === "better") return null;
  const answers = validateAnswers(input);
  if (!getRoutine(current)) return null;
  const excluded = new Set([current, ...visited]);
  for (const mapping of (_content ?? extensions).alternatives ?? []) {
    if (
      mapping.pattern !== _pattern ||
      mapping.currentRoutineId !== current ||
      mapping.feedback !== feedback
    )
      continue;
    if (
      new Set(_changes).size !== _changes.length ||
      mapping.changeIds.length !== _changes.length ||
      mapping.changeIds.some((id) => !_changes.includes(id))
    )
      continue;
    const routine = getRoutine(mapping.nextRoutineId);
    if (
      routine &&
      !excluded.has(routine.id) &&
      allowedRoutineNumbers[answers.area].includes(routine.displayNumber) &&
      isAllowed(routine, answers.mode)
    )
      return routine;
  }
  // No approved pattern/process mapping has been supplied. A broad area candidate
  // is not an approved substitute; finish rather than guessing another movement.
  return null;
}
export function snapshot(
  a: Answers,
  routine: Routine,
  pattern: string,
  _content?: ContentExtensions,
) {
  void _content;
  const selected = makeRecommendation(a);
  const primary =
    selected.ruleId === pattern && selected.routine.id === routine.id;
  return {
    contentVersion: CONTENT_VERSION,
    answers: a,
    posture: postureLabels[a.mode],
    area: {
      id: a.area,
      label: areas.find((area) => area.id === a.area)!.label,
    },
    habits: habitQuestions(a.area)
      .filter((question) => a.habits.includes(question.id))
      .map(({ id, label }) => ({ id, label })),
    recent: recentQuestions(a.area, a.habits)
      .filter((question) => a.recent.includes(question.id))
      .map(({ id, label }) => ({ id, label })),
    pattern,
    ruleId: pattern,
    matchedHabitIds: primary ? selected.matchedHabitIds : [],
    matchedRecentActionIds: primary ? selected.matchedRecentActionIds : [],
    routine: {
      id: routine.id,
      displayNumber: routine.displayNumber,
      name: routine.name,
      image: routine.image,
      steps: [...routine.steps],
      cue: routine.cue,
      dose: routine.dose,
      comfort: routine.comfort,
    },
  };
}
export const catalog = (mode: MovementMode) =>
  routines.filter((routine) => isAllowed(routine, mode));
export function kstDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
