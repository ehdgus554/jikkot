import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { catalog } from "../lib/personalization/catalog";
import {
  approvedConnectionIds,
  programs,
  decide,
} from "../lib/personalization/engine";
import {
  inputSchema,
  emptyMemory,
  poses,
  supports,
} from "../lib/personalization/types";
assert.equal(catalog.length, 94);
assert.equal(new Set(catalog.map((c) => c.catalogId)).size, 94);
assert.equal(approvedConnectionIds.length, 149);
for (const [purpose, count] of [
  ["daily", 70],
  ["warmup", 16],
  ["leisure", 63],
] as const)
  assert.equal(
    approvedConnectionIds.filter((id) => id.startsWith(purpose + ":")).length,
    count,
  );
assert.ok(!approvedConnectionIds.some((id) => id.endsWith(":O09")));
for (const c of catalog) {
  const data = await readFile("public" + c.media.path);
  assert.equal(createHash("sha256").update(data).digest("hex"), c.media.sha256);
  assert.ok(c.steps.length >= 2);
  if (c.eligiblePurposes.length) assert.ok(c.dose.plannedSeconds > 0);
  if (c.eligiblePurposes.length) assert.ok(c.dose.holdSeconds <= 30);
}
assert.equal(catalog.find((c) => c.catalogId === "D31")!.pose, "chair");
for (const p of programs) {
  const input = inputSchema.parse({
    purpose: p.purpose,
    sport: p.sport,
    profile: p.profile,
    preference: p.focus ?? "all",
    minutes: p.minutesChoice,
    poses: poses.map((x) => x[0]),
    supports: supports.map((x) => x[0]),
    current: [p.purpose === "warmup" ? "prep_comfort" : "today_ok"],
    confirmedAt: Date.now(),
  });
  const decision = decide(input, emptyMemory());
  assert.equal(decision.selected.length, p.items.length, p.id);
  assert.equal(decision.program!.plannedSeconds, p.plannedSeconds, p.id);
}
console.log(
  JSON.stringify({
    registered: 94,
    newRecommendationIds: 93,
    connections: 149,
    programs: 32,
    verifiedAssets: 94,
    clinicalApprovalClaimed: false,
  }),
);
