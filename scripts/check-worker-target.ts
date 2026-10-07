import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
const expected = process.argv[2];
const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
if (config.name !== expected)
  throw new Error(
    `Worker target mismatch: expected ${expected}; build selected ${config.name}`,
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
console.log(`PASS: deployment targets ${expected}`);
