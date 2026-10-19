"use client";
/* eslint-disable @next/next/no-img-element -- Versioned, supplied static illustrations. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Home as HomeIcon,
  PersonStanding,
  BarChart3,
  UserRound,
} from "lucide-react";
import { api } from "../lib/firebase-client";
import {
  areas,
  sports,
  supports,
  VERSION,
  type Session,
  type SessionInput,
  type Purpose,
  type Reaction,
} from "../lib/personalization/types";
import {
  questions,
  toggleChoice,
  habitChoices,
  currentChoices,
  type Question,
} from "../lib/personalization/questions";
import programOptions from "../lib/personalization/release/program-options.json";
import dailySupports from "../lib/personalization/release/daily-supports.json";
import { guestRetentionCopy } from "../lib/service/policy";
import { Logo, PrimaryButton } from "./jikkot-ui";
import { BodyRegionSelector } from "./body-region-selector";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
type PublicSession = Omit<Session, "owner" | "decision" | "visited">;
type Context = {
  consent: boolean;
  reviewAllowed: boolean;
  serverNow: number;
  expiresAt: number | null;
  preferences: { habits?: Record<string, string[]>; reducedMotion?: boolean };
  summary: { sevenDays: number; thirtyDays: number } | null;
};
type View =
  | "home"
  | "hub"
  | "sport"
  | "time"
  | "posture"
  | "area"
  | "habits"
  | "current"
  | "support"
  | "plan"
  | "perform"
  | "feedback"
  | "complete"
  | "records"
  | "settings"
  | "review";
type Legacy = {
  id: string;
  createdAt: number;
  feedback: string;
  snapshot: {
    routine: { name: string; image: string; steps?: string[]; dose?: string };
    area: { label: string };
  };
};
const asset = "/assets/jikkot-release/2026-10-17/";
const initial = (purpose: Purpose): SessionInput => ({
  purpose,
  habits: [],
  current: [],
  poses: [],
  supports: [],
  focus: [],
  confirmedAt: Date.now(),
  review: false,
  growth: false,
  preference: "all",
  avoidDirections: [],
});
const titles: Record<Purpose, string> = {
  daily: "불편한 곳 풀기",
  warmup: "운동 전 몸풀기",
  leisure: "여유롭게 몸풀기",
};
const feelings: Record<Reaction, string> = {
  better: "개운해요",
  refreshed: "개운해요",
  same: "비슷해요",
  worse: "더 불편해요",
  ready: "준비됐어요",
  insufficient: "조금 부족해요",
};
const supportNames: Record<string, string> = {
  chairPose: "의자에 앉아서도 움직일 수 있어요",
  ...Object.fromEntries(supports),
  standing: "서서 움직일 수 있어요",
  supine: "바로 누울 수 있어요",
  floor: "바닥에 앉을 수 있어요",
  halfKneel: "한쪽 무릎을 바닥에 댈 수 있어요",
  quadruped: "네발 자세가 가능해요",
};
const directionChoices = [
  ["spine_flexion", "몸통 굽히기"],
  ["spine_extension", "몸통 뒤로 젖히기"],
  ["torso_rotation", "몸통 돌리기"],
  ["arm_overhead", "팔 위로 올리기"],
  ["hip_hinge", "몸을 숙이며 고관절 접기"],
  ["knee_extension", "무릎 펴기"],
  ["neck_rotation", "고개 돌리기"],
];
function Choice({
  label,
  selected,
  onClick,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={"release-choice " + (selected ? "selected" : "")}
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      {selected && <span aria-hidden="true">✓</span>}
    </button>
  );
}
function Timer({ seconds, running }: { seconds: number; running: boolean }) {
  const [elapsed, setElapsed] = useState(0),
    [started, setStarted] = useState(false),
    [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!started || !running || !visible || elapsed >= seconds) return;
    const id = setInterval(
      () => setElapsed((t) => Math.min(seconds, t + 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [started, running, visible, elapsed, seconds]);
  const left = Math.max(0, seconds - elapsed);
  return (
    <div className="release-timer">
      <span role="timer" aria-label="남은 보조 시간">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </span>
      <button
        type="button"
        onClick={() => setStarted((v) => !v)}
        disabled={!running || !left}
      >
        {started ? "타이머 멈춤" : "보조 타이머 시작"}
      </button>
      <p className="note">
        {left
          ? "시간은 참고용이에요. 직접 수행을 확인해주세요."
          : "시간이 끝났어요. 수행 완료는 직접 선택해주세요."}
      </p>
    </div>
  );
}
export function PersonalizedExperience({
  uid,
  memberName,
  onLogin,
  onGuestConsent,
  onLogout,
  onPolicy,
  onDeleteAccount,
  initialPurpose,
  onIntentConsumed,
}: {
  uid: string;
  memberName: string | null;
  onLogin: (purpose?: Purpose) => void;
  initialPurpose?: Purpose;
  onIntentConsumed: () => void;
  onGuestConsent: () => void;
  onLogout: () => void;
  onPolicy: () => void;
  onDeleteAccount: () => void;
}) {
  const [editingHabits, setEditingHabits] = useState(false);
  const [view, setView] = useState<View>("home"),
    [input, setInput] = useState<SessionInput>(initial("daily")),
    [context, setContext] = useState<Context | null>(null),
    [session, setSession] = useState<PublicSession | null>(null),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [page, setPage] = useState(0),
    [bodySection, setBodySection] = useState<"upper" | "lower">("upper"),
    [bodyBack, setBodyBack] = useState(false),
    [posture, setPosture] = useState<"chair" | "standing" | "lying" | null>(
      null,
    ),
    [reaction, setReaction] = useState<Reaction | null>(null),
    [painItem, setPainItem] = useState(""),
    [painSteps, setPainSteps] = useState<number[]>([]),
    [unknownSteps, setUnknownSteps] = useState(false);
  const [records, setRecords] = useState<PublicSession[]>([]),
    [legacy, setLegacy] = useState<Legacy[]>([]),
    [cursor, setCursor] = useState<{ createdAt: number; id: string } | null>(
      null,
    ),
    [legacyCursor, setLegacyCursor] = useState<{
      createdAt: number;
      id: string;
    } | null>(null),
    [zoom, setZoom] = useState(false),
    [exit, setExit] = useState<View | null>(null),
    [skip, setSkip] = useState(false),
    [reduced, setReduced] = useState(false),
    [reviewRows, setReviewRows] = useState<
      {
        catalogId: string;
        name: string;
        steps: string[];
        media: { path: string };
      }[]
    >([]),
    [sportSearch, setSportSearch] = useState("");
  const inFlight = useRef(false),
    pendingCreate = useRef<{ sessionId: string; input: SessionInput } | null>(
      null,
    ),
    pendingEvent = useRef<Record<string, unknown> | null>(null),
    restored = useRef(false),
    sessionRef = useRef<PublicSession | null>(null);
  const key = "jikkot.release." + uid;
  const go = useCallback(
    (next: View, replace = false) => {
      setError("");
      setPage(0);
      setView(next);
      const state = { jikkot: true, view: next, owner: uid };
      if (replace) history.replaceState(state, "", "#" + next);
      else history.pushState(state, "", "#" + next);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [uid],
  );
  const resetExpired = useCallback(() => {
    restored.current = false;
    pendingCreate.current = null;
    pendingEvent.current = null;
    sessionStorage.removeItem(key);
    setSession(null);
    setInput(initial("daily"));
    setView("home");
    setNotice(
      "한국 시간 자정이 지나 이전 비회원 이용이 만료됐어요. 새 날짜로 시작해주세요.",
    );
  }, [key]);
  const run = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "SESSION_EXPIRED") {
        resetExpired();
        setContext((c) => (c ? { ...c, consent: false } : c));
      } else if (code === "CONSENT_REQUIRED") {
        onGuestConsent();
      } else if (code === "AUTH_EXPIRED" || code === "AUTH_REQUIRED") {
        onLogin();
      } else if (code === "DAILY_LIMIT") {
        setError(
          "오늘 체험을 마쳤어요. 한국 시간 자정 이후 다시 이용할 수 있어요.",
        );
      } else
        setError(
          e instanceof Error ? e.message : "연결을 확인하고 다시 시도해주세요.",
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      const next = event.state?.owner === uid ? event.state.view : "home";
      if (
        sessionRef.current &&
        sessionRef.current.status === "active" &&
        ["home", "hub", "records", "settings"].includes(next)
      ) {
        setExit(next);
        return;
      }
      setPage(0);
      setView(next ?? "home");
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [uid]);
  useEffect(() => {
    if (!uid) {
      restored.current = true;
      return;
    }
    let active = true;
    void api<Context>("/personalization/context")
      .then(async (c) => {
        if (!active) return;
        setContext(c);
        setReduced(
          !!c.preferences.reducedMotion ||
            (!memberName &&
              localStorage.getItem("jikkot.reduced-motion") === "true"),
        );
        if (restored.current) return;
        restored.current = true;
        const raw = sessionStorage.getItem(key);
        if (!raw) return;
        try {
          const saved = JSON.parse(raw);
          if (saved.uid !== uid || saved.version !== VERSION) return;
          pendingCreate.current = saved.request ?? null;
          pendingEvent.current = saved.event ?? null;
          if (saved.input) {
            setInput(saved.input);
            setView(saved.view ?? "home");
          }
          const savedId = saved.sessionId ?? saved.request?.sessionId;
          if (savedId) {
            let s = await api<PublicSession>(
              "/personalization/sessions/" + savedId,
            );
            if (saved.event) {
              s = await api<PublicSession>(
                `/personalization/sessions/${savedId}/events`,
                saved.event,
              );
              pendingEvent.current = null;
            }
            pendingCreate.current = null;
            if (!active) return;
            setSession(s);
            setInput(s.input);
            setPosture(
              s.input.profile === "standing"
                ? "standing"
                : s.input.profile === "chair"
                  ? "chair"
                  : s.input.poses.includes("supine")
                    ? "lying"
                    : "chair",
            );
            setIndex(
              Math.max(
                0,
                s.items.findIndex((i) => i.state === "pending"),
              ),
            );
            setView(
              saved.view === "home"
                ? "home"
                : s.status === "completed" || s.status === "stopped"
                  ? s.feedbackSubmitted
                    ? "complete"
                    : "feedback"
                  : "perform",
            );
          } else if (saved.input) {
            setInput(saved.input);
            setView(saved.view ?? "home");
          }
        } catch (e) {
          if ((e as { code?: string }).code === "SESSION_EXPIRED")
            resetExpired();
          else if (active)
            setError(
              "진행 상태를 복원하지 못했어요. 연결을 확인하고 다시 시도해주세요.",
            );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [uid, key, resetExpired, memberName]);
  useEffect(() => {
    if (!uid || !restored.current) return;
    sessionStorage.setItem(
      key,
      JSON.stringify({
        version: VERSION,
        uid,
        input,
        view,
        sessionId: session?.id,
        request: pendingCreate.current,
        event: pendingEvent.current,
      }),
    );
  }, [uid, key, input, view, session, busy]);
  useEffect(() => {
    if (memberName || !context?.expiresAt) return;
    const offset = context.serverNow - Date.now();
    const remaining = context.expiresAt - (Date.now() + offset);
    const id = setTimeout(
      () => {
        resetExpired();
        setContext((c) => (c ? { ...c, consent: false } : c));
      },
      Math.max(0, remaining),
    );
    const visible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() + offset >= context.expiresAt!
      ) {
        resetExpired();
        setContext((c) => (c ? { ...c, consent: false } : c));
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [memberName, context?.expiresAt, context?.serverNow, resetExpired]);
  const requireStart = useCallback(
    (purpose: Purpose) => {
      if (purpose !== "daily" && !memberName) {
        onLogin(purpose);
        return;
      }
      if (!uid || !context?.consent) {
        onGuestConsent();
        return;
      }
      pendingCreate.current = null;
      pendingEvent.current = null;
      setSession(null);
      setReaction(null);
      setPosture(null);
      setEditingHabits(false);
      setInput(initial(purpose));
      go(
        purpose === "warmup"
          ? "sport"
          : purpose === "leisure"
            ? "time"
            : "posture",
      );
    },
    [uid, memberName, context?.consent, onLogin, onGuestConsent, go],
  );
  useEffect(() => {
    if (initialPurpose && context?.consent) {
      queueMicrotask(() => {
        requireStart(initialPurpose);
        onIntentConsumed();
      });
    }
  }, [initialPurpose, context?.consent, requireStart, onIntentConsumed]);
  const choosePose = (p: "chair" | "standing" | "lying") => {
    setPosture(p);
    setInput((old) => ({
      ...old,
      profile: p,
      poses: [p === "lying" ? "supine" : p],
      supports: [],
    }));
  };
  const selectedProgram = programOptions.find(
    (p) =>
      p.purpose === input.purpose &&
      (input.purpose === "warmup"
        ? p.sport === input.sport
        : p.profile === input.profile &&
          p.minutesChoice === input.minutes &&
          p.focus === input.preference),
  );
  const capabilityKeys =
    input.purpose === "daily"
      ? ((dailySupports[input.area ?? "back"] as Record<string, string[]>)[
          input.poses[0]
        ] ?? [])
      : [
          ...new Set([
            ...(selectedProgram?.requiredCapabilities ?? []),
            ...(selectedProgram?.supportOptions ?? []),
          ]),
        ];
  const caps = [
    ...new Set([
      ...capabilityKeys,
      ...(input.purpose === "warmup" ? ["chair", "chairPose"] : []),
    ]),
  ];
  const hasCap = (id: string) =>
    (id === "chairPose" ? input.poses.includes("chair") : false) ||
    input.poses.includes(id as never) ||
    input.supports.includes(id as never);
  const toggleCap = (id: string) =>
    setInput((old) => {
      if (id === "chairPose")
        return {
          ...old,
          poses: old.poses.includes("chair")
            ? old.poses.filter((p) => p !== "chair")
            : [...old.poses, "chair"],
        };
      if (
        ["floor", "halfKneel", "quadruped", "supine", "standing"].includes(id)
      )
        return {
          ...old,
          poses: old.poses.includes(id as never)
            ? old.poses.filter((p) => p !== id)
            : [...old.poses, id as never],
        };
      return {
        ...old,
        supports: old.supports.includes(id as never)
          ? old.supports.filter((s) => s !== id)
          : [...old.supports, id as never],
      };
    });
  const selectedPatterns = habitChoices
    .filter((q) => input.habits.includes(q.id))
    .flatMap((q) => q.patterns);
  const questionList: Question[] =
    view === "habits"
      ? questions("habits", input.area)
      : questions("current", input.area, input.habits).filter(
          (q) =>
            q.exclusive ||
            ["sudden_worse", "radiating", "dizzy"].includes(q.id) ||
            q.patterns.some((p) => selectedPatterns.includes(p)),
        );
  const visibleQuestions = questionList.slice(page * 6, page * 6 + 6);
  const updateAnswer = (kind: "habits" | "current", id: string) =>
    setInput((old) => ({
      ...old,
      [kind]: toggleChoice(old[kind], id),
      ...(kind === "habits" ? { current: [] } : {}),
    }));
  const create = () =>
    run(async () => {
      pendingCreate.current ??= {
        sessionId: crypto.randomUUID(),
        input: { ...input, confirmedAt: Date.now() },
      };
      const s = await api<PublicSession>(
        "/personalization/sessions",
        pendingCreate.current,
      );
      setSession(s);
      setInput(s.input);
      setIndex(0);
      pendingCreate.current = null;
      go(s.input.purpose === "daily" ? "perform" : "plan");
    });
  const event = async (
    action: string,
    fields: Record<string, unknown> = {},
  ) => {
    if (!session) return;
    pendingEvent.current ??= {
      eventId: crypto.randomUUID(),
      action,
      ...fields,
    };
    const s = await api<PublicSession>(
      `/personalization/sessions/${session.id}/events`,
      pendingEvent.current,
    );
    pendingEvent.current = null;
    setSession(s);
    setSkip(false);
    if (s.status === "completed" || s.status === "stopped") {
      setReaction(null);
      setPainSteps([]);
      setUnknownSteps(false);
      setPainItem(s.input.purpose === "daily" ? s.items.at(-1)!.itemId : "");
      go(s.feedbackSubmitted ? "complete" : "feedback");
    } else {
      setIndex(
        Math.max(
          0,
          s.items.findIndex((i) => i.state === "pending"),
        ),
      );
      go("perform");
    }
  };
  const loadRecords = async (more = false) => {
    if (!uid) {
      onLogin();
      return;
    }
    const suffix =
      more && cursor ? `?after=${cursor.createdAt}&afterId=${cursor.id}` : "";
    const fresh = await api<{
      records: PublicSession[];
      reviewRecords: PublicSession[];
      nextCursor: typeof cursor;
    }>("/personalization/records" + suffix);
    setRecords((old) =>
      more
        ? [...old, ...fresh.records, ...fresh.reviewRecords]
        : [...fresh.records, ...fresh.reviewRecords],
    );
    setCursor(fresh.nextCursor);
    if (memberName && (!more || legacyCursor)) {
      const suffix =
        more && legacyCursor
          ? `?after=${legacyCursor.createdAt}&afterId=${legacyCursor.id}`
          : "";
      const old = await api<{
        records: Legacy[];
        nextCursor: typeof legacyCursor;
      }>("/records" + suffix);
      setLegacy((xs) => (more ? [...xs, ...old.records] : old.records));
      setLegacyCursor(old.nextCursor);
    } else if (!memberName) setLegacy([]);
    go("records");
  };
  const navigate = (next: View) => {
    if (session && session.status === "active" && next !== view) {
      setExit(next);
      return;
    }
    if (next === "records") {
      void run(() => loadRecords());
      return;
    }
    go(next);
  };
  const current = session?.items[index];
  const nextImage = session?.items[index + 1]?.movement.media.src;
  useEffect(() => {
    if (!nextImage || view !== "perform") return;
    const image = new Image();
    image.src = nextImage;
    return () => image.removeAttribute("src");
  }, [nextImage, view]);
  const finishFeedback = () =>
    run(() =>
      event("feedback", {
        reaction,
        ...(painItem ? { itemId: painItem } : {}),
        steps: painSteps,
        stepsState: unknownSteps
          ? "unknown"
          : painSteps.length
            ? "selected"
            : "unanswered",
      }),
    );
  const nav = [
    ["home", "홈", HomeIcon],
    ["hub", "몸풀기", PersonStanding],
    ["records", "내 기록", BarChart3],
    ["settings", "마이", UserRound],
  ] as const;
  const rootView = ["home", "hub", "records", "settings", "review"].includes(
    view,
  );
  useEffect(() => {
    const screen = document.querySelector<HTMLElement>(".release-app");
    const nav = document.querySelector<HTMLElement>(".release-nav");
    if (!screen || !nav) return;
    const observer = new ResizeObserver(() =>
      screen.style.setProperty(
        "--nav-height",
        `${nav.getBoundingClientRect().height}px`,
      ),
    );
    observer.observe(nav);
    return () => observer.disconnect();
  }, [rootView]);
  const back = () => {
    if (editingHabits) {
      setEditingHabits(false);
      go("settings");
      return;
    }
    if (page > 0) {
      setPage((p) => p - 1);
      return;
    }
    const routes: Partial<Record<View, View>> = {
      sport: "hub",
      time: "hub",
      posture: input.purpose === "daily" ? "home" : "time",
      area: "posture",
      habits: "area",
      current: input.purpose === "daily" ? "habits" : "support",
      support:
        input.purpose === "daily"
          ? "current"
          : input.purpose === "warmup"
            ? "sport"
            : "posture",
      plan: input.purpose === "daily" ? "support" : "current",
    };
    go(routes[view] ?? "home");
  };
  return (
    <div
      className="release-experience"
      data-view={view}
      data-reduced-motion={reduced}
    >
      {rootView ? (
        <header className="release-top">
          <Logo />
          {!uid ? (
            <button className="text-button" onClick={() => onLogin()}>
              로그인 · 회원가입
            </button>
          ) : null}
        </header>
      ) : (
        <header className="flow-header">
          <button
            type="button"
            onClick={back}
            disabled={busy}
            aria-label="이전 단계"
          >
            ‹ 이전
          </button>
          <span>{titles[input.purpose]}</span>
          <button
            type="button"
            onClick={() => navigate("home")}
            disabled={busy}
            aria-label="진행 나가기"
          >
            닫기
          </button>
        </header>
      )}
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
      {busy && (
        <p className="note" role="status">
          요청을 처리하고 있어요.
        </p>
      )}
      {view === "home" && (
        <>
          <div className="release-home">
            <h1>
              {memberName ? (
                "오늘도, 가볍게 풀어볼까요?"
              ) : (
                <>
                  잠깐,
                  <br />
                  몸도 쉬어갈까요?
                </>
              )}
            </h1>
            <p>어디가 불편한지 알려주세요.</p>
            <img
              className="release-mascot"
              src={asset + "brand/turtle-home.png"}
              width={684}
              height={823}
              alt=""
            />
            <PrimaryButton
              disabled={busy}
              onClick={() => requireStart("daily")}
            >
              불편한 곳 풀기
            </PrimaryButton>
            {!memberName && (
              <p className="note">비회원은 하루 한 번 체험할 수 있어요.</p>
            )}
          </div>
          {session && ["active", "paused"].includes(session.status) && (
            <button className="secondary" onClick={() => go("perform")}>
              진행 중인 몸풀기 이어서 하기
            </button>
          )}
        </>
      )}
      {view === "hub" && (
        <>
          <h1>오늘은 어떻게 풀까요?</h1>
          {(["warmup", "leisure"] as const).map((p) => (
            <button
              type="button"
              className="release-hub-card"
              key={p}
              onClick={() => requireStart(p)}
            >
              <img
                src={
                  asset +
                  "movements/" +
                  (p === "warmup" ? "w11" : "d25") +
                  ".webp"
                }
                width={128}
                height={160}
                alt=""
                loading="lazy"
              />
              <span>
                <strong>{titles[p]}</strong>
                <small>
                  {p === "warmup"
                    ? "운동 전에 천천히 준비해요"
                    : "5분·10분, 내 여유에 맞춰요"}
                </small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
          {!memberName && (
            <p className="note">
              몸풀기 두 메뉴는 로그인 후 무료로 이용할 수 있어요.
            </p>
          )}
        </>
      )}
      {view === "sport" && (
        <>
          <h1>어떤 운동을 할까요?</h1>
          <label className="sr-only" htmlFor="sport-search">
            운동 찾기
          </label>
          <input
            id="sport-search"
            type="search"
            value={sportSearch}
            onChange={(e) => setSportSearch(e.target.value)}
            placeholder="운동 찾기"
          />
          <div className="sport-grid">
            {sports
              .filter(([, label]) => label.includes(sportSearch))
              .map(([id, label]) => {
                const p = programOptions.find((p) => p.sport === id);
                return (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={input.sport === id}
                    className={
                      "release-choice " + (input.sport === id ? "selected" : "")
                    }
                    onClick={() =>
                      setInput((old) => ({
                        ...old,
                        sport: id,
                        poses: [],
                        supports: [],
                        current: [],
                        profile: "standing",
                      }))
                    }
                  >
                    <img
                      src={(p?.icon ?? "").replace("assets/", asset)}
                      width={40}
                      height={40}
                      alt=""
                    />
                    {label}
                  </button>
                );
              })}
          </div>
          {!sports.some(([, label]) => label.includes(sportSearch)) && (
            <p>
              찾는 운동이 없어요.{" "}
              <button onClick={() => setSportSearch("")}>검색 지우기</button>
            </p>
          )}
          <PrimaryButton
            disabled={!input.sport || busy}
            onClick={() => go("support")}
          >
            다음
          </PrimaryButton>
        </>
      )}
      {view === "time" && (
        <>
          <h1>얼마나 여유가 있나요?</h1>
          <div className="release-choices">
            {([5, 10] as const).map((n) => (
              <Choice
                key={n}
                label={n + "분"}
                selected={input.minutes === n}
                onClick={() => setInput((old) => ({ ...old, minutes: n }))}
              />
            ))}
          </div>
          <PrimaryButton
            disabled={!input.minutes}
            onClick={() => go("posture")}
          >
            다음
          </PrimaryButton>
        </>
      )}
      {view === "posture" && (
        <>
          <h1>지금 어떤 상태인가요?</h1>
          <p>지금 할 수 있는 자세를 골라주세요.</p>
          <div
            className="posture-cards"
            role="radiogroup"
            aria-label="가능한 자세"
          >
            {(
              [
                ["chair", "앉기", "의자에 앉아서", "sitting"],
                ["standing", "서기", "서 있는 상태에서", "standing"],
                ["lying", "눕기", "마른 매트에 누워서", "lying"],
              ] as const
            ).map(([id, label, desc, file]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={posture === id}
                className={"posture-card " + (posture === id ? "selected" : "")}
                onClick={() => choosePose(id)}
              >
                <img
                  src={asset + "ui/posture-" + file + ".webp"}
                  width={144}
                  height={144}
                  alt=""
                />
                <span>
                  <strong>{label}</strong>
                  <small>{desc}</small>
                </span>
                <span className="posture-tick" aria-hidden="true">
                  {posture === id ? "✓" : "○"}
                </span>
              </button>
            ))}
          </div>
          {input.purpose === "leisure" && posture === "lying" && (
            <Choice
              label="바닥 앉기·네발 자세 등 자세 전환도 가능해요"
              selected={input.profile === "mixedFloor"}
              onClick={() =>
                setInput((old) => ({
                  ...old,
                  profile:
                    old.profile === "mixedFloor" ? "lying" : "mixedFloor",
                  poses: ["supine"],
                  supports: [],
                }))
              }
            />
          )}
          <PrimaryButton
            disabled={!posture}
            onClick={() => go(input.purpose === "daily" ? "area" : "support")}
          >
            다음
          </PrimaryButton>
        </>
      )}
      {view === "area" && (
        <>
          <h1>어디가 불편하세요?</h1>
          <div className="release-segments">
            {(["upper", "lower"] as const).map((x) => (
              <button
                type="button"
                key={x}
                aria-pressed={bodySection === x}
                onClick={() => setBodySection(x)}
              >
                {x === "upper" ? "상체" : "하체"}
              </button>
            ))}
          </div>
          <BodyRegionSelector
            region={bodySection}
            back={bodyBack}
            selected={input.area}
            reducedMotion={reduced}
            onViewChange={setBodyBack}
            onSelect={(area) => {
              setBodyBack(
                ["back", "lower", "hamstring", "calf"].includes(area),
              );
              setInput((old) => ({
                ...old,
                area,
                habits: context?.preferences.habits?.[area] ?? [],
                current: [],
              }));
            }}
          />
          <div className="body-chips" role="radiogroup" aria-label="불편 부위">
            {areas
              .filter((_, i) => (bodySection === "upper" ? i < 5 : i >= 5))
              .map(([id, label]) => (
                <button
                  type="button"
                  role="radio"
                  key={id}
                  aria-checked={input.area === id}
                  onClick={() => {
                    setBodyBack(
                      ["back", "lower", "hamstring", "calf"].includes(id),
                    );
                    setInput((old) => ({
                      ...old,
                      area: id,
                      habits: context?.preferences.habits?.[id] ?? [],
                      current: [],
                    }));
                  }}
                >
                  {input.area === id && <span aria-hidden="true">✓ </span>}
                  {label}
                </button>
              ))}
          </div>
          <PrimaryButton disabled={!input.area} onClick={() => go("habits")}>
            다음
          </PrimaryButton>
        </>
      )}
      {(view === "habits" ||
        (view === "current" && input.purpose === "daily")) && (
        <>
          <h1>
            {view === "habits"
              ? "평소엔 어떤 시간이 많나요?"
              : "최근엔 어떤 느낌이었나요?"}
          </h1>
          {view === "habits" && editingHabits && (
            <label>
              습관을 바꿀 부위
              <select
                value={input.area}
                onChange={(e) => {
                  const area = e.target.value as SessionInput["area"];
                  setInput((old) => ({
                    ...old,
                    area,
                    habits: context?.preferences.habits?.[area!] ?? [],
                    current: [],
                  }));
                  setPage(0);
                }}
              >
                {areas.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="note">
            {view === "habits"
              ? "여러 개 골라도 괜찮아요. 지난 답변을 바꿀 수 있어요."
              : "이미 기억나는 편한 움직임만 골라주세요. 불편한 움직임을 시험하지 마세요."}
          </p>
          <div className="release-choices">
            {visibleQuestions.map((q) => (
              <Choice
                key={q.id}
                label={q.label}
                selected={input[
                  view === "habits" ? "habits" : "current"
                ].includes(q.id)}
                onClick={() =>
                  updateAnswer(view === "habits" ? "habits" : "current", q.id)
                }
              />
            ))}
          </div>
          <p className="note">
            {page + 1} / {Math.ceil(questionList.length / 6)}
          </p>
          <PrimaryButton
            disabled={
              !input[view === "habits" ? "habits" : "current"].length || busy
            }
            onClick={() => {
              if ((page + 1) * 6 < questionList.length) {
                setPage((p) => p + 1);
                window.scrollTo(0, 0);
              } else if (view === "habits") {
                if (memberName)
                  void run(async () => {
                    await api("/personalization/preferences", {
                      habits: {
                        ...context?.preferences.habits,
                        [input.area!]: input.habits,
                      },
                      review: false,
                    });
                    setContext((c) =>
                      c
                        ? {
                            ...c,
                            preferences: {
                              ...c.preferences,
                              habits: {
                                ...c.preferences.habits,
                                [input.area!]: input.habits,
                              },
                            },
                          }
                        : c,
                    );
                    if (editingHabits) {
                      setEditingHabits(false);
                      setNotice("평소 습관을 저장했어요.");
                      go("settings");
                    } else go("current");
                  });
                else go("current");
              } else go("support");
            }}
          >
            {(page + 1) * 6 < questionList.length ? "계속" : "다음"}
          </PrimaryButton>
        </>
      )}
      {view === "support" && (
        <>
          <h1>
            {input.purpose === "warmup"
              ? "편하게 준비할 수 있나요?"
              : "필요한 지지를 확인해요"}
          </h1>
          <p className="note">
            실제로 가능한 조건만 선택해주세요. 없거나 모르면 선택하지 않아도
            돼요.
          </p>
          <div className="release-choices">
            {caps
              .filter(
                (c) =>
                  !(
                    ["standing", "supine"].includes(c) &&
                    input.purpose !== "warmup"
                  ),
              )
              .slice(page * 6, page * 6 + 6)
              .map((c) => (
                <Choice
                  key={c}
                  label={supportNames[c] ?? c}
                  selected={hasCap(c)}
                  onClick={() => toggleCap(c)}
                />
              ))}
          </div>
          {!caps.filter(
            (c) =>
              !(
                ["standing", "supine"].includes(c) && input.purpose !== "warmup"
              ),
          ).length && <p>추가 지지 도구가 필요하지 않아요.</p>}
          <PrimaryButton
            disabled={busy}
            onClick={() => {
              if (
                (page + 1) * 6 <
                caps.filter(
                  (c) =>
                    !(
                      ["standing", "supine"].includes(c) &&
                      input.purpose !== "warmup"
                    ),
                ).length
              )
                setPage((p) => p + 1);
              else if (input.purpose === "daily") create();
              else go("current");
            }}
          >
            {(page + 1) * 6 <
            caps.filter(
              (c) =>
                !(
                  ["standing", "supine"].includes(c) &&
                  input.purpose !== "warmup"
                ),
            ).length
              ? "계속"
              : input.purpose === "daily"
                ? "동작 보기"
                : "다음"}
          </PrimaryButton>
        </>
      )}
      {view === "current" && input.purpose !== "daily" && (
        <>
          <h1>
            {input.purpose === "warmup"
              ? "오늘은 편하게 움직일 수 있나요?"
              : "편한 범위만 알려주세요"}
          </h1>
          <p>아픈 곳이나 불편한 습관을 만들 필요는 없어요.</p>
          <Choice
            label={
              input.purpose === "warmup"
                ? "준비 움직임을 편한 범위에서 할 수 있어요"
                : "오늘 특별한 불편이 없고 작은 움직임은 편해요"
            }
            selected={input.current.includes(
              input.purpose === "warmup" ? "prep_comfort" : "today_ok",
            )}
            onClick={() =>
              setInput((old) => ({
                ...old,
                current: old.current.includes(
                  old.purpose === "warmup" ? "prep_comfort" : "today_ok",
                )
                  ? []
                  : [old.purpose === "warmup" ? "prep_comfort" : "today_ok"],
              }))
            }
          />
          <details>
            <summary>오늘 피할 움직임이 있어요</summary>
            {directionChoices.map(([id, label]) => (
              <Choice
                key={id}
                label={label}
                selected={input.avoidDirections.includes(id)}
                onClick={() =>
                  setInput((old) => ({
                    ...old,
                    avoidDirections: old.avoidDirections.includes(id)
                      ? old.avoidDirections.filter((d) => d !== id)
                      : [...old.avoidDirections, id],
                  }))
                }
              />
            ))}
          </details>
          <details>
            <summary>새롭게 심한 불편이나 어지러움이 있어요</summary>
            {currentChoices
              .filter((q) =>
                ["sudden_worse", "radiating", "dizzy"].includes(q.id),
              )
              .map((q) => (
                <Choice
                  key={q.id}
                  label={q.label}
                  selected={input.current.includes(q.id)}
                  onClick={() =>
                    setInput((old) => ({
                      ...old,
                      current: toggleChoice(old.current, q.id),
                    }))
                  }
                />
              ))}
          </details>
          {input.purpose === "leisure" && (
            <fieldset>
              <legend>어디를 더 풀고 싶나요? · 선택</legend>
              <div className="release-segments">
                {(
                  [
                    ["all", "전신"],
                    ["upper", "상체"],
                    ["lower", "하체"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={input.preference === id}
                    onClick={() => {
                      setInput((old) => ({ ...old, preference: id }));
                      go("support");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <PrimaryButton
            disabled={!input.current.length || busy}
            onClick={create}
          >
            순서 확인
          </PrimaryButton>
        </>
      )}
      {view === "plan" && session && (
        <>
          <h1>
            {session.input.purpose === "warmup"
              ? "운동 전에 가볍게"
              : "내 여유에 맞는 몸풀기"}
          </h1>
          <p>
            {session.program?.name} · 약{" "}
            {Math.round((session.program?.plannedSeconds ?? 0) / 60)}분
          </p>
          <p className="note">
            {session.items.length}단계 ·{" "}
            {new Set(session.items.map((i) => i.movement.catalogId)).size}개
            동작. 진행량과 자세 전환을 더한 예상 시간이에요.
          </p>
          {session.program?.partial && (
            <p className="note">
              지금 조건에 맞춰 일부 단계를 바꿨거나 제외했어요. 종목의 모든
              준비를 대신하지 않아요.
            </p>
          )}
          <ol className="release-plan">
            {session.items.map((i, n) => (
              <li key={i.itemId}>
                <span>{n + 1}</span>
                <div>
                  <strong>
                    {i.movement.name}
                    {(i.movement.round ?? 1) > 1
                      ? ` · ${i.movement.round}회차`
                      : ""}
                  </strong>
                  <small>{i.movement.dose}</small>
                </div>
              </li>
            ))}
          </ol>
          {session.program?.sportSpecificStart && (
            <p className="note">
              몸풀기 후: {session.program.sportSpecificStart} 이 안내는 위
              시간에 포함되지 않아요.
            </p>
          )}
          <PrimaryButton onClick={() => go("perform")}>
            몸풀기 시작
          </PrimaryButton>
        </>
      )}
      {view === "perform" && session && current && (
        <>
          <p className="note">
            {index + 1} / {session.items.length}단계
            {session.status === "paused" ? " · 잠시 멈춤" : ""}
          </p>
          <h1>{current.movement.name}</h1>
          <button
            className="movement-image-button"
            type="button"
            onClick={() => setZoom(true)}
            aria-label="동작 그림 크게 보기"
          >
            <img
              className="release-movement"
              src={current.movement.media.src}
              width={current.movement.media.width}
              height={current.movement.media.height}
              alt={current.movement.name}
            />
          </button>
          <p className="release-dose">{current.movement.dose}</p>
          <ol className="movement-steps">
            {current.movement.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {current.movement.cue && (
            <p className="note">{current.movement.cue}</p>
          )}
          {session.input.purpose !== "daily" &&
            current.movement.dosage?.kind === "timed" && (
              <Timer
                key={current.itemId}
                seconds={current.movement.dosage.activeSeconds}
                running={session.status === "active"}
              />
            )}
          <div className="release-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() =>
                  event(session.status === "paused" ? "resume" : "pause"),
                )
              }
            >
              {session.status === "paused" ? "재개" : "잠시 멈춤"}
            </button>
            <button
              type="button"
              disabled={busy || session.status !== "active"}
              onClick={() => setSkip(true)}
            >
              동작 넘기기
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => event("stop", { itemId: current.itemId }))
              }
            >
              중단하기
            </button>
          </div>
          {skip && (
            <fieldset>
              <legend>어떤 이유로 넘길까요? · 선택</legend>
              {(
                [
                  ["discomfort", "불편했어요"],
                  ["support", "자세나 도구가 어려워요"],
                  ["time", "지금은 쉬고 싶어요"],
                  ["other", "이유 없이 넘기기"],
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className="secondary"
                  onClick={() =>
                    run(() =>
                      event("skip", { itemId: current.itemId, skipReason: id }),
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </fieldset>
          )}
          <PrimaryButton
            disabled={
              busy || session.status !== "active" || current.state !== "pending"
            }
            onClick={() =>
              run(() => event("complete", { itemId: current.itemId }))
            }
          >
            {input.purpose === "daily" ? "마쳤어요" : "이 동작 마쳤어요"}
          </PrimaryButton>
          <div className="release-actions">
            <button
              disabled={index === 0 || busy}
              onClick={() => setIndex((i) => i - 1)}
            >
              이전 동작 보기
            </button>
            <button
              disabled={index >= session.items.length - 1 || busy}
              onClick={() => setIndex((i) => i + 1)}
            >
              다음 동작 보기
            </button>
          </div>
          <p className="note">
            그림이나 경과 시간만으로 수행 완료를 기록하지 않아요.
          </p>
        </>
      )}
      {view === "feedback" && session && (
        <>
          {session.items.some((i) =>
            ["completed", "stopped"].includes(i.state),
          ) ? (
            <>
              <h1>하고 나니 어떤가요?</h1>
              <p className="note">
                {input.purpose === "daily"
                  ? "실제로 수행한 동작의 느낌이에요."
                  : "묶음 전체의 느낌을 한 번만 남겨요."}
              </p>
              <div className="release-choices">
                {(
                  (input.purpose === "daily"
                    ? ["better", "same", "worse"]
                    : input.purpose === "warmup"
                      ? ["ready", "insufficient", "worse"]
                      : ["refreshed", "same", "worse"]) as Reaction[]
                ).map((r) => (
                  <Choice
                    key={r}
                    label={feelings[r]}
                    selected={reaction === r}
                    onClick={() => setReaction(r)}
                  />
                ))}
              </div>
              {reaction === "worse" && (
                <fieldset>
                  <legend>어느 과정에서 불편했나요?</legend>
                  {input.purpose !== "daily" && (
                    <label>
                      불편했던 동작
                      <select
                        value={painItem}
                        onChange={(e) => {
                          setPainItem(e.target.value);
                          setPainSteps([]);
                        }}
                      >
                        <option value="">정확히 모르겠어요</option>
                        {session.items
                          .filter((i) =>
                            ["completed", "stopped"].includes(i.state),
                          )
                          .map((i) => (
                            <option value={i.itemId} key={i.itemId}>
                              {i.movement.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  {session.items
                    .find((i) => i.itemId === painItem)
                    ?.movement.steps.map((s, n) => (
                      <Choice
                        key={n}
                        label={s}
                        selected={painSteps.includes(n)}
                        onClick={() => {
                          setUnknownSteps(false);
                          setPainSteps((xs) =>
                            xs.includes(n)
                              ? xs.filter((x) => x !== n)
                              : [...xs, n],
                          );
                        }}
                      />
                    ))}
                  <Choice
                    label="과정은 정확히 모르겠어요"
                    selected={unknownSteps}
                    onClick={() => {
                      setUnknownSteps((v) => !v);
                      setPainSteps([]);
                    }}
                  />
                </fieldset>
              )}
              <PrimaryButton
                disabled={!reaction || busy}
                onClick={finishFeedback}
              >
                느낌 남기기
              </PrimaryButton>
              {input.purpose !== "daily" && (
                <button className="text-button" onClick={() => go("complete")}>
                  느낌은 다음에 남길게요
                </button>
              )}
            </>
          ) : (
            <>
              <h1>이번에는 쉬어가요</h1>
              <p>
                수행한 동작이 없어 느낌은 기록하지 않아요. 넘긴 이유만 남겼어요.
              </p>
              <PrimaryButton onClick={() => go("home")}>홈으로</PrimaryButton>
            </>
          )}
        </>
      )}
      {view === "complete" && session && (
        <>
          <img
            className="release-companion"
            src={asset + "ui/turtle-complete.webp"}
            width={180}
            height={180}
            alt=""
          />
          <h1>
            {session.feedbackSubmitted
              ? "오늘의 느낌을 남겼어요"
              : "오늘의 몸풀기를 마쳤어요"}
          </h1>
          {session.feedback && <p>{feelings[session.feedback]}</p>}
          {input.purpose === "daily" &&
            ["same", "worse"].includes(session.feedback ?? "") &&
            session.nextState !== "none" && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => run(() => event("next"))}
              >
                다른 동작 살펴보기
              </button>
            )}
          {session.nextState === "none" && (
            <p>
              지금 조건에 맞는 다른 동작이 없어요. 무리해서 이어가지 않아도
              괜찮아요.
            </p>
          )}
          {session.program?.sportSpecificStart && (
            <p>{session.program.sportSpecificStart}</p>
          )}
          {!memberName && (
            <p className="note">
              {guestRetentionCopy} 가입해도 비회원 기록은 이전되지 않아요.
            </p>
          )}
          <PrimaryButton onClick={() => go("home")}>홈으로</PrimaryButton>
          <button
            className="text-button"
            onClick={() => run(() => loadRecords())}
          >
            내 기록 보기
          </button>
        </>
      )}
      {view === "records" && (
        <>
          <h1>내 기록</h1>
          {!records.length && !legacy.length && (
            <>
              <img
                className="release-companion"
                src={asset + "ui/turtle-records.webp"}
                width={180}
                height={180}
                alt=""
              />
              <p>아직 기록이 없어요. 내 속도로 시작해보세요.</p>
            </>
          )}
          {!memberName && <p className="note">{guestRetentionCopy}</p>}
          {records.map((r) => (
            <details className="release-record" key={r.id}>
              <summary>
                <time>
                  {new Date(r.createdAt).toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </time>
                <strong>{titles[r.input.purpose]}</strong>
                <span>
                  {r.feedback
                    ? feelings[r.feedback]
                    : r.status === "active"
                      ? "진행 중"
                      : "느낌 미응답"}
                </span>
              </summary>
              <ol>
                {r.items.map((i) => (
                  <li key={i.itemId}>
                    {i.movement.name} · {i.movement.dose} ·{" "}
                    {i.state === "completed"
                      ? "수행"
                      : i.state === "skipped"
                        ? "넘김"
                        : i.state === "stopped"
                          ? "중단"
                          : "미완료"}
                    <details>
                      <summary>당시 동작 안내</summary>
                      <img
                        loading="lazy"
                        src={i.movement.media.src}
                        alt={i.movement.name}
                        width={i.movement.media.width}
                        height={i.movement.media.height}
                        className="movement-image"
                      />
                      <ol>
                        {i.movement.steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ol>
                    </details>
                  </li>
                ))}
              </ol>
              <button
                className="secondary"
                onClick={() => {
                  setSession(r);
                  setInput(r.input);
                  setIndex(
                    Math.max(
                      0,
                      r.items.findIndex((i) => i.state === "pending"),
                    ),
                  );
                  go(
                    ["active", "paused"].includes(r.status)
                      ? "perform"
                      : r.feedbackSubmitted
                        ? "complete"
                        : "feedback",
                  );
                }}
              >
                이용 상태 열기
              </button>
              {memberName && r.feedbackSubmitted && (
                <details>
                  <summary>당시 느낌 정정</summary>
                  <p className="note">지금의 후속 느낌과 구분해요.</p>
                  {(
                    (r.input.purpose === "daily"
                      ? ["better", "same", "worse"]
                      : r.input.purpose === "warmup"
                        ? ["ready", "insufficient", "worse"]
                        : ["refreshed", "same", "worse"]) as Reaction[]
                  ).map((reaction) => (
                    <button
                      className="secondary"
                      key={reaction}
                      onClick={() =>
                        run(async () => {
                          const updated = await api<PublicSession>(
                            `/personalization/sessions/${r.id}/events`,
                            {
                              eventId: crypto.randomUUID(),
                              action: "correct",
                              reaction,
                              ...(r.input.purpose === "daily"
                                ? { itemId: r.items.at(-1)!.itemId }
                                : {}),
                              steps: [],
                              stepsState: "unanswered",
                            },
                          );
                          setRecords((xs) =>
                            xs.map((x) => (x.id === r.id ? updated : x)),
                          );
                          if (session?.id === r.id) setSession(updated);
                        })
                      }
                    >
                      {feelings[reaction]}로 정정
                    </button>
                  ))}
                </details>
              )}
              {memberName && r.feedbackSubmitted && !r.followup && (
                <details>
                  <summary>그 뒤의 느낌 · 선택</summary>
                  {(
                    [
                      ["continued_comfort", "편함이 이어졌어요"],
                      ["same", "비슷해요"],
                      ["uncomfortable", "불편했어요"],
                      ["unknown", "잘 모르겠어요"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      className="secondary"
                      key={id}
                      onClick={() =>
                        run(async () => {
                          const updated = await api<PublicSession>(
                            `/personalization/sessions/${r.id}/events`,
                            {
                              eventId: crypto.randomUUID(),
                              action: "followup",
                              followup: id,
                            },
                          );
                          setRecords((xs) =>
                            xs.map((x) => (x.id === r.id ? updated : x)),
                          );
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </details>
              )}
              {memberName && (
                <button
                  className="text-button"
                  onClick={() =>
                    run(async () => {
                      await api(`/personalization/sessions/${r.id}/delete`, {});
                      setRecords((xs) => xs.filter((x) => x.id !== r.id));
                      if (session?.id === r.id) {
                        setSession(null);
                        sessionStorage.removeItem(key);
                      }
                    })
                  }
                >
                  이 기록 삭제
                </button>
              )}
            </details>
          ))}
          {legacy.length > 0 && <h2>이전 동작 기록</h2>}
          {legacy.map((r) => (
            <details className="release-record" key={r.id}>
              <summary>
                {r.snapshot.routine.name} ·{" "}
                {new Date(r.createdAt).toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </summary>
              <img
                className="release-movement"
                loading="lazy"
                src={r.snapshot.routine.image}
                alt={r.snapshot.routine.name}
              />
              <ol>
                {r.snapshot.routine.steps?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p>{r.snapshot.routine.dose}</p>
              <button
                className="text-button"
                onClick={() =>
                  run(async () => {
                    await api(`/records/${r.id}/delete`, {});
                    setLegacy((xs) => xs.filter((x) => x.id !== r.id));
                  })
                }
              >
                이전 기록 삭제
              </button>
            </details>
          ))}
          {(cursor || legacyCursor) && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => run(() => loadRecords(true))}
            >
              기록 더 보기
            </button>
          )}
        </>
      )}
      {view === "settings" && (
        <>
          <h1>{memberName ? memberName + "님의 마이" : "마이"}</h1>
          {memberName ? (
            <>
              <p>회원 이용은 무료이며 횟수 제한이 없어요.</p>
              <button
                className="secondary"
                onClick={() => {
                  setEditingHabits(true);
                  setInput({
                    ...initial("daily"),
                    area: "back",
                    habits: context?.preferences.habits?.back ?? [],
                  });
                  go("habits");
                }}
              >
                평소 습관 수정
              </button>
              <button className="secondary" onClick={onLogout}>
                로그아웃
              </button>
              <button
                className="secondary"
                onClick={() =>
                  run(async () => {
                    for (let i = 0; i < 100; i++) {
                      const r = await api<{ complete: boolean }>(
                        "/account/health/revoke",
                        {},
                      );
                      if (r.complete) {
                        setSession(null);
                        sessionStorage.removeItem(key);
                        setContext((c) => (c ? { ...c, consent: false } : c));
                        setNotice(
                          "건강 관련 이용 기록과 개인화 정보를 삭제했어요.",
                        );
                        return;
                      }
                    }
                    throw Error("삭제 작업이 남아 있어요. 다시 시도해주세요.");
                  })
                }
              >
                건강 관련 동의 철회·기록 삭제
              </button>
              <button className="text-button" onClick={onDeleteAccount}>
                회원 탈퇴
              </button>
            </>
          ) : (
            <>
              <p>{guestRetentionCopy}</p>
              {uid && (
                <button
                  className="secondary"
                  onClick={() =>
                    run(async () => {
                      for (let i = 0; i < 100; i++) {
                        const r = await api<{ complete: boolean }>(
                          "/guest/consent/revoke",
                          {},
                        );
                        if (r.complete) {
                          setSession(null);
                          sessionStorage.removeItem(key);
                          setContext((c) => (c ? { ...c, consent: false } : c));
                          setNotice(
                            "비회원 건강 관련 이용 정보를 삭제했어요. 당일 이용 여부는 자정까지 유지돼요.",
                          );
                          return;
                        }
                      }
                      throw Error(
                        "삭제 작업이 남아 있어요. 다시 시도해주세요.",
                      );
                    })
                  }
                >
                  비회원 동의 철회·기록 삭제
                </button>
              )}
              <button className="secondary" onClick={() => onLogin()}>
                로그인 · 회원가입
              </button>
            </>
          )}
          <label className="release-check">
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => {
                const value = e.target.checked;
                setReduced(value);
                localStorage.setItem("jikkot.reduced-motion", String(value));
                if (memberName)
                  void run(() =>
                    api("/personalization/preferences", {
                      habits: context?.preferences.habits ?? {},
                      reducedMotion: value,
                      review: false,
                    }).then(() => {}),
                  );
              }}
            />
            움직임 줄이기
          </label>
          <button className="secondary" onClick={onPolicy}>
            이용 안내와 개인정보
          </button>
          <a className="secondary" href="mailto:ehdgus554@gmail.com">
            문의하기
          </a>
          {context?.reviewAllowed && (
            <button
              className="text-button"
              onClick={() =>
                run(async () => {
                  const r = await api<{ items: typeof reviewRows }>(
                    "/review/catalog",
                  );
                  setReviewRows(r.items);
                  go("review");
                })
              }
            >
              내부 콘텐츠 검토
            </button>
          )}
        </>
      )}
      {view === "review" && (
        <>
          <h1>보호된 콘텐츠 검토</h1>
          {reviewRows.map((r) => (
            <details key={r.catalogId}>
              <summary>
                {r.catalogId} · {r.name}
              </summary>
              <img
                className="release-movement"
                src={r.media.path}
                loading="lazy"
                alt={r.name}
              />
              <ol>
                {r.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </details>
          ))}
        </>
      )}
      {rootView && (
        <nav className="release-nav" aria-label="주 메뉴">
          {nav.map(([id, label, Icon]) => (
            <button
              type="button"
              key={id}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
              disabled={busy}
            >
              <Icon size={23} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      )}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="movement-zoom">
          <DialogTitle>동작 그림 크게 보기</DialogTitle>
          {current && (
            <img
              src={current.movement.media.src}
              width={current.movement.media.width}
              height={current.movement.media.height}
              alt={current.movement.name}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={exit !== null}
        onOpenChange={(v) => {
          if (!v) setExit(null);
        }}
      >
        <DialogContent>
          <DialogTitle>잠깐 쉬어갈까요?</DialogTitle>
          <p>진행을 잠시 멈추고 나갈 수 있어요. 자동으로 완료하지 않아요.</p>
          <button className="secondary" onClick={() => setExit(null)}>
            계속하기
          </button>
          <PrimaryButton
            disabled={busy}
            onClick={() =>
              run(async () => {
                const target = exit!;
                if (session?.status === "active") await event("pause");
                setExit(null);
                if (target === "records") await loadRecords();
                else go(target);
              })
            }
          >
            잠시 멈추고 나가기
          </PrimaryButton>
        </DialogContent>
      </Dialog>
    </div>
  );
}
