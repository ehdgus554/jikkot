import { importPKCS8, SignJWT } from "jose";
import type { DocumentData } from "firebase/firestore";
export type SparkEnv = {
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_WEB_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  FIREBASE_AUTH_HELPER_HOST?: string;
  ALLOWED_ORIGINS?: string;
};
type Value = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  stringValue?: string;
  timestampValue?: string;
  arrayValue?: { values?: Value[] };
  mapValue?: { fields?: Record<string, Value> };
  referenceValue?: string;
};
export function encode(value: unknown): Value {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number")
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object")
    return { mapValue: { fields: fields(value as DocumentData) } };
  throw new Error("Unsupported Firestore value");
}
export function fields(value: DocumentData): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, encode(item)]),
  );
}
export function decode(value: Value): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("timestampValue" in value) return new Date(value.timestampValue!);
  if ("arrayValue" in value)
    return (value.arrayValue?.values ?? []).map(decode);
  return Object.fromEntries(
    Object.entries(value.mapValue?.fields ?? {}).map(([key, item]) => [
      key,
      decode(item),
    ]),
  );
}
let cached: { key: string; token: string; expires: number } | undefined;
async function accessToken(env: SparkEnv) {
  const key = env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) throw new Error("Firestore server credential is not configured");
  if (cached?.key === key && cached.expires > Date.now() + 60000)
    return cached.token;
  const account = JSON.parse(key);
  if (
    account.type !== "service_account" ||
    account.project_id !== env.FIREBASE_PROJECT_ID ||
    !account.client_email?.endsWith(
      `@${env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
    )
  )
    throw new Error("Service account project mismatch");
  const privateKey = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/datastore",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(privateKey);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !result.access_token)
    throw new Error("Firestore server authorization failed");
  cached = {
    key,
    token: result.access_token,
    expires: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}
export class FirestoreError extends Error {
  constructor(public status: number) {
    super("Firestore request failed");
  }
}
type Write = {
  update?: { name: string; fields: Record<string, Value> };
  delete?: string;
  updateMask?: { fieldPaths: string[] };
  currentDocument?: { exists?: boolean; updateTime?: string };
};
export class FirestoreRest {
  readonly database: string;
  readonly base: string;
  constructor(
    readonly env: SparkEnv,
    readonly emulatorOrigin?: string,
  ) {
    if (
      !env.FIREBASE_PROJECT_ID ||
      !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(env.FIREBASE_PROJECT_ID)
    )
      throw new Error("Firebase project is not configured");
    this.database = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)`;
    this.base = `${emulatorOrigin ?? "https://firestore.googleapis.com"}/v1/${this.database}`;
  }
  async request(
    suffix: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
  ) {
    const token = this.emulatorOrigin ? "owner" : await accessToken(this.env);
    const response = await fetch(this.base + suffix, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new FirestoreError(response.status);
    return response.json();
  }
  doc(path: string) {
    return new DocumentRef(this, path);
  }
  collection(path: string) {
    return new Query(this, path);
  }
  async runTransaction<T>(
    handler: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    // Atomic compare-and-swap commit: every read is guarded by its observed version.
    // This uses the documented REST write preconditions, including unchanged reads.
    for (let attempt = 0; attempt < 5; attempt++) {
      const tx = new Transaction(this);
      try {
        const result = await handler(tx);
        const writes = tx.commitWrites();
        if (writes.length) await this.request("/documents:commit", { writes });
        return result;
      } catch (error) {
        if (
          !(error instanceof FirestoreError) ||
          ![409, 412].includes(error.status) ||
          attempt === 4
        )
          throw error;
      }
    }
    throw new Error("Transaction retries exhausted");
  }
}
class Snapshot {
  readonly exists: boolean;
  readonly id: string;
  constructor(
    readonly ref: DocumentRef,
    readonly raw?: { fields?: Record<string, Value>; updateTime?: string },
  ) {
    this.exists = Boolean(raw);
    this.id = ref.path.split("/").at(-1)!;
  }
  data(): DocumentData | undefined {
    return this.raw
      ? Object.fromEntries(
          Object.entries(this.raw.fields ?? {}).map(([key, value]) => [
            key,
            decode(value),
          ]),
        )
      : undefined;
  }
}
export class DocumentRef {
  readonly name: string;
  constructor(
    readonly db: FirestoreRest,
    readonly path: string,
  ) {
    this.name = `${db.database}/documents/${path}`;
  }
  async get(transaction?: string) {
    try {
      return new Snapshot(
        this,
        await this.db.request(
          `/documents/${this.path}${transaction ? `?transaction=${encodeURIComponent(transaction)}` : ""}`,
        ),
      );
    } catch (error) {
      if (error instanceof FirestoreError && error.status === 404)
        return new Snapshot(this);
      throw error;
    }
  }
  async set(data: DocumentData) {
    await this.db.request("/documents:commit", {
      writes: [{ update: { name: this.name, fields: fields(data) } }],
    });
  }
  async delete() {
    await this.db.request("/documents:commit", {
      writes: [{ delete: this.name }],
    });
  }
}
class Transaction {
  readonly writes: Write[] = [];
  private readonly reads = new Map<string, Snapshot>();
  constructor(readonly db: FirestoreRest) {}
  async get(ref: DocumentRef) {
    if (this.writes.length)
      throw new Error("Transaction reads must precede writes");
    const snap = this.reads.get(ref.name) ?? (await ref.get());
    this.reads.set(ref.name, snap);
    return snap;
  }
  set(ref: DocumentRef, data: DocumentData) {
    this.writes.push({ update: { name: ref.name, fields: fields(data) } });
  }
  create(ref: DocumentRef, data: DocumentData) {
    this.writes.push({
      update: { name: ref.name, fields: fields(data) },
      currentDocument: { exists: false },
    });
  }
  update(ref: DocumentRef, data: DocumentData) {
    this.writes.push({
      update: { name: ref.name, fields: fields(data) },
      updateMask: { fieldPaths: Object.keys(data) },
      currentDocument: { exists: true },
    });
  }
  delete(ref: DocumentRef) {
    this.writes.push({ delete: ref.name });
  }
  commitWrites(): Write[] {
    const output = [...this.writes];
    for (const [name, snapshot] of this.reads) {
      const write = output.find(
        (item) => (item.update?.name ?? item.delete) === name,
      );
      const condition = snapshot.exists
        ? { updateTime: snapshot.raw!.updateTime! }
        : { exists: false };
      if (write) write.currentDocument = condition;
      else
        output.push(
          snapshot.exists
            ? {
                update: { name, fields: snapshot.raw!.fields ?? {} },
                currentDocument: condition,
              }
            : { delete: name, currentDocument: condition },
        );
    }
    return output;
  }
}
class Query {
  private orders: { field: { fieldPath: string }; direction: string }[] = [];
  private cursor?: { values: Value[]; before: boolean };
  private count = 100;
  constructor(
    readonly db: FirestoreRest,
    readonly path: string,
  ) {}
  orderBy(field: string, direction: string) {
    this.orders.push({
      field: { fieldPath: field },
      direction: direction === "desc" ? "DESCENDING" : "ASCENDING",
    });
    return this;
  }
  startAfter(time: number, id: string) {
    this.cursor = {
      values: [
        encode(time),
        { referenceValue: `${this.db.database}/documents/${this.path}/${id}` },
      ],
      before: false,
    };
    return this;
  }
  limit(count: number) {
    this.count = count;
    return this;
  }
  async get() {
    const parts = this.path.split("/");
    const collectionId = parts.pop()!;
    const parent = parts.length
      ? `/documents/${parts.join("/")}`
      : "/documents";
    const rows = (await this.db.request(`${parent}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId }],
        orderBy: this.orders,
        limit: this.count,
        ...(this.cursor ? { startAt: this.cursor } : {}),
      },
    })) as { document?: { name: string; fields: Record<string, Value> } }[];
    return {
      docs: rows
        .filter((row) => row.document)
        .map(
          (row) =>
            new Snapshot(
              this.db.doc(row.document!.name.split("/documents/")[1]),
              row.document,
            ),
        ),
    };
  }
}
