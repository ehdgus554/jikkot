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
    "사용법: npm run firebase:connect -- --project <프로젝트ID> --site https://<실제사이트주소> [--deploy] [--prepare-worker-key]",
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
if (args.includes("--deploy") || args.includes("--prepare-worker-key")) {
  const account = spawnSync(
    "gcloud",
    ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"],
    { encoding: "utf8" },
  );
  if (account.status !== 0 || !account.stdout?.trim())
    throw new Error("Google 계정에 로그인한 Cloud Shell에서 실행해주세요.");
  gcloud([
    "services",
    "enable",
    "iam.googleapis.com",
    "firestore.googleapis.com",
  ]);
  const runtime = connection.server.API_SERVICE_ACCOUNT;
  const existing = spawnSync(
    "gcloud",
    ["iam", "service-accounts", "describe", runtime, "--project", project],
    { encoding: "utf8" },
  );
  if (existing.status !== 0) {
    if (!/NOT_FOUND|not found|does not exist/i.test(existing.stderr ?? ""))
      throw new Error("서버 서비스 계정 접근 권한을 확인해주세요.");
    gcloud([
      "iam",
      "service-accounts",
      "create",
      "jikkot-api",
      "--display-name=Jikkot Worker Firestore access",
    ]);
  }
  gcloud([
    "projects",
    "add-iam-policy-binding",
    project,
    "--member",
    `serviceAccount:${runtime}`,
    "--role",
    "roles/datastore.user",
    "--condition=None",
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
  FIREBASE_PROJECT_ID: connection.server.FIREBASE_PROJECT_ID,
  FIREBASE_WEB_API_KEY: connection.server.FIREBASE_WEB_API_KEY,
  ALLOWED_ORIGINS: connection.server.ALLOWED_ORIGINS,
};
// Produce every file only after authenticated config and origin validation succeeds.
await updateEnv(".env.production.local", connection.browser);
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
console.log("Firebase Spark 웹 설정과 Cloudflare Worker 공개 설정 생성 완료.");
console.log(
  "Cloudflare 빌드 변수에 outputs/firebase-cloudflare.env의 공개 설정을 등록하고 빌드 명령은 npm run build를 사용하세요.",
);
if (args.includes("--prepare-worker-key")) {
  const keyFile = path.resolve("outputs/firebase-worker-service-account.json");
  const { existsSync, chmodSync } = await import("node:fs");
  if (!existsSync(keyFile)) {
    gcloud([
      "iam",
      "service-accounts",
      "keys",
      "create",
      keyFile,
      "--iam-account",
      connection.server.API_SERVICE_ACCOUNT,
    ]);
  }
  chmodSync(keyFile, 0o600);
  const account = JSON.parse(await readFile(keyFile, "utf8"));
  if (
    account.type !== "service_account" ||
    account.project_id !== project ||
    account.client_email !== connection.server.API_SERVICE_ACCOUNT
  )
    throw new Error(
      "기존 서버 키가 지정한 프로젝트/계정과 다릅니다. Cloudflare에 등록하지 말고 파일을 확인해주세요.",
    );
  console.log(
    "서버 키는 outputs/firebase-worker-service-account.json에 저장했습니다. 채팅이나 Git에 넣지 말고 Cloudflare Worker의 FIREBASE_SERVICE_ACCOUNT 암호화 secret에만 등록하세요.",
  );
}
if (args.includes("--deploy")) {
  const deploy = spawnSync(
    process.execPath,
    [
      cli,
      "deploy",
      "--only",
      "firestore:rules,firestore:indexes",
      "--project",
      project,
      "--non-interactive",
    ],
    { stdio: "inherit" },
  );
  process.exitCode = deploy.status ?? 1;
} else
  console.log(
    "Spark 설정 생성 완료. rules/indexes 배포에는 --deploy, Cloudflare용 서버 키 생성에는 --prepare-worker-key를 추가하세요. Firebase Functions와 SMS는 사용하지 않습니다.",
  );
