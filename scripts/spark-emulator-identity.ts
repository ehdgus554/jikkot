import { decodeJwt } from "jose";
import type { Identity } from "../worker/spark-api";
/** Local test driver only. Never imported by the deployed Worker. */
export async function emulatorIdentity(bearer: string): Promise<Identity> {
  const claims = decodeJwt(bearer);
  if (
    claims.aud !== "demo-jikkot" ||
    claims.iss !== "https://securetoken.google.com/demo-jikkot"
  )
    throw new Error("Wrong emulator project");
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: bearer }),
    },
  );
  const data = await response.json();
  const user = data.users?.[0];
  if (
    !response.ok ||
    user?.localId !== claims.sub ||
    user.disabled ||
    Number(user.validSince ?? 0) > Number(claims.auth_time)
  )
    throw new Error("Invalid emulator identity");
  return {
    uid: claims.sub!,
    email: typeof claims.email === "string" ? claims.email : undefined,
    auth_time: Number(claims.auth_time),
    firebase: claims.firebase as Identity["firebase"],
  };
}
