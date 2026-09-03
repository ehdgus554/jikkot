import { getDatabase } from "@/lib/server-db";

export const SESSION_COOKIE = "jikkot_session";
export const GUEST_COOKIE = "jikkot_guest";
export const SESSION_DAYS = 30;
export const PASSWORD_ITERATIONS = 210_000;

export type MemberRecord = {
  id: string;
  username: string;
  tier: "member" | "lifetime" | "admin";
};

type PasswordRecord = MemberRecord & {
  password_hash: string;
  password_salt: string;
  password_iterations: string;
};

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBase64(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToBase64(bytes);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateCredentials(username: string, password: string) {
  if (!/^[a-z0-9_]{4,20}$/.test(username)) {
    return "아이디는 영문 소문자, 숫자, 밑줄 4~20자로 입력해주세요.";
  }
  if (password.length < 8 || password.length > 72) {
    return "비밀번호는 8~72자로 입력해주세요.";
  }
  return null;
}

export async function createPasswordRecord(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    hash: await derivePassword(password, salt, PASSWORD_ITERATIONS),
    salt: bytesToBase64(salt),
    iterations: String(PASSWORD_ITERATIONS),
  };
}

export async function verifyPassword(password: string, member: PasswordRecord) {
  const candidate = await derivePassword(
    password,
    base64ToBytes(member.password_salt),
    Number(member.password_iterations),
  );
  return constantTimeEqual(candidate, member.password_hash);
}

export async function findMemberForLogin(username: string) {
  return getDatabase()
    .prepare(
      `SELECT id, username, tier, password_hash, password_salt, password_iterations
       FROM members
       WHERE username = ?
       LIMIT 1`,
    )
    .bind(username)
    .first<PasswordRecord>();
}

export function parseCookies(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = new Map<string, string>();
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (key) cookies.set(key, decodeURIComponent(value));
  }
  return cookies;
}

function cookieSecurity(request: Request) {
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

export async function prepareSession(memberId: string, request: Request) {
  const token = randomBase64(32);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${cookieSecurity(request)}`;
  return { tokenHash, expiresAt, cookie, memberId };
}

export async function getSessionMember(request: Request): Promise<MemberRecord | null> {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  return getDatabase()
    .prepare(
      `SELECT members.id, members.username, members.tier
       FROM sessions
       INNER JOIN members ON members.id = sessions.member_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first<MemberRecord>();
}

export async function sessionTokenHash(request: Request) {
  const token = parseCookies(request).get(SESSION_COOKIE);
  return token ? sha256(token) : null;
}

export function clearSessionCookie(request: Request) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecurity(request)}`;
}

export function getOrCreateGuest(request: Request) {
  const existing = parseCookies(request).get(GUEST_COOKIE);
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) {
    return { guestId: existing, cookie: null as string | null };
  }
  const guestId = crypto.randomUUID();
  const cookie = `${GUEST_COOKIE}=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${cookieSecurity(request)}`;
  return { guestId, cookie };
}

export function getKstDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function json(data: unknown, init: ResponseInit = {}, cookie?: string | null) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(data), { ...init, headers });
}
