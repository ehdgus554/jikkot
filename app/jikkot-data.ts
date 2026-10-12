// Approved five-area content; stable routine IDs and original PNGs are retained.
import { fiveAreasSpec } from "./five-areas-spec.js";
export type MovementMode = "seated" | "standing" | "lying";
export type Position = "앉기" | "서기" | "눕기";
export const areas = fiveAreasSpec.bodyAreas.map((area) => ({ ...area, tree: area.id }));
export type AreaCode = (typeof fiveAreasSpec.bodyAreas)[number]["id"];
export type HabitId = keyof typeof fiveAreasSpec.habits;
export type RecentActionId = keyof typeof fiveAreasSpec.recentActions;
export function mapAreaValues<T>(value: (id: AreaCode) => T): Record<AreaCode, T> {
  return { head: value("head"), neck: value("neck"), shoulder: value("shoulder"), back: value("back"), lower: value("lower") };
}
export const habitIdsByArea = mapAreaValues<readonly string[]>((id) => [...fiveAreasSpec.habitProfiles[id], "H_UNKNOWN"]);
export const recentActionIdsByArea = mapAreaValues<readonly string[]>((id) => [...fiveAreasSpec.recentProfiles[id], "R_NONE", "R_UNKNOWN"]);
export const habits = Object.entries(fiveAreasSpec.habits).map(([id, label]) => ({
  id: id as HabitId,
  label,
  areas: areas.filter((area) => habitIdsByArea[area.id].includes(id)).map((area) => area.id),
}));
export const recentActions = Object.entries(fiveAreasSpec.recentActions).map(([id, label]) => ({
  id: id as RecentActionId,
  label,
  areas: areas.filter((area) => recentActionIdsByArea[area.id].includes(id)).map((area) => area.id),
}));
export const allowedRoutineNumbers: Record<AreaCode, readonly number[]> = fiveAreasSpec.allowedRoutines;
export type Routine = {
  id: string;
  displayNumber: number;
  name: string;
  positions: Position[];
  areas: AreaCode[];
  steps: string[];
  cue: string;
  dose: string;
  comfort: string;
  image: string;
  sourceFileName: string;
};
export const routines: Routine[] = [
  {
    id: "jikkot11-r01",
    displayNumber: 1,
    name: "Figure-4 스트레칭 + 허벅지 당기기",
    positions: ["앉기"],
    areas: ["lower"],
    steps: [
      "의자에 앉아 한쪽 발목을 반대쪽 허벅지 위에 올려요.",
      "올라온 다리의 허벅지 아래를 양손으로 받쳐 몸 쪽으로 부드럽게 당겨요.",
      "무릎을 아래로 누르는 동작이 아니에요.",
    ],
    cue: "의자에 앉아 한쪽 발목을 반대쪽 허벅지 위에 올려요. 올라온 다리의 허벅지 아래를 양손으로 받쳐 몸 쪽으로 부드럽게 당겨요. 무릎을 아래로 누르는 동작이 아니에요.",
    dose: "",
    comfort: "무릎을 누르지 말고, 허벅지를 부드럽게 당겨요.",
    image: "/assets/routines/routine-01-figure4.png",
    sourceFileName: "Seated figure-four thigh pull guide(1).png",
  },
  {
    id: "jikkot11-r02",
    displayNumber: 2,
    name: "팔 꼬아 앞으로 밀며 고개 숙이기",
    positions: ["앉기"],
    areas: ["back"],
    steps: [
      "팔을 교차해 손을 잡고 앞으로 길게 뻗어요.",
      "날개뼈 사이가 벌어지도록 등 위쪽을 부드럽게 둥글게 만들어요.",
      "고개를 편하게 숙여요.",
    ],
    cue: "팔을 교차해 손을 잡고 앞으로 길게 뻗어요. 날개뼈 사이가 벌어지도록 등 위쪽을 부드럽게 둥글게 만들어요. 고개를 편하게 숙여요.",
    dose: "",
    comfort: "팔을 앞으로 길게 뻗으며, 등 위쪽을 부드럽게 늘려요.",
    image: "/assets/routines/routine-02-upper-back.png",
    sourceFileName: "Seated Arm Reach and Neck Stretch(1).png",
  },
  {
    id: "jikkot11-r03",
    displayNumber: 3,
    name: "견갑거근 대각선 스트레칭",
    positions: ["앉기"],
    areas: ["neck", "shoulder", "back"],
    steps: [
      "한쪽 손으로 의자 옆을 잡고 어깨를 편하게 아래로 둬요.",
      "고개를 반대쪽으로 돌린 뒤 그쪽 겨드랑이를 보듯 대각선으로 숙여요.",
      "반대 손은 머리 위에 가볍게 얹고 세게 당기지 않아요.",
    ],
    cue: "한쪽 손으로 의자 옆을 잡고 어깨를 편하게 아래로 둬요. 고개를 반대쪽으로 돌린 뒤 그쪽 겨드랑이를 보듯 대각선으로 숙여요. 반대 손은 머리 위에 가볍게 얹고 세게 당기지 않아요.",
    dose: "",
    comfort: "고개를 대각선으로 숙이고, 손으로 세게 당기지 않아요.",
    image: "/assets/routines/routine-03-diagonal-neck.png",
    sourceFileName: "Two-Step Diagonal Neck Stretch(1).png",
  },
  {
    id: "jikkot11-r04",
    displayNumber: 4,
    name: "의자를 이용한 한쪽 가슴 열기",
    positions: ["앉기"],
    areas: ["shoulder", "back"],
    steps: [
      "한쪽 손을 같은 쪽 엉덩이 뒤나 좌판 뒤에 고정해요.",
      "가슴을 편하게 세우고 몸통과 시선을 손을 둔 쪽의 반대 방향으로 함께 돌려요.",
    ],
    cue: "한쪽 손을 같은 쪽 엉덩이 뒤나 좌판 뒤에 고정해요. 가슴을 편하게 세우고 몸통과 시선을 손을 둔 쪽의 반대 방향으로 함께 돌려요.",
    dose: "",
    comfort: "손을 뒤에 고정하고, 가슴 앞쪽이 당기는 범위까지만 움직여요.",
    image: "/assets/routines/routine-04-single-chest.png",
    sourceFileName: "Seated twist with aligned gaze(1).png",
  },
  {
    id: "jikkot11-r05",
    displayNumber: 5,
    name: "책상 광배근·날개뼈 스트레칭",
    positions: ["앉기"],
    areas: ["shoulder", "back"],
    steps: [
      "양손을 책상 위에 두고 의자를 뒤로 보내며 상체를 숙여요.",
      "한쪽을 더 늘리고 싶으면 그쪽 손을 조금 더 앞으로 뻗어요.",
    ],
    cue: "양손을 책상 위에 두고 의자를 뒤로 보내며 상체를 숙여요. 한쪽을 더 늘리고 싶으면 그쪽 손을 조금 더 앞으로 뻗어요.",
    dose: "",
    comfort: "손은 책상에 두고, 겨드랑이와 등 옆쪽을 부드럽게 늘려요.",
    image: "/assets/routines/routine-05-desk-lat.png",
    sourceFileName: "Seated Desk Lat Stretch Guide(1).png",
  },
  {
    id: "jikkot11-r06",
    displayNumber: 6,
    name: "팔꿈치 붙이고 양손 바깥으로 벌리기",
    positions: ["앉기"],
    areas: ["shoulder", "back"],
    steps: [
      "팔꿈치를 몸통에 붙이고 손바닥을 위로 둬요.",
      "팔꿈치는 제자리에 두고 양손을 바깥으로 벌려요.",
    ],
    cue: "팔꿈치를 몸통에 붙이고 손바닥을 위로 둬요. 팔꿈치는 제자리에 두고 양손을 바깥으로 벌려요.",
    dose: "",
    comfort: "팔꿈치를 붙인 채, 손만 편한 범위에서 바깥으로 벌려요.",
    image: "/assets/routines/routine-06-external-rotation.png",
    sourceFileName: "Seated elbow-together outward rotation(1).png",
  },
  {
    id: "jikkot11-r07",
    displayNumber: 7,
    name: "앉아서 뒷짐 가슴 열기",
    positions: ["앉기"],
    areas: ["neck", "shoulder", "back"],
    steps: [
      "의자에 앉아 양손의 손등을 허리 뒤에 대요.",
      "엄지는 안쪽을 향하게 두고 팔꿈치를 살짝 뒤로 보내며 가슴을 열어요.",
      "허리를 과하게 꺾지 않아요.",
    ],
    cue: "의자에 앉아 양손의 손등을 허리 뒤에 대요. 엄지는 안쪽을 향하게 두고 팔꿈치를 살짝 뒤로 보내며 가슴을 열어요. 허리를 과하게 꺾지 않아요.",
    dose: "",
    comfort: "의자에 앉아 손등을 허리에 대고, 허리를 꺾지 않고 가슴을 열어요.",
    image: "/assets/routines/routine-07-seated-chest.png",
    sourceFileName: "Seated chest-opening stretch guide(1).png",
  },
  {
    id: "jikkot11-r08",
    displayNumber: 8,
    name: "앉아서 손깍지 끼고 팔 뒤로 뻗기",
    positions: ["앉기"],
    areas: ["neck", "shoulder", "back"],
    steps: [
      "의자에 앉아 등 뒤에서 손깍지를 껴요.",
      "가슴을 편하게 세우고 팔을 뒤로 길게 뻗어요.",
    ],
    cue: "의자에 앉아 등 뒤에서 손깍지를 껴요. 가슴을 편하게 세우고 팔을 뒤로 길게 뻗어요.",
    dose: "",
    comfort: "의자에 앉아 가슴을 세우고, 손깍지 낀 팔을 뒤로 길게 뻗어요.",
    image: "/assets/routines/routine-08-seated-interlace.png",
    sourceFileName: "08. 앉아서 손깍지 끼고 팔 뒤로 뻗기(1).png",
  },
  {
    id: "jikkot11-r09",
    displayNumber: 9,
    name: "흉쇄유돌근 마사지",
    positions: ["앉기"],
    areas: ["head"],
    steps: [
      "귀 뒤에서 쇄골로 이어지는 목 옆 근육에 손끝을 가볍게 대요.",
      "표면을 부드럽게 문질러요.",
    ],
    cue: "귀 뒤에서 쇄골로 이어지는 목 옆 근육에 손끝을 가볍게 대요. 표면을 부드럽게 문질러요.",
    dose: "",
    comfort: "목 앞쪽이나 맥박이 느껴지는 곳은 누르지 않아요.",
    image: "/assets/routines/routine-09-scm.png",
    sourceFileName: "Gentle seated SCM massage guide(1).png",
  },
  {
    id: "jikkot11-r10",
    displayNumber: 10,
    name: "관자놀이 누르며 입 열고 닫기",
    positions: ["앉기"],
    areas: ["head"],
    steps: [
      "양쪽 관자놀이에 손끝을 가볍게 대요.",
      "손끝을 둔 채 입을 편한 범위에서 천천히 열고 닫아요.",
    ],
    cue: "양쪽 관자놀이에 손끝을 가볍게 대요. 손끝을 둔 채 입을 편한 범위에서 천천히 열고 닫아요.",
    dose: "",
    comfort: "손끝을 가볍게 댄 채, 입을 편한 범위에서 천천히 움직여요.",
    image: "/assets/routines/routine-10-temple-jaw.png",
    sourceFileName: "Gentle temple press jaw exercise(1).png",
  },
  {
    id: "jikkot11-r11",
    displayNumber: 11,
    name: "쇄골 아래 바깥쪽 쓸어내기 마사지",
    positions: ["앉기"],
    areas: ["shoulder"],
    steps: [
      "쇄골 바로 아래 가슴 윗부분에 손을 가볍게 대요.",
      "가슴 중앙에서 어깨 방향으로 천천히 쓸어줘요.",
    ],
    cue: "쇄골 바로 아래 가슴 윗부분에 손을 가볍게 대요. 가슴 중앙에서 어깨 방향으로 천천히 쓸어줘요.",
    dose: "",
    comfort:
      "쇄골 아래의 부드러운 부위를, 가슴 중앙에서 어깨쪽으로 천천히 쓸어요.",
    image: "/assets/routines/routine-11-chest-sweep.png",
    sourceFileName: "Under-Collarbone Chest Sweep Guide(1).png",
  },
];
export const allowedPositions: Record<MovementMode, Position[]> = {
  seated: ["앉기"],
  standing: ["앉기", "서기"],
  lying: ["앉기", "서기", "눕기"],
};
export const getRoutine = (id: string) =>
  routines.find((routine) => routine.id === id);
