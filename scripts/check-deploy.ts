import { loadEnv } from "vite";
const env = loadEnv("production", process.cwd(), "VITE_");
if (process.env.JIKKOT_LOCAL_WORKER === "true")
  throw new Error("로컬 Worker 에뮬레이터 빌드는 배포할 수 없습니다.");
if (
  !env.VITE_FIREBASE_API_KEY ||
  !env.VITE_FIREBASE_PROJECT_ID ||
  !env.VITE_API_URL
)
  throw new Error("운영/미리보기 Firebase 환경변수를 먼저 설정해주세요.");
if (
  env.VITE_USE_FIREBASE_EMULATORS === "true" ||
  env.VITE_FIREBASE_PROJECT_ID.startsWith("demo-") ||
  !env.VITE_API_URL.startsWith("https://")
)
  throw new Error(
    "에뮬레이터 설정은 배포할 수 없습니다. 별도 미리보기/운영 Firebase 설정을 사용해주세요.",
  );
console.log("PASS: deployment uses configured non-emulator Firebase endpoints");
