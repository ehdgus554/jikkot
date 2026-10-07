import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
const config = __JIKKOT_PREPARATION__
  ? {
      apiKey: undefined,
      authDomain: undefined,
      projectId: undefined,
      appId: undefined,
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
export const configured = Boolean(config.apiKey && config.projectId);
export const useEmulator =
  (import.meta.env.DEV || __JIKKOT_LOCAL_WORKER__) &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" &&
  config.projectId?.startsWith("demo-");
let auth: Auth | undefined;
export function firebaseAuth() {
  if (!configured)
    throw new Error("서비스 연결을 준비 중입니다. 잠시 후 다시 방문해주세요.");
  if (!auth) {
    const app = getApps()[0] ?? initializeApp(config);
    auth = getAuth(app);
    auth.languageCode = "ko";
    if (useEmulator)
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
  }
  return auth;
}
export const apiBase = __JIKKOT_PREPARATION__
  ? undefined
  : import.meta.env.VITE_API_URL;
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  authenticated = true,
): Promise<T> {
  if (!apiBase) throw new Error("서비스 연결을 준비 중입니다.");
  const token = authenticated
    ? await firebaseAuth().currentUser?.getIdToken()
    : null;
  const response = await fetch(`${apiBase}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.error ?? "요청을 완료하지 못했습니다.",
    ) as Error & { code: string };
    error.code = result.code;
    throw error;
  }
  return result;
}
