"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { api, apiBase, configured, firebaseAuth } from "@/lib/firebase-client";
import {
  areas,
  getRoutine,
  type Routine,
  type MovementMode,
  type AreaCode,
} from "./jikkot-data";
import {
  CONTENT_VERSION,
  postureLabels,
  feedbackLabels,
  featureFlags,
  habitQuestions,
  recentQuestions,
  catalog,
  extensions,
  type Answers,
  type Feedback,
} from "@/lib/service/recommendation";
import {
  fresh,
  restore,
  PROGRESS_KEY,
  type Progress,
  type Screen,
  type Owner,
} from "@/lib/service/progress";
import { RoutineMedia } from "@/components/routine-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { consentPolicy } from "@/lib/service/policy";
import { ServicePreparation } from "@/components/service-preparation";
import { previewRecommendation } from "@/lib/service/public-preview";
type Member = { uid: string; username: string | null; nickname: string };
type Me = {
  member: Member | null;
  kind: "member" | "guest" | "pending";
  guestConsent: boolean;
};
type Rec = {
  recommendationId: string;
  reason: string;
  snapshot: {
    answers: Answers;
    pattern: string;
    routine: Pick<Routine, "id" | "name" | "image" | "cue" | "dose" | "comfort">;
    area: { id: AreaCode; label: string };
    habits: { id: string; label: string }[];
    recent: { id: string; label: string }[];
    contentVersion: string;
  };
  feedback?: Feedback;
  submissionId?: string;
};
type RecordRow = {
  id: string;
  createdAt: number;
  feedback: Feedback;
  snapshot: Rec["snapshot"];
  changes: { id: string; label: string }[];
};
type Entry =
  | "splash"
  | "choice"
  | "guest-consent"
  | "blocked"
  | "login"
  | "signup"
  | "recover"
  | "social-consent"
  | null;
const consentVersion = consentPolicy.version;
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
function Action({
  label,
  onClick,
  busy,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      className="min-h-12 h-auto w-full whitespace-normal rounded-xl px-4 py-3"
      onClick={onClick}
      disabled={busy || disabled}
    >
      {label}
    </Button>
  );
}
export default function JikkotApp() {
  return __JIKKOT_PREPARATION__ ? (
    <ServicePreparation />
  ) : (
    <ConnectedJikkotApp />
  );
}

function ConnectedJikkotApp() {
  const preview = !configured;
  const [entry, setEntry] = useState<Entry>(configured ? "splash" : "choice"),
    [p, setP] = useState<Progress | null>(null),
    [member, setMember] = useState<Member | null>(null),
    [rec, setRec] = useState<Rec | null>(null),
    [records, setRecords] = useState<RecordRow[]>([]);
  const [providers, setProviders] = useState({
    google: true,
    kakao: false,
    naver: false,
  });
  const [recordCursor, setRecordCursor] = useState<{
    createdAt: number;
    id: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [modal, setModal] = useState<"login" | "limit" | "preparing" | null>(null);
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [nickname, setNickname] = useState("");
  const [confirmed, setConfirmed] = useState({ username: "", nickname: "" }),
    [consents, setConsents] = useState({ privacy: false, nonMedical: false }),
    [foundUsername, setFoundUsername] = useState("");
  const authAction = useRef(false),
    pRef = useRef<Progress | null>(null);
  useEffect(() => {
    pRef.current = p;
  }, [p]);
  const update = useCallback(
    (changes: Partial<Progress>) =>
      setP((old) =>
        old ? { ...old, ...changes, updatedAt: Date.now() } : old,
      ),
    [],
  );
  const show = (screen: Screen) => {
    setError("");
    update({ screen });
  };
  const reset = () => {
    if (p) {
      setP(fresh(p.owner, p.guestConsent));
      setRec(null);
      setRecords([]);
      setModal(null);
      setError("");
    }
  };
  const clearLocal = () => {
    setMember(null);
    localStorage.removeItem(PROGRESS_KEY);
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("jikkot."))
      .forEach((key) => sessionStorage.removeItem(key));
    setP(null);
    setRec(null);
    setRecords([]);
    setRecordCursor(null);
    setPassword("");
    setUsername("");
    setEmail("");
    setNickname("");
    setFoundUsername("");
    setConfirmed({ username: "", nickname: "" });
    setConsents({ privacy: false, nonMedical: false });
  };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if ((e as { code?: string }).code === "DAILY_LIMIT") setModal("limit");
      else {
        const code = (e as { code?: string }).code ?? "";
        const messages: Record<string, string> = {
          "auth/popup-closed-by-user":
            "로그인이 취소되었습니다. 원하는 방법으로 다시 시도해주세요.",
          "auth/cancelled-popup-request": "로그인이 취소되었습니다.",
          "auth/operation-not-allowed": "이 인증 방법은 연결 준비 중입니다.",
          "auth/invalid-credential": "이메일 또는 비밀번호를 확인해주세요.",
          "auth/email-already-in-use":
            "이미 가입한 이메일입니다. 로그인하거나 비밀번호를 재설정해주세요.",
          "auth/invalid-email": "이메일 주소를 확인해주세요.",
          "auth/weak-password": "비밀번호는 8자 이상으로 입력해주세요.",
          "auth/too-many-requests":
            "요청이 많습니다. 잠시 후 다시 시도해주세요.",
        };
        setError(
          messages[code] ??
            (e instanceof Error ? e.message : "다시 시도해주세요."),
        );
      }
    } finally {
      setBusy(false);
    }
  };
  const establish = useCallback(async (resetProgress = false) => {
    if (resetProgress) {
      setRec(null);
      setRecords([]);
      setRecordCursor(null);
    }
    const user = firebaseAuth().currentUser;
    if (!user) {
      setMember(null);
      setP(null);
      setEntry("choice");
      return;
    }
    const me = await api<Me>("/me");
    setMember(me.member);
    if (me.kind === "pending") {
      setP(null);
      setEntry(
        user.providerData.some((q) => q.providerId === "password")
          ? "signup"
          : "social-consent",
      );
      return;
    }
    const owner: Owner = { kind: me.kind, id: user.uid };
    const saved = resetProgress
      ? null
      : restore(localStorage.getItem(PROGRESS_KEY), owner);
    if (
      me.kind === "guest" &&
      (!me.guestConsent ||
        localStorage.getItem("jikkot.guest-declined") === "true")
    ) {
      setP(null);
      setEntry("choice");
      return;
    }
    if (saved) {
      if (
        saved.recommendationId &&
        ["routine", "feedback", "complete", "changes", "no-next"].includes(
          saved.screen,
        )
      ) {
        try {
          setRec(await api<Rec>(`/recommendations/${saved.recommendationId}`));
        } catch (e) {
          if (
            ["NOT_FOUND", "OWNER_MISMATCH"].includes(
              (e as { code?: string }).code ?? "",
            )
          ) {
            setP(fresh(owner, me.guestConsent));
            setEntry(null);
            return;
          }
          throw e;
        }
      }
      setP(saved);
    } else setP(fresh(owner, me.guestConsent));
    setEntry(null);
  }, []);
  useEffect(() => {
    if (!configured) return;
    let stopped = false;
    const auth = firebaseAuth();
    let first = true;
    const params = new URLSearchParams(location.search);
    const code = params.get("oauthCode"),
      oauthError = params.get("oauthError");
    const unsubscribe = onAuthStateChanged(auth, () => {
      if (authAction.current || stopped) return;
      if (first) {
        first = false;
        if (oauthError) return;
        void (async () => {
          try {
            await getRedirectResult(auth);
            await new Promise((r) => setTimeout(r, 250));
            if (!stopped) await establish();
          } catch (e) {
            if (!stopped) {
              setError(
                e instanceof Error ? e.message : "인증을 확인하지 못했습니다.",
              );
              setEntry("splash");
            }
          }
        })();
      } else void establish(true).catch((e) => setError(e.message));
    });
    if (code) {
      authAction.current = true;
      history.replaceState({}, "", location.pathname);
      void (async () => {
        try {
          const verifier = sessionStorage.getItem("jikkot.oauth.verifier");
          sessionStorage.removeItem("jikkot.oauth.verifier");
          const r = await api<{ customToken: string }>(
            "/oauth/exchange",
            { code, verifier },
            false,
          );
          await signInWithCustomToken(auth, r.customToken);
          localStorage.removeItem(PROGRESS_KEY);
          await establish(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "인증에 실패했습니다.");
          setEntry("login");
        } finally {
          authAction.current = false;
        }
      })();
    } else if (oauthError) {
      history.replaceState({}, "", location.pathname);
      queueMicrotask(() => {
        setError(
          "소셜 인증이 취소되었거나 실패했습니다. 원하는 방법으로 다시 시도해주세요.",
        );
        setEntry("login");
      });
    }
    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [establish]);
  useEffect(() => {
    if (p && !entry && configured) {
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
      } catch {
        queueMicrotask(() =>
          setError("이 브라우저에서 진행 상태를 저장하지 못했습니다."),
        );
      }
    }
  }, [p, entry]);
  useEffect(() => {
    if (!entry && p?.screen === "records") {
      let active = true;
      void api<{
        records: RecordRow[];
        nextCursor: { createdAt: number; id: string } | null;
      }>("/records")
        .then((r) => {
          if (active) {
            setRecords(r.records);
            setRecordCursor(r.nextCursor);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      return () => {
        active = false;
      };
    }
  }, [entry, p?.screen]);
  const authenticate = async (fn: () => Promise<void>) => {
    if (preview)
      throw new Error(
        "미리보기에서는 로그인·가입이 제공되지 않습니다. Firebase 연결 후 이용할 수 있어요.",
      );
    authAction.current = true;
    try {
      await fn();
      clearLocal();
      await establish(true);
    } finally {
      authAction.current = false;
    }
  };
  const beginLogin = () => {
    setModal(null);
    setEntry("login");
    setError("");
    setConsents({ privacy: false, nonMedical: false });
  };
  const requireMember = (screen: Screen) => {
    if (!member) setModal("login");
    else {
      update({ returnScreen: p?.screen, screen });
      setError("");
    }
  };
  const logout = () =>
    run(async () => {
      authAction.current = true;
      try {
        await signOut(firebaseAuth());
        clearLocal();
        setMember(null);
        setEntry("choice");
      } finally {
        authAction.current = false;
      }
    });
  const beginGuest = () =>
    run(async () => {
      if (preview) {
        setP(fresh({ kind: "guest", id: "public-preview" }, true));
        setRec(null);
        setEntry(null);
        return;
      }
      authAction.current = true;
      try {
        if (
          firebaseAuth().currentUser &&
          !firebaseAuth().currentUser?.isAnonymous
        )
          await signOut(firebaseAuth());
        if (!firebaseAuth().currentUser)
          await signInAnonymously(firebaseAuth());
        localStorage.removeItem("jikkot.guest-declined");
        await api("/guest/consent", {
          nonMedical: true,
          version: consentVersion,
        });
        clearLocal();
        await establish(true);
      } finally {
        authAction.current = false;
      }
    });
  const start = () =>
    run(async () => {
      if (preview) {
        setRec(null);
        setP({ ...fresh(p!.owner, true), screen: "posture" });
        return;
      }
      const result = await api<{ allowed: boolean }>("/eligibility");
      if (!result.allowed) {
        setModal("limit");
        return;
      }
      setP(fresh(p!.owner, p!.guestConsent));
      update({ screen: "posture" });
    });
  const recommend = () =>
    run(async () => {
      if (!p?.answers.recent?.length)
        throw new Error("최근 상태를 하나 이상 선택해주세요.");
      const rid = p.recommendationId ?? crypto.randomUUID();
      if (preview) {
        const result = previewRecommendation(p.answers, rid);
        setRec(result);
        update({
          recommendationId: rid,
          routineId: result.snapshot.routine.id,
          screen: "routine",
        });
        return;
      }
      const pending = {
        ...p,
        screen: "analysis" as const,
        recommendationId: rid,
        updatedAt: Date.now(),
      };
      setP(pending);
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(pending));
      const r = await api<Rec>("/recommendations", {
        recommendationId: rid,
        answers: p.answers,
      });
      setRec(r);
      update({ screen: "routine", routineId: r.snapshot.routine.id });
    });
  const feedback = () =>
    run(async () => {
      if (!p?.feedback || !p.recommendationId)
        throw new Error("피드백을 선택해주세요.");
      if (preview) {
        update({ screen: "complete", submitState: "idle" });
        return;
      }
      const sid = p.submissionId ?? crypto.randomUUID();
      const pending = {
        ...p,
        submissionId: sid,
        submitState: "pending" as const,
        updatedAt: Date.now(),
      };
      setP(pending);
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(pending));
      await api("/feedback", {
        recommendationId: p.recommendationId,
        submissionId: sid,
        feedback: p.feedback,
      });
      update({ submissionId: sid, submitState: "saved", screen: "complete" });
      if (p.feedback !== "better") {
        if (!member) setModal("login");
        else if (
          p.feedback === "worse" &&
          (extensions.changes?.[p.routineId ?? ""] ?? []).length
        )
          show("changes");
        else await requestNext([]);
      }
    });
  const requestNext = async (changes: string[]) => {
    const current = pRef.current!;
    const key = `jikkot.next.${current.recommendationId}`;
    let nextId = sessionStorage.getItem(key);
    if (!nextId) {
      nextId = crypto.randomUUID();
      sessionStorage.setItem(key, nextId);
    }
    const result = await api<{ recommendation: Rec | null }>("/next", {
      recommendationId: current.recommendationId,
      nextRecommendationId: nextId,
      changes,
    });
    if (!result.recommendation) update({ screen: "no-next" });
    else {
      setRec(result.recommendation);
      update({
        screen: "routine",
        recommendationId: result.recommendation.recommendationId,
        routineId: result.recommendation.snapshot.routine.id,
        feedback: undefined,
        submissionId: undefined,
        submitState: "idle",
        changes: [],
      });
    }
  };
  useEffect(() => {
    if (entry !== "login" || !configured) return;
    let active = true;
    void api<{ google: boolean; kakao: boolean; naver: boolean }>(
      "/providers",
      undefined,
      false,
    )
      .then((r) => {
        if (active) setProviders(r);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [entry]);
  const social = (provider: "google" | "kakao" | "naver") =>
    run(async () => {
      if (!providers[provider])
        throw new Error(
          "이 로그인 방법은 연결 준비 중입니다. 다른 방법을 선택해주세요.",
        );
      if (provider === "google") {
        authAction.current = true;
        try {
          const auth = firebaseAuth();
          if (matchMedia("(max-width:600px)").matches) {
            localStorage.removeItem(PROGRESS_KEY);
            await signInWithRedirect(auth, new GoogleAuthProvider());
          } else {
            await signInWithPopup(auth, new GoogleAuthProvider());
            clearLocal();
            await establish(true);
          }
        } finally {
          authAction.current = false;
        }
      } else {
        const verifier = crypto.randomUUID() + crypto.randomUUID();
        sessionStorage.setItem("jikkot.oauth.verifier", verifier);
        const bytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        );
        const challenge = Array.from(new Uint8Array(bytes))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        location.assign(
          `${apiBase}/oauth/${provider}/start?${new URLSearchParams({ origin: location.origin, challenge })}`,
        );
      }
    });
  const abandon = () =>
    run(async () => {
      if (configured && firebaseAuth().currentUser && !member) await signOut(firebaseAuth());
      clearLocal();
      setEntry("choice");
      setError("");
    });
  const consentInputs = (
    <div className="space-y-3 rounded-xl bg-[#f0f1ff] p-4">
      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={consents.privacy}
          onChange={(e) =>
            setConsents((c) => ({ ...c, privacy: e.target.checked }))
          }
        />
        개인정보 수집·이용 동의 (필수)
      </label>
      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={consents.nonMedical}
          onChange={(e) =>
            setConsents((c) => ({ ...c, nonMedical: e.target.checked }))
          }
        />
        진단·치료를 제공하는 의료 서비스가 아님을 이해합니다. (필수)
      </label>
      <p className="text-xs text-gray-500">
        개발용 동의 문안입니다. 출시 전 수집 범위·보관기간·문안을 확정해야
        합니다.
      </p>
    </div>
  );

  const screen = p?.screen;
  const answers = p?.answers ?? {};
  const questionArea = answers.area;
  const selection = (
    label: string,
    id: string,
    selected: boolean,
    fn: () => void,
  ) => (
    <button
      type="button"
      key={id}
      aria-pressed={selected}
      onClick={fn}
      className={`w-full rounded-xl border p-4 text-left leading-6 ${selected ? "border-[#6268ba] bg-[#ecebff]" : "bg-white"}`}
    >
      {selected ? "✓ " : ""}
      {label}
    </button>
  );
  return (
    <main className="service-surface mx-auto min-h-screen max-w-3xl px-4 py-6 sm:px-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <strong className="text-3xl text-[#6268ba]">직꼿</strong>
          <p className="text-xs text-gray-500">
            VER9.1 PROTOTYPE · 무료 서비스
          </p>
        </div>
        <span className="text-sm">
          {preview ? "미리보기" : (member?.nickname ?? "비회원")}
        </span>
      </header>
      {preview && (
        <p role="status" className="mb-5 rounded-xl bg-[#ecebff] p-4 text-sm">
          미리보기 · 문진과 추천 화면을 확인할 수 있어요. 로그인·가입·기록
          저장은 Firebase 연결 후 이용할 수 있으며, 입력한 답변과 피드백은
          서버에 저장되지 않습니다.
        </p>
      )}
      <section
        className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm sm:p-8"
        aria-busy={busy}
      >
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}
        {entry === "splash" && (
          <>
            <h1>직꼿을 준비하고 있어요</h1>
            {error && (
              <>
                <Action
                  label="연결 다시 확인"
                  onClick={() => run(() => establish())}
                  busy={busy}
                />
                <Action label="다시 로그인" onClick={beginLogin} busy={busy} />
              </>
            )}
          </>
        )}
        {entry === "choice" && (
          <>
            <h1>잠깐 움직여볼까요?</h1>
            <p>지금 가능한 자세에서 가볍게 시작하세요.</p>
            {
              <Action
                key={"로그인하기"}
                label={"로그인하기"}
                onClick={beginLogin}
                busy={busy}
              />
            }
            {
              <Action
                key={"비회원으로 체험하기"}
                label={"비회원으로 체험하기"}
                onClick={() => {
                  setEntry("guest-consent");
                  setError("");
                }}
                busy={busy}
              />
            }
          </>
        )}
        {entry === "guest-consent" && (
          <>
            <h1>시작 전 확인해주세요</h1>
            <p>
              직꼿은 질환을 진단하거나 치료하는 의료 서비스가 아닙니다. 추천은
              검수 전 시제품 콘텐츠입니다.
              {preview
                ? "현재 미리보기에서는 답변과 피드백을 서버에 저장하지 않습니다."
                : "체험 답변·동작·피드백은 서비스 개선용 운영 데이터로 저장되며 개인 기록은 제공하지 않습니다."}
            </p>
            {
              <Action
                key={"이해하고 동의합니다"}
                label={"이해하고 동의합니다"}
                onClick={beginGuest}
                busy={busy}
              />
            }
            {
              <Action
                key={"동의하지 않습니다"}
                label={"동의하지 않습니다"}
                onClick={() => {
                  localStorage.setItem("jikkot.guest-declined", "true");
                  setEntry("blocked");
                  clearLocal();
                  if (configured && firebaseAuth().currentUser?.isAnonymous)
                    void api("/guest/consent/revoke", {}).catch(() => {});
                }}
                busy={busy}
              />
            }
          </>
        )}
        {entry === "blocked" && (
          <>
            <h1>동의 없이는 이용할 수 없습니다</h1>
            {
              <Action
                key={"초기 화면"}
                label={"초기 화면"}
                onClick={() => setEntry("choice")}
                busy={busy}
              />
            }
          </>
        )}
        {entry === "login" && (
          <>
            <h1>로그인</h1>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() =>
                  authenticate(async () => {
                    await signInWithEmailAndPassword(
                      firebaseAuth(),
                      email,
                      password,
                    );
                  }),
                );
              }}
            >
              <label>
                이메일
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                비밀번호
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Button className="w-full min-h-12" disabled={busy || preview}>
                로그인
              </Button>
            </form>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["google", "kakao", "naver"] as const).map((provider, i) => (
                <Button
                  key={provider}
                  variant="outline"
                  className="min-h-12"
                  disabled={busy || preview}
                  onClick={() => social(provider)}
                >
                  {["구글", "카카오", "네이버"][i]}
                  {!providers[provider] && " (준비 중)"}
                </Button>
              ))}
            </div>
            {
              <Action
                key={"직접 회원가입"}
                label={"직접 회원가입"}
                onClick={() => {
                  setEntry("signup");
                  setConfirmed({ username: "", nickname: "" });
                }}
                busy={busy}
              />
            }
            {
              <Action
                key={"이메일로 비밀번호 재설정"}
                label={"이메일로 비밀번호 재설정"}
                onClick={() => {
                  setEntry("recover");
                  setFoundUsername("");
                }}
                busy={busy}
              />
            }
            {
              <Action
                key={"초기 화면"}
                label={"초기 화면"}
                onClick={() => setEntry("choice")}
                busy={busy}
              />
            }
          </>
        )}
        {(entry === "signup" || entry === "recover") && (
          <>
            <h1>
              {entry === "signup"
                ? "직접 회원가입"
                : "이메일로 비밀번호 재설정"}
            </h1>
            {entry === "signup" && (
              <>
                <label>
                  아이디 (영문 소문자·숫자·밑줄 4~20자)
                  <Input
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setConfirmed((c) => ({ ...c, username: "" }));
                    }}
                  />
                </label>
                {
                  <Action
                    key={
                      confirmed.username === username && username
                        ? "아이디 확인 완료"
                        : "아이디 중복 확인"
                    }
                    label={
                      confirmed.username === username && username
                        ? "아이디 확인 완료"
                        : "아이디 중복 확인"
                    }
                    onClick={() =>
                      run(async () => {
                        const r = await api<{ available: boolean }>(
                          "/availability",
                          { kind: "username", value: username },
                          true,
                        );
                        if (!r.available)
                          throw new Error("이미 사용 중인 아이디입니다.");
                        setConfirmed((c) => ({ ...c, username }));
                      })
                    }
                    busy={busy}
                  />
                }
                <label>
                  비밀번호 (8~72자)
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  이메일 (로그인에 사용)
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  닉네임 (한글·영문·숫자·밑줄 2~20자)
                  <Input
                    value={nickname}
                    onChange={(e) => {
                      setNickname(e.target.value);
                      setConfirmed((c) => ({ ...c, nickname: "" }));
                    }}
                  />
                </label>
                {
                  <Action
                    key={
                      confirmed.nickname === nickname && nickname
                        ? "닉네임 확인 완료"
                        : "닉네임 중복 확인"
                    }
                    label={
                      confirmed.nickname === nickname && nickname
                        ? "닉네임 확인 완료"
                        : "닉네임 중복 확인"
                    }
                    onClick={() =>
                      run(async () => {
                        const r = await api<{ available: boolean }>(
                          "/availability",
                          { kind: "nickname", value: nickname },
                          true,
                        );
                        if (!r.available)
                          throw new Error("이미 사용 중인 닉네임입니다.");
                        setConfirmed((c) => ({ ...c, nickname }));
                      })
                    }
                    busy={busy}
                  />
                }
              </>
            )}
            {entry === "signup" && (
              <>
                {consentInputs}
                {
                  <Action
                    key={"가입하고 시작하기"}
                    label={"가입하고 시작하기"}
                    onClick={() =>
                      run(() =>
                        authenticate(async () => {
                          if (password.length < 8 || password.length > 72)
                            throw new Error(
                              "비밀번호는 8~72자로 입력해주세요.",
                            );
                          const current = firebaseAuth().currentUser;
                          if (
                            !current ||
                            !current.providerData.some(
                              (provider) => provider.providerId === "password",
                            ) ||
                            current.email !== email
                          ) {
                            await createUserWithEmailAndPassword(
                              firebaseAuth(),
                              email,
                              password,
                            );
                          }
                          await api("/signup", {
                            username,
                            nickname,
                            consents: { ...consents, version: consentVersion },
                          });
                        }),
                      )
                    }
                    busy={busy}
                    disabled={
                      preview ||
                      !consents.privacy ||
                      !consents.nonMedical ||
                      confirmed.username !== username ||
                      confirmed.nickname !== nickname
                    }
                  />
                }
              </>
            )}
            {entry === "recover" && (
              <>
                <label>
                  가입한 이메일
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <Action
                  label="비밀번호 재설정 메일 보내기"
                  busy={busy}
                  disabled={preview}
                  onClick={() =>
                    run(async () => {
                      await sendPasswordResetEmail(firebaseAuth(), email);
                      setFoundUsername(
                        "가입한 이메일이라면 재설정 안내가 발송됩니다. 받은 편지함과 스팸함을 확인해주세요.",
                      );
                    })
                  }
                />
                {foundUsername && <p role="status">{foundUsername}</p>}
              </>
            )}
            {
              <Action
                key={"가입·복구 포기"}
                label={"가입·복구 포기"}
                onClick={abandon}
                busy={busy}
              />
            }
          </>
        )}
        {entry === "social-consent" && (
          <>
            <h1>직꼿 가입을 완료해주세요</h1>
            <label>
              닉네임 (한글·영문·숫자·밑줄 2~20자)
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </label>
            {consentInputs}
            {
              <Action
                key={"동의하고 시작하기"}
                label={"동의하고 시작하기"}
                onClick={() =>
                  run(async () => {
                    await api("/social/activate", {
                      nickname,
                      consents: { ...consents, version: consentVersion },
                    });
                    clearLocal();
                    await establish(true);
                  })
                }
                busy={busy}
                disabled={!consents.privacy || !consents.nonMedical}
              />
            }
            {
              <Action
                key={"가입 포기"}
                label={"가입 포기"}
                onClick={abandon}
                busy={busy}
              />
            }
          </>
        )}
        {!entry && p && (
          <>
            {screen === "home" && (
              <>
                <h1>지금 가능한 움직임부터</h1>
                <p>자세와 최근 생활을 선택하면 동작 하나를 제안해요.</p>
                {
                  <Action
                    key={"루틴 시작하기"}
                    label={"루틴 시작하기"}
                    onClick={start}
                    busy={busy}
                  />
                }
                <nav
                  aria-label="서비스 메뉴"
                  className="grid grid-cols-2 gap-3"
                >
                  {
                    <Action
                      key={"기록 확인"}
                      label={"기록 확인"}
                      onClick={() => requireMember("records")}
                      busy={busy}
                    />
                  }
                  {member && (
                    <Action
                      key={"로그아웃"}
                      label={"로그아웃"}
                      onClick={logout}
                      busy={busy}
                    />
                  )}
                  {
                    <Action
                      key={"스트레칭"}
                      label={"스트레칭"}
                      onClick={() => {
                        if (!featureFlags.stretching) setModal("preparing");
                      }}
                      busy={busy}
                    />
                  }
                  {
                    <Action
                      key={"쇼핑"}
                      label={"쇼핑"}
                      onClick={() => {
                        if (!featureFlags.shopping) setModal("preparing");
                      }}
                      busy={busy}
                    />
                  }
                </nav>
              </>
            )}
            {["posture", "area", "habits", "recent"].includes(screen!) && (
              <>
                <p className="text-sm text-[#6268ba]">
                  자세 → 부위 → 생활 습관 → 최근 상태
                </p>
                <h1>
                  {screen === "posture"
                    ? "현재 가능한 자세"
                    : screen === "area"
                      ? "불편한 부위"
                      : screen === "habits"
                        ? "평소 생활 습관"
                        : "최근 상태"}
                </h1>
                <p>
                  {["habits", "recent"].includes(screen!)
                    ? "해당하는 항목을 모두 선택해주세요."
                    : "하나를 선택해주세요."}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {screen === "posture" &&
                    Object.entries(postureLabels).map(([id, label]) =>
                      selection(label, id, answers.mode === id, () =>
                        update({
                          answers: { mode: id as MovementMode },
                          recommendationId: undefined,
                        }),
                      ),
                    )}
                  {screen === "area" &&
                    areas.map((q) =>
                      selection(q.label, q.id, answers.area === q.id, () =>
                        update({
                          answers: { mode: answers.mode, area: q.id },
                          recommendationId: undefined,
                        }),
                      ),
                    )}
                  {screen === "habits" &&
                    questionArea &&
                    habitQuestions(questionArea).map((q) =>
                      selection(
                        q.label,
                        q.id,
                        answers.habits?.includes(q.id) ?? false,
                        () =>
                          update({
                            answers: {
                              ...answers,
                              habits: toggle(answers.habits ?? [], q.id),
                              recent: [],
                            },
                            recommendationId: undefined,
                          }),
                      ),
                    )}
                  {screen === "recent" &&
                    questionArea &&
                    recentQuestions(questionArea, answers.habits ?? []).map(
                      (q) =>
                        selection(
                          q.label,
                          q.id,
                          answers.recent?.includes(q.id) ?? false,
                          () =>
                            update({
                              answers: {
                                ...answers,
                                recent: toggle(answers.recent ?? [], q.id),
                              },
                              recommendationId: undefined,
                            }),
                        ),
                    )}
                </div>
                {
                  <Action
                    key={screen === "recent" ? "동작 추천받기" : "다음"}
                    label={screen === "recent" ? "동작 추천받기" : "다음"}
                    onClick={() => {
                      const selected =
                        screen === "posture"
                          ? answers.mode
                          : screen === "area"
                            ? answers.area
                            : screen === "habits"
                              ? answers.habits?.length
                              : answers.recent?.length;
                      if (!selected) {
                        setError("항목을 하나 이상 선택해주세요.");
                        return;
                      }
                      if (screen === "recent") recommend();
                      else
                        show(
                          screen === "posture"
                            ? "area"
                            : screen === "area"
                              ? "habits"
                              : "recent",
                        );
                    }}
                    busy={busy}
                  />
                }
                {
                  <Action
                    key={"이전"}
                    label={"이전"}
                    onClick={() =>
                      show(
                        screen === "posture"
                          ? "home"
                          : screen === "area"
                            ? "posture"
                            : screen === "habits"
                              ? "area"
                              : "habits",
                      )
                    }
                    busy={busy}
                  />
                }
              </>
            )}
            {screen === "analysis" && (
              <>
                <h1>선택한 내용을 확인하고 있어요</h1>
                <p>
                  추천 저장이 중단되었다면 같은 추천으로 다시 시도할 수 있어요.
                </p>
                {
                  <Action
                    key={"추천 확인 · 재시도"}
                    label={"추천 확인 · 재시도"}
                    onClick={recommend}
                    busy={busy}
                  />
                }
              </>
            )}
            {screen === "routine" && rec && (
              <>
                <p>{rec.reason}</p>
                <RoutineMedia routine={rec.snapshot.routine} />
                {
                  <Action
                    key={"루틴 완료"}
                    label={"루틴 완료"}
                    onClick={() => show("feedback")}
                    busy={busy}
                  />
                }
              </>
            )}
            {screen === "feedback" && (
              <>
                <h1>동작 후 어떠세요?</h1>
                {Object.entries(feedbackLabels).map(([id, label]) =>
                  selection(label, id, p.feedback === id, () => {
                    if (p.submitState !== "pending")
                      update({ feedback: id as Feedback });
                  }),
                )}
                {
                  <Action
                    key={
                      preview
                        ? "완료 화면 미리보기"
                        : p.submitState === "pending"
                          ? "피드백 저장 재시도"
                          : "피드백 저장"
                    }
                    label={
                      preview
                        ? "완료 화면 미리보기"
                        : p.submitState === "pending"
                          ? "피드백 저장 재시도"
                          : "피드백 저장"
                    }
                    onClick={feedback}
                    busy={busy}
                  />
                }
                <p className="text-xs">
                  {preview
                    ? "미리보기에서는 피드백을 저장하지 않고 완료 화면만 확인합니다."
                    : "저장이 완료된 뒤 다음 화면으로 이동합니다."}
                </p>
              </>
            )}
            {screen === "complete" && (
              <>
                <h1>루틴을 마쳤어요</h1>
                <p>{p.feedback && feedbackLabels[p.feedback]}</p>
                {p.feedback === "better" ? (
                  <>
                    {
                      <Action
                        key={"기록 확인"}
                        label={"기록 확인"}
                        onClick={() => requireMember("records")}
                        busy={busy}
                      />
                    }
                    {
                      <Action
                        key={"다른 루틴 보기"}
                        label={"다른 루틴 보기"}
                        onClick={() => requireMember("catalog")}
                        busy={busy}
                      />
                    }
                  </>
                ) : (
                  <Action
                    key={"다음 추천 확인"}
                    label={"다음 추천 확인"}
                    onClick={() => {
                      if (!member) setModal("login");
                      else if (
                        p.feedback === "worse" &&
                        (extensions.changes?.[p.routineId ?? ""] ?? []).length
                      )
                        show("changes");
                      else run(() => requestNext([]));
                    }}
                    busy={busy}
                  />
                )}
                {
                  <Action
                    key={"첫 화면"}
                    label={"첫 화면"}
                    onClick={reset}
                    busy={busy}
                  />
                }
              </>
            )}
            {screen === "changes" && (
              <>
                <h1>어떤 변화가 있었나요?</h1>
                {(extensions.changes?.[p.routineId ?? ""] ?? []).map((q) =>
                  selection(q.label, q.id, p.changes.includes(q.id), () =>
                    update({ changes: toggle(p.changes, q.id) }),
                  ),
                )}
                {
                  <Action
                    key={"다음 추천 확인"}
                    label={"다음 추천 확인"}
                    onClick={() =>
                      run(async () => {
                        if (!p.changes.length)
                          throw new Error("변화를 선택해주세요.");
                        await requestNext(p.changes);
                      })
                    }
                    busy={busy}
                  />
                }
              </>
            )}
            {screen === "no-next" && (
              <>
                <h1>추가 추천이 없습니다</h1>
                {
                  <Action
                    key={"완료하기"}
                    label={"완료하기"}
                    onClick={reset}
                    busy={busy}
                  />
                }
              </>
            )}
            {screen === "records" && (
              <>
                <h1>부위별 기록</h1>
                {!records.length && <p>저장된 기록이 없습니다.</p>}
                {areas.map((area) => {
                  const rows = records.filter(
                    (r) => r.snapshot.area.id === area.id,
                  );
                  return rows.length ? (
                    <section key={area.id}>
                      <h2>{area.label}</h2>
                      {rows.map((r) => (
                        <article
                          className="my-3 rounded-xl bg-[#f0f1ff] p-4"
                          key={r.id}
                        >
                          <p>
                            {new Date(r.createdAt).toLocaleString("ko-KR", {
                              timeZone: "Asia/Seoul",
                            })}
                          </p>
                          <h3>
                            {r.snapshot.routine.name} ·{" "}
                            {feedbackLabels[r.feedback]}
                          </h3>
                          <p>부위: {r.snapshot.area.label}</p>
                          <p>
                            생활 습관:{" "}
                            {r.snapshot.habits.map((q) => q.label).join(", ")}
                          </p>
                          <p>
                            최근 상태:{" "}
                            {r.snapshot.recent.map((q) => q.label).join(", ")}
                          </p>
                          {r.changes?.length > 0 && (
                            <p>
                              추가 변화:{" "}
                              {r.changes.map((q) => q.label).join(", ")}
                            </p>
                          )}
                        </article>
                      ))}
                    </section>
                  ) : null;
                })}
                {
                  <Action
                    key={"기록 다시 불러오기"}
                    label={"기록 다시 불러오기"}
                    onClick={() =>
                      run(async () => {
                        const result = await api<{
                          records: RecordRow[];
                          nextCursor: { createdAt: number; id: string } | null;
                        }>("/records");
                        setRecords(result.records);
                        setRecordCursor(result.nextCursor);
                      })
                    }
                    busy={busy}
                  />
                }
                {recordCursor && (
                  <Action
                    label="이전 기록 더 보기"
                    busy={busy}
                    onClick={() =>
                      run(async () => {
                        const query = new URLSearchParams({
                          after: String(recordCursor.createdAt),
                          afterId: recordCursor.id,
                        });
                        const result = await api<{
                          records: RecordRow[];
                          nextCursor: { createdAt: number; id: string } | null;
                        }>(`/records?${query}`);
                        setRecords((old) => [...old, ...result.records]);
                        setRecordCursor(result.nextCursor);
                      })
                    }
                  />
                )}
                {
                  <Action
                    key={"돌아가기"}
                    label={"돌아가기"}
                    onClick={() => show(p.returnScreen ?? "home")}
                    busy={busy}
                  />
                }
              </>
            )}
            {screen === "catalog" && (
              <>
                <h1>다른 루틴 보기</h1>
                <p>{postureLabels[answers.mode!]}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {catalog(answers.mode!).map((r) => (
                    <Action
                      key={r.name}
                      label={r.name}
                      onClick={() =>
                        update({ screen: "browse", routineId: r.id })
                      }
                      busy={busy}
                    />
                  ))}
                </div>
                {
                  <Action
                    key={"돌아가기"}
                    label={"돌아가기"}
                    onClick={() => show("complete")}
                    busy={busy}
                  />
                }
              </>
            )}
            {screen === "browse" && p.routineId && getRoutine(p.routineId) && (
              <>
                <RoutineMedia routine={getRoutine(p.routineId)!} />
                {
                  <Action
                    key={"목록으로"}
                    label={"목록으로"}
                    onClick={() => show("catalog")}
                    busy={busy}
                  />
                }
              </>
            )}
          </>
        )}
      </section>
      <footer className="py-6 text-center text-xs text-gray-500">
        의료 서비스가 아닙니다. 콘텐츠는 검수 전 시제품입니다. {CONTENT_VERSION}
      </footer>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modal === "limit"
                ? "오늘 체험 완료"
                : modal === "preparing"
                  ? "서비스 준비 중"
                  : "로그인이 필요합니다"}
            </DialogTitle>
            <DialogDescription>
              {modal === "limit"
                ? "비회원은 한국 날짜 기준 하루 첫 추천을 한 번 체험할 수 있어요."
                : modal === "preparing"
                  ? "이 기능은 아직 준비 중입니다."
                  : "회원은 기록과 동작 목록, 다음 추천을 이용할 수 있어요. 로그인하면 기존 체험 답변은 초기화됩니다."}
            </DialogDescription>
          </DialogHeader>
          {modal !== "preparing" && (
            <Action
              key={"로그인하기"}
              label={"로그인하기"}
              onClick={beginLogin}
              busy={busy}
            />
          )}
          {
            <Action
              key={"닫기"}
              label={"닫기"}
              onClick={() => {
                if (modal === "limit") {
                  clearLocal();
                  setEntry("choice");
                }
                setModal(null);
              }}
              busy={busy}
            />
          }
        </DialogContent>
      </Dialog>
    </main>
  );
}
