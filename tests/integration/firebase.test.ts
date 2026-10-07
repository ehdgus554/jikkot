import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
process.env.GCLOUD_PROJECT = "demo-jikkot";
process.env.FUNCTIONS_EMULATOR = "true";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const adminApp = initializeApp({ projectId: "demo-jikkot" }, "test-driver");
const db = getFirestore(adminApp);
const base = "http://127.0.0.1:5001/demo-jikkot/asia-northeast3/api";
const answers = {
  mode: "seated",
  area: "NECK",
  habits: ["HB01", "HB04", "HB05"],
  recent: ["RA02", "RA03", "RA06"],
};
async function authRequest(action: string, body: unknown) {
  const r = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${action}?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  assert.equal(r.status, 200, action);
  return r.json();
}
async function anon() {
  return authRequest("signUp", { returnSecureToken: true });
}
async function phone(
  phoneNumber = "+1650555" +
    String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
) {
  const sent = await authRequest("sendVerificationCode", {
    phoneNumber,
    recaptchaToken: "emulator-only",
  });
  const data = await (
    await fetch(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-jikkot/verificationCodes",
    )
  ).json();
  const code = data.verificationCodes.find(
    (c: { sessionInfo: string }) => c.sessionInfo === sent.sessionInfo,
  ).code;
  return authRequest("signInWithPhoneNumber", {
    sessionInfo: sent.sessionInfo,
    code,
  });
}
async function call(
  path: string,
  token?: string,
  body?: unknown,
  status = 200,
) {
  const r = await fetch(base + path, {
    headers: {
      Origin: "http://127.0.0.1:5173",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            Origin: "http://127.0.0.1:5173",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        }),
  });
  const payload = await r.json();
  assert.equal(
    r.status,
    status,
    `${path}: ${payload.code ?? "unexpected status"}`,
  );
  return payload;
}
async function signup() {
  const user = await phone();
  const suffix = randomUUID().slice(0, 8);
  const details = {
    username: "u_" + suffix,
    nickname: "n_" + suffix,
    email: `${suffix}@example.test`,
    password: randomUUID(),
    consents: { privacy: true, nonMedical: true, version: "draft-v1" },
  };
  await call("/signup", user.idToken, details);
  const credential = await call("/login", undefined, {
    username: details.username,
    password: details.password,
  });
  const logged = await authRequest("signInWithCustomToken", {
    token: credential.customToken,
    returnSecureToken: true,
  });
  return { ...logged, localId: user.localId, details };
}
before(async () => {
  assert.equal(adminApp.options.projectId, "demo-jikkot");
  await db.recursiveDelete(db.collection("rateLimits"));
});
after(async () => {
  await adminApp.delete();
});
test("guest consent, preflight, transaction race, restoration, feedback and guest/member boundaries", async () => {
  const g = await anon();
  await call("/eligibility", g.idToken, undefined, 403);
  await call("/guest/consent", g.idToken, {
    nonMedical: true,
    version: "draft-v1",
  });
  assert.equal((await call("/eligibility", g.idToken)).allowed, true);
  const ids = [randomUUID(), randomUUID()];
  const raced = await Promise.all(
    ids.map(async (recommendationId) => {
      const r = await fetch(base + "/recommendations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${g.idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recommendationId, answers }),
      });
      return { status: r.status, data: await r.json() };
    }),
  );
  assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
  const winning = raced.find((r) => r.status === 200)!.data;
  assert.equal((await call("/eligibility", g.idToken)).allowed, false);
  const retry = await call("/recommendations", g.idToken, {
    recommendationId: winning.recommendationId,
    answers,
  });
  assert.equal(retry.recommendationId, winning.recommendationId);
  await call("/recommendations/" + winning.recommendationId, g.idToken);
  const b = {
    recommendationId: winning.recommendationId,
    submissionId: randomUUID(),
    feedback: "same",
  };
  await Promise.all([
    call("/feedback", g.idToken, b),
    call("/feedback", g.idToken, b),
  ]);
  await call("/records", g.idToken, undefined, 403);
  await call(
    "/next",
    g.idToken,
    {
      recommendationId: b.recommendationId,
      nextRecommendationId: randomUUID(),
      changes: [],
    },
    403,
  );
  assert.equal(
    (await db.collection(`profiles/${g.localId}/records`).get()).size,
    0,
  );
  assert.equal(
    (await db.doc(`operations/${b.submissionId}`).get()).data().kind,
    "guest",
  );
  const other = await anon();
  await call(
    "/recommendations/" + winning.recommendationId,
    other.idToken,
    undefined,
    404,
  );
  await call("/feedback", other.idToken, b, 403);
});
test("phone-proof signup, private username password verification, recovery and per-feedback member history", async () => {
  const m = await signup();
  assert.equal((await call("/me", m.idToken)).kind, "member");
  await call(
    "/login",
    undefined,
    { username: m.details.username, password: "wrong-pass" },
    401,
  );
  for (let i = 0; i < 2; i++) {
    const recommendationId = randomUUID();
    await call("/recommendations", m.idToken, { recommendationId, answers });
    const submissionId = randomUUID();
    await call("/feedback", m.idToken, {
      recommendationId,
      submissionId,
      feedback: "better",
    });
    await call("/feedback", m.idToken, {
      recommendationId,
      submissionId,
      feedback: "better",
    });
  }
  const rows = (await call("/records", m.idToken)).records;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].snapshot.answers, answers);
  assert.equal(rows[0].snapshot.habits.length, 3);
  const other = await phone();
  await call("/recovery", other.idToken, { action: "username" }, 404);
  await call("/recovery", m.idToken, { action: "username" }, 403); // custom/password token is not recent phone proof
  const { getAuth } = require("firebase-admin/auth");
  const proof = await phone(
    (await getAuth(adminApp).getUser(m.localId)).phoneNumber,
  );
  assert.equal(
    (await call("/recovery", proof.idToken, { action: "username" })).username,
    m.details.username,
  );
  const newPassword = randomUUID();
  await call("/recovery", proof.idToken, {
    action: "password",
    password: newPassword,
  });
  await call(
    "/login",
    undefined,
    { username: m.details.username, password: m.details.password },
    401,
  );
  const recovered = await call("/login", undefined, {
    username: m.details.username,
    password: newPassword,
  });
  const recoveredUser = await authRequest("signInWithCustomToken", {
    token: recovered.customToken,
    returnSecureToken: true,
  });
  assert.equal(
    (await call("/records", recoveredUser.idToken)).records.length,
    2,
  );
  const g = await anon();
  await call("/signup", g.idToken, m.details, 403);
  await call(
    "/social/activate",
    g.idToken,
    { consents: m.details.consents },
    403,
  );
});
test("signup uniqueness race and missing consents never activate a profile", async () => {
  const users = await Promise.all([phone(), phone()]);
  const suffix = randomUUID().slice(0, 8);
  const bodies = users.map((_, i) => ({
    username: "race_" + suffix,
    nickname: "r_" + suffix + i,
    email: `race-${suffix}-${i}@example.test`,
    password: randomUUID(),
    consents: { privacy: true, nonMedical: true, version: "draft-v1" },
  }));
  const results = await Promise.all(
    users.map(async (u, i) => {
      const r = await fetch(base + "/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u.idToken}`,
        },
        body: JSON.stringify(bodies[i]),
      });
      return r.status;
    }),
  );
  assert.deepEqual(results.sort(), [200, 409]);
  const pending = await phone();
  await call(
    "/signup",
    pending.idToken,
    {
      ...bodies[0],
      consents: { privacy: false, nonMedical: true, version: "draft-v1" },
    },
    400,
  );
  assert.equal((await call("/me", pending.idToken)).kind, "pending");
  await call("/records", pending.idToken, undefined, 403);
});
test("OAuth rejects forged state and enforces one-time challenge-bound grants", async () => {
  await call(
    "/oauth/kakao/callback?state=" + "0".repeat(64),
    undefined,
    undefined,
    403,
  );
  const verifier = randomUUID() + randomUUID(),
    code = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const m = await signup();
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  await db.doc(`oauthGrants/${hash(code)}`).set({
    uid: m.localId,
    challenge: hash(verifier),
    expiresAt: Date.now() + 60000,
  });
  await call(
    "/oauth/exchange",
    undefined,
    { code, verifier: "a".repeat(64) },
    403,
  );
  const grant = await call("/oauth/exchange", undefined, { code, verifier });
  assert.ok(grant.customToken);
  await call("/oauth/exchange", undefined, { code, verifier }, 403);
});
test("Firestore rules: active owner only; operational data and all client writes denied", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-jikkot",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
  try {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "profiles/rulesA"), { active: true });
      await setDoc(doc(c.firestore(), "profiles/rulesA/records/one"), {
        content: "saved",
      });
      await setDoc(doc(c.firestore(), "profiles/rulesPending"), {
        active: false,
      });
    });
    const own = env
        .authenticatedContext("rulesA", {
          firebase: { sign_in_provider: "custom" },
        })
        .firestore(),
      other = env.authenticatedContext("rulesB").firestore(),
      pending = env.authenticatedContext("rulesPending").firestore();
    await assertSucceeds(getDoc(doc(own, "profiles/rulesA/records/one")));
    await assertFails(getDoc(doc(other, "profiles/rulesA/records/one")));
    await assertFails(getDoc(doc(pending, "profiles/rulesPending")));
    await assertFails(setDoc(doc(own, "profiles/rulesA/records/new"), {}));
    for (const name of [
      "operations",
      "usernames",
      "nicknames",
      "guestDays",
      "recommendations",
    ])
      await assertFails(getDoc(doc(own, `${name}/one`)));
  } finally {
    await env.cleanup();
  }
});

test("injected feedback content persists change labels and yields another-area next recommendation", async () => {
  const { createApi } = await import("../../functions/src/index");
  const fixture = {
    related: { "NECK:0": [{ area: "SHOULDER" as const, routineId: "MV012" }] },
    changes: {
      MV009: [
        { id: "change-1", label: "테스트 변화 답변", nextRoutineId: "MV005" },
      ],
    },
  };
  const server = createApi(fixture).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const port = (server.address() as { port: number }).port;
  try {
    const m = await signup();
    async function local(path: string, body: unknown) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${m.idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 200);
      return r.json();
    }
    for (const feedback of ["same", "worse"]) {
      const recommendationId = randomUUID(),
        submissionId = randomUUID();
      await local("/recommendations", {
        recommendationId,
        answers: { ...answers, habits: ["HB01"], recent: ["RA02"] },
      });
      await local("/feedback", { recommendationId, submissionId, feedback });
      const next = await local("/next", {
        recommendationId,
        nextRecommendationId: randomUUID(),
        changes: feedback === "worse" ? ["change-1"] : [],
      });
      assert.equal(
        next.recommendation.snapshot.routine.id,
        feedback === "same" ? "MV012" : "MV005",
      );
      if (feedback === "worse") {
        const saved = (
          await db.doc(`profiles/${m.localId}/records/${submissionId}`).get()
        ).data();
        assert.deepEqual(saved.changes, [
          { id: "change-1", label: "테스트 변화 답변" },
        ]);
      }
    }
  } finally {
    await new Promise<void>((r, e) =>
      server.close((err) => (err ? e(err) : r())),
    );
  }
});

test("Google provider proof gets a separate service UID and never inherits a password profile by email", async () => {
  const m = await signup();
  const claims = {
    sub: "google-test-" + randomUUID(),
    email: m.details.email,
    email_verified: true,
    name: "Google test",
  };
  const jwt =
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url") +
    "." +
    Buffer.from(JSON.stringify(claims)).toString("base64url") +
    ".";
  const google = await authRequest("signInWithIdp", {
    requestUri: "http://127.0.0.1:5173",
    postBody: new URLSearchParams({
      providerId: "google.com",
      id_token: jwt,
    }).toString(),
    returnSecureToken: true,
  });
  await call("/records", google.idToken, undefined, 403);
  assert.equal((await call("/me", google.idToken)).kind, "pending");
  const proof = await call("/social/google", google.idToken, {});
  const canonical = await authRequest("signInWithCustomToken", {
    token: proof.customToken,
    returnSecureToken: true,
  });
  const info = await call("/me", canonical.idToken);
  assert.equal(info.kind, "pending");
  await call(
    "/social/activate",
    canonical.idToken,
    { consents: { privacy: false, nonMedical: true, version: "draft-v1" } },
    400,
  );
  await call("/records", canonical.idToken, undefined, 403);
  await call("/social/activate", canonical.idToken, {
    consents: m.details.consents,
  });
  const active = await call("/me", canonical.idToken);
  assert.notEqual(active.member.uid, m.localId);
  assert.equal((await call("/records", canonical.idToken)).records.length, 0);
  assert.equal(
    (await call("/me", m.idToken)).member.username,
    m.details.username,
  );
});
