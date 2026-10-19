import { createHash } from "node:crypto";
import { consentPolicy } from "../lib/service/policy";
import { decode, type FirestoreRest, type Transaction } from "./firestore-rest";
export const nextMidnightKST = (now = Date.now()) =>
  Math.floor((now + 9 * 3600000) / 86400000) * 86400000 +
  86400000 -
  9 * 3600000;
export const currentKSTDay = (now = Date.now()) =>
  new Date(now + 9 * 3600000).toISOString().slice(0, 10);
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export const cleanupRef = (db: FirestoreRest, uid: string, expiresAt: number) =>
  db.doc(`cleanupJobs/${digest(uid + ":" + expiresAt)}`);
export function isExpired(
  row: { expiresAt?: number; createdAt?: number },
  now = Date.now(),
) {
  return (row.expiresAt ?? nextMidnightKST(row.createdAt ?? 0)) <= now;
}
export async function trackGuest(
  tx: Transaction,
  db: FirestoreRest,
  uid: string,
  expiresAt: number,
  paths: string[],
) {
  const ref = cleanupRef(db, uid, expiresAt);
  const old = (await tx.get(ref)).data();
  return () =>
    tx.set(ref, {
      owner: uid,
      policyVersion: consentPolicy.version,
      expiresAt,
      nextAttemptAt: expiresAt,
      attempts: old?.attempts ?? 0,
      paths: [...new Set([...(old?.paths ?? []), ...paths])],
    });
}
export async function cleanupExpiredGuests(
  db: FirestoreRest,
  now = Date.now(),
) {
  const jobs = await db
    .collection("cleanupJobs")
    .where("nextAttemptAt", "<=", now)
    .orderBy("nextAttemptAt", "asc")
    .limit(8)
    .get();
  let completed = 0,
    failed = 0;
  for (const job of jobs.docs) {
    const data = job.data()!;
    if (data.policyVersion !== consentPolicy.version) continue;
    try {
      // Do not delete a newer day's consent or unrelated pre-policy data.
      const paths = data.paths as string[];
      // One batch read and conditional commit keep a cron invocation below the
      // Worker subrequest limit while processing several independent owners.
      const rows = await db.request("/documents:batchGet", {
        documents: paths.slice(0, 100).map((p) => db.doc(p).name),
      });
      const writes = rows.flatMap(
        (row: {
          found?: {
            name: string;
            fields: Record<string, Parameters<typeof decode>[0]>;
            updateTime: string;
          };
        }) => {
          if (!row.found) return [];
          const found = row.found;
          const d = Object.fromEntries(
            Object.entries(found.fields ?? {}).map(([k, v]) => [k, decode(v)]),
          );
          return d.owner === data.owner &&
            d.policyVersion === consentPolicy.version &&
            typeof d.expiresAt === "number" &&
            d.expiresAt <= now
            ? [
                {
                  delete: found.name,
                  currentDocument: { updateTime: found.updateTime },
                },
              ]
            : [];
        },
      );
      if (writes.length) await db.request("/documents:commit", { writes });
      if (paths.length > 100)
        await job.ref.set({
          ...data,
          paths: paths.slice(100),
          nextAttemptAt: now,
        });
      else {
        await job.ref.delete();
        completed++;
      }
    } catch {
      await job.ref.set({
        ...data,
        attempts: (data.attempts ?? 0) + 1,
        nextAttemptAt:
          now + Math.min(3600000, 60000 * 2 ** Math.min(data.attempts ?? 0, 6)),
        lastError: "DELETE_FAILED",
      });
      failed++;
    }
  }
  await db
    .doc("cleanupStatus/guests")
    .set({ checkedAt: now, completed, failed, pendingBatch: jobs.docs.length });
  return { completed, failed };
}
/** Only explicit owner withdrawal/deletion uses this path, including older-policy data. */
export async function deleteHealthData(
  db: FirestoreRest,
  uid: string,
  member: boolean,
) {
  const collections = [
    ...(member
      ? [
          `profiles/${uid}/records`,
          `profiles/${uid}/sessions`,
          `personalGrowth/${uid}/weeks`,
          `reviewGrowth/${uid}/weeks`,
        ]
      : []),
    `guestSessions/${uid}/sessions`,
  ];
  const root = [
    "recommendations",
    "submissions",
    "operations",
    "personalSubmissions",
  ];
  // Each step is idempotent. A failed batch stays visible and the owner can retry.
  let batches = 0;
  for (const path of [...collections, ...root]) {
    for (;;) {
      let q = db.collection(path).limit(80);
      if (root.includes(path)) q = q.where("owner", "==", uid);
      const rows = (await q.get()).docs;
      if (!rows.length) break;
      await db.request("/documents:commit", {
        writes: rows.map((r) => ({
          delete: r.ref.name,
          currentDocument: { updateTime: r.raw!.updateTime },
        })),
      });
      if (++batches >= 8) return false;
    }
  }
  const direct = [
    "guestConsents",
    "personalConsents",
    "personalMemory",
    "reviewMemory",
    "personalPreferences",
    "reviewPreferences",
    "personalGrowth",
    "reviewGrowth",
  ];
  await db.runTransaction(async (tx) => {
    for (const p of direct) tx.delete(db.doc(`${p}/${uid}`));
  });
  return true;
}
