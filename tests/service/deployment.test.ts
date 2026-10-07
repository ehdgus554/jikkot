import test from "node:test";
import assert from "node:assert/strict";
import { deploymentMode } from "../../lib/service/deployment";
const connected = {
  VITE_FIREBASE_API_KEY: "public-web-key",
  VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "example",
  VITE_FIREBASE_APP_ID: "public-app-id",
  VITE_API_URL: "https://example.cloudfunctions.net/api",
};
test("empty Firebase configuration deploys the preparation page; partial configuration cannot pretend to be live", () => {
  assert.equal(deploymentMode({}), "preparation");
  assert.throws(
    () => deploymentMode({ VITE_FIREBASE_PROJECT_ID: "example" }),
    /누락/,
  );
  assert.equal(deploymentMode(connected), "connected");
});
test("local/demo configuration is rejected by default; explicit preparation ignores stale local settings", () => {
  for (const env of [
    { ...connected, VITE_USE_FIREBASE_EMULATORS: "true" },
    { ...connected, VITE_FIREBASE_PROJECT_ID: "demo-example" },
    { ...connected, VITE_API_URL: "http://127.0.0.1:5001" },
    { ...connected, VITE_API_URL: "https://localhost/api" },
  ])
    assert.throws(() => deploymentMode(env), /에뮬레이터/);
  assert.equal(
    deploymentMode({ ...connected, VITE_USE_FIREBASE_EMULATORS: "true" }, true),
    "preparation",
  );
});
