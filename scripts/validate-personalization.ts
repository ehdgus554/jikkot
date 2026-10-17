import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { catalog } from "../lib/personalization/catalog";
import patterns from "../lib/personalization/source-patterns.json";
assert.equal(catalog.length, 74);
assert.equal(new Set(catalog.map((c) => c.catalogId)).size, 74);
assert.equal(patterns.length, 21);
for (const item of catalog) {
  assert.ok(item.steps.length > 0);
  assert.equal(item.media.sha256, item.imageSha256);
  assert.match(
    item.imageFileName,
    new RegExp(`^\\d{3}_${item.catalogId}_(male|female)\\.png$`),
  );
  if (item.media.installed) {
    const path = "public" + item.media.path;
    assert.ok((await stat(path)).isFile());
    assert.equal(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
      item.imageSha256,
    );
  }
  if (!item.old) assert.equal(item.publicationApproval, "draft");
}
assert.equal(catalog.find((c) => c.catalogId === "D31")!.pose, "unconfirmed");
const installed = catalog.filter((c) => c.media.installed).length;
console.log(
  JSON.stringify({
    registered: 74,
    existing: catalog.filter((c) => c.old).length,
    draft: catalog.filter((c) => !c.old).length,
    newOriginalsVerified: installed,
    missingOriginals: 74 - installed,
    unconfirmedDosage: catalog.filter((c) => !c.old?.dose).length,
  }),
);
if (process.argv.includes("--require-originals"))
  assert.equal(
    installed,
    74,
    "Original ZIP files must be supplied and validated",
  );
