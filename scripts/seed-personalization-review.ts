/** Local-only fixture. Uses the real Auth emulator; never runs against a Firebase project. */
import { createRequire } from "node:module";
import { FirestoreRest } from "../worker/firestore-rest";
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099")
  throw new Error(
    "Set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099; emulator only",
  );
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const projectId = "demo-jikkot",
  uid = "jikkot-local-reviewer",
  email = "reviewer@example.test",
  password = "LocalReview123!";
const app = initializeApp({ projectId });
const auth = getAuth(app);
try {
  await auth.getUser(uid);
  await auth.updateUser(uid, { email, password });
} catch (error) {
  if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  await auth.createUser({ uid, email, password });
}
const db = new FirestoreRest(
  { FIREBASE_PROJECT_ID: projectId },
  "http://127.0.0.1:8080",
);
const ref = db.doc(`profiles/${uid}`);
if (!(await ref.get()).exists)
  await ref.set({
    active: true,
    authProvider: "password",
    username: "local_reviewer",
    nickname: "로컬 검토",
    createdAt: Date.now(),
    consents: { privacy: true, nonMedical: true, version: "draft-v1" },
  });
await db
  .doc(`personalConsents/${uid}`)
  .set({
    version: "personalization-draft-v1",
    personalization: true,
    ai: false,
    confirmedAt: Date.now(),
    policyReviewed: false,
  });
console.log(
  "Local Auth/Firestore reviewer fixture ready: reviewer@example.test. Password is documented in the local-only review guide.",
);
