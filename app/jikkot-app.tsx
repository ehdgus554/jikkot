"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  reauthenticateWithPopup,
} from "firebase/auth";
import { api, configured, firebaseAuth } from "../lib/firebase-client";
import { consentPolicy, guestRetentionCopy } from "../lib/service/policy";
import { PersonalizedExperience } from "../components/personalized-experience";
import { ServicePolicy } from "../components/service-policy";
import { ServicePreparation } from "../components/service-preparation";
import { Header, PrimaryButton } from "../components/jikkot-ui";
import type { Purpose } from "../lib/personalization/types";
import { nicknameSchema } from "../lib/service/nickname";
type Member = {
  uid: string;
  nickname: string | null;
  username: string | null;
  needsNickname: boolean;
  needsConsent: boolean;
};
type Me = {
  member: Member | null;
  kind: "member" | "guest" | "pending";
  guestConsent: boolean;
};
type Entry =
  | "login"
  | "signup"
  | "consent"
  | "profile"
  | "recover"
  | "policy"
  | "delete"
  | null;
const emptyConsent = {
  privacy: false,
  healthPersonalization: false,
  nonMedical: false,
};
export default function JikkotApp() {
  return __JIKKOT_PREPARATION__ ? <ServicePreparation /> : <ConnectedApp />;
}
function ConnectedApp() {
  const [uid, setUid] = useState(""),
    [member, setMember] = useState<Member | null>(null),
    [entry, setEntry] = useState<Entry>(null),
    [loading, setLoading] = useState(configured),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [nickname, setNickname] = useState(""),
    [consents, setConsents] = useState(emptyConsent),
    [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [intent, setIntent] = useState<Purpose | undefined>();
  const policyReturn = useRef<Entry>(null);
  const guard = useRef(false),
    authAction = useRef(false);
  const clearLocal = () => {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("jikkot.")) sessionStorage.removeItem(key);
    localStorage.removeItem("jikkot.progress.v1");
  };
  const refresh = useCallback(async () => {
    const user = firebaseAuth().currentUser;
    setUid(user?.uid ?? "");
    if (!user) {
      setMember(null);
      setEntry(null);
      return;
    }
    const me = await api<Me>("/me");
    setMember(me.member);
    if (me.kind === "pending") {
      setEmail(user.email ?? "");
      setEntry("profile");
    } else if (me.member?.needsNickname) setEntry("profile");
    else if (me.member?.needsConsent) setEntry("consent");
    else setEntry(null);
  }, []);
  const run = async (fn: () => Promise<void>) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      const messages: Record<string, string> = {
        "auth/popup-closed-by-user": "로그인이 취소됐어요.",
        "auth/cancelled-popup-request": "로그인이 취소됐어요.",
        "auth/invalid-credential": "이메일 또는 비밀번호를 확인해주세요.",
        "auth/email-already-in-use":
          "이미 가입된 이메일이에요. 로그인하거나 비밀번호를 재설정해주세요.",
        "auth/network-request-failed": "연결을 확인하고 다시 시도해주세요.",
        "auth/too-many-requests": "잠시 후 다시 시도해주세요.",
      };
      setError(
        messages[code] ??
          (code.startsWith("auth/")
            ? "인증을 완료하지 못했어요. 다시 시도해주세요."
            : e instanceof Error
              ? ((e as Error & { issues?: { message: string }[] }).issues?.[0]
                  ?.message ?? e.message)
              : "다시 시도해주세요."),
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!configured) return;
    let active = true;
    let first = true;
    const auth = firebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, () => {
      if (authAction.current || !active) return;
      void (async () => {
        try {
          if (first) {
            first = false;
            await getRedirectResult(auth);
          }
          if (active) await refresh();
        } catch (e) {
          if (active)
            setError(
              e instanceof Error ? e.message : "인증을 확인하지 못했어요.",
            );
        } finally {
          if (active) setLoading(false);
        }
      })();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);
  useEffect(() => {
    void Promise.all([
      document.fonts.load('400 16px "LINE Seed KR"', "직꼿"),
      document.fonts.load('700 16px "LINE Seed KR"', "직꼿"),
    ])
      .then((v) => {
        if (v.some((xs) => !xs.length))
          setError("화면 글꼴을 불러오지 못했어요. 새로고침해주세요.");
      })
      .catch(() =>
        setError("화면 글꼴을 불러오지 못했어요. 새로고침해주세요."),
      );
  }, []);
  const authenticate = async (fn: () => Promise<unknown>) => {
    authAction.current = true;
    try {
      const previous = firebaseAuth().currentUser?.uid;
      await fn();
      if (previous !== firebaseAuth().currentUser?.uid) clearLocal();
      await refresh();
    } finally {
      authAction.current = false;
      setLoading(false);
    }
  };
  const open = (view: Entry) => {
    setError("");
    setNotice("");
    setEntry(view);
    setConsents(emptyConsent);
  };
  const accepted = Object.values(consents).every(Boolean);
  const activate = () =>
    run(async () => {
      const name = nicknameSchema.parse(nickname);
      if (!accepted) throw Error("세 가지 필수 안내를 확인해주세요.");
      if (member?.needsNickname) {
        await api("/account/nickname", { nickname: name });
        await api("/account/consent", {
          ...consents,
          version: consentPolicy.version,
        });
        await refresh();
        return;
      }
      const user = firebaseAuth().currentUser;
      if (!user || user.isAnonymous) throw Error("인증을 먼저 완료해주세요.");
      await api(
        user.providerData.some((p) => p.providerId === "google.com")
          ? "/social/activate"
          : "/signup",
        {
          nickname: name,
          consents: { ...consents, version: consentPolicy.version },
        },
      );
      clearLocal();
      await refresh();
    });
  const agree = () =>
    run(async () => {
      if (!accepted) throw Error("세 가지 필수 안내를 확인해주세요.");
      authAction.current = true;
      try {
        if (!firebaseAuth().currentUser)
          await signInAnonymously(firebaseAuth());
        await api(member ? "/account/consent" : "/guest/consent", {
          ...consents,
          version: consentPolicy.version,
        });
        await refresh();
      } finally {
        authAction.current = false;
      }
    });
  const logout = () =>
    run(async () =>
      authenticate(async () => {
        await signOut(firebaseAuth());
        setNotice("로그아웃했어요.");
      }),
    );
  const deleteAccount = () =>
    run(async () => {
      if (!deleteConfirmed) throw Error("계정 삭제 확인을 선택해주세요.");
      const user = firebaseAuth().currentUser;
      if (!user) throw Error("다시 로그인해주세요.");
      if (user.providerData.some((p) => p.providerId === "password"))
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email!, password),
        );
      else await reauthenticateWithPopup(user, new GoogleAuthProvider());
      authAction.current = true;
      try {
        for (let i = 0; i < 100; i++) {
          const result = await api<{ complete: boolean }>(
            "/account/delete",
            {},
          );
          if (result.complete) {
            await signOut(firebaseAuth());
            clearLocal();
            setUid("");
            setMember(null);
            setEntry(null);
            setNotice("계정과 이용 기록을 삭제했어요.");
            return;
          }
        }
        throw Error("삭제 작업이 남아 있어요. 다시 시도해주세요.");
      } finally {
        authAction.current = false;
      }
    });
  const consentFields = (
    <fieldset className="release-consents">
      <legend>필수 안내</legend>
      {(
        [
          ["privacy", "계정·개인정보 처리 동의"],
          ["healthPersonalization", "건강 관련 입력 처리에 대한 별도 동의"],
          ["nonMedical", "일반 몸풀기 안내·비의료 서비스 확인"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={consents[key]}
            onChange={(e) =>
              setConsents({ ...consents, [key]: e.target.checked })
            }
          />
          {label}
        </label>
      ))}
      <button
        type="button"
        className="text-button"
        onClick={() => {
          policyReturn.current = entry;
          setEntry("policy");
        }}
      >
        동의 상세와 개인정보 처리방침
      </button>
    </fieldset>
  );
  return (
    <main className="app release-app">
      <section className="screen" aria-busy={busy || loading}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="note" role="status">
            {notice}
          </p>
        )}
        {loading ? (
          <>
            <Header />
            <h1>잠깐만 기다려주세요</h1>
            <p role="status">인증을 확인하고 있어요.</p>
          </>
        ) : entry ? (
          <>
            <Header
              back={() => {
                setEntry(entry === "policy" ? policyReturn.current : null);
                setError("");
              }}
              busy={busy}
            />
            {entry === "policy" ? (
              <>
                <ServicePolicy />
                <PrimaryButton onClick={() => setEntry(policyReturn.current)}>
                  돌아가기
                </PrimaryButton>
              </>
            ) : null}
            {entry === "login" && (
              <>
                <h1>다시 만나 반가워요</h1>
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() =>
                      authenticate(() =>
                        signInWithEmailAndPassword(
                          firebaseAuth(),
                          email,
                          password,
                        ),
                      ),
                    );
                  }}
                >
                  <label>
                    이메일
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label>
                    비밀번호
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <PrimaryButton type="submit" disabled={busy}>
                    로그인
                  </PrimaryButton>
                </form>
                <button
                  className="secondary"
                  onClick={() =>
                    run(async () => {
                      authAction.current = true;
                      try {
                        const auth = firebaseAuth(),
                          provider = new GoogleAuthProvider();
                        if (
                          matchMedia("(pointer: coarse)").matches &&
                          !import.meta.env.DEV
                        )
                          await signInWithRedirect(auth, provider);
                        else await signInWithPopup(auth, provider);
                        clearLocal();
                        await refresh();
                      } finally {
                        authAction.current = false;
                      }
                    })
                  }
                >
                  Google로 계속하기
                </button>
                <button className="text-button" onClick={() => open("signup")}>
                  이메일로 가입하기
                </button>
                <button className="text-button" onClick={() => open("recover")}>
                  비밀번호를 잊으셨나요?
                </button>
              </>
            )}
            {entry === "signup" && (
              <>
                <h1>가볍게 시작해볼까요?</h1>
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      nicknameSchema.parse(nickname);
                      if (!accepted) throw Error("필수 안내를 확인해주세요.");
                      if (password.length < 8 || password !== confirmation)
                        throw Error(
                          "비밀번호를 8자 이상 입력하고 일치하는지 확인해주세요.",
                        );
                      authAction.current = true;
                      try {
                        const auth = firebaseAuth();
                        if (
                          !auth.currentUser ||
                          auth.currentUser.isAnonymous ||
                          auth.currentUser.email !== email
                        ) {
                          if (auth.currentUser) await signOut(auth);
                          await createUserWithEmailAndPassword(
                            auth,
                            email,
                            password,
                          );
                        }
                        await api("/signup", {
                          nickname: nickname.trim(),
                          consents: {
                            ...consents,
                            version: consentPolicy.version,
                          },
                        });
                        clearLocal();
                        await refresh();
                      } finally {
                        authAction.current = false;
                      }
                    });
                  }}
                >
                  <label>
                    이메일
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label>
                    비밀번호
                    <input
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <label>
                    비밀번호 확인
                    <input
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      required
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </label>
                  <label>
                    닉네임
                    <input
                      autoComplete="nickname"
                      required
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="2~20글자"
                    />
                  </label>
                  {consentFields}
                  <PrimaryButton type="submit" disabled={busy || !accepted}>
                    가입하기
                  </PrimaryButton>
                </form>
                <p className="note">
                  비회원 기록은 가입한 회원 기록으로 옮겨지지 않아요.
                </p>
              </>
            )}
            {entry === "profile" && (
              <>
                <h1>어떻게 불러드릴까요?</h1>
                <p>직접 정한 닉네임을 사용해요. 기존 기록은 유지돼요.</p>
                <label>
                  닉네임
                  <input
                    value={nickname}
                    autoComplete="nickname"
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="2~20글자"
                  />
                </label>
                {consentFields}
                <PrimaryButton onClick={activate} disabled={busy || !accepted}>
                  닉네임과 동의 저장
                </PrimaryButton>
              </>
            )}
            {entry === "consent" && (
              <>
                <h1>시작 전에 확인해주세요</h1>
                <p>
                  {member
                    ? "새 이용 안내를 확인해주세요. 기존 기록은 유지돼요."
                    : guestRetentionCopy}
                </p>
                {consentFields}
                <PrimaryButton onClick={agree} disabled={busy || !accepted}>
                  동의하고 시작
                </PrimaryButton>
              </>
            )}
            {entry === "recover" && (
              <>
                <h1>비밀번호를 잊으셨나요?</h1>
                <label>
                  이메일
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <PrimaryButton
                  disabled={busy || !email}
                  onClick={() =>
                    run(async () => {
                      await sendPasswordResetEmail(firebaseAuth(), email);
                      setNotice("입력한 이메일의 재설정 안내를 확인해주세요.");
                      setEntry("login");
                    })
                  }
                >
                  재설정 메일 보내기
                </PrimaryButton>
              </>
            )}
            {entry === "delete" && (
              <>
                <h1>계정을 삭제할까요?</h1>
                <p>
                  회원 기록과 개인화 정보, 인증 계정을 삭제해요. 되돌릴 수
                  없어요.
                </p>
                {firebaseAuth().currentUser?.providerData.some(
                  (p) => p.providerId === "password",
                ) && (
                  <label>
                    비밀번호 재확인
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                )}
                <label className="release-check">
                  <input
                    type="checkbox"
                    checked={deleteConfirmed}
                    onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  />
                  계정과 기록 삭제를 확인했어요
                </label>
                <PrimaryButton
                  disabled={busy || !deleteConfirmed}
                  onClick={deleteAccount}
                >
                  계정 삭제
                </PrimaryButton>
              </>
            )}
          </>
        ) : (
          <PersonalizedExperience
            key={uid || "public"}
            uid={uid}
            memberName={member?.nickname ?? null}
            onLogin={(purpose) => {
              setIntent(purpose);
              open("login");
            }}
            initialPurpose={intent}
            onIntentConsumed={() => setIntent(undefined)}
            onGuestConsent={() => {
              setIntent("daily");
              open("consent");
            }}
            onLogout={logout}
            onPolicy={() => {
              policyReturn.current = null;
              open("policy");
            }}
            onDeleteAccount={() => open("delete")}
          />
        )}
      </section>
    </main>
  );
}
