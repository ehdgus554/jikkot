export const publicFirebaseKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_API_URL",
] as const;

/** Empty configuration opens a clearly labelled local preview; unsafe live configuration fails. */
export function deploymentMode(
  env: Record<string, string | undefined>,
  preparation = false,
) {
  if (preparation) return "preparation" as const;
  const present = publicFirebaseKeys.filter((key) => Boolean(env[key]?.trim()));
  if (present.length === 0 && env.VITE_USE_FIREBASE_EMULATORS !== "true")
    return "preview" as const;
  const missing = publicFirebaseKeys.filter((key) => !env[key]?.trim());
  if (missing.length)
    throw new Error(
      `Firebase 설정이 일부만 입력됐습니다. 누락: ${missing.join(", ")}. 미리보기는 전체 설정을 비우세요. 준비 화면은 npm run build:preparation으로 빌드하세요.`,
    );
  let api: URL;
  try {
    api = new URL(env.VITE_API_URL!);
  } catch {
    throw new Error("VITE_API_URL은 유효한 HTTPS URL이어야 합니다.");
  }
  if (
    env.VITE_USE_FIREBASE_EMULATORS === "true" ||
    env.VITE_FIREBASE_PROJECT_ID!.startsWith("demo-") ||
    api.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)
  )
    throw new Error(
      "에뮬레이터 설정은 배포할 수 없습니다. 별도 미리보기/운영 Firebase 설정을 사용해주세요.",
    );
  return "connected" as const;
}
