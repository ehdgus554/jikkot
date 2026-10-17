import source from "./source-catalog.json";
import { routines } from "../../app/jikkot-data";
import mediaManifest from "./media-manifest.json";
import type { CustomerMovement, Pose, Support } from "./types";

type Profile = [Pose | "unconfirmed", Support[], string[], string[]];
const profiles: Record<string, Profile> = {
  O01: ["chair", ["chair"], ["cross_comfort"], ["hip_flexion", "knee_hold"]],
  O02: [
    "chair",
    ["chair"],
    ["reach_comfort"],
    ["reach_forward", "neck_flexion"],
  ],
  O03: [
    "chair",
    ["chair"],
    ["diagonal_comfort"],
    ["neck_diagonal", "shoulder_depression"],
  ],
  O04: [
    "chair",
    ["chair"],
    ["chest_open_comfort"],
    ["arm_behind", "torso_rotation"],
  ],
  O05: [
    "chair",
    ["chair", "desk"],
    ["arm_raise_comfort"],
    ["reach_forward", "arm_overhead"],
  ],
  O06: ["chair", ["chair"], ["external_comfort"], ["external_rotation"]],
  O07: ["chair", ["chair"], ["chest_open_comfort"], ["arm_behind"]],
  O08: [
    "chair",
    ["chair"],
    ["chest_open_comfort"],
    ["arm_behind", "hand_interlace"],
  ],
  O09: ["chair", ["chair"], ["touch_comfort", "neck_fatigue"], ["neck_touch"]],
  O10: ["chair", ["chair"], ["jaw_move_comfort"], ["jaw_open", "temple_touch"]],
  O11: ["chair", ["chair"], ["touch_comfort"], ["chest_touch"]],
  D01: ["chair", ["chair"], ["side_neck_comfort", "neck_side"], ["neck_side"]],
  D02: [
    "chair",
    ["chair"],
    ["rotation_comfort", "torso_limited"],
    ["torso_rotation"],
  ],
  D03: [
    "chair",
    ["chair", "chairBack"],
    ["extension_comfort"],
    ["thoracic_extension"],
  ],
  D04: [
    "chair",
    ["chair"],
    ["hip_extend_comfort", "hip_front"],
    ["hip_extension"],
  ],
  D05: ["chair", ["chair"], ["hamstring_comfort"], ["hamstring", "hip_hinge"]],
  D06: ["chair", ["chair"], ["knee_hug_comfort"], ["hip_flexion", "knee_hold"]],
  D07: [
    "standing",
    ["wall"],
    ["chest_open_comfort"],
    ["arm_behind", "wall_arm"],
  ],
  D08: [
    "standing",
    ["wall", "balance"],
    ["sidebend_comfort"],
    ["hip_sidebend", "cross_standing"],
  ],
  D09: ["standing", ["wall"], ["calf_straight_comfort"], ["calf_straight"]],
  D10: ["standing", ["wall"], ["calf_bent_comfort"], ["calf_bent"]],
  D11: ["side", [], ["hip_extend_comfort"], ["knee_flexion", "hip_extension"]],
  D12: ["supine", [], ["hamstring_comfort"], ["hamstring", "knee_extension"]],
  D13: [
    "side",
    [],
    ["rotation_comfort", "torso_limited"],
    ["torso_rotation", "arm_behind"],
  ],
  D14: ["floor", [], ["abduct_comfort"], ["hip_abduction"]],
  D15: ["chair", ["chair"], ["touch_comfort"], ["jaw_touch"]],
  D16: ["chair", ["chair"], ["jaw_move_comfort"], ["jaw_open"]],
  D17: [
    "chair",
    ["chair"],
    ["diagonal_comfort", "neck_back"],
    ["neck_diagonal", "shoulder_depression"],
  ],
  D18: ["chair", ["chair"], ["chin_comfort"], ["chin_retraction"]],
  D19: [
    "chair",
    ["chair"],
    ["neck_turn_comfort", "neck_limited"],
    ["neck_rotation"],
  ],
  D20: [
    "chair",
    ["chair"],
    ["neck_flex_comfort", "neck_back"],
    ["neck_flexion"],
  ],
  D21: ["chair", ["chair"], ["shoulder_back"], ["cross_body"]],
  D22: [
    "chair",
    ["chair"],
    ["chest_open_comfort", "arm_raise_comfort"],
    ["arm_overhead", "arm_behind"],
  ],
  D23: [
    "chair",
    ["chair", "desk", "towel"],
    ["arm_raise_comfort"],
    ["reach_forward", "arm_overhead"],
  ],
  D24: ["chair", ["chair"], ["reach_comfort"], ["reach_forward"]],
  D25: ["chair", ["chair"], ["sidebend_comfort"], ["trunk_sidebend"]],
  D26: ["chair", ["chair"], ["small_comfort"], ["pelvic_tilt"]],
  D27: [
    "chair",
    ["chair"],
    ["both_directions_comfort"],
    ["reach_forward", "spine_flexion", "spine_extension"],
  ],
  D28: [
    "chair",
    ["chair"],
    ["cross_comfort", "hamstring_comfort"],
    ["hip_hinge", "hip_rotation"],
  ],
  D29: ["chair", ["chair"], ["abduct_comfort"], ["hip_abduction"]],
  D30: [
    "chair",
    ["chair", "towel"],
    ["calf_straight_comfort"],
    ["calf_straight"],
  ],
  D31: ["unconfirmed", ["towel"], ["calf_bent_comfort"], ["calf_bent"]],
  D32: [
    "chair",
    ["chair"],
    ["toe_comfort", "plantar_local"],
    ["toe_extension"],
  ],
  D33: ["chair", ["chair"], ["small_comfort"], ["ankle_pump"]],
  Y01: [
    "quadruped",
    ["wrist", "knee"],
    ["arm_raise_comfort", "knee_hug_comfort"],
    ["reach_forward", "hip_flexion", "deep_knee"],
  ],
  Y02: [
    "quadruped",
    ["wrist", "knee"],
    ["both_directions_comfort"],
    ["reach_forward", "spine_flexion", "spine_extension"],
  ],
  Y03: [
    "quadruped",
    ["wrist", "knee"],
    ["arm_raise_comfort"],
    ["reach_forward", "arm_overhead"],
  ],
  Y04: [
    "quadruped",
    ["wrist", "knee"],
    ["rotation_comfort"],
    ["torso_rotation", "arm_thread"],
  ],
  Y05: [
    "floor",
    [],
    ["sidebend_comfort", "arm_raise_comfort"],
    ["trunk_sidebend", "arm_overhead"],
  ],
  Y06: [
    "halfKneel",
    ["knee"],
    ["hip_extend_comfort", "hip_front"],
    ["hip_extension"],
  ],
  Y07: ["floor", [], ["hamstring_comfort"], ["hamstring", "hip_hinge"]],
  Y08: [
    "supine",
    [],
    ["knee_hug_comfort", "abduct_comfort"],
    ["hip_flexion", "hip_abduction"],
  ],
  Y09: [
    "supine",
    [],
    ["abduct_comfort", "arm_raise_comfort"],
    ["hip_abduction", "arm_overhead"],
  ],
  Y10: [
    "supine",
    [],
    ["sidebend_comfort", "arm_raise_comfort"],
    ["trunk_sidebend", "arm_overhead"],
  ],
  Y11: ["prone", [], ["flex_bad_ext_good"], ["spine_extension"]],
  Y12: ["supine", [], ["bridge_comfort"], ["hip_activation"]],
  Y13: [
    "handFoot",
    ["wrist", "experienced"],
    ["arm_raise_comfort", "hamstring_comfort", "calf_straight_comfort"],
    ["reach_forward", "hamstring", "calf_straight"],
  ],
  W01: ["standing", ["space"], ["prep_comfort"], ["lunge", "hip_extension"]],
  W02: ["standing", [], ["prep_comfort"], ["torso_rotation"]],
  W03: ["standing", ["wall"], ["prep_comfort"], ["leg_swing"]],
  W04: ["standing", [], ["prep_comfort"], ["arm_circle"]],
  W05: ["standing", [], ["prep_comfort"], ["squat"]],
  W06: ["standing", ["wall"], ["prep_comfort"], ["calf_load"]],
  W07: [
    "standing",
    ["balance"],
    ["prep_comfort"],
    ["knee_hold", "hip_flexion"],
  ],
  W08: [
    "standing",
    ["balance", "experienced"],
    ["prep_comfort", "hamstring_comfort"],
    ["hip_hinge", "hamstring"],
  ],
  W09: [
    "standing",
    ["space"],
    ["prep_comfort"],
    ["lateral_lunge", "hip_abduction"],
  ],
  W10: ["standing", ["space", "dryFloor"], ["prep_comfort"], ["lateral_steps"]],
  W11: ["standing", [], ["prep_comfort"], ["march"]],
  W12: ["standing", [], ["prep_comfort"], ["knee_flexion"]],
  W13: [
    "quadruped",
    ["wrist", "knee", "space", "dryFloor"],
    ["prep_comfort"],
    ["hip_abduction", "hip_hinge"],
  ],
  W14: [
    "quadruped",
    ["wrist", "knee", "dryFloor"],
    ["prep_comfort"],
    ["torso_rotation", "arm_thread"],
  ],
  W15: [
    "quadruped",
    ["wrist", "knee", "dryFloor"],
    ["prep_comfort"],
    ["reach_forward", "shoulder_load"],
  ],
  W16: [
    "supine",
    ["dryFloor"],
    ["prep_comfort"],
    ["hamstring", "knee_extension"],
  ],
  W17: ["supine", ["dryFloor"], ["prep_comfort"], ["arm_overhead"]],
};
export const canonicalFamilies: Record<string, string> = {
  O01: "figure-four",
  D28: "figure-four",
  O05: "lat-reach",
  D23: "lat-reach",
  D12: "hamstring",
  D05: "hamstring",
  Y07: "hamstring",
  W16: "hamstring",
  D02: "torso-rotation",
  D13: "torso-rotation",
  Y04: "torso-rotation",
  W14: "torso-rotation",
  D27: "cat-cow",
  Y02: "cat-cow",
  D04: "hip-flexor",
  Y06: "hip-flexor",
  D25: "sidebend",
  Y05: "sidebend",
  Y10: "sidebend",
  D14: "adductor",
  D29: "adductor",
  Y09: "adductor",
  D09: "calf-straight",
  D30: "calf-straight",
  D10: "calf-bent",
  D31: "calf-bent",
};
export const catalog = source.map((item) => {
  const profile = profiles[item.catalogId];
  if (!profile) throw new Error(`Missing execution profile: ${item.catalogId}`);
  const old = routines.find((x) => x.id === item.legacyIdInSource);
  const media = mediaManifest.find((x) => x.catalogId === item.catalogId)!;
  return {
    ...item,
    pose: profile[0],
    supports: profile[1],
    comfort: profile[2],
    directions: profile[3],
    family: canonicalFamilies[item.catalogId] ?? item.sourceFamilyId,
    role: item.movementTypeSource.includes("마사지")
      ? "massage"
      : item.movementTypeSource.includes("활성")
        ? "activation"
        : item.catalogId.startsWith("W")
          ? "preparation"
          : item.catalogId === "D26" ||
              item.catalogId === "D33" ||
              item.catalogId === "D27" ||
              item.catalogId === "Y02"
            ? "mobility"
            : "stretch",
    approval: {
      daily: old ? "existing" : "draft",
      warmup: "draft",
      leisure: "draft",
    },
    old,
    media,
    reviewReasons: [
      ...(item.catalogId === "D31"
        ? ["의자·바닥 지지 미확정: 자동 배정 제외"]
        : []),
      ...(old ? [] : ["목적별 연결·실시량·시연 검토 대기"]),
      ...(media.installed ? [] : ["새 PNG 원본 수신·검증 대기"]),
    ],
  };
});
export type Content = (typeof catalog)[number];
export function movement(item: Content): CustomerMovement {
  return {
    id: item.old?.id ?? `jikkot74-${item.catalogId.toLowerCase()}`,
    catalogId: item.catalogId,
    name: item.old?.name ?? item.name,
    steps: item.steps,
    pose: item.pose,
    media: {
      type: "image",
      src: item.media.installed
        ? item.media.path
        : (item.old?.image ?? item.media.path),
      width: item.imageWidth,
      height: item.imageHeight,
      version: item.media.installed
        ? item.imageSha256
        : item.old
          ? "existing-preserved"
          : "awaiting-original",
    },
    dose: item.old?.dose || null,
    doseStatus: item.old ? "existing" : "unconfirmed",
    directions: item.directions,
  };
}
