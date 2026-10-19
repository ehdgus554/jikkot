import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSparkApi } from "../../worker/spark-api";
import { FirestoreRest } from "../../worker/firestore-rest";
import { emulatorIdentity } from "../../scripts/spark-emulator-identity";
import {
  inputSchema,
  type SessionInput,
} from "../../lib/personalization/types";
export const env = {
  FIREBASE_PROJECT_ID: "demo-jikkot",
  FIREBASE_WEB_API_KEY: "demo-key",
  DEPLOYMENT_STAGE: "review",
  REVIEW_ENABLED: "true",
  AI_ENABLED: "false",
  GROWTH_ENABLED: "false",
};
export const db = new FirestoreRest(env, "http://127.0.0.1:8080");
export const consents = {
  privacy: true,
  healthPersonalization: true,
  nonMedical: true,
  version: "2026-10-19",
};
export function client(allowed = "") {
  const api = createSparkApi(
    { ...env, REVIEW_ALLOWED_UIDS: allowed },
    undefined,
    { db, verify: emulatorIdentity },
  );
  return async (path: string, token?: string, body?: unknown) => {
    const r = await api(
      new Request("https://test.example/api" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    return { status: r.status, body: await r.json() };
  };
}
export async function identity(kind: "guest" | "member" | "google" = "member") {
  const suffix = randomUUID().slice(0, 8),
    email = "release-" + suffix + "@example.test",
    password = "LocalTest123!";
  let body: unknown = {
    ...(kind === "guest" ? {} : { email, password }),
    returnSecureToken: true,
  };
  let method = "signUp";
  if (kind === "google") {
    method = "signInWithIdp";
    const jwt =
      Buffer.from('{"alg":"none"}').toString("base64url") +
      "." +
      Buffer.from(
        JSON.stringify({ sub: suffix, email, name: "Unconfirmed Google name" }),
      ).toString("base64url") +
      ".";
    body = {
      requestUri: "http://127.0.0.1:5173",
      postBody: new URLSearchParams({
        providerId: "google.com",
        id_token: jwt,
      }).toString(),
      returnSecureToken: true,
    };
  }
  const response = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${method}?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  assert.equal(response.status, 200);
  return { ...(await response.json()), email, password, suffix } as {
    localId: string;
    idToken: string;
    email: string;
    password: string;
    suffix: string;
  };
}
export async function member() {
  const u = await identity();
  assert.equal(
    (
      await client()("/signup", u.idToken, {
        nickname: "회원" + u.suffix,
        consents,
      })
    ).status,
    200,
  );
  return u;
}
export const daily = (patch: Partial<SessionInput> = {}) =>
  inputSchema.parse({
    purpose: "daily",
    flowVersion:
      patch.purpose && patch.purpose !== "daily"
        ? undefined
        : "daily-four-2026-10-19",
    area: "back",
    habits: ["retract"],
    current: ["recent_immobile"],
    poses: ["chair"],
    supports: [],
    confirmedAt: Date.now(),
    ...patch,
  });
export async function create(
  call: ReturnType<typeof client>,
  u: { idToken: string },
  input = daily(),
) {
  const id = randomUUID();
  const r = await call("/personalization/sessions", u.idToken, {
    sessionId: id,
    input,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
