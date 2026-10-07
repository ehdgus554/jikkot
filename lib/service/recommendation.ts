import {
  allowedPositions,
  areas,
  getRoutine,
  habits,
  habitIdsByArea,
  recentActions,
  recentActionIdsByArea,
  routes,
  routines,
  type MovementMode,
  type AreaCode,
  type Routine,
} from "../../app/jikkot-data.js";
export const CONTENT_VERSION = "mvp-9.1-adapter-v1";
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
  better: "편해졌다",
  same: "비슷하다",
  worse: "더 불편하다",
};
export type ContentExtensions = {
  recentQuestions?: { area: AreaCode; allHabits: string[]; ids: string[] }[];
  related?: Record<string, { area: AreaCode; routineId: string }[]>;
  changes?: Record<
    string,
    { id: string; label: string; nextRoutineId?: string }[]
  >;
};
// No unreviewed clinical connections in production. Tests inject explicit fixtures.
export const extensions: ContentExtensions = {};
export const habitQuestions = (area: AreaCode) =>
  habits.filter((q) => habitIdsByArea[area].includes(q.id) && q.id !== "HB99");
export function recentQuestions(
  area: AreaCode,
  selected: string[],
  content = extensions,
) {
  const conditional = content.recentQuestions?.find(
    (q) => q.area === area && q.allHabits.every((id) => selected.includes(id)),
  );
  return recentActions.filter(
    (q) =>
      (conditional?.ids ?? recentActionIdsByArea[area]).includes(q.id) &&
      q.id !== "RA99",
  );
}
export function isAllowed(routine: Routine, mode: MovementMode) {
  return routine.positions.some((p) => allowedPositions[mode].includes(p));
}
export function validateAnswers(value: unknown, content = extensions): Answers {
  if (!value || typeof value !== "object")
    throw new Error("문진 답변을 확인해주세요.");
  const a = value as Answers;
  if (
    !Object.hasOwn(postureLabels, a.mode) ||
    !areas.some((q) => q.id === a.area)
  )
    throw new Error("자세와 부위를 선택해주세요.");
  for (const [ids, options] of [
    [a.habits, habitQuestions(a.area)],
    [a.recent, recentQuestions(a.area, a.habits ?? [], content)],
  ] as const) {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > options.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !options.some((q) => q.id === id))
    )
      throw new Error("선택 항목을 확인해주세요.");
  }
  return {
    mode: a.mode,
    area: a.area,
    habits: [...a.habits],
    recent: [...a.recent],
  };
}
export function makeRecommendation(a: Answers) {
  const recentTags = recentActions
    .filter((q) => a.recent.includes(q.id))
    .map((q) => q.tag as string);
  const habitTags = habits
    .filter((q) => a.habits.includes(q.id))
    .map((q) => q.tag as string);
  const index = routes[a.area].findIndex((r) =>
    r.tags.some((t) => recentTags.includes(t)),
  );
  const routeIndex = index < 0 ? routes[a.area].length - 1 : index;
  const route = routes[a.area][routeIndex];
  const seen = new Set<string>();
  const candidates = [route.relax, route.move, route.control]
    .flatMap((ids) =>
      ids
        .map(getRoutine)
        .filter((r): r is Routine => Boolean(r))
        .filter((r) => isAllowed(r, a.mode))
        .map((routine, index) => ({
          routine,
          index,
          match: routine.clusters.some((t) => habitTags.includes(t)) ? 1 : 0,
        }))
        .sort((x, y) => y.match - x.match || x.index - y.index)
        .map(({ routine }) => routine),
    )
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  // Keep the original route and slot ordering; never add unrelated fallback moves.
  if (!candidates.length)
    throw new Error(
      `지원하지 않는 콘텐츠 조합: ${a.mode}/${a.area}/${routeIndex}`,
    );
  return {
    pattern: `${a.area}:${routeIndex}`,
    reason: route.reason,
    routine: candidates[0],
    candidateIds: candidates.map((r) => r.id),
    contentVersion: CONTENT_VERSION,
  };
}
export function nextRecommendation(
  a: Answers,
  current: string,
  pattern: string,
  feedback: Feedback,
  changes: string[],
  content = extensions,
) {
  if (feedback === "same") {
    return (
      content.related?.[pattern]
        ?.map((link) => ({ link, routine: getRoutine(link.routineId) }))
        .find(
          ({ link, routine }) =>
            link.area !== a.area &&
            routine?.areas.includes(link.area) &&
            routine.id !== current &&
            isAllowed(routine, a.mode),
        )?.routine ?? null
    );
  }
  if (feedback === "worse") {
    const questions = content.changes?.[current] ?? [];
    const id = questions.find(
      (q) => changes.includes(q.id) && q.nextRoutineId,
    )?.nextRoutineId;
    const routine = id ? getRoutine(id) : undefined;
    return routine && isAllowed(routine, a.mode) ? routine : null;
  }
  return null;
}
export function snapshot(
  a: Answers,
  routine: Routine,
  pattern: string,
  content = extensions,
) {
  return {
    contentVersion: CONTENT_VERSION,
    answers: a,
    posture: postureLabels[a.mode],
    area: { id: a.area, label: areas.find((q) => q.id === a.area)!.label },
    habits: habitQuestions(a.area)
      .filter((q) => a.habits.includes(q.id))
      .map((q) => ({ id: q.id, label: q.label })),
    recent: recentQuestions(a.area, a.habits, content)
      .filter((q) => a.recent.includes(q.id))
      .map((q) => ({ id: q.id, label: q.label })),
    pattern,
    routine: {
      id: routine.id,
      name: routine.name,
      image: routine.image,
      cue: routine.cue,
      dose: routine.dose,
      comfort: routine.comfort,
    },
  };
}
export const catalog = (mode: MovementMode) =>
  routines.filter((r) => isAllowed(r, mode));
export function kstDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
