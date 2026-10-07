import { loadEnv } from "vite";
import { deploymentMode } from "../lib/service/deployment";
if (process.env.JIKKOT_LOCAL_WORKER === "true")
  throw new Error("로컬 Worker 에뮬레이터 빌드는 배포할 수 없습니다.");
const mode = deploymentMode(
  loadEnv("production", process.cwd(), "VITE_"),
  process.env.JIKKOT_PREPARATION === "true",
);
console.log(
  mode === "preparation"
    ? "PASS: preparation page deployment; sign-in and recommendations remain unavailable until Firebase is connected"
    : "PASS: deployment uses configured non-emulator Firebase endpoints",
);
