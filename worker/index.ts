/** Spark deployment: web, same-domain Auth helper and data API on Workers. */
import handler from "vinext/server/app-router-entry";
import { createSparkApi } from "./spark-api";
import type { SparkEnv } from "./firestore-rest";
interface Env extends SparkEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  FIREBASE_AUTH_HELPER_HOST?: string;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const settings = {
        ...env,
        FIREBASE_PROJECT_ID:
          env.FIREBASE_PROJECT_ID ?? import.meta.env.VITE_FIREBASE_PROJECT_ID,
        FIREBASE_WEB_API_KEY:
          env.FIREBASE_WEB_API_KEY ?? import.meta.env.VITE_FIREBASE_API_KEY,
      };
      if (
        !settings.FIREBASE_PROJECT_ID ||
        !settings.FIREBASE_WEB_API_KEY ||
        !settings.FIREBASE_SERVICE_ACCOUNT
      )
        return Response.json(
          {
            code: "SERVICE_NOT_CONFIGURED",
            error: "서비스 연결을 준비 중입니다.",
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      return createSparkApi(settings)(request);
    }
    if (url.pathname.startsWith("/__/auth/")) {
      // Firebase's documented same-domain reverse proxy for mobile redirect/storage restrictions.
      const host = env.FIREBASE_AUTH_HELPER_HOST;
      if (!host || !/^[a-z0-9-]+\.firebaseapp\.com$/.test(host))
        return new Response("Authentication helper is not configured.", {
          status: 503,
        });
      if (!["GET", "HEAD", "POST"].includes(request.method))
        return new Response("Method not allowed.", { status: 405 });
      const target = new URL(url.pathname + url.search, `https://${host}`);
      const forwarded = new Request(target, request);
      forwarded.headers.delete("authorization");
      forwarded.headers.delete("cookie");
      return fetch(forwarded);
    }
    return handler.fetch(request, env, ctx);
  },
};
export default worker;
