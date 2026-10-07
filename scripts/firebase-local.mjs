import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
const root = process.cwd();
const build = spawnSync("npm", ["--prefix", "functions", "run", "build"], {
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);
const command = process.argv[2] ?? "start";
if (!["start", "exec"].includes(command))
  throw new Error("Expected start or exec");
const env = {
  ...process.env,
  XDG_CONFIG_HOME: path.join(root, ".firebase/config"),
  FIREBASE_EMULATORS_PATH: path.join(root, ".firebase/emulators"),
};
const args = [
  path.join(root, "node_modules/firebase-tools/lib/bin/firebase.js"),
  `emulators:${command}`,
  "--project",
  "demo-jikkot",
  "--only",
  "auth,firestore,functions",
];
if (command === "exec") args.push("npm run test:integration");
const child = spawn(process.execPath, args, { stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 130 : 1)));
