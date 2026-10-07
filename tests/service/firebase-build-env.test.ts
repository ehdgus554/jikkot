import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { firebaseBuildEnv } from "../../scripts/firebase-build-env";

test("public production settings stay out of development and respect explicit environment", () => {
  const root = mkdtempSync(path.join(tmpdir(), "jikkot-build-env-"));
  try {
    mkdirSync(path.join(root, "config"));
    const file = path.join(root, "config/firebase-web.json");
    const settings = {
      VITE_FIREBASE_API_KEY: "public-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "example.workers.dev",
      VITE_FIREBASE_PROJECT_ID: "example-project",
      VITE_FIREBASE_APP_ID: "public-app-id",
      VITE_API_URL: "https://asia-northeast3-example-project.cloudfunctions.net/api",
      VITE_USE_FIREBASE_EMULATORS: "false",
      ADMIN_PRIVATE_KEY: "must-not-be-included",
    };
    writeFileSync(file, JSON.stringify(settings));
    assert.equal(firebaseBuildEnv("development", root).VITE_FIREBASE_PROJECT_ID, undefined);
    assert.equal(firebaseBuildEnv("production", root).VITE_FIREBASE_PROJECT_ID, "example-project");
    assert.equal(firebaseBuildEnv("production", root).ADMIN_PRIVATE_KEY, undefined);
    writeFileSync(path.join(root, ".env.production"), "VITE_FIREBASE_PROJECT_ID=explicit-project\n");
    assert.equal(firebaseBuildEnv("production", root).VITE_FIREBASE_PROJECT_ID, "explicit-project");
    rmSync(path.join(root, ".env.production"));
    writeFileSync(file, JSON.stringify({ ...settings, VITE_USE_FIREBASE_EMULATORS: "true" }));
    assert.throws(() => firebaseBuildEnv("production", root), /에뮬레이터/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
