import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import {
  db,
  client,
  member,
  identity,
  consents,
  create,
  daily,
} from "./fixtures";
import { cleanupExpiredGuests, nextMidnightKST } from "../../worker/retention";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
test("published daily and member programmes work while review metadata stays UID/stage protected", async () => {
  const u = await member(),
    call = client();
  const s = await create(call, u);
  assert.equal(s.items[0].movement.catalogId, "O02");
  assert.equal(s.items[0].movement.dosage.label, "20초씩 2회");
  assert.equal("decision" in s, false);
  assert.deepEqual(s.items[0].directions, []);
  assert.equal((await call("/review/catalog", u.idToken)).status, 403);
  assert.equal(
    (await client(u.localId)("/review/catalog", u.idToken)).body.items.length,
    75,
  );
  const other = await member();
  assert.equal(
    (await call(`/personalization/sessions/${s.id}`, other.idToken)).status,
    404,
  );
});
test("parallel creation/event retries keep one session and one adverse fact; deletion clears evidence and receipts", async () => {
  const u = await member(),
    call = client(),
    id = randomUUID(),
    body = { sessionId: id, input: daily() };
  const creation = await Promise.all([
    call("/personalization/sessions", u.idToken, body),
    call("/personalization/sessions", u.idToken, body),
  ]);
  assert.ok(creation.every((x) => x.status === 200));
  const s = creation[0].body,
    item = s.items[0];
  await call(`/personalization/sessions/${id}/events`, u.idToken, {
    eventId: randomUUID(),
    action: "complete",
    itemId: item.itemId,
  });
  const event = {
    eventId: randomUUID(),
    action: "feedback",
    itemId: item.itemId,
    reaction: "worse",
    steps: [0],
  };
  const r = await Promise.all([
    call(`/personalization/sessions/${id}/events`, u.idToken, event),
    call(`/personalization/sessions/${id}/events`, u.idToken, event),
  ]);
  assert.ok(r.every((x) => x.status === 200));
  const m = (await db.doc(`personalMemory/${u.localId}`).get()).data()!;
  assert.equal(m.constraints.length, 1);
  assert.equal(m.experiences.length, 1);
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        sessionId: randomUUID(),
        input: daily(),
      })
    ).status,
    422,
  );
  assert.equal(
    (await call(`/personalization/sessions/${id}/delete`, u.idToken, {}))
      .status,
    200,
  );
  assert.equal(
    (await db.doc(`personalMemory/${u.localId}`).get()).data()!.constraints
      .length,
    0,
  );
  assert.equal(
    (
      await db
        .collection("personalSubmissions")
        .where("sessionId", "==", id)
        .get()
    ).docs.length,
    0,
  );
  await create(call, u);
});
test("correcting a feedback removes the old adverse constraint without creating duplicate experience", async () => {
  const u = await member(),
    call = client(),
    s = await create(call, u),
    item = s.items[0];
  for (const b of [
    { action: "complete", itemId: item.itemId },
    { action: "feedback", itemId: item.itemId, reaction: "worse", steps: [] },
    { action: "correct", itemId: item.itemId, reaction: "better", steps: [] },
  ])
    assert.equal(
      (
        await call(`/personalization/sessions/${s.id}/events`, u.idToken, {
          eventId: randomUUID(),
          ...b,
        })
      ).status,
      200,
    );
  const m = (await db.doc(`personalMemory/${u.localId}`).get()).data()!;
  assert.equal(m.constraints.length, 0);
  assert.equal(m.experiences.length, 1);
  assert.equal(m.experiences[0].reaction, "better");
});
test("guest consent is separate and successful recommendation alone consumes the day; retry/revoke never resets its usage", async () => {
  const u = await identity("guest"),
    call = client();
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        sessionId: randomUUID(),
        input: daily(),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/guest/consent", u.idToken, {
        ...consents,
        healthPersonalization: false,
      })
    ).status,
    400,
  );
  await call("/guest/consent", u.idToken, consents);
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        sessionId: randomUUID(),
        input: daily({ habits: ["unknown"], current: ["unknown"] }),
      })
    ).status,
    422,
  );
  const id = randomUUID(),
    body = { sessionId: id, input: daily() };
  assert.equal(
    (await call("/personalization/sessions", u.idToken, body)).status,
    200,
  );
  assert.equal(
    (await call("/personalization/sessions", u.idToken, body)).status,
    200,
  );
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        ...body,
        sessionId: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("/guest/consent/revoke", u.idToken, {})).body.complete,
    true,
  );
  assert.equal(
    (await db.collection(`guestSessions/${u.localId}/sessions`).get()).docs
      .length,
    0,
  );
  await call("/guest/consent", u.idToken, consents);
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        ...body,
        sessionId: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await db
        .doc(`cleanupJobs/${hash(u.localId + ":" + nextMidnightKST())}`)
        .get()
    ).exists,
    true,
  );
});
test("KST midnight rejects active guest reads, restoration and events; cleanup retries delete only new-policy expired data", async (t) => {
  const u = await identity("guest"),
    call = client();
  const expiry = Date.parse("2026-10-20T15:00:00Z");
  t.mock.timers.enable({ apis: ["Date"], now: expiry - 600000 });
  await call("/guest/consent", u.idToken, consents);
  const s = await create(call, u);
  assert.equal(s.expiresAt, expiry);
  const oldId = randomUUID();
  await db.doc(`recommendations/${oldId}`).set({
    owner: u.localId,
    kind: "guest",
    createdAt: Date.now() - 86400000,
    snapshot: { routine: { name: "old protected retention" } },
  });
  t.mock.timers.setTime(expiry - 1);
  assert.equal(
    (await call(`/personalization/sessions/${s.id}`, u.idToken)).status,
    200,
  );
  t.mock.timers.setTime(expiry);
  for (const path of [
    `/personalization/sessions/${s.id}`,
    "/personalization/records",
  ])
    assert.ok([403, 410].includes((await call(path, u.idToken)).status));
  assert.equal(
    (
      await call(`/personalization/sessions/${s.id}/events`, u.idToken, {
        eventId: randomUUID(),
        action: "complete",
        itemId: s.items[0].itemId,
      })
    ).status,
    410,
  );
  const request = db.request.bind(db);
  let fail = true;
  db.request = async (...args: Parameters<typeof db.request>) => {
    const body = args[1] as { writes?: { delete?: string }[] } | undefined;
    if (
      fail &&
      body?.writes?.some((w) =>
        w.delete?.includes(`/guestSessions/${u.localId}/`),
      )
    ) {
      fail = false;
      throw Error("simulated transient delete failure");
    }
    return request(...args);
  };
  try {
    let failures = 0;
    for (let i = 0; i < 100 && !failures; i++)
      failures += (await cleanupExpiredGuests(db, expiry)).failed;
    assert.equal(failures, 1);
    assert.equal(
      (await db.doc(`guestSessions/${u.localId}/sessions/${s.id}`).get())
        .exists,
      true,
    );
    t.mock.timers.setTime(expiry + 120000);
    for (
      let i = 0;
      i < 10 &&
      (await db.doc(`guestSessions/${u.localId}/sessions/${s.id}`).get())
        .exists;
      i++
    )
      await cleanupExpiredGuests(db, Date.now());
    assert.equal(
      (await db.doc(`guestSessions/${u.localId}/sessions/${s.id}`).get())
        .exists,
      false,
    );
    assert.equal((await db.doc(`recommendations/${oldId}`).get()).exists, true);
    await call("/guest/consent", u.idToken, consents);
    assert.equal(
      (
        await call("/personalization/sessions", u.idToken, {
          sessionId: randomUUID(),
          input: daily(),
        })
      ).status,
      200,
    );
  } finally {
    db.request = request;
    t.mock.timers.reset();
  }
});
test("guest records expire rather than transferring to a separately activated member", async () => {
  const guest = await identity("guest"),
    call = client();
  await call("/guest/consent", guest.idToken, consents);
  await create(call, guest);
  const m = await member();
  assert.equal(
    (await call("/personalization/records", m.idToken)).body.records.length,
    0,
  );
  assert.equal(
    (await call("/personalization/records", guest.idToken)).body.records.length,
    1,
  );
});
test("healthy warmup/leisure preserve actual completion, skip reasons, pause/resume and bundle-only feelings", async () => {
  const u = await member(),
    call = client();
  for (const purpose of ["warmup", "leisure"] as const) {
    const s = await create(
      call,
      u,
      daily({
        purpose,
        area: undefined,
        habits: [],
        current: [purpose === "warmup" ? "prep_comfort" : "today_ok"],
        sport: "swimming",
        minutes: 5,
        profile: purpose === "warmup" ? "standing" : "chair",
        poses: purpose === "warmup" ? ["standing"] : ["chair"],
        supports: purpose === "warmup" ? ["dryFloor", "space"] : ["chair"],
      }),
    );
    assert.equal(s.items.length, 5);
    const event = async (b: object) =>
      call(`/personalization/sessions/${s.id}/events`, u.idToken, {
        eventId: randomUUID(),
        ...b,
      });
    assert.equal((await event({ action: "pause" })).status, 200);
    assert.equal(
      (await event({ action: "complete", itemId: s.items[0].itemId })).status,
      409,
    );
    await event({ action: "resume" });
    await event({
      action: "skip",
      itemId: s.items[0].itemId,
      skipReason: "space",
    });
    for (const i of s.items.slice(1))
      await event({ action: "complete", itemId: i.itemId });
    const feeling = await event({
      action: "feedback",
      reaction: purpose === "warmup" ? "ready" : "refreshed",
    });
    assert.equal(feeling.status, 200);
    assert.ok(
      feeling.body.items.every(
        (i: { reaction: unknown }) => i.reaction === null,
      ),
    );
    const memory = (await db.doc(`personalMemory/${u.localId}`).get()).data()!;
    assert.equal(memory.constraints.length, 0);
    assert.ok(
      memory.bundles.some((b: { sessionId: string }) => b.sessionId === s.id),
    );
    assert.equal((await event({ action: "stop" })).status, 409);
  }
});
test("skipping every item never creates a performed feeling; specific discomfort skips create a first adverse memory", async () => {
  const u = await member(),
    call = client();
  const input = daily({
    purpose: "leisure",
    area: undefined,
    habits: [],
    current: ["today_ok"],
    minutes: 5,
    profile: "chair",
    poses: ["chair"],
    supports: ["chair"],
  });
  let s = await create(call, u, input);
  for (const item of s.items)
    await call(`/personalization/sessions/${s.id}/events`, u.idToken, {
      eventId: randomUUID(),
      action: "skip",
      itemId: item.itemId,
      skipReason: "time",
    });
  assert.equal(
    (
      await call(`/personalization/sessions/${s.id}/events`, u.idToken, {
        eventId: randomUUID(),
        action: "feedback",
        reaction: "refreshed",
      })
    ).status,
    409,
  );
  s = await create(call, u, input);
  await call(`/personalization/sessions/${s.id}/events`, u.idToken, {
    eventId: randomUUID(),
    action: "skip",
    itemId: s.items[0].itemId,
    skipReason: "discomfort",
  });
  assert.equal(
    (await db.doc(`personalMemory/${u.localId}`).get()).data()!.constraints
      .length,
    1,
  );
});
test("legacy record deletion removes owned copies and its adverse bootstrap memory, preserving another record", async () => {
  const u = await member(),
    call = client(),
    id = randomUUID(),
    other = randomUUID(),
    rid = randomUUID();
  const row = {
    owner: u.localId,
    kind: "member",
    feedback: "worse",
    recommendationId: rid,
    createdAt: Date.now(),
    snapshot: { routine: { id: "jikkot11-r02", name: "unchanged" } },
  };
  for (const p of [
    `profiles/${u.localId}/records/${id}`,
    `submissions/${id}`,
    `operations/${id}`,
    `recommendations/${rid}`,
  ])
    await db.doc(p).set(row);
  await db
    .doc(`profiles/${u.localId}/records/${other}`)
    .set({ ...row, feedback: "same" });
  await call("/personalization/context", u.idToken);
  assert.equal(
    (await db.doc(`personalMemory/${u.localId}`).get()).data()!.constraints
      .length,
    1,
  );
  assert.equal(
    (await call(`/records/${id}/delete`, u.idToken, {})).status,
    200,
  );
  assert.equal(
    (await db.doc(`personalMemory/${u.localId}`).get()).data()!.constraints
      .length,
    0,
  );
  assert.equal((await db.doc(`operations/${id}`).get()).exists, false);
  assert.equal(
    (await db.doc(`profiles/${u.localId}/records/${other}`).get()).exists,
    true,
  );
});
test("health consent withdrawal deletes all owned health/derived data but leaves the member account and fails closed on retry", async () => {
  const u = await member(),
    call = client();
  await create(call, u);
  const r = await call("/account/health/revoke", u.idToken, {});
  assert.equal(r.body.complete, true);
  assert.equal(
    (await db.doc(`personalMemory/${u.localId}`).get()).exists,
    false,
  );
  assert.equal(
    (await db.collection(`profiles/${u.localId}/sessions`).get()).docs.length,
    0,
  );
  assert.equal((await call("/me", u.idToken)).body.member.needsConsent, true);
  assert.equal(
    (
      await call("/personalization/sessions", u.idToken, {
        sessionId: randomUUID(),
        input: daily(),
      })
    ).status,
    403,
  );
});
test("withdrawal racing with a new recommendation cannot recreate health data", async () => {
  for (const kind of ["member", "guest"] as const) {
    const u = kind === "member" ? await member() : await identity("guest");
    const call = client();
    if (kind === "guest") await call("/guest/consent", u.idToken, consents);
    const id = randomUUID();
    const path = `${kind === "member" ? "profiles" : "guestSessions"}/${u.localId}/sessions/${id}`;
    const request = db.request.bind(db);
    let intercepted = false;
    db.request = async (...args: Parameters<typeof db.request>) => {
      const b = args[1] as
        { writes?: { update?: { name: string } }[] } | undefined;
      if (
        !intercepted &&
        b?.writes?.some((w) => w.update?.name === db.doc(path).name)
      ) {
        intercepted = true;
        const revoked = await call(
          kind === "member"
            ? "/account/health/revoke"
            : "/guest/consent/revoke",
          u.idToken,
          {},
        );
        assert.equal(revoked.status, 200);
      }
      return request(...args);
    };
    try {
      const result = await call("/personalization/sessions", u.idToken, {
        sessionId: id,
        input: daily(),
      });
      assert.equal(result.status, 403);
      assert.ok(intercepted);
      assert.equal((await db.doc(path).get()).exists, false);
      assert.equal(
        (await db.doc(`personalMemory/${u.localId}`).get()).exists,
        false,
      );
    } finally {
      db.request = request;
    }
  }
});
