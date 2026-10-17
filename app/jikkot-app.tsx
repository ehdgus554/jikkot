"use client";
/* eslint-disable @next/next/no-img-element -- Supplied official Google brand artwork is displayed intact. */
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
import { areas, getRoutine, routines, type Routine } from "./jikkot-data";
import {
  toggleExclusive,
  postureLabels,
  feedbackLabels,
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Header,
  Surface,
  PrimaryButton,
  ChoiceCard,
  QuestionProgress,
  AreaContext,
  ResultSummary,
  ConsentRow,
  BodySelector,
  Home,
} from "@/components/jikkot-ui";
import { consentPolicy, operationalPolicy } from "@/lib/service/policy";
import { ServicePreparation } from "@/components/service-preparation";
import { previewRecommendation } from "@/lib/service/public-preview";
import { PersonalizedExperience } from "@/components/personalized-experience";
import type { Purpose } from "@/lib/personalization/types";
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
    posture?: string;
    pattern: string;
    routine: Pick<
      Routine,
      "id" | "name" | "image" | "cue" | "dose" | "comfort"
    > &
      Partial<Pick<Routine, "steps" | "displayNumber">>;
    area: { id: string; label: string };
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
  | "signup-complete"
  | "phone"
  | null;
const consentVersion = consentPolicy.version;
function Action({
  label,
  onClick,
  busy,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <PrimaryButton
      onClick={onClick}
      disabled={busy || disabled}
      secondary={secondary}
    >
      {label}
    </PrimaryButton>
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
  const [personalPurpose,setPersonalPurpose]=useState<Purpose|null>(null);
  const [entry, setEntry] = useState<Entry>(configured ? "splash" : "choice"),
    [p, setP] = useState<Progress | null>(null),
    [member, setMember] = useState<Member | null>(null),
    [rec, setRec] = useState<Rec | null>(null),
    [records, setRecords] = useState<RecordRow[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [fontError, setFontError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([
      document.fonts.load('400 16px "LINE Seed KR"', "직꼿"),
      document.fonts.load('700 16px "LINE Seed KR"', "직꼿"),
      document.fonts.load("400 16px Nunito", "Jikkot"),
    ])
      .then((fonts) => {
        if (active && fonts.some((loaded) => !loaded.length))
          setFontError("화면 글꼴을 불러오지 못했어요. 새로고침해주세요.");
      })
      .catch(() => {
        if (active)
          setFontError("화면 글꼴을 불러오지 못했어요. 새로고침해주세요.");
      });
    return () => {
      active = false;
    };
  }, []);
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
    [modal, setModal] = useState<
      "login" | "limit" | "preparing" | "privacy" | "non-medical" | null
    >(null);
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [nickname, setNickname] = useState("");
  const [confirmed, setConfirmed] = useState({ username: "", nickname: "" }),
    [consents, setConsents] = useState({ privacy: false, nonMedical: false }),
    [foundUsername, setFoundUsername] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState(""),
    [phone, setPhone] = useState("");
  const inFlight = useRef(false);
  const authAction = useRef(false),
    pRef = useRef<Progress | null>(null);
  const initialOAuth = useRef<{
    code: string | null;
    error: string | null;
  } | null>(null);
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
  const changeAnswers = (answers: Partial<Answers>) => {
    setRec(null);
    update({
      answers,
      recommendationId: undefined,
      routineId: undefined,
      feedback: undefined,
      submissionId: undefined,
      submitState: "idle",
      changes: [],
    });
    setError("");
  };
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
    setPersonalPurpose(null);
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
    setPasswordConfirmation("");
    setPhone("");
    setUsername("");
    setEmail("");
    setNickname("");
    setFoundUsername("");
    setConfirmed({ username: "", nickname: "" });
    setConsents({ privacy: false, nonMedical: false });
  };
  const run = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
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
          "auth/network-request-failed": "연결을 확인한 뒤 다시 시도해주세요.",
          "auth/too-many-requests":
            "요청이 많습니다. 잠시 후 다시 시도해주세요.",
        };
        setError(
          messages[code] ??
            (e instanceof TypeError || code.startsWith("auth/")
              ? "연결을 확인한 뒤 다시 시도해주세요."
              : e instanceof Error
                ? e.message
                : "다시 시도해주세요."),
        );
      }
    } finally {
      inFlight.current = false;
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
      setEmail(user.email ?? "");
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
        [
          "routine",
          "feedback",
          "complete",
          "session-end",
          "changes",
          "no-next",
        ].includes(saved.screen)
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
    initialOAuth.current ??= {
      code: params.get("oauthCode"),
      error: params.get("oauthError"),
    };
    const code = initialOAuth.current.code,
      oauthError = initialOAuth.current.error;
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
    if (code && !authAction.current) {
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
        if (stopped) return;
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
      queueMicrotask(() => {
        if (active) setRecordsLoading(true);
      });
      void api<{
        records: RecordRow[];
        nextCursor: { createdAt: number; id: string } | null;
      }>("/records")
        .then((r) => {
          if (active) {
            setRecords(r.records);
            setRecordCursor(r.nextCursor);
            setRecordsLoading(false);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setRecordsLoading(false);
          }
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
        setPersonalPurpose(null);
      } finally {
        authAction.current = false;
      }
    });
  const start = () =>
    run(async () => {
      if (preview) {
        setRec(null);
        setP({
          ...fresh(p!.owner, true),
          answers: {},
          screen: "posture",
        });
        return;
      }
      const result = await api<{ allowed: boolean }>("/eligibility");
      if (!result.allowed) {
        setModal("limit");
        return;
      }
      setP({
        ...fresh(p!.owner, p!.guestConsent),
        answers: {},
        screen: "posture",
      });
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
  const feedback = (selected?: Feedback) =>
    run(async () => {
      const value = selected ?? p?.feedback;
      if (!value || !p?.recommendationId)
        throw new Error("피드백을 선택해주세요.");
      if (preview) {
        update({
          feedback: value,
          screen: value === "worse" ? "changes" : "complete",
          submitState: "idle",
        });
        return;
      }
      const sid = p.submissionId ?? crypto.randomUUID();
      const pending = {
        ...p,
        submissionId: sid,
        feedback: value,
        submitState: "pending" as const,
        updatedAt: Date.now(),
      };
      setP(pending);
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(pending));
      await api("/feedback", {
        recommendationId: p.recommendationId,
        submissionId: sid,
        feedback: value,
      });
      update({
        feedback: value,
        submissionId: sid,
        submitState: "saved",
        screen: value === "worse" ? "changes" : "complete",
      });
      if (value === "same") {
        if (!member) setModal("login");
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
      if (configured && firebaseAuth().currentUser && !member)
        await signOut(firebaseAuth());
      clearLocal();
      setEntry("choice");
      setError("");
    });

  const beginSignup = () => {
    setModal(null);
    setEntry("signup");
    setError("");
    setConfirmed({ username: "", nickname: "" });
    setConsents({ privacy: false, nonMedical: false });
  };
  const availability = (kind: "username" | "nickname", value: string) =>
    run(async () => {
      authAction.current = true;
      try {
        if (!firebaseAuth().currentUser)
          await signInAnonymously(firebaseAuth());
        const result = await api<{ available: boolean }>("/availability", {
          kind,
          value,
        });
        if (!result.available)
          throw new Error(
            `이미 사용 중인 ${kind === "username" ? "아이디" : "닉네임"}입니다.`,
          );
        setConfirmed((old) => ({ ...old, [kind]: value }));
      } finally {
        authAction.current = false;
      }
    });
  const signup = () =>
    run(async () => {
      if (password !== passwordConfirmation)
        throw new Error("비밀번호 확인이 일치하지 않아요.");
      if (password.length < 8 || password.length > 72)
        throw new Error("비밀번호는 8~72자로 입력해주세요.");
      await authenticate(async () => {
        const current = firebaseAuth().currentUser;
        if (
          !current ||
          !current.providerData.some(
            (provider) => provider.providerId === "password",
          ) ||
          current.email !== email
        )
          await createUserWithEmailAndPassword(firebaseAuth(), email, password);
        await api("/signup", {
          username,
          nickname,
          consents: { ...consents, version: consentVersion },
        });
      });
      setEntry("signup-complete");
    });
  const consentInputs = (
    <div className="consents">
      <ConsentRow
        checked={consents.privacy}
        onChange={(checked) =>
          setConsents((old) => ({ ...old, privacy: checked }))
        }
        label="개인정보 수집·이용 동의"
        onDetails={() => setModal("privacy")}
      />
      <ConsentRow
        checked={consents.nonMedical}
        onChange={(checked) =>
          setConsents((old) => ({ ...old, nonMedical: checked }))
        }
        label="의료서비스가 아님을 확인"
        onDetails={() => setModal("non-medical")}
      />
      <p className="field-note">
        운영 약관은 확정 전입니다. ‘보기’에서 현재 안내와 준비 상태를
        확인해주세요.
      </p>
    </div>
  );
  const screen = p?.screen;
  const answers = p?.answers ?? {};
  const questionArea = answers.area;
  const areaLabel =
    rec?.snapshot.area.label ??
    areas.find((area) => area.id === questionArea)?.label ??
    "";
  const home = entry === "choice" || (!entry && screen === "home");
  const changeQuestions = extensions.changes?.[p?.routineId ?? ""] ?? [];
  const summary =
    rec && p?.feedback ? (
      <ResultSummary
        area={rec.snapshot.area.label}
        routine={rec.snapshot.routine.name}
        feedback={feedbackLabels[p.feedback]}
      />
    ) : null;
  const finishButtons = (
    <footer className="footer">
      {<Action label={"첫 화면으로"} onClick={reset} busy={busy} />}
      {member && (
        <Action
          label={"기록 확인하기"}
          onClick={() => requireMember("records")}
          busy={busy}
          secondary={true}
        />
      )}
      {member && p?.feedback === "better" && (
        <Action
          label={"다른 루틴 하기"}
          onClick={start}
          busy={busy}
          secondary={true}
        />
      )}
    </footer>
  );
  const backQuestion = () =>
    show(
      screen === "area" ? "posture" : screen === "habits" ? "area" : "habits",
    );
  return (
    <main className="jikkot-app">
      <Surface busy={busy}>
        {fontError && (
          <p role="alert" className="error-panel">
            {fontError}
          </p>
        )}
        {preview && (
          <p className="preview-note" role="status">
            미리보기 · 문진과 동작을 확인할 수 있어요. 로그인·가입·서버 기록
            저장은 연결 후 이용할 수 있습니다.
          </p>
        )}
        {error && (
          <div role="alert" className="error-panel">
            <p>{error}</p>
            {screen === "feedback" && p?.submitState === "pending" && (
              <>
                {
                  <Action
                    label={"저장 다시 시도"}
                    onClick={() => feedback()}
                    busy={busy}
                    secondary={true}
                  />
                }
              </>
            )}
            {screen === "complete" && member && p?.feedback === "same" && (
              <Action label="다시 시도" onClick={() => run(() => requestNext([]))} busy={busy} secondary />
            )}
          </div>
        )}
        {home && (entry === "choice" || preview) && (
          <Home
            memberName={member?.nickname}
            busy={busy}
            begin={() => {
              if (p && (member || p.guestConsent)) start();
              else {
                setEntry("guest-consent");
                setError("");
              }
            }}
            login={beginLogin}
            records={() => requireMember("records")}
            comingSoon={() => setModal("preparing")}
            warmup={beginLogin}
            leisure={beginLogin}
          />
        )}
        {!entry && p && screen === "home" && !preview && <PersonalizedExperience key={`${p.owner.id}:${p.owner.kind}`} uid={p.owner.id} memberName={member?.nickname} initialPurpose={personalPurpose} onLogin={beginLogin} onLogout={logout} onExistingDaily={start} onExistingRecords={()=>requireMember("records")} />}
        {entry === "splash" && (
          <>
            <Header />
            <h1>직꼿을 준비하고 있어요</h1>
            <div className="busy" role="status" aria-label="연결 확인 중">
              <span />
              <span />
              <span />
            </div>
            {error && (
              <footer className="footer">
                {
                  <Action
                    label={"연결 다시 확인"}
                    onClick={() => run(() => establish())}
                    busy={busy}
                  />
                }
                {
                  <Action
                    label={"다시 로그인"}
                    onClick={beginLogin}
                    busy={busy}
                    secondary={true}
                  />
                }
              </footer>
            )}
          </>
        )}
        {entry === "guest-consent" && (
          <>
            <Header back={() => setEntry("choice")} busy={busy} />
            <h1>시작하기 전에 확인해주세요</h1>
            <p className="sub">
              직꼿은 질환을 진단하거나 치료하는 의료서비스가 아닙니다. 편안한
              범위에서 가볍게 움직여주세요.
            </p>
            <p className="account-note">
              {preview
                ? "미리보기의 답변과 피드백은 서버에 저장되지 않습니다."
                : "비회원 체험 답변·동작·피드백은 서비스 개선용 운영 데이터로 저장되며 계정 기록으로 가져오지 않습니다."}
            </p>
            <button
              className="text-button"
              type="button"
              onClick={() => setModal("non-medical")}
            >
              의료서비스가 아님을 확인 · 보기
            </button>
            <footer className="footer">
              {
                <Action
                  label={"이해하고 동의합니다"}
                  onClick={beginGuest}
                  busy={busy}
                />
              }
              {
                <Action
                  label={"동의하지 않습니다"}
                  onClick={() => {
                    localStorage.setItem("jikkot.guest-declined", "true");
                    setEntry("blocked");
                    clearLocal();
                    if (configured && firebaseAuth().currentUser?.isAnonymous)
                      void api("/guest/consent/revoke", {}).catch(() => {});
                  }}
                  busy={busy}
                  secondary={true}
                />
              }
            </footer>
          </>
        )}
        {entry === "blocked" && (
          <>
            <Header />
            <h1>동의가 필요해요</h1>
            <p className="sub">필수 안내에 동의한 뒤 이용할 수 있어요.</p>
            <footer className="footer">
              {
                <Action
                  label={"동의 다시 확인"}
                  onClick={() => setEntry("guest-consent")}
                  busy={busy}
                />
              }
              {
                <Action
                  label={"첫 화면으로"}
                  onClick={() => setEntry("choice")}
                  busy={busy}
                  secondary={true}
                />
              }
            </footer>
          </>
        )}
        {entry === "login" && (
          <>
            <Header back={() => setEntry(p ? null : "choice")} busy={busy} />
            <h1>
              나를 위한 루틴,
              <br />
              기록으로 이어가세요.
            </h1>
            <p className="sub">
              로그인하면 루틴을 자유롭게 이용하고
              <br />내 기록을 모아볼 수 있어요.
            </p>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
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
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                비밀번호
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <p className="field-note">
                현재는 가입한 이메일로 로그인할 수 있어요. 아이디 로그인은 준비
                중입니다.
              </p>
              <PrimaryButton type="submit" disabled={busy || preview}>
                로그인
              </PrimaryButton>
            </form>
            <div className="divider">
              <span />
              <p>간편 로그인</p>
              <span />
            </div>
            {(["kakao", "naver", "google"] as const).map((provider) => (
              <button
                type="button"
                className={`social ${provider}`}
                key={provider}
                disabled={busy || preview}
                onClick={() => social(provider)}
              >
                {provider === "google" && (
                  <img
                    src="/assets/brand/google-g-logo.png"
                    width={20}
                    height={20}
                    alt=""
                  />
                )}
                {provider === "google"
                  ? "Google"
                  : provider === "kakao"
                    ? "카카오"
                    : "네이버"}
                로 계속하기{!providers[provider] && " · 준비 중"}
              </button>
            ))}
            <div className="center">
              <p className="note">아직 회원이 아니신가요?</p>
              <button
                type="button"
                className="text-button"
                onClick={beginSignup}
              >
                회원가입
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEntry("recover");
                  setFoundUsername("");
                }}
              >
                비밀번호 재설정
              </button>
            </div>
          </>
        )}
        {entry === "signup" && (
          <>
            <Header back={abandon} busy={busy} />
            <h1>직꼿과 함께 시작해요.</h1>
            <p className="sub">내게 맞는 루틴과 기록을 이어가세요.</p>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                signup();
              }}
            >
              <label>
                아이디
                <Input
                  autoComplete="username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setConfirmed((old) => ({ ...old, username: "" }));
                  }}
                />
              </label>
              <p className="field-note">영문 소문자·숫자·밑줄 4~20자</p>
              {
                <Action
                  label={
                    confirmed.username === username && username
                      ? "아이디 확인 완료"
                      : "아이디 중복 확인"
                  }
                  onClick={() => availability("username", username)}
                  busy={busy}
                  secondary={true}
                  disabled={preview || !username}
                />
              }
              <label>
                비밀번호
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <p className="field-note">8~72자로 입력해주세요.</p>
              <label>
                비밀번호 확인
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                />
              </label>
              <label>
                휴대폰 번호 <span className="field-note">연결 준비 중</span>
                <div className="phone-row">
                  <Input
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                  <button
                    className="verify"
                    type="button"
                    onClick={() => setEntry("phone")}
                  >
                    인증하기
                  </button>
                </div>
              </label>
              <p className="field-note">
                휴대폰 인증은 준비 중이며 현재 가입에 사용하지 않습니다.
              </p>
              <label>
                이메일
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <p className="field-note">
                현재 이메일·비밀번호 로그인 연결에 필요한 주소입니다.
              </p>
              <label>
                닉네임
                <Input
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setConfirmed((old) => ({ ...old, nickname: "" }));
                  }}
                />
              </label>
              <p className="field-note">한글·영문·숫자·밑줄 2~20자</p>
              {
                <Action
                  label={
                    confirmed.nickname === nickname && nickname
                      ? "닉네임 확인 완료"
                      : "닉네임 중복 확인"
                  }
                  onClick={() => availability("nickname", nickname)}
                  busy={busy}
                  secondary={true}
                  disabled={preview || !nickname}
                />
              }
              {consentInputs}
              <PrimaryButton
                type="submit"
                disabled={
                  busy ||
                  preview ||
                  !username ||
                  !nickname ||
                  !password ||
                  !passwordConfirmation ||
                  !email ||
                  !consents.privacy ||
                  !consents.nonMedical ||
                  confirmed.username !== username ||
                  confirmed.nickname !== nickname
                }
              >
                가입하기
              </PrimaryButton>
            </form>
          </>
        )}
        {entry === "recover" && (
          <>
            <Header back={beginLogin} busy={busy} />
            <h1>비밀번호 재설정</h1>
            <p className="sub">가입한 이메일로 재설정 안내를 보내드려요.</p>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  await sendPasswordResetEmail(firebaseAuth(), email);
                  setFoundUsername(
                    "가입한 이메일이라면 재설정 안내가 발송됩니다. 받은 편지함과 스팸함을 확인해주세요.",
                  );
                });
              }}
            >
              <label>
                가입한 이메일
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <PrimaryButton type="submit" disabled={busy || preview}>
                비밀번호 재설정 메일 보내기
              </PrimaryButton>
              {foundUsername && (
                <p role="status" className="field-note">
                  {foundUsername}
                </p>
              )}
            </form>
          </>
        )}
        {entry === "phone" && (
          <>
            <Header back={() => setEntry("signup")} busy={busy} />
            <h1>휴대폰 인증</h1>
            <p className="sub">
              휴대폰 인증 연결을 준비하고 있어요.
              <br />
              지금은 인증 문자를 보내거나 인증을 완료할 수 없습니다.
            </p>
            <form className="form">
              <label>
                인증번호
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled
                  placeholder="서비스 연결 후 입력할 수 있어요"
                />
              </label>
              <button type="button" className="text-button" disabled>
                인증번호 재발송 · 준비 중
              </button>
            </form>
            <footer className="footer">
              {
                <Action
                  label={"회원가입으로 돌아가기"}
                  onClick={() => setEntry("signup")}
                  busy={busy}
                />
              }
            </footer>
          </>
        )}
        {entry === "social-consent" && (
          <>
            <Header back={abandon} busy={busy} />
            <h1>직꼿 가입을 완료해주세요</h1>
            <p className="sub">사용할 닉네임과 필수 동의를 확인해주세요.</p>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  await api("/social/activate", {
                    nickname,
                    consents: { ...consents, version: consentVersion },
                  });
                  clearLocal();
                  await establish(true);
                  setEntry("signup-complete");
                });
              }}
            >
              <label>
                닉네임
                <Input
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                />
              </label>
              {consentInputs}
              <PrimaryButton
                type="submit"
                disabled={
                  busy || !nickname || !consents.privacy || !consents.nonMedical
                }
              >
                동의하고 시작하기
              </PrimaryButton>
            </form>
            <button
              type="button"
              className="text-button"
              onClick={abandon}
              disabled={busy}
            >
              동의하지 않고 돌아가기
            </button>
          </>
        )}
        {entry === "signup-complete" && (
          <>
            <Header />
            <span className="tag">가입 완료</span>
            <h1>직꼿에 오신 걸 환영해요.</h1>
            <p className="sub">
              필요할 때 가볍게 움직이고,
              <br />
              나에게 맞는 루틴을 찾아가세요.
            </p>
            <div className="summary">
              <p>횟수 제한 없이 루틴 이용</p>
              <p>동작과 피드백 자동 기록</p>
              <p>부위별 지난 기록 확인</p>
            </div>
            <footer className="footer">
              {
                <Action
                  label={"내 루틴 시작하기"}
                  onClick={() => {
                    setEntry(null);
                    start();
                  }}
                  busy={busy}
                />
              }
            </footer>
          </>
        )}
        {!entry && p && (
          <>
            {screen === "posture" && (
              <>
                <Header back={reset} busy={busy} />
                <h1>지금 어떤 상태인가요?</h1>
                <p className="sub">
                  지금 바로 할 수 있는 자세를 골라주세요.
                  <br />그 자세에 맞는 동작을 찾아드릴게요.
                </p>
                <div className="wide-list">
                  {(
                    [
                      ["seated", "앉기", "의자에 앉아있어요."],
                      ["standing", "서기", "가볍게 일어설 수 있어요."],
                      ["lying", "눕기", "바닥에 누울 수도 있어요."],
                    ] as const
                  ).map(([mode, label, description]) => (
                    <ChoiceCard
                      key={mode}
                      label={label}
                      description={description}
                      wide
                      selected={answers.mode === mode}
                      disabled={busy}
                      onClick={() => changeAnswers({ mode })}
                    />
                  ))}
                </div>
                <p className="note">자세를 하나 선택해주세요</p>
                <footer className="footer">
                  {
                    <Action
                      label={"다음"}
                      onClick={() => {
                        const position = {
                          seated: "앉기",
                          standing: "서기",
                          lying: "눕기",
                        }[answers.mode!];
                        show(
                          routines.some((routine) =>
                            routine.positions.some((item) => item === position),
                          )
                            ? "area"
                            : "posture-unavailable",
                        );
                      }}
                      busy={busy}
                      secondary={false}
                      disabled={!answers.mode}
                    />
                  }
                </footer>
              </>
            )}
            {screen === "posture-unavailable" && (
              <>
                <Header back={() => show("posture")} busy={busy} />
                <h1>이 자세의 동작을 준비하고 있어요</h1>
                <p className="sub">
                  현재 안내 동작은 모두 앉아서 하는 동작이에요.
                  <br />
                  앉아서 이용할 수 있을 때 다시 시작해주세요.
                </p>
                <footer className="footer">
                  {
                    <Action
                      label={"앉아서 이용하기"}
                      onClick={() => {
                        changeAnswers({ mode: "seated" });
                        show("area");
                      }}
                      busy={busy}
                    />
                  }
                  {
                    <Action
                      label={"첫 화면으로"}
                      onClick={reset}
                      busy={busy}
                      secondary={true}
                    />
                  }
                </footer>
              </>
            )}
            {["area", "habits", "recent"].includes(screen!) && (
              <>
                <Header back={backQuestion} busy={busy} />
                <QuestionProgress
                  step={screen === "area" ? 0 : screen === "habits" ? 1 : 2}
                />
                {screen !== "area" && (
                  <AreaContext
                    label={
                      areas.find((area) => area.id === questionArea)?.label ??
                      ""
                    }
                  />
                )}
                <h1>
                  {screen === "area"
                    ? "어디가 불편한가요?"
                    : screen === "habits"
                      ? "평소 어떤 습관이 있나요?"
                      : "최근에는 무엇을 했나요?"}
                </h1>
                <p className="sub">
                  {screen === "area" ? (
                    <>
                      그림에서 가장 불편한 곳을
                      <br />
                      하나만 눌러주세요.
                    </>
                  ) : screen === "habits" ? (
                    "자주 하는 행동을 모두 골라주세요."
                  ) : (
                    "오늘이나 불편해지기 직전에 한 행동을 모두 골라주세요."
                  )}
                </p>
                {screen === "area" ? (
                  <BodySelector
                    selected={questionArea}
                    disabled={busy}
                    onChange={(area) => {
                      if (area !== questionArea)
                        changeAnswers({ mode: answers.mode ?? "seated", area });
                    }}
                  />
                ) : (
                  <>
                    <div className="choices">
                      {(screen === "habits"
                        ? habitQuestions(questionArea!)
                        : recentQuestions(questionArea!, answers.habits ?? [])
                      )
                        .filter(
                          (question) =>
                            !["H_UNKNOWN", "R_NONE", "R_UNKNOWN"].includes(
                              question.id,
                            ),
                        )
                        .map((question) => (
                          <ChoiceCard
                            key={question.id}
                            label={question.label}
                            selected={
                              (screen === "habits"
                                ? answers.habits
                                : answers.recent
                              )?.includes(question.id) ?? false
                            }
                            disabled={busy}
                            onClick={() =>
                              changeAnswers(
                                screen === "habits"
                                  ? {
                                      ...answers,
                                      habits: toggleExclusive(
                                        answers.habits ?? [],
                                        question.id,
                                        ["H_UNKNOWN"],
                                      ),
                                      recent: [],
                                    }
                                  : {
                                      ...answers,
                                      recent: toggleExclusive(
                                        answers.recent ?? [],
                                        question.id,
                                        ["R_NONE", "R_UNKNOWN"],
                                      ),
                                    },
                              )
                            }
                          />
                        ))}
                    </div>
                    {(screen === "habits"
                      ? habitQuestions(questionArea!)
                      : recentQuestions(questionArea!, answers.habits ?? [])
                    )
                      .filter((question) =>
                        ["H_UNKNOWN", "R_NONE", "R_UNKNOWN"].includes(
                          question.id,
                        ),
                      )
                      .map((question) => (
                        <ChoiceCard
                          special
                          key={question.id}
                          label={question.label}
                          selected={
                            (screen === "habits"
                              ? answers.habits
                              : answers.recent
                            )?.includes(question.id) ?? false
                          }
                          disabled={busy}
                          onClick={() =>
                            changeAnswers(
                              screen === "habits"
                                ? {
                                    ...answers,
                                    habits: toggleExclusive(
                                      answers.habits ?? [],
                                      question.id,
                                      ["H_UNKNOWN"],
                                    ),
                                    recent: [],
                                  }
                                : {
                                    ...answers,
                                    recent: toggleExclusive(
                                      answers.recent ?? [],
                                      question.id,
                                      ["R_NONE", "R_UNKNOWN"],
                                    ),
                                  },
                            )
                          }
                        />
                      ))}
                  </>
                )}
                {screen === "area" && (
                  <p className="note">
                    {questionArea
                      ? `${areas.find((area) => area.id === questionArea)?.label} 부위를 선택했어요`
                      : "부위를 하나 선택해주세요"}
                  </p>
                )}
                <footer className="footer">
                  {
                    <Action
                      label={screen === "recent" ? "내 루틴 보기" : "다음"}
                      onClick={() =>
                        screen === "recent"
                          ? recommend()
                          : show(screen === "area" ? "habits" : "recent")
                      }
                      busy={busy}
                      secondary={false}
                      disabled={
                        !(screen === "area"
                          ? answers.area
                          : screen === "habits"
                            ? answers.habits?.length
                            : answers.recent?.length)
                      }
                    />
                  }
                </footer>
              </>
            )}
            {screen === "analysis" && (
              <>
                <Header />
                <h1>
                  {error
                    ? "연결을 다시 확인해주세요"
                    : "내 몸에 맞는 동작을 찾고 있어요"}
                </h1>
                <p className="sub">
                  {error
                    ? "선택한 답변은 유지돼요. 같은 추천으로 다시 시도할 수 있어요."
                    : "선택한 부위와 생활 습관, 최근 행동을 확인하고 있어요."}
                </p>
                {busy ? (
                  <div className="busy" role="status" aria-label="추천 준비 중">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : (
                  <footer className="footer">
                    {
                      <Action
                        label={"다시 시도"}
                        onClick={recommend}
                        busy={busy}
                      />
                    }
                    {
                      <Action
                        label={"첫 화면으로"}
                        onClick={reset}
                        busy={busy}
                        secondary={true}
                      />
                    }
                  </footer>
                )}
              </>
            )}
            {screen === "routine" && rec && (
              <>
                <Header back={() => show("recent")} busy={busy} />
                <AreaContext label={areaLabel} />
                <h1>
                  {rec.snapshot.pattern.includes(":alternative:")
                    ? "다른 동작으로 이어가볼까요?"
                    : "잠깐, 몸을 풀어볼까요?"}
                </h1>
                <RoutineMedia routine={rec.snapshot.routine} />
                <footer className="footer">
                  {
                    <Action
                      label={"마쳤어요"}
                      onClick={() => show("feedback")}
                      busy={busy}
                    />
                  }
                </footer>
                <p className="note">동작을 마친 뒤 눌러주세요.</p>
              </>
            )}
            {screen === "feedback" && (
              <>
                <Header back={() => show("routine")} busy={busy} />
                <AreaContext label={areaLabel} />
                <h1>
                  {error && p.submitState === "pending"
                    ? "기록 저장을 완료하지 못했어요"
                    : "동작 후 어떠세요?"}
                </h1>
                <p className="sub">
                  {error && p.submitState === "pending"
                    ? "선택한 피드백은 유지돼요. 위의 ‘저장 다시 시도’를 눌러주세요."
                    : "느껴지는 변화를 하나 골라주세요."}
                </p>
                <div className="wide-list">
                  {Object.entries(feedbackLabels).map(([id, label]) => (
                    <ChoiceCard
                      wide
                      key={id}
                      label={label}
                      selected={p.feedback === id}
                      disabled={busy || p.submitState === "pending"}
                      onClick={() => feedback(id as Feedback)}
                    />
                  ))}
                </div>
                {p.submitState === "pending" && !busy && !error && (
                  <footer className="footer">
                    <Action
                      label="저장 다시 시도"
                      onClick={() => feedback()}
                      busy={busy}
                      secondary
                    />
                  </footer>
                )}
                {busy && (
                  <p className="note" role="status">
                    피드백을 저장하고 있어요.
                  </p>
                )}
              </>
            )}
            {["complete", "session-end"].includes(screen!) && (
              <>
                <Header />
                <span className="tag">
                  루틴 {screen === "complete" ? "완료" : "종료"}
                </span>
                <h1>오늘의 루틴을 마쳤어요.</h1>
                <p className="sub">
                  {member
                    ? "동작과 알려주신 느낌을 내 기록에 남겼어요."
                    : "잠깐의 움직임으로 나를 돌봤어요. 비회원 체험은 계정 기록에 저장되지 않아요."}
                </p>
                {summary}
                {finishButtons}
              </>
            )}
            {screen === "changes" && (
              <>
                <Header back={() => show("complete")} busy={busy} />
                <AreaContext label={areaLabel} />
                <h1>어느 과정에서 불편했나요?</h1>
                <p className="sub">
                  방금 한 동작
                  <br />
                  {rec?.snapshot.routine.name}
                </p>
                <p className="field-note">해당하는 과정을 모두 골라주세요.</p>
                <div className="wide-list">
                  {changeQuestions.map((question) => (
                    <ChoiceCard
                      wide
                      key={question.id}
                      label={question.label}
                      selected={p.changes.includes(question.id)}
                      disabled={busy}
                      onClick={() =>
                        update({
                          changes: toggleExclusive(p.changes, question.id, [
                            "unknown",
                          ]),
                        })
                      }
                    />
                  ))}
                </div>
                <footer className="footer">
                  {
                    <Action
                      label={"확인"}
                      onClick={() =>
                        member
                          ? run(() => requestNext(p.changes))
                          : show("session-end")
                      }
                      busy={busy}
                      secondary={false}
                      disabled={!p.changes.length}
                    />
                  }
                  {
                    <Action
                      label={"여기서 마칠게요"}
                      onClick={() => show("session-end")}
                      busy={busy}
                      secondary={true}
                    />
                  }
                </footer>
              </>
            )}
            {screen === "no-next" && (
              <>
                <Header />
                <h1>추가로 안내할 동작이 없어요</h1>
                <p className="sub">
                  오늘은 여기까지 마무리해요.
                  <br />
                  알려주신 느낌은 기록에 함께 남겼어요.
                </p>
                {summary}
                {finishButtons}
              </>
            )}
            {screen === "records" && member && (
              <>
                <Header
                  back={() => show(p.returnScreen ?? "home")}
                  busy={busy}
                  right={
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={logout}
                    >
                      로그아웃
                    </button>
                  }
                />
                <h1>내 기록</h1>
                <p className="sub">나를 돌본 순간들을 부위별로 모았어요.</p>
                {recordsLoading && (
                  <p className="note" role="status">
                    기록을 불러오고 있어요.
                  </p>
                )}
                {!records.length && !error && !recordsLoading && (
                  <>
                    <h2 className="routine-heading">아직 기록이 없어요</h2>
                    <p className="sub">첫 루틴을 시작하고 느낌을 남겨보세요.</p>
                    {
                      <Action
                        label={"첫 루틴 시작하기"}
                        onClick={start}
                        busy={busy}
                      />
                    }
                  </>
                )}
                {Array.from(
                  new Map(
                    records.map((record) => [
                      record.snapshot.area.id,
                      record.snapshot.area,
                    ]),
                  ).values(),
                ).map((area) => (
                  <section key={area.id}>
                    <h2 className="record-group">{area.label}</h2>
                    {records
                      .filter((record) => record.snapshot.area.id === area.id)
                      .map((record) => (
                        <details key={record.id}>
                          <summary>
                            <div>
                              <span className="record-date">
                                {new Date(record.createdAt).toLocaleString(
                                  "ko-KR",
                                  { timeZone: "Asia/Seoul" },
                                )}
                              </span>
                              <div className="record-title">
                                {record.snapshot.routine.name}
                              </div>
                            </div>
                            <span>
                              {feedbackLabels[record.feedback]}{" "}
                              <span aria-hidden="true">⌄</span>
                            </span>
                          </summary>
                          <dl className="record-detail">
                            {[
                              [
                                "자세",
                                record.snapshot.posture ??
                                  (record.snapshot.answers?.mode
                                    ? postureLabels[
                                        record.snapshot.answers.mode
                                      ]
                                    : "자세 정보 없음"),
                              ],
                              ["부위", record.snapshot.area.label],
                              [
                                "평소 습관",
                                record.snapshot.habits
                                  .map((question) => question.label)
                                  .join(", "),
                              ],
                              [
                                "최근 행동",
                                record.snapshot.recent
                                  .map((question) => question.label)
                                  .join(", "),
                              ],
                              ["추천 동작", record.snapshot.routine.name],
                              ["동작 후 느낌", feedbackLabels[record.feedback]],
                              ...(record.changes?.length
                                ? [
                                    [
                                      "불편했던 과정",
                                      record.changes
                                        .map((question) => question.label)
                                        .join(", "),
                                    ],
                                  ]
                                : []),
                            ].map(([label, value]) => (
                              <div key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ))}
                  </section>
                ))}
                <footer className="footer">
                  {
                    <Action
                      label={"기록 다시 불러오기"}
                      onClick={() =>
                        run(async () => {
                          const result = await api<{
                            records: RecordRow[];
                            nextCursor: {
                              createdAt: number;
                              id: string;
                            } | null;
                          }>("/records");
                          setRecords(result.records);
                          setRecordCursor(result.nextCursor);
                        })
                      }
                      busy={busy}
                      secondary={true}
                    />
                  }
                  {recordCursor && (
                    <Action
                      label={"이전 기록 더 보기"}
                      onClick={() =>
                        run(async () => {
                          const query = new URLSearchParams({
                            after: String(recordCursor.createdAt),
                            afterId: recordCursor.id,
                          });
                          const result = await api<{
                            records: RecordRow[];
                            nextCursor: {
                              createdAt: number;
                              id: string;
                            } | null;
                          }>(`/records?${query}`);
                          setRecords((old) => [...old, ...result.records]);
                          setRecordCursor(result.nextCursor);
                        })
                      }
                      busy={busy}
                      secondary={true}
                    />
                  )}
                </footer>
              </>
            )}
            {screen === "catalog" && member && (
              <>
                <Header back={() => show("complete")} busy={busy} />
                <h1>동작 안내</h1>
                <div className="wide-list">
                  {catalog(answers.mode!).map((routine) => (
                    <PrimaryButton
                      secondary
                      key={routine.id}
                      onClick={() =>
                        update({ screen: "browse", routineId: routine.id })
                      }
                    >
                      {routine.name}
                    </PrimaryButton>
                  ))}
                </div>
              </>
            )}
            {screen === "browse" &&
              member &&
              p.routineId &&
              getRoutine(p.routineId) && (
                <>
                  <Header back={() => show("catalog")} busy={busy} />
                  <RoutineMedia routine={getRoutine(p.routineId)!} />
                </>
              )}
          </>
        )}
      </Surface>
      <p className="page-footer">직꼿은 의료서비스가 아닙니다.</p>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="jikkot-dialog jikkot-app">
          <DialogHeader>
            <DialogTitle>
              {modal === "limit"
                ? "오늘의 체험을 마쳤어요"
                : modal === "preparing"
                  ? "조금만 기다려주세요"
                  : modal === "privacy"
                    ? "개인정보 수집·이용 안내"
                    : modal === "non-medical"
                      ? "의료서비스가 아님을 확인"
                      : "로그인이 필요해요"}
            </DialogTitle>
            <DialogDescription>
              {modal === "limit"
                ? "비회원은 한국시간 기준 하루 1회 체험할 수 있어요. 회원은 제한 없이 이용할 수 있어요."
                : modal === "preparing"
                  ? "스트레칭과 쇼핑 기능은 준비 중이에요."
                  : modal === "privacy"
                    ? "운영 약관 확정 전의 현재 수집 안내입니다."
                    : modal === "non-medical"
                      ? "직꼿은 질환을 진단하거나 치료하는 의료서비스가 아닙니다."
                      : "회원은 내 기록과 루틴을 이용할 수 있어요. 로그인 후에는 비회원 체험을 계정 기록으로 가져오지 않습니다."}
            </DialogDescription>
          </DialogHeader>
          {modal === "privacy" && (
            <div className="policy-copy">
              <p>운영자: {operationalPolicy.operatorName}</p>
              <p>
                수집 항목: 인증 식별자, 이메일, 아이디·닉네임, 동의 정보, 문진
                답변, 동작과 피드백.
              </p>
              <p>
                목적: 로그인·회원 관리, 동작 추천, 계정 기록 제공 및 서비스
                개선.
              </p>
              <p>
                보유기간 방침: 탈퇴 시까지. 탈퇴·삭제 절차와 확정 약관은 준비
                중입니다.
              </p>
              <p>문의 이메일: 미정</p>
              <p>
                동의 문안 버전: {consentPolicy.version} · 운영 약관 검토 미완료
              </p>
              <p>
                비밀번호는 Firebase Authentication이 처리하며 직꼿의 진행 상태에
                저장하지 않습니다.
              </p>
            </div>
          )}
          {modal === "non-medical" && (
            <p>
              생활 습관과 최근 행동을 바탕으로 가벼운 동작을 안내합니다. 질환의
              진단·치료·개선 효과를 보장하지 않습니다. 승인된 안내를 편안한
              범위에서 이용해주세요.
            </p>
          )}
          {["limit", "login"].includes(modal ?? "") && (
            <PrimaryButton onClick={beginLogin} disabled={busy}>
              로그인하기
            </PrimaryButton>
          )}
          <PrimaryButton secondary onClick={() => setModal(null)}>
            닫기
          </PrimaryButton>
        </DialogContent>
      </Dialog>
    </main>
  );
}
