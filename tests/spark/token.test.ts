import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { verifyFirebaseToken } from "../../worker/spark-api";
test("production verifier checks signed project identity, revocation and disabled accounts", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key = {
    ...(await exportJWK(publicKey)),
    kid: "spark-test-key",
    alg: "RS256",
    use: "sig",
  };
  const authTime = Math.floor(Date.now() / 1000);
  let revoked = false,
    disabled = false;
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://www.googleapis.com/service_accounts/v1/jwk/"))
      return Response.json({ keys: [key] });
    if (
      url.startsWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:lookup",
      )
    )
      return Response.json({
        users: [
          {
            localId: "verified-user",
            disabled,
            validSince: String(authTime + (revoked ? 1 : -1)),
          },
        ],
      });
    throw new Error("Unexpected verification request");
  };
  const sign = (project: string, expiry: number) =>
    new SignJWT({
      auth_time: authTime,
      email: "test@example.test",
      firebase: { sign_in_provider: "password" },
    })
      .setProtectedHeader({ alg: "RS256", kid: key.kid })
      .setIssuer(`https://securetoken.google.com/${project}`)
      .setAudience(project)
      .setSubject("verified-user")
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(privateKey);
  const env = {
    FIREBASE_PROJECT_ID: "jikkot",
    FIREBASE_WEB_API_KEY: "public-test-key",
  };
  try {
    const bearer = await sign("jikkot", authTime + 3600);
    assert.equal((await verifyFirebaseToken(bearer, env)).uid, "verified-user");
    await assert.rejects(
      verifyFirebaseToken(await sign("other-project", authTime + 3600), env),
    );
    await assert.rejects(
      verifyFirebaseToken(await sign("jikkot", authTime - 1), env),
    );
    revoked = true;
    await assert.rejects(verifyFirebaseToken(bearer, env));
    revoked = false;
    disabled = true;
    await assert.rejects(verifyFirebaseToken(bearer, env));
  } finally {
    globalThis.fetch = original;
  }
});
