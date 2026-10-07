import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { parse, type ParseError } from "jsonc-parser";
import {
  firebaseConnection,
  firebaseSiteOrigin,
} from "../lib/service/firebase-connection";
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const project = option("--project"),
  site = option("--site");
if (!project || !site)
  throw new Error(
    "사용법: npm run firebase:connect -- --project <프로젝트ID> --site https://<실제사이트주소> [--deploy]",
  );
if (
  !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) ||
  project.startsWith("demo-")
)
  throw new Error("실제 Firebase 프로젝트 ID가 필요합니다.");
firebaseSiteOrigin(site);
const cli = path.resolve("node_modules/firebase-tools/lib/bin/firebase.js");
function firebase(command: string[]) {
  const result = spawnSync(
    process.execPath,
    [cli, ...command, "--project", project!, "--non-interactive", "--json"],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      "Firebase 접근에 실패했습니다. 먼저 본인 계정으로 npx firebase login을 실행하고 프로젝트 접근 권한을 확인해주세요.",
    );
  try {
    return JSON.parse(result.stdout).result;
  } catch {
    throw new Error(
      "Firebase CLI 응답을 확인하지 못했습니다. 설정 파일은 작성하지 않았습니다.",
    );
  }
}
const apps = firebase(["apps:list", "WEB"]);
if (!Array.isArray(apps))
  throw new Error("Firebase 웹 앱 목록을 확인하지 못했습니다.");
let appId = option("--app");
if (!appId) {
  if (apps.length > 1)
    throw new Error("웹 앱이 여러 개입니다. --app <웹앱ID>를 지정해주세요.");
  appId =
    apps.length === 1
      ? apps[0].appId
      : firebase(["apps:create", "WEB", "jikkot-web"]).appId;
}
const data = firebase(["apps:sdkconfig", "WEB", appId!]);
const config = data.sdkConfig;
if (config?.projectId !== project)
  throw new Error("Firebase 웹 앱과 지정한 프로젝트가 다릅니다.");
const connection = firebaseConnection(config, site);
function gcloud(command: string[]) {
  const result = spawnSync(
    "gcloud",
    [...command, "--project", project!, "--quiet"],
    { stdio: "inherit" },
  );
  if (result.status !== 0)
    throw new Error(
      "Google Cloud 권한 준비에 실패했습니다. 본인 계정의 Cloud Shell과 프로젝트 권한을 확인해주세요.",
    );
}
if (args.includes("--deploy")) {
  const account = spawnSync(
    "gcloud",
    ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"],
    { encoding: "utf8" },
  );
  const email = account.stdout?.trim();
  if (account.status !== 0 || !email || !/^[^\s@]+@[^\s@]+$/.test(email))
    throw new Error(
      "--deploy는 Google 계정에 로그인한 Cloud Shell에서 실행해주세요.",
    );
  gcloud([
    "services",
    "enable",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
  ]);
  const runtime = connection.server.API_SERVICE_ACCOUNT;
  const existing = spawnSync(
    "gcloud",
    ["iam", "service-accounts", "describe", runtime, "--project", project],
    { encoding: "utf8" },
  );
  if (existing.status !== 0) {
    if (!/NOT_FOUND|not found|does not exist/i.test(existing.stderr ?? ""))
      throw new Error("런타임 서비스 계정 접근 권한을 확인해주세요.");
    gcloud([
      "iam",
      "service-accounts",
      "create",
      "jikkot-api",
      "--display-name=Jikkot API runtime",
    ]);
  }
  for (const role of ["roles/firebaseauth.admin", "roles/datastore.user"])
    gcloud([
      "projects",
      "add-iam-policy-binding",
      project!,
      "--member",
      `serviceAccount:${runtime}`,
      "--role",
      role,
      "--condition=None",
    ]);
  gcloud([
    "iam",
    "service-accounts",
    "add-iam-policy-binding",
    runtime,
    "--member",
    `serviceAccount:${runtime}`,
    "--role",
    "roles/iam.serviceAccountTokenCreator",
  ]);
  gcloud([
    "iam",
    "service-accounts",
    "add-iam-policy-binding",
    runtime,
    "--member",
    `${email.endsWith(".gserviceaccount.com") ? "serviceAccount" : "user"}:${email}`,
    "--role",
    "roles/iam.serviceAccountUser",
  ]);
}
async function updateEnv(filename: string, values: Record<string, string>) {
  let text = "";
  try {
    text = await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const keys = new Set(Object.keys(values));
  const lines = text
    .split("\n")
    .filter((line) => !keys.has(line.match(/^([A-Z0-9_]+)=/)?.[1] ?? ""));
  await writeFile(
    filename,
    lines.join("\n").trimEnd() +
      "\n" +
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") +
      "\n",
    { mode: 0o600 },
  );
}
const configErrors: ParseError[] = [];
const worker = parse(await readFile("wrangler.jsonc", "utf8"), configErrors, {
  allowTrailingComma: true,
});
if (configErrors.length)
  throw new Error(
    "wrangler.jsonc를 해석하지 못했습니다. 설정 파일은 작성하지 않았습니다.",
  );
worker.vars = {
  ...worker.vars,
  FIREBASE_AUTH_HELPER_HOST: connection.helperHost,
};
// Produce every file only after authenticated config and origin validation succeeds.
await updateEnv(".env.production.local", connection.browser);
await updateEnv(`functions/.env.${project}`, connection.server);
await writeFile("wrangler.jsonc", JSON.stringify(worker, null, 2) + "\n");
await mkdir("outputs", { recursive: true });
await writeFile(
  "outputs/firebase-cloudflare.env",
  Object.entries(connection.browser)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
await writeFile(
  "outputs/firebase-public-settings.json",
  JSON.stringify(connection.browser, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(
  "Firebase 웹 설정, Functions 공개 설정, Cloudflare Auth helper 설정 생성 완료.",
);
console.log(
  "Cloudflare 빌드 변수에 outputs/firebase-cloudflare.env의 공개 설정을 등록하고 빌드 명령은 npm run build를 사용하세요.",
);
if (args.includes("--deploy")) {
  const installed = spawnSync("npm", ["--prefix", "functions", "ci"], {
    stdio: "inherit",
  });
  if (installed.status !== 0) process.exit(installed.status ?? 1);
  const deploy = spawnSync(
    process.execPath,
    [
      cli,
      "deploy",
      "--only",
      "firestore:rules,firestore:indexes,functions",
      "--project",
      project,
      "--non-interactive",
    ],
    { stdio: "inherit" },
  );
  process.exitCode = deploy.status ?? 1;
} else
  console.log(
    `권한 준비 및 서버 배포: 같은 연결 명령에 --deploy를 추가해 본인 계정의 Cloud Shell에서 실행하세요 (프로젝트 ${project}).`,
  );
