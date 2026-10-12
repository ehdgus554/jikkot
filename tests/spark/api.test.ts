import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSparkApi, verifyFirebaseToken } from "../../worker/spark-api";
import {
  FirestoreRest,
  fields,
  encode,
  decode,
} from "../../worker/firestore-rest";
import { emulatorIdentity } from "../../scripts/spark-emulator-identity";
const env = {
  FIREBASE_PROJECT_ID: "demo-jikkot",
  FIREBASE_WEB_API_KEY: "demo-key",
};
const db = new FirestoreRest(env, "http://127.0.0.1:8080");
const api = createSparkApi(env, undefined, { db, verify: emulatorIdentity });
const consents = { privacy: true, nonMedical: true, version: "draft-v1" };
const answers = {
  mode: "seated",
  area: "neck_trapezius",
  habits: ["H_SHRUG", "H_SIDE_SCREEN", "H_CARRY"],
  recent: ["R_HEAD_TURN", "R_HOLD_LOAD", "R_COMPUTER_BOTH"],
};
async function identity(email?: string) {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(email ? { email, password: "password12345" } : {}),
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(response.status, 200);
  return response.json();
}
async function call(path: string, token?: string, body?: unknown) {
  const response = await api(
    new Request("https://test.example/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return { status: response.status, body: await response.json() };
}
test("Firestore REST codecs preserve nested snapshots and timestamps", () => {
  const value = {
    text: "한글",
    list: [1, false, null],
    nested: { at: new Date("2026-10-07T00:00:00Z") },
  };
  assert.deepEqual(decode(encode(value)), value);
  assert.equal(fields({ empty: [] }).empty.arrayValue?.values?.length, 0);
});
test("Spark email signup enforces consent, atomic uniqueness, owner isolation and feedback idempotency", async () => {
  const suffix = randomUUID().slice(0, 8);
  const a = await identity(`spark-${suffix}@example.test`),
    b = await identity(`other-${suffix}@example.test`);
  assert.equal(
    (
      await call("/signup", a.idToken, {
        username: "s_" + suffix,
        nickname: "s_" + suffix,
        consents: { ...consents, privacy: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/recommendations", a.idToken, {
        recommendationId: randomUUID(),
        answers,
      })
    ).status,
    403,
  );
  const payload = {
    username: "s_" + suffix,
    nickname: "s_" + suffix,
    consents,
  };
  const results = await Promise.all([
    call("/signup", a.idToken, payload),
    call("/signup", b.idToken, payload),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = results[0].status === 200 ? a : b,
    other = winner === a ? b : a;
  assert.equal((await call("/me", winner.idToken)).body.kind, "member");
  const rid = randomUUID(),
    sid = randomUUID();
  assert.equal(
    (
      await call("/recommendations", winner.idToken, {
        recommendationId: rid,
        answers,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`/recommendations/${rid}`, other.idToken)).status,
    403,
  );
  const feedback = {
    recommendationId: rid,
    submissionId: sid,
    feedback: "better",
  };
  assert.equal((await call("/feedback", winner.idToken, feedback)).status, 200);
  assert.equal((await call("/feedback", winner.idToken, feedback)).status, 200);
  assert.equal(
    (
      await call("/feedback", winner.idToken, {
        ...feedback,
        feedback: "worse",
      })
    ).status,
    409,
  );
  const records = await call("/records", winner.idToken);
  assert.equal(records.status, 200);
  assert.equal(records.body.records.length, 1);
  assert.equal(records.body.records[0].id, sid);
  assert.equal(
    (
      await call("/next", winner.idToken, {
        recommendationId: rid,
        nextRecommendationId: randomUUID(),
        changes: [],
      })
    ).status,
    200,
  );
});
test("Spark guests require consent and consume a KST day only once under concurrent requests", async () => {
  const user = await identity();
  assert.equal((await call("/eligibility", user.idToken)).status, 403);
  assert.equal(
    (
      await call("/guest/consent", user.idToken, {
        nonMedical: true,
        version: "draft-v1",
      })
    ).status,
    200,
  );
  const results = await Promise.all([
    call("/recommendations", user.idToken, {
      recommendationId: randomUUID(),
      answers,
    }),
    call("/recommendations", user.idToken, {
      recommendationId: randomUUID(),
      answers,
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await call("/eligibility", user.idToken)).body.allowed, false);
  assert.equal((await call("/records", user.idToken)).status, 403);
});
test("production verification rejects unsigned emulator proofs, and API rejects malformed or cross-origin requests", async () => {
  const user = await identity();
  await assert.rejects(
    verifyFirebaseToken(user.idToken, {
      FIREBASE_PROJECT_ID: "jikkot",
      FIREBASE_WEB_API_KEY: "public-key",
    }),
  );
  assert.equal((await call("/me", "forged-token")).status, 401);
  assert.equal(
    (
      await api(
        new Request("https://test.example/api/me", {
          headers: { Origin: "https://attacker.example" },
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await api(
        new Request("https://test.example/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
      )
    ).status,
    400,
  );
});
test("Google signup requires profile consent and never inherits a password profile through provider switching", async () => {
  const suffix = randomUUID().slice(0, 8);
  const claims = {
    sub: "spark-google-" + suffix,
    email: `google-${suffix}@example.test`,
    email_verified: true,
    name: "Google test",
  };
  const jwt =
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url") +
    "." +
    Buffer.from(JSON.stringify(claims)).toString("base64url") +
    ".";
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestUri: "http://127.0.0.1:5173",
        postBody: new URLSearchParams({
          providerId: "google.com",
          id_token: jwt,
        }).toString(),
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(response.status, 200);
  const google = await response.json();
  assert.equal((await call("/me", google.idToken)).body.kind, "pending");
  assert.equal((await call("/records", google.idToken)).status, 403);
  assert.equal(
    (
      await call("/social/activate", google.idToken, {
        nickname: "g_" + suffix,
        consents: { ...consents, nonMedical: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/social/activate", google.idToken, {
        nickname: "g_" + suffix,
        consents,
      })
    ).status,
    200,
  );
  assert.equal((await call("/me", google.idToken)).body.kind, "member");
  const wrongProviderApi = createSparkApi(env, undefined, {
    db,
    verify: async () => ({
      uid: google.localId,
      email: claims.email,
      auth_time: Date.now() / 1000,
      firebase: { sign_in_provider: "password" },
    }),
  });
  const denied = await wrongProviderApi(
    new Request("https://test.example/api/records", {
      headers: { Authorization: "Bearer test-proof" },
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "LOGIN_METHOD_MISMATCH");
});
test("new snapshots and alternatives retain approved version/area and atomically preserve completed records", async () => {
  const suffix = randomUUID().slice(0, 8),
    user = await identity(`alternate-${suffix}@example.test`);
  assert.equal(
    (
      await call("/signup", user.idToken, {
        username: "alt_" + suffix,
        nickname: "alt_" + suffix,
        consents,
      })
    ).status,
    200,
  );
  const rid = randomUUID(),
    sid = randomUUID(),
    nid = randomUUID();
  const primary = await call("/recommendations", user.idToken, {
    recommendationId: rid,
    answers,
  });
  assert.equal(primary.status, 200);
  assert.equal(primary.body.snapshot.contentVersion, "jikkot11-v1");
  assert.equal(primary.body.snapshot.routine.id, "jikkot11-r03");
  assert.deepEqual(primary.body.snapshot.matchedRecentActionIds, [
    "R_HEAD_TURN",
  ]);
  assert.deepEqual(primary.body.snapshot.matchedHabitIds, []);
  assert.equal(
    (
      await call("/feedback", user.idToken, {
        recommendationId: rid,
        submissionId: sid,
        feedback: "same",
      })
    ).status,
    200,
  );
  const payload = {
    recommendationId: rid,
    nextRecommendationId: nid,
    changes: [],
  };
  const next = await call("/next", user.idToken, payload);
  assert.equal(next.status, 200);
  assert.equal(next.body.recommendation.snapshot.routine.id, "jikkot11-r08");
  assert.equal(next.body.recommendation.snapshot.area.id, "neck_trapezius");
  assert.equal(next.body.recommendation.snapshot.contentVersion, "jikkot11-v1");
  assert.equal(next.body.recommendation.snapshot.routine.steps.length, 2);
  assert.equal(
    (await call("/next", user.idToken, payload)).body.recommendation
      .recommendationId,
    nid,
  );
  assert.equal(
    (
      await call("/next", user.idToken, {
        ...payload,
        nextRecommendationId: randomUUID(),
      })
    ).status,
    409,
  );
  const records = await call("/records", user.idToken);
  assert.equal(records.body.records.length, 1);
  assert.equal(records.body.records[0].snapshot.routine.id, "jikkot11-r03");
  assert.deepEqual(next.body.recommendation.visitedRoutineIds, [
    "jikkot11-r03",
    "jikkot11-r08",
  ]);
  assert.equal(
    (
      await call("/feedback", user.idToken, {
        recommendationId: nid,
        submissionId: randomUUID(),
        feedback: "worse",
      })
    ).status,
    200,
  );
  const finalId = randomUUID();
  const final = await call("/next", user.idToken, {
    recommendationId: nid,
    nextRecommendationId: finalId,
    changes: [],
  });
  assert.equal(final.body.recommendation.snapshot.routine.id, "jikkot11-r07");
  assert.deepEqual(final.body.recommendation.visitedRoutineIds, [
    "jikkot11-r03",
    "jikkot11-r08",
    "jikkot11-r07",
  ]);
  assert.equal(
    (
      await call("/feedback", user.idToken, {
        recommendationId: finalId,
        submissionId: randomUUID(),
        feedback: "same",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/next", user.idToken, {
        recommendationId: finalId,
        nextRecommendationId: randomUUID(),
        changes: [],
      })
    ).body.recommendation,
    null,
  );
  const lower = {
    mode: "seated",
    area: "lower_back",
    habits: ["H_UNKNOWN"],
    recent: ["R_NONE"],
  };
  const lowerId = randomUUID();
  assert.equal(
    (
      await call("/recommendations", user.idToken, {
        recommendationId: lowerId,
        answers: lower,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/feedback", user.idToken, {
        recommendationId: lowerId,
        submissionId: randomUUID(),
        feedback: "worse",
      })
    ).status,
    200,
  );
  const noAlternative = await call("/next", user.idToken, {
    recommendationId: lowerId,
    nextRecommendationId: randomUUID(),
    changes: [],
  });
  assert.equal(noAlternative.status, 200);
  assert.equal(noAlternative.body.recommendation, null);
});
test("old saved records and old recommendation IDs remain snapshots, with no implicit new movement conversion", async () => {
  const suffix = randomUUID().slice(0, 8),
    user = await identity(`old-${suffix}@example.test`);
  assert.equal(
    (
      await call("/signup", user.idToken, {
        username: "old_" + suffix,
        nickname: "old_" + suffix,
        consents,
      })
    ).status,
    200,
  );
  const rid = randomUUID(),
    sid = randomUUID();
  const old = {
    contentVersion: "mvp-9.1-adapter-v1",
    area: { id: "NECK", label: "목" },
    routine: {
      id: "MV009",
      name: "어깨 올렸다 힘 빼며 내리기",
      image: "/assets/routines/R11.webp",
      dose: "3~5회",
    },
    habits: [],
    recent: [],
    answers: {
      mode: "seated",
      area: "NECK",
      habits: ["HB01"],
      recent: ["RA02"],
    },
    pattern: "NECK:0",
  };
  await db.doc(`profiles/${user.localId}/records/${sid}`).set({
    owner: user.localId,
    snapshot: old,
    feedback: "same",
    createdAt: Date.now(),
    changes: [],
  });
  await db.doc(`recommendations/${rid}`).set({
    owner: user.localId,
    kind: "member",
    recommendationId: rid,
    snapshot: old,
    submissionId: sid,
    feedback: "same",
  });
  const records = await call("/records", user.idToken);
  assert.deepEqual(records.body.records[0].snapshot, old);
  const next = await call("/next", user.idToken, {
    recommendationId: rid,
    nextRecommendationId: randomUUID(),
    changes: [],
  });
  assert.equal(next.status, 200);
  assert.equal(next.body.recommendation, null);
  assert.deepEqual(
    (await call("/records", user.idToken)).body.records[0].snapshot,
    old,
  );
});
