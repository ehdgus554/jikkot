type WebConfig = {
  projectId: string;
  apiKey: string;
  appId: string;
  authDomain: string;
};
export function firebaseConnection(config: WebConfig, site: string) {
  if (
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId) ||
    config.projectId.startsWith("demo-")
  )
    throw new Error(
      "실제 Firebase 프로젝트 ID를 입력해주세요. demo 프로젝트는 운영 연결할 수 없습니다.",
    );
  for (const value of [config.apiKey, config.appId, config.authDomain])
    if (typeof value !== "string" || !value || /[\s\r\n]/.test(value))
      throw new Error("Firebase 웹 설정값을 확인해주세요.");
  if (config.authDomain !== `${config.projectId}.firebaseapp.com`)
    throw new Error("웹 앱과 프로젝트의 authDomain이 일치하지 않습니다.");
  const url = firebaseSiteOrigin(site);
  const api = `https://asia-northeast3-${config.projectId}.cloudfunctions.net/api`;
  return {
    browser: {
      VITE_FIREBASE_API_KEY: config.apiKey,
      VITE_FIREBASE_AUTH_DOMAIN: url.hostname,
      VITE_FIREBASE_PROJECT_ID: config.projectId,
      VITE_FIREBASE_APP_ID: config.appId,
      VITE_API_URL: api,
      VITE_USE_FIREBASE_EMULATORS: "false",
    },
    server: {
      FIREBASE_WEB_API_KEY: config.apiKey,
      ALLOWED_ORIGINS: url.origin,
      PUBLIC_API_URL: api,
      API_SERVICE_ACCOUNT: `jikkot-api@${config.projectId}.iam.gserviceaccount.com`,
    },
    helperHost: config.authDomain,
  };
}
export function firebaseSiteOrigin(site: string) {
  const url = new URL(site);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("실제 사이트의 HTTPS origin만 입력해주세요.");
  return url;
}
