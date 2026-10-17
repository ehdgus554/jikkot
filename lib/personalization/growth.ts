export const GROWTH_VERSION = "leisure-growth-v1";
export const levels = [
  [0, "첫걸음"],
  [100, "루틴 새싹"],
  [250, "주말 실천가"],
  [450, "나를 아는 관리 습관"],
  [700, "꾸준한 동행"],
  [1000, "직꼿 생활가"],
] as const;
export function kstWeek(time: number) {
  const local = new Date(time + 9 * 3600000);
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}
export type Growth = {
  xp: number;
  weeks: string[];
  feelings: string[];
  badges: string[];
};
export type WeeklyGrowth = {
  completion: boolean;
  feeling: boolean;
  xp: number;
  version: string;
};
export const newGrowth = (): Growth => ({
  xp: 0,
  weeks: [],
  feelings: [],
  badges: [],
});
export const newWeekly = (): WeeklyGrowth => ({
  completion: false,
  feeling: false,
  xp: 0,
  version: GROWTH_VERSION,
});
export function awardGrowth(
  state: Growth,
  week: WeeklyGrowth,
  sessionId: string,
  weekId: string,
  completed: boolean,
  feeling: boolean,
) {
  const next = structuredClone(state),
    weekly = structuredClone(week);
  let added = 0;
  if (completed && !weekly.completion) {
    weekly.completion = true;
    added += 50;
  }
  if (feeling && !weekly.feeling) {
    weekly.feeling = true;
    added += 10;
  }
  if (completed && !next.weeks.includes(weekId))
    next.weeks = [...next.weeks, weekId].slice(-3);
  if (feeling && !next.feelings.includes(sessionId))
    next.feelings = [...next.feelings, sessionId].slice(-5);
  next.xp += added;
  weekly.xp += added;
  if (completed && !next.badges.includes("first-completion"))
    next.badges.push("first-completion");
  if (next.weeks.length >= 3 && !next.badges.includes("three-weeks"))
    next.badges.push("three-weeks");
  if (next.feelings.length >= 5 && !next.badges.includes("five-feelings"))
    next.badges.push("five-feelings");
  return { state: next, weekly, added };
}
