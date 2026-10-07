import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
test("Spark rules allow only the active owner and original login provider to read; clients cannot write", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-jikkot",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
  try {
    const uid = "rule_" + randomUUID();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `profiles/${uid}`), {
        active: true,
        authProvider: "google.com",
      });
      await setDoc(doc(context.firestore(), `profiles/${uid}/records/one`), {
        owner: uid,
      });
    });
    const owner = env
      .authenticatedContext(uid, {
        firebase: { sign_in_provider: "google.com" },
      })
      .firestore();
    const other = env
      .authenticatedContext("other", {
        firebase: { sign_in_provider: "google.com" },
      })
      .firestore();
    const switched = env
      .authenticatedContext(uid, { firebase: { sign_in_provider: "password" } })
      .firestore();
    assert.equal(
      (
        await assertSucceeds(getDoc(doc(owner, `profiles/${uid}/records/one`)))
      ).exists(),
      true,
    );
    await assertFails(getDoc(doc(other, `profiles/${uid}/records/one`)));
    await assertFails(getDoc(doc(switched, `profiles/${uid}/records/one`)));
    await assertFails(
      setDoc(doc(owner, `profiles/${uid}/records/two`), { owner: uid }),
    );
    await assertFails(getDoc(doc(owner, "operations/private")));
  } finally {
    await env.cleanup();
  }
});
