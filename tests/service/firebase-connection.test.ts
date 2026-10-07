import test from "node:test";
import assert from "node:assert/strict";
import { firebaseConnection } from "../../lib/service/firebase-connection";
const config = {
  projectId: "example-project",
  apiKey: "public-key",
  appId: "public-app-id",
  authDomain: "example-project.firebaseapp.com",
};
test("connection aligns browser auth domain, server CORS, Seoul API and same-domain helper", () => {
  const settings = firebaseConnection(
    config,
    "https://jikkot.example.workers.dev",
  );
  assert.equal(
    settings.browser.VITE_FIREBASE_AUTH_DOMAIN,
    "jikkot.example.workers.dev",
  );
  assert.equal(
    settings.server.ALLOWED_ORIGINS,
    "https://jikkot.example.workers.dev",
  );
  assert.equal(settings.server.PUBLIC_API_URL, settings.browser.VITE_API_URL);
  assert.equal(settings.helperHost, config.authDomain);
  assert.equal(
    settings.server.API_SERVICE_ACCOUNT,
    "jikkot-api@example-project.iam.gserviceaccount.com",
  );
  assert.equal(settings.browser.VITE_USE_FIREBASE_EMULATORS, "false");
});
test("connection rejects demo, mismatched project, env injection and non-origin URLs", () => {
  assert.throws(() =>
    firebaseConnection(
      { ...config, projectId: "demo-example" },
      "https://example.com",
    ),
  );
  assert.throws(() =>
    firebaseConnection(
      { ...config, authDomain: "other.firebaseapp.com" },
      "https://example.com",
    ),
  );
  assert.throws(() =>
    firebaseConnection(
      { ...config, apiKey: "key\nSECRET=value" },
      "https://example.com",
    ),
  );
  for (const site of [
    "http://example.com",
    "https://localhost",
    "https://example.com/path",
    "https://user:pass@example.com",
    "https://example.com?x=1",
  ])
    assert.throws(() => firebaseConnection(config, site));
});
