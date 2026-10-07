import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
// Workers Builds supplies the name of the linked Worker (jikkot). Keep a
// manually selected preview target explicit rather than silently overriding it.
const expected = process.argv[2];
const override = process.env.WRANGLER_CI_OVERRIDE_NAME;
const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
if (config.name !== expected && (!override || config.name !== override))
  throw new Error(
    `Worker target mismatch: expected ${expected}; build selected ${config.name}`,
  );
if (
  process.env.CLOUDFLARE_ENV === "preview" &&
  override &&
  override !== expected
)
  throw new Error(
    `Cloudflare linked Worker ${override} does not match the selected preview target ${expected}.`,
  );
async function verifyClient(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await verifyClient(filename);
    else if (
      entry.name.endsWith(".js") &&
      (await readFile(filename, "utf8")).includes("http://127.0.0.1:9099")
    )
      throw new Error(
        "Local Auth emulator connection is present in this bundle; rebuild for deployment.",
      );
  }
}
await verifyClient("dist/client");
console.log(
  `PASS: deployment targets ${override || expected} (build configuration: ${config.name})`,
);
