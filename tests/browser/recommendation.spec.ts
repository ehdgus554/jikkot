import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  readFileSync("lib/personalization/release/asset-manifest.json", "utf8"),
).runtimeImages as { path: string; sha256: string }[];
test("all 75 independent movement images and 8 UI images are exact versioned assets", async ({
  request,
}) => {
  for (const m of manifest) {
    const r = await request.get(
      "/assets/jikkot-release/2026-10-17/" + m.path.replace(/^assets\//, ""),
    );
    expect(r.status()).toBe(200);
    expect(
      createHash("sha256")
        .update(await r.body())
        .digest("hex"),
    ).toBe(m.sha256);
  }
});
test("unauthenticated clients cannot reach personal records or protected review metadata", async ({
  request,
}) => {
  for (const path of ["/api/personalization/records", "/api/review/catalog"])
    expect((await request.get("http://127.0.0.1:5002" + path)).status()).toBe(
      401,
    );
});
