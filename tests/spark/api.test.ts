import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fields, encode, decode } from "../../worker/firestore-rest";
import { createSparkApi } from "../../worker/spark-api";
import {
  db,
  env,
  client,
  identity,
  member,
  consents,
  create,
} from "./fixtures";
test("Firestore REST codecs preserve historical snapshots and timestamps", () => {
  const v = {
    text: "한글",
    list: [1, false, null],
    nested: { at: new Date("2026-10-07T00:00:00Z") },
  };
  assert.deepEqual(decode(encode(v)), v);
  assert.equal(fields({ empty: [] }).empty.arrayValue?.values?.length, 0);
});
test("signup requires a trimmed 2-character nickname and separate current health consent; username is optional", async () => {
  const u = await identity(),
    call = client();
  for (const nickname of ["", " ", "가"])
    assert.equal(
      (await call("/signup", u.idToken, { nickname, consents })).status,
      400,
    );
  assert.equal(
    (
      await call("/signup", u.idToken, {
        nickname: "회원" + u.suffix,
        consents: { ...consents, healthPersonalization: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/signup", u.idToken, {
        nickname: "회원" + u.suffix,
        consents: { ...consents, version: "draft-v1" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/signup", u.idToken, {
        nickname: "  회원" + u.suffix + "  ",
        consents,
      })
    ).status,
    200,
  );
  const me = await call("/me", u.idToken);
  assert.equal(me.body.member.username, null);
  assert.equal(me.body.member.nickname, "회원" + u.suffix);
  assert.equal(me.body.member.needsConsent, false);
});
test("nickname duplicate activation is atomic and stored profiles never disclose Google names by default", async () => {
  const a = await identity(),
    b = await identity();
  const call = client(),
    nickname = "동시" + a.suffix;
  const r = await Promise.all([
    call("/signup", a.idToken, { nickname, consents }),
    call("/signup", b.idToken, { nickname, consents }),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [200, 409]);
  const g = await identity("google");
  assert.equal((await call("/me", g.idToken)).body.member, null);
  assert.equal(
    (
      await call("/social/activate", g.idToken, {
        nickname: "구글" + g.suffix,
        consents,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/me", g.idToken)).body.member.nickname,
    "구글" + g.suffix,
  );
});
test("legacy account nickname repair preserves username, indices and exact record snapshots", async () => {
  const u = await identity();
  const old = {
    active: true,
    authProvider: "password",
    username: "old_name",
    nickname: null,
    consents: { version: "draft-v1" },
    createdAt: 1,
  };
  await db.doc(`profiles/${u.localId}`).set(old);
  const rid = randomUUID(),
    snapshot = {
      routine: {
        id: "old-id",
        name: "그때의 이름",
        steps: ["그때의 단계"],
        dose: "그때의 실시량",
      },
    };
  await db
    .doc(`profiles/${u.localId}/records/${rid}`)
    .set({ snapshot, createdAt: 1, feedback: "same" });
  const call = client();
  assert.equal((await call("/me", u.idToken)).body.member.needsNickname, true);
  assert.equal(
    (
      await call("/account/nickname", u.idToken, {
        nickname: "보완" + u.suffix,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/account/consent", u.idToken, consents)).status,
    200,
  );
  assert.equal(
    (await db.doc(`profiles/${u.localId}`).get()).data()!.username,
    "old_name",
  );
  assert.deepEqual(
    (await db.doc(`profiles/${u.localId}/records/${rid}`).get()).data()!
      .snapshot,
    snapshot,
  );
});
test("policy reports actual metadata and known operator; unsupported old recommendation creation cannot resurrect O09", async () => {
  const call = client();
  const p = await call("/service-policy");
  assert.equal(p.status, 200);
  assert.equal(p.body.operatorName, "김동현");
  assert.equal(p.body.contactEmail, "ehdgus554@gmail.com");
  assert.equal(p.body.storageRegion, "local-emulator");
  assert.equal(
    (await call("/recommendations", undefined, {})).body.code,
    "UPDATE_REQUIRED",
  );
});
test("signed provider ownership, malformed input, CORS and unsigned proofs remain enforced", async () => {
  const u = await member();
  const api = createSparkApi(env, undefined, {
    db,
    verify: async () => ({
      uid: u.localId,
      email: u.email,
      auth_time: Date.now() / 1000,
      firebase: { sign_in_provider: "google.com" },
    }),
  });
  const r = await api(
    new Request("https://test.example/api/records", {
      headers: { Authorization: "Bearer fixture" },
    }),
  );
  assert.equal(r.status, 403);
  const call = client();
  assert.equal((await call("/personalization/context")).status, 401);
  const denied = await api(
    new Request("https://test.example/api/health", {
      headers: { Origin: "https://wrong.example" },
    }),
  );
  assert.equal(denied.status, 403);
});
test("account deletion requires recent authentication and deletes Auth, health data and indices", async () => {
  const u = await member(),
    call = client();
  await create(call, u);
  const expired = createSparkApi(env, undefined, {
    db,
    verify: async () => ({
      uid: u.localId,
      email: u.email,
      auth_time: Date.now() / 1000 - 301,
      firebase: { sign_in_provider: "password" },
    }),
  });
  assert.equal(
    (
      await expired(
        new Request("https://test.example/api/account/delete", {
          method: "POST",
          headers: {
            Authorization: "Bearer fixture",
            "Content-Type": "application/json",
          },
          body: "{}",
        }),
      )
    ).status,
    401,
  );
  const r = await call("/account/delete", u.idToken, {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.complete, true);
  assert.equal((await db.doc(`profiles/${u.localId}`).get()).exists, false);
  assert.equal(
    (await db.collection(`profiles/${u.localId}/sessions`).get()).docs.length,
    0,
  );
  assert.equal(
    (await db.doc(`personalMemory/${u.localId}`).get()).exists,
    false,
  );
  const lookup = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: u.idToken }),
    },
  );
  assert.ok(lookup.status !== 200);
});
test("existing one-character nickname is repaired before sensitive member actions", async () => {
  const u = await member(),
    call = client();
  const ref = db.doc(`profiles/${u.localId}`);
  await ref.set({ ...(await ref.get()).data(), nickname: "가" });
  assert.equal((await call("/me", u.idToken)).body.member.needsNickname, true);
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        sessionId: randomUUID(),
        input: {
          purpose: "daily",
          area: "back",
          habits: ["retract"],
          current: ["upper_back", "reach_comfort"],
          poses: ["chair"],
          supports: ["chair"],
          confirmedAt: Date.now(),
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/account/nickname", u.idToken, {
        nickname: "보완" + u.suffix,
      })
    ).status,
    200,
  );
  assert.equal((await call("/me", u.idToken)).body.member.needsNickname, false);
});
