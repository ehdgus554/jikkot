import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { routines } from "../../app/jikkot-data";
const manifest = JSON.parse(
  await readFile("docs/jikkot11-image-manifest.json", "utf8"),
) as { number: number; target: string; sha256: string }[];
const hashes = new Map<string, number>();
for (const routine of routines)
  test(`approved original PNG ${routine.displayNumber}: ${routine.name}`, async () => {
    const file = path.join(process.cwd(), "public", routine.image);
    const bytes = await readFile(file);
    assert.equal(
      bytes.subarray(0, 8).toString("hex"),
      "89504e470d0a1a0a",
      "original PNG required",
    );
    assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const original = manifest.find(
      (image) => image.number === routine.displayNumber,
    )!;
    assert.equal(original.target, routine.image);
    assert.equal(
      hash,
      original.sha256,
      "source PNG bytes must be preserved unchanged",
    );
    assert.equal(
      hashes.has(hash),
      false,
      `duplicate guide reused for routines ${hashes.get(hash)} and ${routine.displayNumber}`,
    );
    hashes.set(hash, routine.displayNumber);
  });
