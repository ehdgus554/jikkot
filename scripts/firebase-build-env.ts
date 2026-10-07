import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";
import { deploymentMode, publicFirebaseKeys } from "../lib/service/deployment";
export function firebaseBuildEnv(mode: string, root = process.cwd()) {
  const env = loadEnv(mode, root, "VITE_");
  const file = path.join(root, "config/firebase-web.json");
  if (
    mode !== "production" ||
    publicFirebaseKeys.some((key) => Boolean(env[key])) ||
    !existsSync(file)
  )
    return env;
  const saved = JSON.parse(readFileSync(file, "utf8"));
  const keys = [...publicFirebaseKeys, "VITE_USE_FIREBASE_EMULATORS"];
  const result: Record<string, string> = {};
  for (const key of keys)
    if (typeof saved[key] === "string") result[key] = saved[key];
  if (deploymentMode(result) !== "connected")
    throw new Error("공개 Firebase 빌드 설정은 실제 연결값 전체가 필요합니다.");
  return result;
}
