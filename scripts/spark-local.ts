import { createServer } from "node:http";
import { createSparkApi } from "../worker/spark-api";
import { FirestoreRest } from "../worker/firestore-rest";
import { emulatorIdentity } from "./spark-emulator-identity";
const env = {
  FIREBASE_PROJECT_ID: "demo-jikkot",
  FIREBASE_WEB_API_KEY: "demo-key",
  ALLOWED_ORIGINS:
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8787,http://localhost:8787",
};
const api = createSparkApi(env, undefined, {
  db: new FirestoreRest(env, "http://127.0.0.1:8080"),
  verify: emulatorIdentity,
});
createServer(async (incoming, outgoing) => {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 16384) {
        outgoing.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request(`http://127.0.0.1:5002${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers as Record<string, string>,
      ...(["GET", "HEAD"].includes(incoming.method!)
        ? {}
        : { body: Buffer.concat(chunks) }),
    });
    const response = await api(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end();
  }
}).listen(5002, "127.0.0.1", () =>
  console.log("Spark local API ready; demo Auth/Firestore emulators only."),
);
