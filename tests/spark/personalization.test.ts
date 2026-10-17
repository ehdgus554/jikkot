import test from "node:test";
import assert from "node:assert/strict";
import { kstWeek } from "../../lib/personalization/growth";
import { randomUUID } from "node:crypto";
import { createSparkApi } from "../../worker/spark-api";
import { FirestoreRest } from "../../worker/firestore-rest";
import { emulatorIdentity } from "../../scripts/spark-emulator-identity";
import {
  inputSchema,
  type SessionInput,
} from "../../lib/personalization/types";
const env = {
  FIREBASE_PROJECT_ID: "demo-jikkot",
  FIREBASE_WEB_API_KEY: "demo-key",
  DEPLOYMENT_STAGE: "review",
  REVIEW_ENABLED: "true",
  GROWTH_ENABLED: "true",
};
const db = new FirestoreRest(env, "http://127.0.0.1:8080");
async function user(guest = false) {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(guest
          ? {}
          : {
              email: `p-${randomUUID()}@example.test`,
              password: randomUUID(),
            }),
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(r.status, 200);
  return (await r.json()) as { idToken: string; localId: string };
}
function client(uid: string, stage = "review") {
  const api = createSparkApi(
    { ...env, DEPLOYMENT_STAGE: stage, REVIEW_ALLOWED_UIDS: uid },
    undefined,
    { db, verify: emulatorIdentity },
  );
  return async (path: string, token: string, body?: unknown) => {
    const r = await api(
      new Request("https://test.example/api" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    return { status: r.status, body: await r.json() };
  };
}
async function activate(
  call: ReturnType<typeof client>,
  u: Awaited<ReturnType<typeof user>>,
) {
  const suffix = randomUUID().slice(0, 8);
  assert.equal(
    (
      await call("/signup", u.idToken, {
        username: `p_${suffix}`,
        nickname: `p_${suffix}`,
        consents: { privacy: true, nonMedical: true, version: "draft-v1" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/personalization/consent", u.idToken, {
        version: "personalization-draft-v1",
        personalization: true,
        ai: false,
      })
    ).status,
    200,
  );
}
const daily = (patch: Partial<SessionInput> = {}) =>
  inputSchema.parse({
    purpose: "daily",
    area: "back",
    habits: ["retract"],
    current: ["upper_back", "reach_comfort"],
    poses: ["chair"],
    supports: ["chair"],
    focus: [],
    review: true,
    growth: false,
    confirmedAt: Date.now(),
    ...patch,
  });
test("server restricts review by member UID and deployment stage, and customer snapshots omit decision evidence", async () => {
  const a = await user(),
    b = await user();
  const call = client(a.localId);
  await activate(call, a);
  await activate(call, b);
  assert.equal(
    (await call("/review/catalog", a.idToken)).body.items.length,
    74,
  );
  assert.equal((await call("/review/catalog", b.idToken)).status, 403);
  assert.equal(
    (await client(a.localId, "production")("/review/catalog", a.idToken))
      .status,
    403,
  );
  assert.equal(
    (
      await call("/personalization/sessions", b.idToken, {
        sessionId: randomUUID(),
        input: daily(),
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/personalization/preferences", b.idToken, { review: true }))
      .status,
    403,
  );
  assert.equal(
    (
      await call("/personalization/preferences", a.idToken, {
        review: true,
        habits: { back: ["retract"] },
      })
    ).status,
    200,
  );
  assert.deepEqual(
    (await call("/personalization/context", a.idToken)).body.preferences
      .habits ?? {},
    {},
  );
  assert.deepEqual(
    (await call("/personalization/context?review=true", a.idToken)).body
      .preferences.habits,
    { back: ["retract"] },
  );
  const sid = randomUUID();
  const r = await call("/personalization/sessions", a.idToken, {
    sessionId: sid,
    input: daily(),
  });
  assert.equal(r.status, 200);
  assert.equal("decision" in r.body, false);
  assert.equal("owner" in r.body, false);
  assert.equal(
    (await call(`/personalization/sessions/${sid}`, b.idToken)).status,
    404,
  );
  assert.equal(
    (await call(`/review/sessions/${sid}`, a.idToken)).body.decision
      .selected[0],
    "O02",
  );
});
test("one adverse item changes the next identical input; concurrent fixed event retries create one fact and deletion removes its evidence", async () => {
  const u = await user();
  const call = client(u.localId);
  await activate(call, u);
  const sid = randomUUID(),
    input = daily();
  const r = await call("/personalization/sessions", u.idToken, {
    sessionId: sid,
    input,
  });
  assert.equal(r.status, 200);
  const item = r.body.items[0];
  assert.equal(
    (
      await call(`/personalization/sessions/${sid}/events`, u.idToken, {
        eventId: randomUUID(),
        action: "followup",
        followup: "uncomfortable",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`/personalization/sessions/${sid}/events`, u.idToken, {
        eventId: randomUUID(),
        action: "complete",
        itemId: item.itemId,
      })
    ).status,
    200,
  );
  const body = {
    eventId: randomUUID(),
    action: "feedback",
    reaction: "worse",
    itemId: item.itemId,
    steps: [0],
  };
  const replies = await Promise.all([
    call(`/personalization/sessions/${sid}/events`, u.idToken, body),
    call(`/personalization/sessions/${sid}/events`, u.idToken, body),
  ]);
  assert.ok(replies.every((r) => r.status === 200));
  assert.equal(
    (
      await call(`/personalization/sessions/${sid}/events`, u.idToken, {
        eventId: randomUUID(),
        action: "stop",
        itemId: item.itemId,
      })
    ).status,
    409,
  );
  const memory = (await db.doc(`reviewMemory/${u.localId}`).get()).data()!;
  assert.equal(memory.constraints.length, 1);
  assert.equal(memory.experiences.length, 1);
  assert.equal(
    (
      await call(`/personalization/sessions/${sid}/events`, u.idToken, {
        ...body,
        reaction: "better",
      })
    ).status,
    409,
  );
  const next = await call("/personalization/sessions", u.idToken, {
    sessionId: randomUUID(),
    input: daily(),
  });
  assert.equal(next.status, 422);
  assert.deepEqual(replies[0].body.items[0].directions, []);
  const corrected = await call(
    `/personalization/sessions/${sid}/events`,
    u.idToken,
    {
      eventId: randomUUID(),
      action: "correct",
      itemId: item.itemId,
      reaction: "better",
    },
  );
  assert.equal(corrected.status, 200);
  assert.deepEqual(
    (await db.doc(`reviewMemory/${u.localId}`).get()).data()!.constraints,
    [],
  );
  assert.equal(
    (await db.doc(`reviewMemory/${u.localId}`).get()).data()!.experiences[0]
      .reaction,
    "better",
  );
  assert.equal(
    (
      await call(`/personalization/sessions/${sid}/events`, u.idToken, {
        eventId: randomUUID(),
        action: "correct",
        itemId: item.itemId,
        reaction: "worse",
        steps: [0],
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`/personalization/sessions/${sid}/delete`, u.idToken, {}))
      .status,
    200,
  );
  const cleared = (await db.doc(`reviewMemory/${u.localId}`).get()).data()!;
  assert.deepEqual(cleared.constraints, []);
  assert.deepEqual(cleared.experiences, []);
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        sessionId: randomUUID(),
        input: daily(),
      })
    ).status,
    200,
  );
});
test("unapproved v2 connections never consume a guest quota; legacy successful creation and retries keep the KST rule", async () => {
  const u = await user(true);
  const call = client("");
  assert.equal(
    (
      await call("/guest/consent", u.idToken, {
        nonMedical: true,
        version: "draft-v1",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        sessionId: randomUUID(),
        input: daily({ review: false }),
      })
    ).status,
    422,
  );
  assert.equal((await call("/eligibility", u.idToken)).body.allowed, true);
  const sid = randomUUID();
  const answers = {
    mode: "seated",
    area: "neck",
    habits: ["H_SHRUG", "H_SIDE_SCREEN", "H_CARRY"],
    recent: ["R_HEAD_TURN", "R_HOLD_LOAD", "R_COMPUTER_BOTH"],
  };
  const payload = { recommendationId: sid, answers };
  assert.equal(
    (await call("/recommendations", u.idToken, payload)).status,
    200,
  );
  assert.equal(
    (await call("/recommendations", u.idToken, payload)).status,
    200,
  );
  assert.equal((await call("/eligibility", u.idToken)).body.allowed, false);
  assert.equal(
    (
      await call("/recommendations", u.idToken, {
        ...payload,
        recommendationId: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal((await call("/personalization/records", u.idToken)).status, 403);
  assert.equal(
    (await db.doc(`personalMemory/${u.localId}`).get()).exists,
    false,
  );
});

test("bundle feeling stays at bundle scope, spatial skips do not become adverse constraints, and weekly growth is atomic", async () => {
  const u = await user();
  const call = client(u.localId);
  await activate(call, u);
  const input = daily({
    purpose: "leisure",
    area: undefined,
    minutes: 5,
    habits: ["sitting", "immobile"],
    current: [
      "hip_back",
      "knee_hug_comfort",
      "stiff",
      "small_comfort",
      "both_directions_comfort",
    ],
    poses: ["chair"],
    supports: ["chair"],
    growth: true,
  });
  const sid = randomUUID();
  let r = await call("/personalization/sessions", u.idToken, {
    sessionId: sid,
    input,
  });
  assert.equal(r.status, 200);
  const first = r.body.items[0];
  r = await call(`/personalization/sessions/${sid}/events`, u.idToken, {
    eventId: randomUUID(),
    action: "skip",
    itemId: first.itemId,
    skipReason: "space",
  });
  assert.equal(r.status, 200);
  for (const item of r.body.items.filter(
    (i: { state: string }) => i.state === "pending",
  )) {
    r = await call(`/personalization/sessions/${sid}/events`, u.idToken, {
      eventId: randomUUID(),
      action: "complete",
      itemId: item.itemId,
    });
    assert.equal(r.status, 200);
  }
  const feedback = {
    eventId: randomUUID(),
    action: "feedback",
    reaction: "refreshed",
  };
  const results = await Promise.all([
    call(`/personalization/sessions/${sid}/events`, u.idToken, feedback),
    call(`/personalization/sessions/${sid}/events`, u.idToken, feedback),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.ok(
    results[0].body.items.every(
      (i: { reaction: unknown }) => i.reaction === null,
    ),
  );
  const memory = (await db.doc(`reviewMemory/${u.localId}`).get()).data()!;
  assert.equal(memory.constraints.length, 0);
  assert.equal(
    memory.experiences.find(
      (e: { catalogId: string }) => e.catalogId === first.movement.catalogId,
    ).environmentSkip,
    true,
  );
  const growth = (await db.doc(`reviewGrowth/${u.localId}`).get()).data()!;
  assert.equal(growth.xp, 60);
  // Simulate the next week by clearing its award ledger. Old followups must not
  // retroactively award completion or feeling points into an empty week.
  const weekRef = db.doc(
    `reviewGrowth/${u.localId}/weeks/${kstWeek(Date.now())}`,
  );
  await weekRef.delete();
  const followup = await call(
    `/personalization/sessions/${sid}/events`,
    u.idToken,
    {
      eventId: randomUUID(),
      action: "followup",
      followup: "same",
    },
  );
  assert.equal(followup.status, 200);
  assert.equal(
    (await db.doc(`reviewGrowth/${u.localId}`).get()).data()!.xp,
    60,
  );
  assert.equal((await weekRef.get()).exists, false);
  const skippedId = randomUUID();
  const skipped = await call("/personalization/sessions", u.idToken, {sessionId: skippedId, input});
  assert.equal(skipped.status, 200);
  for (const entry of skipped.body.items) {
    assert.equal((await call(`/personalization/sessions/${skippedId}/events`, u.idToken, {
      eventId: randomUUID(), action: "skip", itemId: entry.itemId, skipReason: "space",
    })).status, 200);
  }
  assert.equal((await call(`/personalization/sessions/${skippedId}/events`, u.idToken, {
    eventId: randomUUID(), action: "feedback", reaction: "refreshed",
  })).status, 409);
  assert.equal((await db.doc(`reviewGrowth/${u.localId}`).get()).data()!.xp, 60);
});
test("legacy adverse record snapshots are preserved and conservatively constrain first production personalization", async () => {
  const u = await user();
  const call = client(u.localId);
  await activate(call, u);
  const oldId = randomUUID();
  const old = {
    createdAt: Date.now(),
    feedback: "worse",
    snapshot: {
      routine: { id: "jikkot11-r02", name: "unchanged-original" },
      contentVersion: "old-version",
    },
    changes: [{ id: "step-1", label: "original-stage" }],
  };
  await db.doc(`profiles/${u.localId}/records/${oldId}`).set(old);
  const response = await call("/personalization/sessions", u.idToken, {
    sessionId: randomUUID(),
    input: daily({ review: false }),
  });
  assert.equal(response.status, 422);
  assert.deepEqual(
    (await db.doc(`profiles/${u.localId}/records/${oldId}`).get()).data(),
    old,
  );
});
