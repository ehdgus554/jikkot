import { firebaseBuildEnv } from "./firebase-build-env";
import { deploymentMode } from "../lib/service/deployment";
if (process.env.JIKKOT_LOCAL_WORKER === "true")
  throw new Error("로컬 Worker 에뮬레이터 빌드는 배포할 수 없습니다.");
const mode = deploymentMode(
  firebaseBuildEnv("production"),
  process.env.JIKKOT_PREPARATION === "true",
);
console.log(
  mode === "preparation"
    ? "PASS: preparation page deployment; sign-in and recommendations remain unavailable until Firebase is connected"
    : mode === "preview"
      ? "PASS: public preview; questionnaire and routine browsing only, without accounts or cloud storage"
      : "PASS: deployment uses configured non-emulator Firebase endpoints",
);
