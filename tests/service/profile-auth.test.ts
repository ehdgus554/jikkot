import test from "node:test";
import assert from "node:assert/strict";
import { profileForIdentity } from "../../worker/profile-auth";
import type { FirestoreRest } from "../../worker/firestore-rest";
import type { Identity } from "../../worker/spark-api";

const identity = (provider = "google.com"): Identity => ({
  uid: "owner", auth_time: 123, firebase: { sign_in_provider: provider },
});
function fixture(initial: Record<string, unknown>, concurrent?: Record<string, unknown>) {
  let row = structuredClone(initial);
  let writes = 0;
  const ref = { get: async () => ({ data: () => structuredClone(row) }) };
  const db = {
    doc: (path: string) => { assert.equal(path, "profiles/owner"); return ref; },
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      if (concurrent) row = structuredClone(concurrent);
      return fn({
        get: ref.get,
        set: (_ref: unknown, value: Record<string, unknown>) => { row = value; writes++; },
      });
    },
  } as unknown as FirestoreRest;
  return { db, writes: () => writes, row: () => row };
}
test("legacy profile without provider recovers by verified UID without losing profile fields", async () => {
  for (const provider of ["google.com", "password"]) {
    const original = {uid: "owner", active: true, nickname: "기존회원", consents: {privacy: true}, createdAt: 42};
    const f = fixture(original);
    assert.deepEqual(await profileForIdentity(f.db, identity(provider)), {...original, authProvider: provider});
    assert.equal(f.writes(), 1);
    await profileForIdentity(f.db, identity(provider));
    assert.equal(f.writes(), 1);
  }
});
test("existing provider bindings are never overwritten", async () => {
  const original = {uid: "owner", active: true, authProvider: "password"};
  const f = fixture(original);
  assert.deepEqual(await profileForIdentity(f.db, identity()), original);
  assert.equal(f.writes(), 0);
});
test("anonymous, unsupported, inactive, foreign UID and malformed bindings cannot migrate", async () => {
  for (const [profile, provider] of [
    [{uid: "owner", active: true}, "anonymous"],
    [{uid: "owner", active: true}, "custom"],
    [{uid: "owner", active: false}, "google.com"],
    [{uid: "other", active: true}, "google.com"],
    [{active: true}, "google.com"],
    [{uid: "owner", active: true, authProvider: ""}, "google.com"],
  ] as const) {
    const f = fixture(profile);
    await profileForIdentity(f.db, identity(provider));
    assert.equal(f.writes(), 0);
  }
});
test("transaction rechecks concurrent binding and deactivation before writing", async () => {
  for (const latest of [
    {uid: "owner", active: true, authProvider: "password"},
    {uid: "owner", active: false},
  ]) {
    const f = fixture({uid: "owner", active: true}, latest);
    assert.deepEqual(await profileForIdentity(f.db, identity()), latest);
    assert.equal(f.writes(), 0);
  }
});
