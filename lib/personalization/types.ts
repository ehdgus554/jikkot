import { z } from "zod";

export const VERSION = "jikkot-personal-2026-10-16-v1";
export const areas = [
  ["head", "머리"],
  ["neck", "목"],
  ["shoulder", "어깨"],
  ["back", "등"],
  ["lower", "허리"],
  ["thigh", "허벅지"],
  ["hamstring", "햄스트링(허벅지 뒤쪽)"],
  ["knee", "무릎"],
  ["calf", "종아리"],
  ["ankle", "발목"],
] as const;
export const poses = [
  ["chair", "의자에 앉기"],
  ["floor", "바닥에 앉기"],
  ["standing", "서기"],
  ["supine", "바로 눕기"],
  ["side", "옆으로 눕기"],
  ["prone", "엎드리기"],
  ["quadruped", "네발 자세"],
  ["halfKneel", "한쪽 무릎 대기"],
  ["handFoot", "손발로 지지하기"],
] as const;
export const supports = [
  ["chair", "안정된 의자"],
  ["chairBack", "안정된 등받이"],
  ["desk", "책상"],
  ["wall", "벽"],
  ["towel", "수건"],
  ["wrist", "손목으로 바닥 지지 가능"],
  ["knee", "무릎으로 바닥 지지 가능"],
  ["balance", "한 발로 안정되게 서기 가능"],
  ["space", "다리를 펼치거나 옆으로 움직일 공간"],
  ["dryFloor", "마르고 미끄럽지 않은 바닥"],
  ["experienced", "손발 지지·한 발 지지 수행 경험"],
] as const;
export type Area = (typeof areas)[number][0];
export type Pose = (typeof poses)[number][0];
export type Support = (typeof supports)[number][0];
export type Purpose = "daily" | "warmup" | "leisure";
export const sports = [
  ["running", "러닝"],
  ["football", "축구"],
  ["hiking", "등산"],
  ["gym", "헬스"],
  ["golf", "골프"],
  ["tennis", "테니스"],
  ["swimming", "수영"],
  ["cycling", "자전거"],
] as const;
const unique = (xs: string[]) => new Set(xs).size === xs.length;
export const inputSchema = z
  .object({
    purpose: z.enum(["daily", "warmup", "leisure"]),
    area: z.enum(areas.map((x) => x[0]) as [Area, ...Area[]]).optional(),
    habits: z.array(z.string().max(64)).max(30).refine(unique).default([]),
    current: z.array(z.string().max(64)).max(45).refine(unique).default([]),
    poses: z
      .array(z.enum(poses.map((x) => x[0]) as [Pose, ...Pose[]]))
      .min(1)
      .max(9)
      .refine(unique),
    supports: z
      .array(z.enum(supports.map((x) => x[0]) as [Support, ...Support[]]))
      .max(11)
      .refine(unique),
    sport: z
      .enum(
        sports.map((x) => x[0]) as [
          (typeof sports)[number][0],
          ...(typeof sports)[number][0][],
        ],
      )
      .optional(),
    gymFocus: z.enum(["upper", "lower", "whole"]).optional(),
    minutes: z.union([z.literal(5), z.literal(10)]).optional(),
    focus: z
      .array(z.enum(areas.map((x) => x[0]) as [Area, ...Area[]]))
      .max(2)
      .refine(unique)
      .default([]),
    confirmedAt: z.number().int().min(0),
    review: z.boolean().default(false),
    growth: z.boolean().default(false),
  })
  .strict();
export type SessionInput = z.infer<typeof inputSchema>;
export type Reaction =
  | "better"
  | "same"
  | "worse"
  | "ready"
  | "insufficient"
  | "refreshed";
export type Experience = {
  sessionId: string;
  catalogId: string;
  at: number;
  purpose: Purpose;
  area: Area | null;
  patterns: string[];
  reaction: Reaction | null;
  directions: string[];
  performed: boolean;
  environmentSkip?: boolean;
};
export type Constraint = {
  catalogId: string;
  directions: string[];
  evidenceIds: string[];
};
export type Memory = {
  experiences: Experience[];
  constraints: Constraint[];
  revision: number;
  bundles?: {
    sessionId: string;
    catalogIds: string[];
    purpose: Purpose;
    reaction: Reaction;
    at: number;
    patterns: string[];
    focus: Area[];
    minutes: number | null;
  }[];
};
export const emptyMemory = (): Memory => ({
  experiences: [],
  constraints: [],
  revision: 0,
});
export type CustomerMovement = {
  id: string;
  catalogId: string;
  name: string;
  steps: string[];
  pose: Pose | "unconfirmed";
  media: {
    type: "image" | "video";
    src: string;
    width: number;
    height: number;
    version: string;
  };
  dose: string | null;
  doseStatus: "existing" | "unconfirmed";
  directions: string[];
};
export type Decision = {
  version: string;
  selected: string[];
  patterns: string[];
  excluded: { id: string; reason: string; evidenceIds?: string[] }[];
  appliedRules: string[];
  memoryRevision: number;
  reason: "ready" | "blocked" | "no-match" | "not-approved";
};
export type Session = {
  id: string;
  owner: string;
  kind: "member" | "guest";
  review: boolean;
  input: SessionInput;
  createdAt: number;
  updatedAt: number;
  status: "active" | "paused" | "completed" | "stopped";
  items: {
    itemId: string;
    movement: CustomerMovement;
    state: "pending" | "completed" | "skipped" | "stopped";
    reaction: Reaction | null;
    directions: string[];
    steps: number[];
    skipReason: string | null;
    performedAt?: number | null;
    feedbackAt?: number | null;
    stepsState?: "selected" | "unknown" | "unanswered";
  }[];
  feedback: Reaction | null;
  feedbackSubmitted: boolean;
  visited: string[];
  decision: Decision;
  completedAt: number | null;
  nextState?: "none" | "ready" | null;
  followup?: { value: string; at: number } | null;
  feedbackAt?: number | null;
};
