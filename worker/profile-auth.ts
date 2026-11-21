import type { FirestoreRest } from "./firestore-rest";
import type { Identity } from "./spark-api";

// Pre-Spark profiles were written without authProvider. Recover only the
// authenticated UID's own legacy profile; never search or merge by email.
export async function profileForIdentity(db: FirestoreRest, identity: Identity) {
  const ref = db.doc(`profiles/${identity.uid}`);
  const profile = (await ref.get()).data();
  const provider = identity.firebase.sign_in_provider;
  const recoverable = (p: typeof profile) =>
    p?.active === true &&
    p.uid === identity.uid &&
    p.authProvider == null &&
    (provider === "password" || provider === "google.com");
  if (!recoverable(profile)) return profile;
  return db.runTransaction(async (tx) => {
    const latest = (await tx.get(ref)).data();
    if (!recoverable(latest)) return latest;
    const recovered = { ...latest, authProvider: provider };
    tx.set(ref, recovered);
    return recovered;
  });
}

export function loginMethodMessage(provider: unknown) {
  if (provider === "password")
    return "이 계정은 이메일·비밀번호로 가입했어요. 이메일로 로그인하거나 비밀번호를 재설정해주세요.";
  if (provider === "google.com")
    return "이 계정은 구글로 가입했어요. Google로 계속하기를 선택해주세요.";
  return "계정의 로그인 정보를 확인하지 못했어요. 고객 지원에 문의해주세요.";
}
