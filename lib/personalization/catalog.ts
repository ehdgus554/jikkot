import source from "./release/catalogue-reviewed.json";
import manifest from "./release/asset-manifest.json";
import { routines } from "../../app/jikkot-data";
import type { CustomerMovement, Pose, Dose } from "./types";
export const ASSET_ROOT = "/assets/jikkot-release/2026-10-17/";
export const assetPath = (path: string) =>
  path.replace(/^assets\//, ASSET_ROOT);
export const catalog = source.items.map((item) => {
  const asset = manifest.runtimeImages.find((a) => a.path === item.media.src)!;
  return {
    ...item,
    pose: item.pose as Pose,
    directions: item.directions as string[],
    supports: item.supports as string[],
    requiredExplicitCapabilities: item.requiredExplicitCapabilities as string[],
    comfort: item.requiresComfortForDaily,
    old: routines.find((r) => r.id === item.provenance.legacyId),
    media: {
      ...item.media,
      installed: true,
      path: assetPath(item.media.src),
      sha256: asset.sha256,
    },
    imageWidth: asset.dimensions[0],
    imageHeight: asset.dimensions[1],
    imageSha256: asset.sha256,
  };
});
export type Content = (typeof catalog)[number];
export const canonicalFamilies = Object.fromEntries(
  catalog.map((c) => [c.catalogId, c.family]),
);
export function movement(
  item: Content,
  dose: Dose = item.dose as Dose,
  round = 1,
): CustomerMovement {
  const { basis: _basis, ...publicDose } = dose as Dose & { basis?: unknown };
  void _basis;
  return {
    id: item.old?.id ?? item.movementId,
    catalogId: item.catalogId,
    name: item.name,
    steps: item.steps,
    pose: item.pose,
    media: {
      type: "image",
      src: item.media.path,
      width: item.imageWidth,
      height: item.imageHeight,
      version: item.media.sha256,
    },
    dose: dose.label,
    doseStatus: "existing",
    dosage: publicDose,
    cautions: item.cautions,
    cue: item.cue,
    round,
    directions: item.directions,
  };
}
