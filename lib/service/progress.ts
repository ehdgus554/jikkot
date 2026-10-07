import {
  CONTENT_VERSION,
  validateAnswers,
  postureLabels,
  habitQuestions,
  recentQuestions,
  type Answers,
  type Feedback,
} from "./recommendation";
import { areas, getRoutine } from "../../app/jikkot-data";
export const PROGRESS_KEY = "jikkot.progress.v1";
export const SCHEMA_VERSION = 1;
export type Owner = { kind: "guest" | "member"; id: string };
export const screens = [
  "home",
  "posture",
  "area",
  "habits",
  "recent",
  "analysis",
  "routine",
  "feedback",
  "complete",
  "changes",
  "no-next",
  "records",
  "catalog",
  "browse",
] as const;
export type Screen = (typeof screens)[number];
export type Progress = {
  schemaVersion: 1;
  owner: Owner;
  screen: Screen;
  answers: Partial<Answers>;
  recommendationId?: string;
  routineId?: string;
  feedback?: Feedback;
  submissionId?: string;
  submitState: "idle" | "pending" | "saved";
  changes: string[];
  contentVersion: string;
  updatedAt: number;
  guestConsent: boolean;
  returnScreen?: Screen;
};
export function fresh(owner: Owner, guestConsent = false): Progress {
  return {
    schemaVersion: 1,
    owner,
    screen: "home",
    answers: {},
    changes: [],
    submitState: "idle",
    contentVersion: CONTENT_VERSION,
    updatedAt: Date.now(),
    guestConsent,
  };
}
export function restore(
  raw: string | null,
  owner: Owner,
  now = Date.now(),
): Progress | null {
  try {
    const p = JSON.parse(raw ?? "null");
    if (
      !p ||
      p.schemaVersion !== SCHEMA_VERSION ||
      p.contentVersion !== CONTENT_VERSION ||
      p.owner?.id !== owner.id ||
      p.owner?.kind !== owner.kind ||
      !screens.includes(p.screen) ||
      !Number.isFinite(p.updatedAt) ||
      now - p.updatedAt > 30 * 86400000 ||
      p.updatedAt > now + 60000 ||
      !p.answers ||
      !Array.isArray(p.changes) ||
      !["idle", "pending", "saved"].includes(p.submitState)
    )
      return null;
    if (
      owner.kind === "guest" &&
      (!p.guestConsent ||
        ["records", "catalog", "browse", "changes"].includes(p.screen))
    )
      return null;
    const a = p.answers;
    if (a.mode !== undefined && !Object.hasOwn(postureLabels, a.mode))
      return null;
    if (a.area !== undefined && !areas.some((q) => q.id === a.area))
      return null;
    for (const [ids, options] of [
      [a.habits, a.area ? habitQuestions(a.area) : []],
      [a.recent, a.area ? recentQuestions(a.area, a.habits ?? []) : []],
    ] as const) {
      if (
        ids !== undefined &&
        (!Array.isArray(ids) ||
          ids.some((id) => !options.some((q) => q.id === id)) ||
          new Set(ids).size !== ids.length)
      )
        return null;
    }
    if (["area", "habits", "recent"].includes(p.screen) && !a.mode) return null;
    if (["habits", "recent"].includes(p.screen) && !a.area) return null;
    if (p.screen === "recent" && !a.habits?.length) return null;
    for (const value of [p.recommendationId, p.submissionId])
      if (
        value !== undefined &&
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          value,
        )
      )
        return null;
    if (p.routineId !== undefined && !getRoutine(p.routineId)) return null;
    if (
      p.feedback !== undefined &&
      !["better", "same", "worse"].includes(p.feedback)
    )
      return null;
    if (p.returnScreen !== undefined && !screens.includes(p.returnScreen))
      return null;
    if (["catalog", "browse"].includes(p.screen)) validateAnswers(a);
    if (
      [
        "analysis",
        "routine",
        "feedback",
        "complete",
        "changes",
        "no-next",
      ].includes(p.screen)
    ) {
      validateAnswers(p.answers);
      if (!p.recommendationId) return null;
    }
    // Persist only explicit fields. Credentials and auth form contents never enter progress.
    return {
      schemaVersion: 1,
      owner,
      screen: p.screen,
      answers: {
        mode: a.mode,
        area: a.area,
        habits: a.habits,
        recent: a.recent,
      },
      recommendationId: p.recommendationId,
      routineId: p.routineId,
      feedback: p.feedback,
      submissionId: p.submissionId,
      submitState: p.submitState,
      changes: p.changes,
      contentVersion: CONTENT_VERSION,
      updatedAt: p.updatedAt,
      guestConsent: p.guestConsent,
      returnScreen: p.returnScreen,
    };
  } catch {
    return null;
  }
}
