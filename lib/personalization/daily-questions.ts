import type { Area, SessionInput } from "./types";
export const DAILY_FLOW = "daily-four-2026-10-19";
const definitions: Record<
  Area,
  { habits: [string, string][]; recent: [string, string, string][] }
> = {
  head: {
    habits: [
      ["screen", "화면을 오래 봐요"],
      ["clench", "집중할 때 이를 악물어요"],
      ["chew", "자주 오래 씹어요"],
    ],
    recent: [
      ["screen", "화면을 오래 봤어요", "screen"],
      ["clench", "집중하면서 이를 꽉 물었어요", "clench"],
      ["chew", "딱딱한 음식을 오래 씹었어요", "chew"],
    ],
  },
  neck: {
    habits: [
      ["screen", "화면을 가까이 봐요"],
      ["shrug", "어깨에 힘을 주고 있어요"],
      ["one_direction", "한 방향을 오래 봐요"],
    ],
    recent: [
      ["look_down", "고개를 숙이고 오래 있었어요", "screen"],
      ["one_direction", "한 방향을 오래 봤어요", "one_direction"],
      ["look_up", "고개를 들고 작업했어요", "shrug"],
    ],
  },
  shoulder: {
    habits: [
      ["arm_front", "팔을 앞으로 두고 일해요"],
      ["shrug", "어깨에 힘이 들어가요"],
      ["arms_up", "팔을 자주 들어요"],
    ],
    recent: [
      ["lifting", "무거운 것을 들었어요", "shrug"],
      ["arms_up", "팔을 들고 작업했어요", "arms_up"],
      ["computer", "컴퓨터 작업을 오래 했어요", "arm_front"],
    ],
  },
  back: {
    habits: [
      ["arm_front", "팔을 앞으로 두고 일해요"],
      ["retract", "날개뼈를 뒤로 모으고 버텨요"],
      ["one_side", "한쪽으로 기대요"],
    ],
    recent: [
      ["lifting", "물건을 들거나 옮겼어요", "arm_front"],
      ["immobile", "한 자세로 오래 일했어요", "retract"],
      ["turning", "상체를 자주 돌렸어요", "one_side"],
    ],
  },
  lower: {
    habits: [
      ["sitting", "오래 앉아 있어요"],
      ["cross_legs", "다리를 꼬아요"],
      ["one_side", "한쪽으로 기대요"],
      ["bending", "자주 숙여요"],
    ],
    recent: [
      ["sitting", "오래 앉아 있었어요", "sitting"],
      ["lifting", "무거운 것을 들었어요", "one_side"],
      ["bending", "몸을 숙이고 일했어요", "bending"],
    ],
  },
  thigh: {
    habits: [
      ["sitting", "오래 앉아 있어요"],
      ["standing", "오래 서 있어요"],
      ["stairs", "계단을 자주 이용해요"],
    ],
    recent: [
      ["stairs", "계단·오르막을 많이 걸었어요", "stairs"],
      ["walking", "걷거나 달렸어요", "standing"],
      ["sitting", "오래 앉아 있었어요", "sitting"],
    ],
  },
  hamstring: {
    habits: [
      ["sitting", "오래 앉아 있어요"],
      ["bending", "몸을 자주 숙여요"],
      ["walking", "걷거나 달리는 일이 많아요"],
    ],
    recent: [
      ["walking", "걷거나 달렸어요", "walking"],
      ["bending", "숙인 자세로 일했어요", "bending"],
      ["sitting", "오래 앉아 있었어요", "sitting"],
    ],
  },
  knee: {
    habits: [
      ["sitting", "오래 앉아 있어요"],
      ["stairs", "계단을 자주 이용해요"],
      ["walking", "걷거나 서 있는 시간이 많아요"],
    ],
    recent: [
      ["stairs", "계단을 많이 이용했어요", "stairs"],
      ["walking", "많이 걷거나 달렸어요", "walking"],
      ["sit_stand", "앉았다 일어나는 일이 많았어요", "sitting"],
    ],
  },
  calf: {
    habits: [
      ["standing", "오래 서 있어요"],
      ["walking", "많이 걸어요"],
      ["immobile", "한 자세로 오래 있어요"],
    ],
    recent: [
      ["walking", "평소보다 많이 걸었어요", "walking"],
      ["exercise", "뛰거나 운동했어요", "immobile"],
      ["standing", "오래 서 있었어요", "standing"],
    ],
  },
  ankle: {
    habits: [
      ["walking", "많이 걸어요"],
      ["standing", "오래 서 있어요"],
      ["immobile", "한 자세로 오래 있어요"],
    ],
    recent: [
      ["walking", "많이 걷거나 달렸어요", "walking"],
      ["stairs", "계단·오르막을 이용했어요", "immobile"],
      ["standing", "오래 서 있었어요", "standing"],
    ],
  },
};
export function dailyQuestions(
  kind: "habits" | "current",
  area?: Area,
  habits: string[] = [],
) {
  const d = definitions[area ?? "neck"];
  const choices =
    kind === "habits"
      ? d.habits.map(([id, label]) => ({ id, label }))
      : d.recent
          .map(([id, label, habit], index) => ({
            id: "recent_" + id,
            label,
            priority: habits.includes(habit) ? 0 : 1,
            index,
          }))
          .sort((a, b) => a.priority - b.priority || a.index - b.index);
  return [...choices, { id: "unknown", label: "해당 없어요 / 잘 모르겠어요" }];
}
export function validateDaily(input: SessionInput) {
  if (
    !input.area ||
    input.poses.length !== 1 ||
    !["chair", "standing", "supine"].includes(input.poses[0])
  )
    throw Error("자세와 부위를 선택해주세요.");
  for (const kind of ["habits", "current"] as const) {
    if (
      input[kind].length !== 1 ||
      !dailyQuestions(kind, input.area, input.habits).some(
        (q) => q.id === input[kind][0],
      )
    )
      throw Error("가장 가까운 답변 한 개를 선택해주세요.");
  }
  if (input.supports.length || input.avoidDirections.length)
    throw Error("새 일상 입력에 이전 조건을 섞을 수 없어요.");
}
