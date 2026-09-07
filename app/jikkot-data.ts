export type MovementMode = "seated" | "standing" | "lying";
export type Position = "앉기" | "서기" | "눕기";
export type AreaCode = "HEAD" | "NECK" | "SHOULDER" | "LOW_BACK" | "HIP_PELVIS";
export type RoutineRole = "긴장 완화" | "움직임 회복" | "근육 조절";

export type Routine = {
  id: string;
  name: string;
  role: RoutineRole;
  positions: Position[];
  areas: AreaCode[];
  clusters: string[];
  dose: string;
  cue: string;
  comfort: string;
  image: string;
};

export const movements = [
  {
    id: "seated" as const,
    label: "앉아서",
    description: "앉기만",
  },
  {
    id: "standing" as const,
    label: "서서도",
    description: "서기까지",
  },
  {
    id: "lying" as const,
    label: "누워서도",
    description: "눕기까지",
  },
];

export const areas: Array<{ id: AreaCode; label: string; description: string }> = [
  { id: "HEAD", label: "머리", description: "턱과 머리 주변 포함" },
  { id: "NECK", label: "목", description: "목 앞·옆·뒤를 나누지 않아요" },
  { id: "SHOULDER", label: "어깨", description: "어깨와 등 위쪽 포함" },
  { id: "LOW_BACK", label: "허리", description: "허리와 몸통 주변" },
  { id: "HIP_PELVIS", label: "골반·엉덩이", description: "골반과 고관절 주변" },
];

export const recentActions = [
  { id: "RA01", label: "오래 앉아 있었다", tag: "STATIC_SITTING", areas: ["NECK", "SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
  { id: "RA02", label: "모니터를 오래 봤다", tag: "SCREEN_STATIC", areas: ["HEAD", "NECK", "SHOULDER"] },
  { id: "RA03", label: "휴대폰을 내려다보는 시간이 길었다", tag: "NECK_FLEXION", areas: ["HEAD", "NECK", "SHOULDER"] },
  { id: "RA04", label: "이를 악물거나 턱에 힘을 주고 있었다", tag: "JAW_TENSION", areas: ["HEAD", "NECK"] },
  { id: "RA05", label: "운전을 오래했다", tag: "DRIVING_STATIC", areas: ["HEAD", "NECK", "SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
  { id: "RA06", label: "키보드나 마우스를 오래 사용했다", tag: "UPPER_LIMB_REPEAT", areas: ["NECK", "SHOULDER"] },
  { id: "RA07", label: "팔을 앞에 뻗은 채 오래 일했다", tag: "FORWARD_REACH", areas: ["NECK", "SHOULDER"] },
  { id: "RA08", label: "팔을 머리 위로 오래 사용했다", tag: "OVERHEAD_LOAD", areas: ["NECK", "SHOULDER"] },
  { id: "RA09", label: "무거운 물건을 들거나 옮겼다", tag: "LIFT_LOAD", areas: ["SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
  { id: "RA10", label: "한쪽으로 가방이나 짐을 오래 들었다", tag: "ASYMMETRIC_LOAD", areas: ["SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
  { id: "RA11", label: "오래 서 있었거나 평소보다 많이 걸었다", tag: "STANDING_WALKING", areas: ["LOW_BACK", "HIP_PELVIS"] },
  { id: "RA12", label: "평소보다 운동이나 집안일을 많이 했다", tag: "NOVEL_LOAD", areas: ["SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
  { id: "RA13", label: "불편한 자세로 잠을 잔 것 같다", tag: "SLEEP_POSITION", areas: ["HEAD", "NECK", "SHOULDER", "LOW_BACK"] },
  { id: "RA14", label: "긴장하거나 스트레스가 큰 상태였다", tag: "GENERAL_TENSION", areas: ["HEAD", "NECK", "SHOULDER"] },
  { id: "RA99", label: "해당 없음 / 잘 모르겠어요", tag: "NONE", areas: ["HEAD", "NECK", "SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
] as const;

export const habits = [
  { id: "HB01", label: "오래 앉아 있어도 자세를 자주 바꾸지 않는다", tag: "LOW_VARIATION", areas: ["NECK", "SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
  { id: "HB02", label: "다리를 꼬고 앉는 시간이 잦다", tag: "ASYMMETRIC_SIT", areas: ["LOW_BACK", "HIP_PELVIS"] },
  { id: "HB03", label: "한쪽 엉덩이에 기대어 앉는 편이다", tag: "ASYMMETRIC_SIT", areas: ["LOW_BACK", "HIP_PELVIS"] },
  { id: "HB04", label: "화면을 볼 때 머리가 어깨보다 앞으로 나오는 편이다", tag: "SCREEN_STATIC", areas: ["HEAD", "NECK", "SHOULDER"] },
  { id: "HB05", label: "앉아 있을 때 어깨와 등이 둥글게 말리는 편이다", tag: "THORACIC_FLEXION", areas: ["NECK", "SHOULDER"] },
  { id: "HB06", label: "마우스·휴대폰을 주로 한쪽 손으로 오래 쓴다", tag: "UNILATERAL_UPPER", areas: ["NECK", "SHOULDER"] },
  { id: "HB07", label: "평소 이를 악물거나 이를 가는 편이다", tag: "JAW_TENSION", areas: ["HEAD", "NECK"] },
  { id: "HB08", label: "가방을 늘 같은 쪽으로 메는 편이다", tag: "ASYMMETRIC_LOAD", areas: ["SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
  { id: "HB09", label: "엎드리거나 늘 같은 방향으로 자는 편이다", tag: "SLEEP_POSITION", areas: ["HEAD", "NECK", "SHOULDER", "LOW_BACK"] },
  { id: "HB10", label: "걷기나 가벼운 운동을 거의 하지 않는다", tag: "LOW_ACTIVITY", areas: ["HEAD", "NECK", "SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
  { id: "HB99", label: "해당 없음 / 잘 모르겠어요", tag: "NONE", areas: ["HEAD", "NECK", "SHOULDER", "LOW_BACK", "HIP_PELVIS"] },
] as const;

// 질문 피로도를 줄이기 위해 큰 불편 부위마다 노출할 문항을 명시적으로 제한합니다.
// 마지막 문항은 언제나 "해당 없음"이며, 배열 순서가 화면 노출 순서입니다.
export const recentActionIdsByArea: Record<AreaCode, readonly string[]> = {
  HEAD: ["RA04", "RA02", "RA03", "RA13", "RA14", "RA99"],
  NECK: ["RA02", "RA03", "RA05", "RA06", "RA13", "RA99"],
  SHOULDER: ["RA06", "RA07", "RA08", "RA10", "RA12", "RA99"],
  LOW_BACK: ["RA01", "RA05", "RA09", "RA11", "RA13", "RA99"],
  HIP_PELVIS: ["RA01", "RA05", "RA09", "RA10", "RA11", "RA99"],
};

export const habitIdsByArea: Record<AreaCode, readonly string[]> = {
  HEAD: ["HB04", "HB07", "HB09", "HB10", "HB99"],
  NECK: ["HB01", "HB04", "HB05", "HB09", "HB99"],
  SHOULDER: ["HB01", "HB05", "HB06", "HB08", "HB99"],
  LOW_BACK: ["HB01", "HB02", "HB03", "HB09", "HB99"],
  HIP_PELVIS: ["HB01", "HB02", "HB03", "HB08", "HB99"],
};

export const routines: Routine[] = [
  {
    id: "MV001",
    name: "편안한 360도 호흡과 어깨 내려놓기",
    role: "긴장 완화",
    positions: ["앉기", "서기", "눕기"],
    areas: ["HEAD", "NECK", "SHOULDER", "LOW_BACK", "HIP_PELVIS"],
    clusters: ["GENERAL_TENSION", "JAW_TENSION"],
    dose: "느린 호흡 3회",
    cue: "들이쉴 때 배와 옆구리를 편하게 넓히고, 내쉴 때 어깨 힘을 놓아보세요.",
    comfort: "어깨에 힘이 들어가지 않는 편안한 호흡 범위에서 진행해요.",
    image: "/assets/routines/R11.webp",
  },
  {
    id: "MV002",
    name: "턱 휴식 위치 만들기",
    role: "긴장 완화",
    positions: ["앉기", "서기"],
    areas: ["HEAD", "NECK"],
    clusters: ["JAW_TENSION"],
    dose: "10초 유지 × 2",
    cue: "입술은 편하게 닿게 두고, 위아래 치아는 살짝 떨어뜨려 턱의 힘을 놓아보세요.",
    comfort: "이를 꽉 물지 않고 턱이 편안한 위치만 찾아요.",
    image: "/assets/routines/R03.webp",
  },
  {
    id: "MV003",
    name: "거울 보며 부분 턱 열기",
    role: "움직임 회복",
    positions: ["앉기"],
    areas: ["HEAD"],
    clusters: ["JAW_TENSION"],
    dose: "작은 범위 5회",
    cue: "정면을 보며 턱이 한쪽으로 치우치지 않게 입을 작게 열었다 닫아요.",
    comfort: "크게 벌리지 말고 편안한 범위만 사용해요.",
    image: "/assets/routines/R03.webp",
  },
  {
    id: "MV004",
    name: "앉은 턱 당기기",
    role: "근육 조절",
    positions: ["앉기", "서기"],
    areas: ["HEAD", "NECK"],
    clusters: ["SCREEN_STATIC", "NECK_FLEXION"],
    dose: "3초 유지 × 5회",
    cue: "고개를 숙이지 않고 머리 전체를 뒤로 작게 이동했다 돌아와요.",
    comfort: "목 앞쪽에 힘이 과하게 들어가지 않는 작은 범위로 해요.",
    image: "/assets/routines/R07.webp",
  },
  {
    id: "MV005",
    name: "목 좌우 천천히 돌리기",
    role: "움직임 회복",
    positions: ["앉기", "서기"],
    areas: ["HEAD", "NECK"],
    clusters: ["DRIVING_STATIC", "SLEEP_POSITION"],
    dose: "좌우 3회",
    cue: "어깨는 정면에 둔 채 고개를 좌우로 천천히 돌려요.",
    comfort: "끝까지 밀지 않고 부드럽게 돌아가는 범위까지만 해요.",
    image: "/assets/routines/R08.webp",
  },
  {
    id: "MV006",
    name: "목 옆으로 가볍게 기울이기",
    role: "움직임 회복",
    positions: ["앉기", "서기"],
    areas: ["HEAD", "NECK"],
    clusters: ["SCREEN_STATIC", "GENERAL_TENSION"],
    dose: "좌우 3회, 3초",
    cue: "손으로 당기지 않고 귀를 어깨 쪽으로 작게 기울였다 돌아와요.",
    comfort: "어깨를 끌어내리지 않고 목이 편안한 범위에서 움직여요.",
    image: "/assets/routines/R09.webp",
  },
  {
    id: "MV007",
    name: "견갑거근 방향 목 늘리기",
    role: "움직임 회복",
    positions: ["앉기", "서기"],
    areas: ["NECK", "SHOULDER"],
    clusters: ["SCREEN_STATIC", "DRIVING_STATIC"],
    dose: "좌우 10초",
    cue: "고개를 대각선 아래로 작게 돌리고 반대쪽 어깨는 편하게 둬요.",
    comfort: "손으로 강하게 당기지 않는 작은 범위에서 멈춰요.",
    image: "/assets/routines/R10.webp",
  },
  {
    id: "MV008",
    name: "누워서 작은 고개 끄덕임",
    role: "근육 조절",
    positions: ["눕기"],
    areas: ["HEAD", "NECK"],
    clusters: ["NECK_FLEXION", "SCREEN_STATIC"],
    dose: "3초 유지 × 5회",
    cue: "편하게 누워서 ‘예’라고 하듯 아주 작게 끄덕였다 돌아와요.",
    comfort: "머리를 바닥에 세게 누르지 않는 범위에서 해요.",
    image: "/assets/routines/R07.webp",
  },
  {
    id: "MV009",
    name: "어깨 올렸다 힘 빼며 내리기",
    role: "긴장 완화",
    positions: ["앉기", "서기"],
    areas: ["HEAD", "NECK", "SHOULDER"],
    clusters: ["GENERAL_TENSION", "SCREEN_STATIC"],
    dose: "3~5회",
    cue: "어깨를 가볍게 올렸다가 숨을 내쉬며 힘을 놓고 내려요.",
    comfort: "어깨를 세게 끌어내리지 말고 자연스럽게 놓아요.",
    image: "/assets/routines/R11.webp",
  },
  {
    id: "MV010",
    name: "어깨 천천히 원 그리기",
    role: "움직임 회복",
    positions: ["앉기", "서기"],
    areas: ["NECK", "SHOULDER"],
    clusters: ["UPPER_LIMB_REPEAT", "GENERAL_TENSION"],
    dose: "앞뒤 각 3~5회",
    cue: "팔의 힘을 빼고 어깨로 작은 원을 천천히 그려요.",
    comfort: "걸리는 느낌이 없는 작은 원부터 시작해요.",
    image: "/assets/routines/R11.webp",
  },
  {
    id: "MV011",
    name: "날개뼈 모았다 풀기",
    role: "근육 조절",
    positions: ["앉기", "서기"],
