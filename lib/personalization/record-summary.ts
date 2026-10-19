import { areas, type Session } from "./types";
import { dailyQuestions } from "./daily-questions";
const day = (at: number) =>
  new Date(at + 9 * 3600000).toISOString().slice(0, 10);
type LegacyRecord = {
  id: string;
  createdAt: number;
  submissionId?: string;
  sessionId?: string;
  recommendationId?: string;
  feedback?: string;
  performed?: boolean;
  snapshot?: {
    routine?: { id?: string; name?: string };
    area?: { id?: string; label?: string };
  };
};
export function recordSummary(
  sessions: Session[],
  legacy: LegacyRecord[],
  now = Date.now(),
) {
  const midnight =
    Math.floor((now + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
  const from = midnight - 29 * 86400000;
  const performanceAt = (s: Session) => {
    const times = s.items
      .filter((i) => i.state === "completed")
      .map((i) => i.performedAt ?? 0);
    return Math.max(0, ...times) || s.completedAt || s.createdAt;
  };
  const valid = sessions.filter(
    (s) =>
      !s.review &&
      performanceAt(s) >= from &&
      performanceAt(s) <= now &&
      s.items.some((i) => i.state === "completed"),
  );
  const ids = new Set(sessions.flatMap((s) => [s.id, `legacy:${s.id}`]));
  const seen = new Set(ids);
  const old = legacy.filter((r) => {
    const key = r.sessionId ?? r.submissionId ?? r.recommendationId ?? r.id;
    const eligible =
      r.createdAt >= from &&
      r.createdAt <= now &&
      !seen.has(key) &&
      r.performed !== false &&
      !!r.feedback;
    if (eligible) seen.add(key);
    return eligible;
  });
  const rows = [
    ...valid.map((s) => ({
      id: s.id,
      at: performanceAt(s),
      area: s.input.purpose === "daily" ? s.input.area : undefined,
      routineId:
        s.program?.id ??
        s.items
          .filter((i) => i.state === "completed")
          .map((i) => i.movement.catalogId)
          .join("+"),
      name: s.program?.name ?? s.items[0].movement.name,
      reaction: s.feedbackSubmitted ? s.feedback : null,
      input: s.input,
    })),
    ...old.map((r) => ({
      id: r.id,
      at: r.createdAt,
      area: areas.find(
        ([id, label]) =>
          id === r.snapshot?.area?.id || label === r.snapshot?.area?.label,
      )?.[0],
      routineId: `legacy:${r.snapshot?.routine?.id ?? r.id}`,
      name: r.snapshot?.routine?.name ?? "이전 몸풀기",
      reaction: r.feedback ?? null,
      input: null,
    })),
  ];
  const period = (days: number) => {
    const xs = rows.filter(
      (r) => r.at >= midnight - (days - 1) * 86400000 && r.at <= now,
    );
    return {
      sessions: new Set(xs.map((r) => r.id)).size,
      days: new Set(xs.map((r) => day(r.at))).size,
    };
  };
  const regions = areas
    .map(([id, label]) => ({
      id,
      label,
      count: rows.filter((r) => r.area === id).length,
    }))
    .filter((r) => r.count)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const choices: {
    key: string;
    areaLabel: string;
    label: string;
    count: number;
  }[] = [];
  for (const [area, label] of areas)
    for (const kind of ["habits", "current"] as const) {
      const counts = new Map<string, number>();
      for (const s of valid.filter(
        (s) => s.input.purpose === "daily" && s.input.area === area,
      ))
        for (const id of s.input[kind]) {
          if (!id.startsWith("recent_") && kind === "current") continue;
          const q = dailyQuestions(kind, area, s.input.habits).find(
            (q) => q.id === id,
          );
          if (q && id !== "unknown")
            counts.set(q.label, (counts.get(q.label) ?? 0) + 1);
        }
      for (const [answer, count] of counts)
        choices.push({
          key: area + kind + answer,
          areaLabel: label,
          label: answer,
          count,
        });
    }
  const routines = [...new Set(rows.map((r) => r.routineId))]
    .map((id) => {
      const xs = rows.filter((r) => r.routineId === id);
      return {
        id,
        name: xs[0].name,
        count: xs.length,
        better: xs.filter((r) =>
          ["better", "refreshed"].includes(r.reaction ?? ""),
        ).length,
        same: xs.filter((r) => ["same"].includes(r.reaction ?? "")).length,
        ready: xs.filter((r) => r.reaction === "ready").length,
        insufficient: xs.filter((r) => r.reaction === "insufficient").length,
        worse: xs.filter((r) => r.reaction === "worse").length,
        unanswered: xs.filter((r) => !r.reaction).length,
      };
    })
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return {
    updatedAt: now,
    fromDate: day(from),
    toDate: day(now),
    sevenDays: period(7),
    thirtyDays: period(30),
    areas: regions,
    choices: choices.sort((a, b) => b.count - a.count).slice(0, 6),
    routines: routines.slice(0, 6),
  };
}
export type RecordSummary = ReturnType<typeof recordSummary>;
