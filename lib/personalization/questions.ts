import type { Area, SessionInput } from "./types";

export type Question = {
  id: string;
  label: string;
  areas: Area[];
  patterns: string[];
  requiresHabit?: string[];
  exclusive?: boolean;
  version: string;
};
const all: Area[] = [
  "head",
  "neck",
  "shoulder",
  "back",
  "lower",
  "thigh",
  "hamstring",
  "knee",
  "calf",
  "ankle",
];
const upper: Area[] = ["head", "neck", "shoulder", "back"];
const lower: Area[] = ["lower", "thigh", "hamstring", "knee", "calf", "ankle"];
const q = (
  id: string,
  label: string,
  regions: Area[],
  patterns: string[],
  requiresHabit?: string[],
): Question => ({
  id,
  label,
  areas: regions,
  patterns,
  ...(requiresHabit ? { requiresHabit } : {}),
  version: "questions-2026-10-16-v1",
});
export const habitChoices: Question[] = [
  q("arm_front", "양팔을 앞에 둔 채 오래 작업해요", upper, ["P01"]),
  q("shrug", "어깨에 힘이 들어가거나 올라가요", upper, ["P02"]),
  q("look_up", "고개를 들고 버티는 작업을 해요", upper, ["P02"]),
  q("retract", "날개뼈를 뒤로 모은 채 오래 버텨요", upper, ["P03"]),
  q("screen", "휴대폰·노트북 화면을 가까이 오래 봐요", upper, ["P04"]),
  q("one_direction", "옆 화면·운전 등 한 방향을 오래 봐요", upper, ["P05"]),
  q("clench", "집중할 때 이를 악물거나 자주 씹어요", ["head", "neck"], ["P06"]),
  q(
    "arms_up",
    "팔을 들거나 반복해서 사용하는 일이 많아요",
    ["shoulder", "back"],
    ["P07", "P08"],
  ),
  q("sitting", "오래 앉거나 운전하는 시간이 많아요", lower, [
    "P09",
    "P10",
    "P11",
  ]),
  q(
    "cross_legs",
    "다리를 꼬거나 한쪽으로 기대요",
    ["lower", "thigh"],
    ["P10", "P13"],
  ),
  q(
    "bending",
    "몸을 앞으로 숙이는 일을 반복해요",
    ["lower", "hamstring"],
    ["P11", "P18"],
  ),
  q("standing", "오래 서 있거나 자주 일어서요", lower, [
    "P12",
    "P15",
    "P16",
    "P19",
  ]),
  q(
    "one_side",
    "한 팔·한 발로 기대거나 한쪽으로 가방을 들어요",
    ["back", "lower", "thigh"],
    ["P13"],
  ),
  q(
    "legs_together",
    "다리를 모으고 앉거나 방향을 자주 바꿔요",
    ["lower", "thigh", "knee"],
    ["P14"],
  ),
  q("walking", "걷기·달리기 등 반복 활동을 자주 해요", lower, [
    "P15",
    "P16",
    "P17",
  ]),
  q("stairs", "계단이나 오르막을 자주 이용해요", ["thigh", "knee"], ["P09"]),
  q("increased_load", "최근 운동이나 반복 작업량이 늘었어요", all, ["P17"]),
  q("immobile", "한 자세에서 오래 움직이지 않아요", all, ["P20"]),
  { ...q("none", "해당하는 습관이 없어요", all, []), exclusive: true },
  { ...q("unknown", "평소 습관을 잘 모르겠어요", all, []), exclusive: true },
];
export const currentChoices: Question[] = [
  q("chest_stiff", "최근 며칠 가슴 앞이 뻣뻣하거나 말린 느낌이에요", upper, [
    "P01",
  ]),
  q("neck_side", "오늘 목 옆이 국소적으로 당겨요", upper, ["P02"]),
  q("neck_back", "오늘 목 뒤 위쪽이 국소적으로 당겨요", upper, ["P02"]),
  q("upper_back", "오늘 윗등이 굳거나 긴장된 느낌이에요", upper, [
    "P03",
    "P04",
  ]),
  q(
    "neck_fatigue",
    "최근 며칠 화면을 본 뒤 목 뒤가 피로해요",
    upper,
    ["P04"],
    ["screen"],
  ),
  q("torso_limited", "최근 일상에서 몸통 돌림이 뻣뻣했어요", upper, ["P05"]),
  q("neck_limited", "최근 목만 좌우로 돌릴 때 뻣뻣했어요", upper, ["P05"]),
  q("jaw_stiff", "오늘 턱 옆·관자 주변이 뻐근해요", ["head", "neck"], ["P06"]),
  q(
    "lat_stiff",
    "최근 팔을 들 때 겨드랑이 뒤·등 옆이 당겼어요",
    ["shoulder", "back"],
    ["P07"],
  ),
  q(
    "shoulder_back",
    "최근 팔을 가슴 앞으로 가져오면 어깨 뒤가 편하게 당겼어요",
    ["shoulder", "back"],
    ["P08"],
  ),
  q(
    "hip_front",
    "최근 걸을 때 다리를 뒤로 보내기 어렵고 고관절 앞이 당겼어요",
    lower,
    ["P09"],
  ),
  q("hip_back", "앉은 뒤 엉덩이 뒤가 뻣뻣하고 굽힘·회전이 제한돼요", lower, [
    "P10",
  ]),
  q(
    "hamstring_local",
    "골반에서 숙일 때 허벅지 뒤만 국소적으로 당겼어요",
    lower,
    ["P11"],
  ),
  q(
    "waist_effort",
    "일어설 때 엉덩이보다 허리로 버티는 느낌이에요",
    ["lower", "thigh"],
    ["P12"],
  ),
  q(
    "side_local",
    "오늘 옆구리·바깥 고관절이 국소적으로 당겨요",
    ["back", "lower", "thigh"],
    ["P13"],
  ),
  q("inner_thigh", "최근 다리를 벌릴 때 허벅지 안쪽이 편하게 당겼어요", lower, [
    "P14",
  ]),
  q(
    "calf_limited",
    "최근 종아리 뒤가 뻣뻣하고 발목을 앞으로 굽히기 어려웠어요",
    lower,
    ["P15"],
  ),
  q(
    "plantar_local",
    "최근 발바닥이 국소적으로 당기고 발가락이 뻣뻣했어요",
    ["calf", "ankle"],
    ["P16"],
  ),
  q("fatigue", "최근 움직임 제한보다 피로·뻐근함이 주된 느낌이에요", all, [
    "P17",
  ]),
  q(
    "flex_bad_ext_good",
    "최근 일상에서 숙임은 불편했지만 작은 폄은 편했어요",
    ["lower"],
    ["P18"],
  ),
  q(
    "ext_bad_flex_good",
    "최근 일상에서 젖힘은 불편했지만 작은 굽힘은 편했어요",
    ["lower"],
    ["P19"],
  ),
  q("stiff", "오늘 오래 같은 자세 뒤 전반적으로 굳은 느낌이에요", all, ["P20"]),
  q(
    "reach_comfort",
    "최근 가볍게 앞으로 뻗었을 때 편했어요",
    upper,
    ["P03"],
    ["retract"],
  ),
  q("side_neck_comfort", "최근 작은 옆목 기울임은 편했어요", upper, ["P02"]),
  q("diagonal_comfort", "최근 작은 대각선 고개 숙임은 편했어요", upper, [
    "P02",
  ]),
  q("neck_flex_comfort", "최근 작은 고개 숙임은 편했어요", upper, ["P02"]),
  q("rotation_comfort", "최근 작은 몸통 회전은 편했어요", all, ["P05"]),
  q("neck_turn_comfort", "최근 작은 목 회전은 편했어요", upper, ["P05"]),
  q(
    "chest_open_comfort",
    "최근 손을 뒤에 두고 가슴을 작게 여는 것은 편했어요",
    upper,
    ["P01"],
  ),
  q(
    "external_comfort",
    "최근 팔꿈치를 붙이고 양손을 바깥으로 벌리기는 편했어요",
    upper,
    ["P01"],
  ),
  q("touch_comfort", "최근 가벼운 손끝 접촉·마사지는 편했어요", upper, [
    "P01",
    "P06",
  ]),
  q(
    "chin_comfort",
    "최근 고개를 숙이지 않고 턱을 조금 뒤로 옮기기는 편했어요",
    upper,
    ["P04"],
  ),
  q(
    "extension_comfort",
    "최근 등받이에서 윗등을 조금 펴는 것은 편했어요",
    upper,
    ["P04"],
  ),
  q(
    "jaw_move_comfort",
    "최근 작은 입 열고 닫기는 편했어요",
    ["head", "neck"],
    ["P06"],
  ),
  q(
    "arm_raise_comfort",
    "최근 지지한 팔 올리기·손 미끄러뜨리기는 편했어요",
    upper,
    ["P07"],
  ),
  q(
    "hip_extend_comfort",
    "최근 다리를 뒤로 보내 고관절을 작게 펴기는 편했어요",
    lower,
    ["P09"],
  ),
  q("cross_comfort", "최근 다리 교차·허벅지 당기기는 편했어요", lower, ["P10"]),
  q("knee_hug_comfort", "최근 작은 무릎 당기기는 편했어요", lower, [
    "P10",
    "P19",
  ]),
  q(
    "hamstring_comfort",
    "최근 허벅지 뒤의 작은 당김·무릎 펴기는 편했어요",
    lower,
    ["P11"],
  ),
  q(
    "bridge_comfort",
    "최근 누워 엉덩이를 조금 들기는 편했어요",
    ["lower", "thigh"],
    ["P12"],
  ),
  q(
    "sidebend_comfort",
    "최근 작은 옆구리 기울임은 편했어요",
    ["back", "lower", "thigh"],
    ["P13"],
  ),
  q("abduct_comfort", "최근 다리를 부드럽게 벌리는 것은 편했어요", lower, [
    "P14",
  ]),
  q("calf_straight_comfort", "최근 무릎을 편 종아리 당김은 편했어요", lower, [
    "P15",
  ]),
  q("calf_bent_comfort", "최근 무릎을 굽힌 종아리 당김은 편했어요", lower, [
    "P15",
  ]),
  q(
    "toe_comfort",
    "최근 발가락을 부드럽게 뒤로 보내기는 편했어요",
    ["calf", "ankle"],
    ["P16"],
  ),
  q("small_comfort", "최근 작은 움직임에는 불편이 없었어요", all, ["P20"]),
  q(
    "both_directions_comfort",
    "최근 등을 작게 굽혔다 펴는 두 방향 모두 편했어요",
    ["back", "lower"],
    ["P20"],
  ),
  q("today_ok", "오늘은 특별히 불편한 곳이 없어요", all, []),
  q(
    "prep_comfort",
    "오늘 할 운동의 준비 움직임을 편한 범위에서 할 수 있어요",
    all,
    ["P21"],
  ),
  q(
    "sudden_worse",
    "갑자기 뚜렷하게 악화했거나 새롭게 심한 불편이 생겼어요",
    all,
    [],
  ),
  q("radiating", "전기처럼 찌릿하게 팔다리로 뻗는 느낌이 있어요", all, []),
  q("dizzy", "움직일 때 어지럽거나 찌릿한 느낌이 있어요", all, []),
  { ...q("none", "특별한 최근 행동·느낌이 없어요", all, []), exclusive: true },
  {
    ...q("unknown", "최근 상태가 기억나지 않거나 잘 모르겠어요", all, []),
    exclusive: true,
  },
];
export function questions(
  kind: "habits" | "current",
  area?: Area,
  habits: string[] = [],
) {
  return (kind === "habits" ? habitChoices : currentChoices).filter(
    (x) =>
      (!area || x.areas.includes(area)) &&
      (!x.requiresHabit || x.requiresHabit.some((h) => habits.includes(h))),
  );
}
export function toggleChoice(values: string[], id: string) {
  if (values.includes(id)) return values.filter((x) => x !== id);
  if (["none", "unknown"].includes(id)) return [id];
  return [...values.filter((x) => !["none", "unknown"].includes(x)), id].sort();
}
export function validateQuestionInput(input: SessionInput) {
  for (const [kind, values] of [
    ["habits", input.habits],
    ["current", input.current],
  ] as const) {
    const allowed = questions(
      kind,
      input.purpose === "daily" ? input.area : undefined,
      input.habits,
    );
    if (
      values.some((id) => !allowed.some((q) => q.id === id)) ||
      (values.some((id) => ["none", "unknown"].includes(id)) &&
        values.length > 1)
    )
      throw new Error("선택한 답변을 확인해주세요.");
  }
  if (
    input.current.includes("today_ok") &&
    input.current.some((id) =>
      currentChoices
        .find((x) => x.id === id)
        ?.patterns.some((p) => p !== "P21"),
    )
  )
    throw new Error("오늘 괜찮음과 현재 불편 답변을 함께 선택할 수 없어요.");
}
