import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "firebase/auth";
import { activationPath, canResumeEmailSignup } from "../../lib/service/auth-session";

function user(provider: string | null, anonymous = false) {
  return {
    email: "member@example.test",
    isAnonymous: anonymous,
    // Linked providers deliberately disagree with the active password session.
    providerData: [{ providerId: "google.com" }, { providerId: "password" }],
    getIdTokenResult: async () => ({ signInProvider: provider }),
  } as unknown as User;
}

test("activation uses the current token provider even with multiple linked providers", async () => {
  assert.equal(await activationPath(user("password")), "/signup");
  assert.equal(await activationPath(user("google.com")), "/social/activate");
});

test("anonymous and unsupported sessions cannot activate a membership", async () => {
  await assert.rejects(activationPath(user("anonymous", true)));
  await assert.rejects(activationPath(user(null)));
  await assert.rejects(activationPath(user("custom")));
});

test("email signup must not reuse a Google session with the same email", async () => {
  assert.equal(await canResumeEmailSignup(user("google.com"), "member@example.test"), false);
  assert.equal(await canResumeEmailSignup(user("password"), "member@example.test"), true);
});

test("email signup rejects absent, anonymous and different-account sessions", async () => {
  assert.equal(await canResumeEmailSignup(null, "member@example.test"), false);
  assert.equal(await canResumeEmailSignup(user("anonymous", true), "member@example.test"), false);
  assert.equal(await canResumeEmailSignup(user("password"), "other@example.test"), false);
});

test("token lookup errors stop activation instead of guessing from linked providers", async () => {
  const broken = user("password");
  broken.getIdTokenResult = async () => { throw new Error("expired"); };
  await assert.rejects(activationPath(broken), /expired/);
  await assert.rejects(canResumeEmailSignup(broken, "member@example.test"), /expired/);
});
