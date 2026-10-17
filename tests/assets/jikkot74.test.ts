import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import manifest from "../../lib/personalization/media-manifest.json";
import source from "../../lib/personalization/source-catalog.json";
test("all 74 new original PNGs match CSV IDs, hashes, dimensions and alpha-bearing format", async () => {
  const csv = JSON.parse(
    await readFile("docs/jikkot74-csv-mapping.json", "utf8"),
  );
  assert.equal(Object.keys(csv).length, 74);
  assert.equal(new Set(manifest.map((x) => x.catalogId)).size, 74);
  assert.equal(
    (await readdir("public/assets/jikkot74")).filter((x) => x.endsWith(".png"))
      .length,
    74,
  );
  for (const m of manifest) {
    assert.equal(m.installed, true);
    const png = await readFile("public" + m.path);
    assert.equal(
      createHash("sha256").update(png).digest("hex"),
      m.sha256,
      m.catalogId,
    );
    assert.equal(png.readUInt32BE(16), m.width);
    assert.equal(png.readUInt32BE(20), m.height);
    assert.ok([4, 6].includes(png[25]));
    assert.equal(
      source.find((x) => x.catalogId === m.catalogId)!.imageSha256,
      m.sha256,
    );
  }
});
