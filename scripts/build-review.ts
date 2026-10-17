import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "jsonc-parser";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("..", import.meta.url));
const configuration = parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
const target = configuration.env?.preview?.name;
if (target !== "jikkot-review")
  throw new Error(
    "The existing review Worker target must be selected explicitly",
  );
if (
  process.env.WRANGLER_CI_OVERRIDE_NAME &&
  process.env.WRANGLER_CI_OVERRIDE_NAME !== target
)
  throw new Error("The linked Worker differs from the review target");
const origin = new URL(
  process.env.JIKKOT_REVIEW_ORIGIN ??
    "https://jikkot-review.ehdgus554.workers.dev",
);
if (
  origin.protocol !== "https:" ||
  origin.hostname !== "jikkot-review.ehdgus554.workers.dev" ||
  origin.pathname !== "/"
)
  throw new Error("Use the existing HTTPS review origin");
const saved = JSON.parse(
  readFileSync(new URL("../config/firebase-web.json", import.meta.url), "utf8"),
);
if (
  process.env.JIKKOT_LOCAL_WORKER === "true" ||
  process.env.JIKKOT_PREPARATION === "true"
)
  throw new Error(
    "A local/preparation build cannot be deployed as a review workflow",
  );
const env = {
  ...saved,
  ...process.env,
  VITE_FIREBASE_AUTH_DOMAIN: origin.hostname,
  VITE_API_URL: origin.origin + "/api",
  VITE_USE_FIREBASE_EMULATORS: "false",
  CLOUDFLARE_ENV: "preview",
  JIKKOT_LOCAL_WORKER: "false",
};
function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: repo, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, ["--import", "tsx", "scripts/check-deploy.ts"]);
run(process.execPath, [
  "--import",
  "tsx",
  "scripts/validate-personalization.ts",
  "--require-originals",
]);
run("npm", ["run", "content:check"]);
run("npm", ["run", "build"]);
run(process.execPath, [
  "--import",
  "tsx",
  "scripts/check-worker-target.ts",
  target,
]);
if (process.argv.includes("--deploy"))
  run("npx", ["--no-install", "wrangler", "deploy"]);
