import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
test("handoff artwork and fonts retain every supplied byte and license", async () => {
  const manifest = JSON.parse(
    await readFile("docs/uiux-2026-10-13/assets-manifest.json", "utf8"),
  ) as { path: string; sha256: string }[];
  assert.equal(manifest.length, 22);
  for (const item of manifest)
    assert.equal(
      createHash("sha256")
        .update(await readFile(item.path))
        .digest("hex"),
      item.sha256,
      item.path,
    );
  for (const name of ["LINE-Seed-OFL.txt", "Nunito-OFL.txt"])
    assert.match(
      await readFile(`public/assets/fonts/${name}`, "utf8"),
      /SIL OPEN FONT LICENSE/i,
    );
});
test("large bold coral CTA and normal supporting copy meet their text contrast thresholds", () => {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const contrast = (first: string, second: string) =>
    (Math.max(luminance(first), luminance(second)) + 0.05) /
    (Math.min(luminance(first), luminance(second)) + 0.05);
  assert.ok(contrast("#252A76", "#EF7564") >= 3);
  assert.ok(contrast("#686774", "#FFFDFB") >= 4.5);
  assert.ok(contrast("#686774", "#F8F5F2") >= 4.5);
});
