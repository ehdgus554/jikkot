/** Web serving and same-domain Firebase Auth helper only. Data APIs stay in Functions. */
import handler from "vinext/server/app-router-entry";
interface Env {
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
