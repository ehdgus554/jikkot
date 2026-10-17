"use client";
/* eslint-disable @next/next/no-img-element -- Original supplied illustrations retain their natural aspect ratio. */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/firebase-client";
import {
  areas,
  poses,
  supports,
  sports,
  VERSION,
  type Session,
  type SessionInput,
  type Reaction,
  type Purpose,
} from "../lib/personalization/types";
import {
  questions,
  toggleChoice,
  habitChoices,
  currentChoices,
} from "../lib/personalization/questions";
import { Header, Home, PrimaryButton } from "./jikkot-ui";
import { BodyRegionSelector } from "./body-region-selector";
import { levels } from "../lib/personalization/growth";

type PublicSession = Omit<Session, "owner" | "decision" | "visited">;
type Context = {
  reviewAllowed: boolean;
  consent: boolean;
  consentVersion: string;
  preferences: {
    habits?: Record<string, string[]>;
    showGrowth?: boolean;
    sport?: string;
  };
  growthAvailable: boolean;
  growth: { xp: number; badges: string[] } | null;
  aiAvailable: boolean;
  hasNewSessions: boolean;
};
type View =
  | "home"
  | "setup"
  | "environment"
  | "area"
  | "habits"
  | "current"
  | "plan"
  | "perform"
  | "feedback"
  | "complete"
  | "records"
  | "settings"
  | "review";
type ReviewContent = {
  catalogId: string;
  name: string;
  actualPose: string;
  imageFileName: string;
  imageSha256: string;
  steps: string[];
  reviewReasons: string[];
  media: { installed: boolean; path: string };
  publicationApproval: string;
  dosage: unknown;
  mappingSource: Record<string, string>;
};
const names = {
  daily: "불편한 곳 풀기",
  warmup: "운동 전 몸풀기",
  leisure: "여유롭게 몸풀기",
};
const labels: Record<Reaction, string> = {
  better: "편해졌어요",
  same: "비슷해요",
  worse: "불편했어요",
  ready: "준비됐어요",
  insufficient: "조금 부족해요",
  refreshed: "개운해요",
};
const initialInput = (purpose: Purpose): SessionInput => ({
  purpose,
  habits: [],
  current: [],
  poses: [],
  supports: [],
  focus: [],
  confirmedAt: Date.now(),
  review: false,
  growth: false,
});
function errorText(e: unknown) {
  return e instanceof Error ? e.message : "연결을 확인한 뒤 다시 시도해주세요.";
}
function Select({
  label,
  selected,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`personal-choice ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      {selected && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}
export function PersonalizedExperience({
  uid,
  memberName,
  initialPurpose,
  onLogin,
  onLogout,
  onExistingDaily,
  onExistingRecords,
}: {
  uid: string;
  memberName?: string;
  initialPurpose?: Purpose | null;
  onLogin: () => void;
  onLogout: () => void;
  onExistingDaily: () => void;
  onExistingRecords: () => void;
}) {
  const [context, setContext] = useState<Context | null>(null);
  const [view, setView] = useState<View>(
    initialPurpose
      ? initialPurpose === "daily"
        ? "environment"
        : "setup"
      : "home",
  );
  const [input, setInput] = useState<SessionInput>(() =>
    initialInput(initialPurpose ?? "daily"),
  );
  const [session, setSession] = useState<PublicSession | null>(null),
    [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [personalConsent, setPersonalConsent] = useState(false),
    [aiConsent, setAiConsent] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null),
    [painSteps, setPainSteps] = useState<number[]>([]),
    [unknownStep, setUnknownStep] = useState(false),
    [painItem, setPainItem] = useState("");
  const [skip, setSkip] = useState(false),
    [reviewItems, setReviewItems] = useState<ReviewContent[]>([]),
    [reviewCode, setReviewCode] = useState("");
  const [records, setRecords] = useState<PublicSession[]>([]),
    [legacy, setLegacy] = useState<
      {
        id: string;
        createdAt: number;
        feedback: string;
        snapshot: {
          routine: { name: string };
          area: { label: string };
          habits: { label: string }[];
          recent: { label: string }[];
        };
      }[]
    >([]);
  const [cursor, setCursor] = useState<{
      createdAt: number;
      id: string;
    } | null>(null),
    [reviewDecision, setReviewDecision] = useState<unknown>(null);
  const [region, setRegion] = useState<"upper" | "lower">("upper"),
    [back, setBack] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const request = useRef<{ sessionId: string; input: SessionInput } | null>(
    null,
  );
  const pendingEvent = useRef<{
    sessionId: string;
    body: Record<string, unknown>;
  } | null>(null);
  const lastAction = useRef<null | (() => Promise<void>)>(null),
    inFlight = useRef(false),
    restored = useRef(false);
  const storageKey = `jikkot.personal.${uid}`;
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    lastAction.current = fn;
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  const persist = useCallback(
    (value: unknown) => {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ version: VERSION, uid, ...(value as object) }),
      );
    },
    [storageKey, uid],
  );
  useEffect(() => {
    let active = true;
    void api<Context>("/personalization/context")
      .then(async (c) => {
        if (!active) return;
        setContext(c);
        if (restored.current) return;
        restored.current = true;
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return;
        try {
          const saved = JSON.parse(raw);
          if (saved.uid !== uid || saved.version !== VERSION) return;
          request.current = saved.request ?? null;
          pendingEvent.current = saved.pendingEvent ?? null;
          if (saved.input?.review || saved.request?.input?.review) {
            const reviewContext = await api<Context>(
              "/personalization/context?review=true",
            );
            if (!active) return;
            setContext(reviewContext);
          }
          const id = saved.sessionId ?? saved.request?.sessionId;
          if (id) {
            const s = await api<PublicSession>(
              `/personalization/sessions/${id}`,
            );
            if (!active) return;
            setInput(s.input);
            setSession(s);
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
            setView(saved.view ?? "environment");
          }
        } catch {
          if (active)
            setError(
              "진행 상태를 복원하지 못했어요. 연결을 확인하고 다시 시도해주세요.",
            );
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [storageKey, uid]);
  useEffect(() => {
    if (!restored.current) return;
    persist({
      input,
      view,
      sessionId: session?.id ?? null,
      request: request.current,
      pendingEvent: pendingEvent.current,
    });
  }, [input, view, session, persist]);
  useEffect(() => {
    if (view !== "perform" || session?.status !== "active") return;
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [view, session?.status]);
  const change = (patch: Partial<SessionInput>) => {
    request.current = null;
    setInput((prev) => ({ ...prev, ...patch }));
    setError("");
  };
  const begin = (purpose: Purpose) => {
    if (pendingEvent.current) {
      setError("앞선 저장을 먼저 다시 시도해주세요.");
      return;
    }
    if (purpose === "daily" && !input.review) {
      onExistingDaily();
      return;
    }
    if (!memberName && purpose !== "daily") {
      onLogin();
      return;
    }
    if (purpose !== "daily" && !input.review) {
      setError("이 콘텐츠는 수행 방법과 구성 검토를 마친 뒤 이용할 수 있어요.");
      return;
    }
    request.current = null;
    pendingEvent.current = null;
    setSession(null);
    setElapsed(0);
    setReaction(null);
    setPainSteps([]);
    setUnknownStep(false);
    setError("");
    setInput({
      ...initialInput(purpose),
      review: input.review,
      growth: context?.preferences.showGrowth ?? false,
    });
    setView(purpose === "daily" ? "environment" : "setup");
  };
  const home = () => {
    setView("home");
    setError("");
  };
  const afterSession = (s: PublicSession) => {
    setSession(s);
    setInput(s.input);
    if (s.status === "completed" || s.status === "stopped")
      setView(s.feedbackSubmitted ? "complete" : "feedback");
    else {
      setView("perform");
      const next = s.items.findIndex((i) => i.state === "pending");
      if (next >= 0) setIndex(next);
    }
  };
  const generate = () =>
    run(async () => {
      if (memberName && !context?.consent) {
        if (!personalConsent)
          throw new Error("개인화 기록 이용 안내를 확인해주세요.");
        await api("/personalization/consent", {
          version: context?.consentVersion ?? "personalization-draft-v1",
          personalization: true,
          ai: aiConsent,
        });
        setContext((c) => (c ? { ...c, consent: true } : c));
      }
      if (!request.current)
        request.current = {
          sessionId: crypto.randomUUID(),
          input: { ...input, confirmedAt: Date.now() },
        };
      persist({ input, view, request: request.current });
      const s = await api<PublicSession>(
        "/personalization/sessions",
        request.current,
      );
      setSession(s);
      setInput(s.input);
      setIndex(0);
      setView(input.purpose === "daily" ? "perform" : "plan");
      if (memberName && input.purpose === "daily" && input.area) {
        const habits = {
          ...context?.preferences.habits,
          [input.area]: input.habits,
        };
        // Recommendation success is not rolled back if the reusable-preference write fails.
        await api("/personalization/preferences", {
          habits,
          showGrowth: context?.preferences.showGrowth ?? false,
          review: input.review,
          sport: input.sport ?? context?.preferences.sport ?? null,
        })
          .then(() =>
            setContext((c) =>
              c ? { ...c, preferences: { ...c.preferences, habits } } : c,
            ),
          )
          .catch(() =>
            setError(
              "동작은 저장됐지만, 다음 방문을 위한 습관 설정을 저장하지 못했어요.",
            ),
          );
      }
    });
  const event = (action: string, extra: Record<string, unknown> = {}) =>
    run(async () => {
      if (!session) return;
      const body = { eventId: crypto.randomUUID(), action, ...extra };
      if (pendingEvent.current && pendingEvent.current.body.action !== action)
        throw new Error("앞선 저장을 먼저 다시 시도해주세요.");
      if (!pendingEvent.current)
        pendingEvent.current = { sessionId: session.id, body };
      persist({
        input,
        view,
        sessionId: session.id,
        request: request.current,
        pendingEvent: pendingEvent.current,
      });
      const s = await api<PublicSession>(
        `/personalization/sessions/${session.id}/events`,
        pendingEvent.current.body,
      );
      pendingEvent.current = null;
      setSkip(false);
      setReaction(null);
      setPainSteps([]);
      setUnknownStep(false);
      afterSession(s);
      persist({
        input: s.input,
        view: s.feedbackSubmitted ? "complete" : "perform",
        sessionId: s.id,
        request: request.current,
        pendingEvent: null,
      });
    });
  const loadRecords = (more = false) =>
    run(async () => {
      if (!memberName || (!input.review && !context?.hasNewSessions)) {
        onExistingRecords();
        return;
      }
      const query =
        more && cursor ? `?after=${cursor.createdAt}&afterId=${cursor.id}` : "";
      const r = await api<{
        records: PublicSession[];
        reviewRecords: PublicSession[];
        nextCursor: typeof cursor;
      }>("/personalization/records" + query);
      setRecords((prev) =>
        more
          ? [...prev, ...r.records, ...(input.review ? r.reviewRecords : [])]
          : [...r.records, ...(input.review ? r.reviewRecords : [])],
      );
      setCursor(r.nextCursor);
      if (!more) {
        const old = await api<{ records: typeof legacy }>("/records");
        setLegacy(old.records);
      }
      setView("records");
    });
  const currentItem = session?.items[index];
  const currentRegion = input.area;
  const currentQuestions =
    input.purpose === "daily"
      ? questions("current", currentRegion, input.habits)
      : currentChoices.filter(
          (q) =>
            [
              "today_ok",
              "prep_comfort",
              "sudden_worse",
              "unknown",
              "none",
              "stiff",
              "small_comfort",
              "both_directions_comfort",
            ].includes(q.id) || input.focus.some((a) => q.areas.includes(a)),
        );
  const startCurrent = () => {
    setView("current");
    setError("");
  };
  const loadReview = () =>
    run(async () => {
      const r = await api<{ items: ReviewContent[] }>("/review/catalog");
      setReviewItems(r.items);
      setView("review");
    });
  const switchReview = () =>
    run(async () => {
      const review = !input.review;
      const c = await api<Context>(
        "/personalization/context" + (review ? "?review=true" : ""),
      );
      change({ review });
      setContext(c);
    });
  const title =
    view === "environment"
      ? "지금 가능한 자세와 환경을 알려주세요"
      : view === "area"
        ? "어디가 불편한가요?"
        : view === "habits"
          ? "평소 어떤 습관이 있나요?"
          : view === "current"
            ? "최근 행동과 오늘 느낌은 어떤가요?"
            : view === "setup"
              ? names[input.purpose]
              : view === "plan"
                ? "이 순서로 가볍게 움직여볼까요?"
                : view === "feedback"
                  ? "마친 뒤 어떤 느낌인가요?"
                  : view === "complete"
                    ? "오늘의 몸풀기를 마쳤어요"
                    : view === "records"
                      ? "내 기록"
                      : view === "settings"
                        ? "내 이용 설정"
                        : view === "review"
                          ? "콘텐츠 검토"
                          : "";
  if (view === "home")
    return (
      <>
        {input.review && (
          <p className="review-banner" role="status">
            검토 전용 · 초안 콘텐츠
          </p>
        )}
        <Home
          memberName={memberName}
          busy={busy}
          begin={() => begin("daily")}
          warmup={() => begin("warmup")}
          leisure={() => begin("leisure")}
          bundlesReady={input.review && !!context?.reviewAllowed}
          login={onLogin}
          records={() => loadRecords()}
          comingSoon={() => {}}
        />
        {session && ["active", "paused"].includes(session.status) && (
          <PrimaryButton secondary onClick={() => setView("perform")}>
            진행 중인 몸풀기 이어하기
          </PrimaryButton>
        )}
        <div className="personal-secondary">
          <button
            type="button"
            className="text-button"
            onClick={() =>
              run(async () => {
                setContext(
                  await api<Context>(
                    "/personalization/context" +
                      (input.review ? "?review=true" : ""),
                  ),
                );
                setView("settings");
              })
            }
          >
            내 이용 설정
          </button>
          {context?.reviewAllowed && (
            <button type="button" className="text-button" onClick={loadReview}>
              콘텐츠 검토
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="error-panel">
            {error}
          </p>
        )}
        {!context && !error && (
          <p role="status">이용 설정을 확인하고 있어요.</p>
        )}
      </>
    );
  return (
    <section className="personal-experience" aria-busy={busy}>
      <Header
        back={() => {
          if (view === "area") setView("environment");
          else if (view === "habits") setView("area");
          else if (view === "current")
            setView(input.purpose === "daily" ? "habits" : "environment");
          else home();
        }}
        busy={busy}
        right={
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={home}
          >
            홈
          </button>
        }
      />
      {input.review && (
        <p className="review-banner" role="status">
          검토 전용 · 초안 콘텐츠와 미확정 실시량을 포함합니다
        </p>
      )}
      {error && (
        <div className="error-panel" role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (lastAction.current) void run(lastAction.current);
              else window.location.reload();
            }}
          >
            저장 다시 시도
          </button>
        </div>
      )}
      {busy && (
        <p role="status" className="note">
          요청을 확인하고 있어요. 잠시 기다려주세요.
        </p>
      )}
      {title && <h1>{title}</h1>}
      {view === "setup" && (
        <>
          <p className="sub">
            오늘의 선택으로 시작해요. 예전 기록을 오늘 상태로 간주하지 않아요.
          </p>
          {input.purpose === "warmup" ? (
            <>
              <div className="personal-grid">
                {sports.map(([id, label]) => (
                  <Select
                    key={id}
                    label={label}
                    selected={input.sport === id}
                    onClick={() =>
                      change({ sport: id, current: [], focus: [] })
                    }
                  />
                ))}
              </div>
              {input.sport === "gym" && (
                <fieldset>
                  <legend>오늘 할 헬스 운동</legend>
                  {(
                    [
                      ["upper", "상체"],
                      ["lower", "하체"],
                      ["whole", "전신"],
                    ] as const
                  ).map(([id, label]) => (
                    <Select
                      key={id}
                      label={label}
                      selected={input.gymFocus === id}
                      onClick={() => change({ gymFocus: id })}
                    />
                  ))}
                </fieldset>
              )}
            </>
          ) : (
            <div className="personal-grid">
              {([5, 10] as const).map((n) => (
                <Select
                  key={n}
                  label={`${n}분 여유`}
                  selected={input.minutes === n}
                  onClick={() => change({ minutes: n })}
                />
              ))}
            </div>
          )}
          <p className="note">
            여유 시간에 맞춰 구성해요. 미확정 동작의 정확한 총 수행 시간은 검토
            후 안내합니다.
          </p>
          <fieldset>
            <legend>
              {input.purpose === "leisure"
                ? "집중하고 싶은 곳 · 선택하지 않으면 전신, 최대 두 곳"
                : "오늘 불편한 곳이 있다면 · 최대 두 곳"}
            </legend>
            <div className="personal-grid">
              {areas.map(([id, label]) => (
                <Select
                  key={id}
                  label={label}
                  selected={input.focus.includes(id)}
                  onClick={() =>
                    change({
                      focus: input.focus.includes(id)
                        ? input.focus.filter((x) => x !== id)
                        : input.focus.length < 2
                          ? [...input.focus, id]
                          : input.focus,
                      current: [],
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          <PrimaryButton
            disabled={
              !context ||
              (!input.sport && input.purpose === "warmup") ||
              (input.sport === "gym" && !input.gymFocus) ||
              (input.purpose === "leisure" && !input.minutes)
            }
            onClick={() => setView("environment")}
          >
            다음
          </PrimaryButton>
        </>
      )}
      {view === "environment" && (
        <>
          <p className="sub">
            실제로 가능한 항목만 골라주세요. 고른 자세는 이번 이용에서 다시 묻지
            않아요.
          </p>
          <fieldset>
            <legend>가능한 자세 · 여러 개 선택 가능</legend>
            <div className="personal-grid">
              {poses.map(([id, label]) => (
                <Select
                  key={id}
                  label={label}
                  selected={input.poses.includes(id)}
                  onClick={() =>
                    change({
                      poses: input.poses.includes(id)
                        ? input.poses.filter((x) => x !== id)
                        : [...input.poses, id],
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>이용할 수 있는 지지와 공간</legend>
            <div className="personal-grid">
              {supports.map(([id, label]) => (
                <Select
                  key={id}
                  label={label}
                  selected={input.supports.includes(id)}
                  onClick={() =>
                    change({
                      supports: input.supports.includes(id)
                        ? input.supports.filter((x) => x !== id)
                        : [...input.supports, id],
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          <PrimaryButton
            disabled={busy || !input.poses.length}
            onClick={() =>
              input.purpose === "daily" ? setView("area") : startCurrent()
            }
          >
            다음
          </PrimaryButton>
        </>
      )}
      {view === "area" && (
        <>
          <p className="eyebrow">1 / 3 · 불편 부위</p>
          <p className="sub">
            한 곳을 골라주세요. 그림 또는 아래의 큰 버튼을 이용할 수 있어요.
          </p>
          <div className="personal-grid">
            <Select
              label="상체"
              selected={region === "upper"}
              onClick={() => {
                if (region !== "upper") {
                  setRegion("upper");
                  change({ area: undefined, habits: [], current: [] });
                }
              }}
            />
            <Select
              label="하체"
              selected={region === "lower"}
              onClick={() => {
                if (region !== "lower") {
                  setRegion("lower");
                  change({ area: undefined, habits: [], current: [] });
                }
              }}
            />
          </div>
          <button
            type="button"
            className="text-button"
            aria-pressed={back}
            onClick={() => setBack(!back)}
          >
            {back ? "앞으로 전환" : "뒤로 전환"}
          </button>
          <BodyRegionSelector
            region={region}
            back={back}
            selected={input.area}
            onSelect={(id) =>
              change({
                area: id,
                habits: context?.preferences.habits?.[id] ?? [],
                current: [],
              })
            }
          />
          <div className="personal-grid">
            {areas
              .filter((_, i) => (region === "upper" ? i < 5 : i >= 5))
              .map(([id, label]) => (
                <Select
                  key={id}
                  label={label}
                  selected={input.area === id}
                  onClick={() =>
                    change({
                      area: id,
                      habits: context?.preferences.habits?.[id] ?? [],
                      current: [],
                    })
                  }
                />
              ))}
          </div>
          <PrimaryButton
            disabled={busy || !input.area}
            onClick={() => setView("habits")}
          >
            다음
          </PrimaryButton>
        </>
      )}
      {view === "habits" && (
        <>
          <p className="eyebrow">2 / 3 · 평소 습관</p>
          <p className="sub">
            여러 개 골라도 괜찮아요. 지난 습관은 확인한 뒤 수정할 수 있어요.
          </p>
          <div className="personal-choices">
            {questions("habits", currentRegion).map((q) => (
              <Select
                key={q.id}
                label={q.label}
                selected={input.habits.includes(q.id)}
                onClick={() =>
                  change({
                    habits: toggleChoice(input.habits, q.id),
                    current: [],
                  })
                }
              />
            ))}
          </div>
          <PrimaryButton
            disabled={busy || !input.habits.length}
            onClick={startCurrent}
          >
            다음
          </PrimaryButton>
        </>
      )}
      {view === "current" && (
        <>
          <p className="eyebrow">
            {input.purpose === "daily" ? "3 / 3 · " : ""}이번 상태 확인
          </p>
          <p className="sub">
            최근 며칠의 실제 경험만 골라주세요. 지금 새로 불편한 동작을 시험할
            필요는 없어요.
          </p>
          {input.purpose !== "daily" && (
            <details>
              <summary>관련 평소 습관 확인 · 필요한 경우만</summary>
              <div className="personal-choices">
                {habitChoices
                  .filter((q) =>
                    [
                      "immobile",
                      "sitting",
                      "standing",
                      "screen",
                      "arms_up",
                      "clench",
                      "walking",
                      "bending",
                      "retract",
                      "arm_front",
                      "one_direction",
                      "stairs",
                      "one_side",
                      "legs_together",
                      "increased_load",
                    ].includes(q.id),
                  )
                  .map((q) => (
                    <Select
                      key={q.id}
                      label={q.label}
                      selected={input.habits.includes(q.id)}
                      onClick={() =>
                        change({ habits: toggleChoice(input.habits, q.id) })
                      }
                    />
                  ))}
              </div>
            </details>
          )}
          <div className="personal-choices">
            {currentQuestions.map((q) => (
              <Select
                key={q.id}
                label={q.label}
                selected={input.current.includes(q.id)}
                onClick={() =>
                  change({ current: toggleChoice(input.current, q.id) })
                }
              />
            ))}
          </div>
          {memberName && !context?.consent && (
            <div className="personal-consent">
              <p>
                습관·이번 상태·수행 반응을 회원 기록에 저장하고 다음 추천에
                사용해요. 운영자·보관·문의 정책은 아직 검토 중인 초안이에요.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={personalConsent}
                  onChange={(e) => setPersonalConsent(e.target.checked)}
                />
                개인화 기록 이용에 동의해요
              </label>
              {context?.aiAvailable && (
                <label>
                  <input
                    type="checkbox"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                  />
                  선택: 식별 정보를 제외한 반응 요약의 외부 AI 전송에 동의해요
                </label>
              )}
            </div>
          )}
          <PrimaryButton
            disabled={
              busy ||
              !context ||
              !input.current.length ||
              (!!memberName && !context.consent && !personalConsent)
            }
            onClick={generate}
          >
            {input.purpose === "daily" ? "내 동작 보기" : "루틴 구성하기"}
          </PrimaryButton>
        </>
      )}
      {view === "plan" && session && (
        <>
          <p className="sub">
            {names[session.input.purpose]} · {session.items.length}개 동작
          </p>
          <p className="note">
            실시량과 전환 시간을 아직 확정하지 않은 묶음이에요. 시간을 맞추려고
            빠르게 하거나 오래 버티지 않아요.
          </p>
          <ol className="personal-plan">
            {session.items.map((i) => (
              <li key={i.itemId}>
                <strong>{i.movement.name}</strong>
                <span>{poses.find((p) => p[0] === i.movement.pose)?.[1]}</span>
              </li>
            ))}
          </ol>
          <PrimaryButton onClick={() => setView("perform")}>
            순서대로 시작하기
          </PrimaryButton>
        </>
      )}
      {view === "perform" && session && currentItem && (
        <>
          {session.input.purpose !== "daily" && (
            <p className="eyebrow">
              {index + 1} / {session.items.length}
            </p>
          )}
          <h1>{currentItem.movement.name}</h1>
          <MovementMedia
            key={currentItem.itemId}
            movement={currentItem.movement}
          />
          <ol className="personal-steps">
            {currentItem.movement.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {currentItem.movement.dose ? (
            <p>{currentItem.movement.dose}</p>
          ) : (
            <p className="note">
              시간·횟수는 아직 확정되지 않았어요. 수행 방법과 편한 범위를 먼저
              확인해주세요.
            </p>
          )}
          <p className="note">정적 안내 이미지 · 직접 시연 영상이 아닙니다</p>
          <p role="status">
            {session.status === "paused"
              ? "잠시 멈췄어요"
              : `진행 시간 ${Math.floor(elapsed / 60)}분 ${elapsed % 60}초`}
          </p>
          <div className="personal-actions">
            <button
              type="button"
              onClick={() =>
                event(session.status === "paused" ? "resume" : "pause")
              }
              disabled={busy || !["active", "paused"].includes(session.status)}
            >
              {session.status === "paused" ? "재개" : "잠시 멈춤"}
            </button>
            <button
              type="button"
              onClick={() => setSkip(true)}
              disabled={busy || session.status !== "active"}
            >
              동작 넘기기
            </button>
            <button
              type="button"
              onClick={() => event("stop", { itemId: currentItem.itemId })}
              disabled={busy}
            >
              중단하기
            </button>
          </div>
          {skip && (
            <fieldset>
              <legend>어떤 이유로 넘기나요?</legend>
              {(
                [
                  ["space", "공간이 부족해요"],
                  ["support", "자세·지지가 어려워요"],
                  ["time", "시간이 부족해요"],
                  ["other", "다른 이유예요"],
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  onClick={() =>
                    event("skip", {
                      itemId: currentItem.itemId,
                      skipReason: id,
                    })
                  }
                  disabled={busy}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          )}
          <PrimaryButton
            disabled={busy || session.status !== "active"}
            onClick={() => event("complete", { itemId: currentItem.itemId })}
          >
            {session.input.purpose === "daily"
              ? "마쳤어요"
              : "이 동작을 수행했어요"}
          </PrimaryButton>
          <div className="personal-actions">
            <button
              type="button"
              disabled={index === 0 || busy}
              onClick={() => setIndex(index - 1)}
            >
              이전 동작
            </button>
            <button
              type="button"
              disabled={index === session.items.length - 1 || busy}
              onClick={() => setIndex(index + 1)}
            >
              다음 동작 보기
            </button>
          </div>
          <p className="note">
            이미지를 보거나 시간이 지나는 것만으로 수행 완료를 기록하지 않아요.
          </p>
        </>
      )}
      {view === "feedback" &&
        session &&
        !session.items.some((i) =>
          ["completed", "stopped"].includes(i.state),
        ) && (
          <>
            <p className="sub">
              수행한 동작이 없어 느낌은 기록하지 않아요. 넘긴 이유는 이용 기록에
              남겨뒀어요.
            </p>
            <PrimaryButton onClick={home}>첫 화면으로</PrimaryButton>
          </>
        )}
      {view === "feedback" &&
        session &&
        session.items.some((i) =>
          ["completed", "stopped"].includes(i.state),
        ) && (
          <>
            <p className="sub">
              {session.input.purpose === "daily"
                ? "실제로 수행한 동작의 느낌을 남겨주세요."
                : "묶음 전체의 느낌이에요. 개별 동작의 효과로 나누어 저장하지 않아요."}
            </p>
            <div className="personal-choices">
              {(session.input.purpose === "daily"
                ? ["better", "same", "worse"]
                : session.input.purpose === "warmup"
                  ? ["ready", "insufficient", "worse"]
                  : ["refreshed", "same", "worse"]
              ).map((id) => (
                <Select
                  key={id}
                  label={labels[id as Reaction]}
                  selected={reaction === id}
                  onClick={() => {
                    setReaction(id as Reaction);
                    setPainSteps([]);
                    setUnknownStep(false);
                    setPainItem(
                      session.input.purpose === "daily"
                        ? session.items.at(-1)!.itemId
                        : "",
                    );
                  }}
                />
              ))}
            </div>
            {reaction === "worse" && (
              <fieldset>
                <legend>어느 과정에서 불편했나요?</legend>
                {session.input.purpose !== "daily" && (
                  <>
                    <label>
                      불편했던 동작 · 특정할 수 있을 때만
                      <select
                        value={painItem}
                        onChange={(e) => {
                          setPainItem(e.target.value);
                          setPainSteps([]);
                          setUnknownStep(false);
                        }}
                      >
                        <option value="">특정하기 어려워요</option>
                        {session.items
                          .filter((i) =>
                            ["completed", "stopped"].includes(i.state),
                          )
                          .map((i) => (
                            <option key={i.itemId} value={i.itemId}>
                              {i.movement.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
                {session.items
                  .find((i) => i.itemId === painItem)
                  ?.movement.steps.map((s, i) => (
                    <Select
                      key={i}
                      label={s}
                      selected={painSteps.includes(i)}
                      onClick={() => {
                        setUnknownStep(false);
                        setPainSteps(
                          painSteps.includes(i)
                            ? painSteps.filter((x) => x !== i)
                            : [...painSteps, i],
                        );
                      }}
                    />
                  ))}
                <Select
                  label="과정은 잘 모르겠어요"
                  selected={unknownStep}
                  onClick={() => {
                    setUnknownStep(!unknownStep);
                    setPainSteps([]);
                  }}
                />
              </fieldset>
            )}
            <PrimaryButton
              disabled={
                busy ||
                !reaction ||
                (reaction === "worse" && !painSteps.length && !unknownStep)
              }
              onClick={() =>
                event("feedback", {
                  reaction,
                  itemId: painItem || undefined,
                  steps: painSteps,
                  stepsState: unknownStep
                    ? "unknown"
                    : painSteps.length
                      ? "selected"
                      : "unanswered",
                })
              }
            >
              느낌 저장하기
            </PrimaryButton>
            {session.input.purpose !== "daily" && (
              <button
                type="button"
                className="text-button"
                onClick={() => setView("complete")}
              >
                느낌 기록 건너뛰기
              </button>
            )}
          </>
        )}
      {view === "complete" && session && (
        <>
          <img
            className="personal-complete-mascot"
            src="/assets/brand/turtle-home.png"
            alt="쉬고 있는 직꼿 거북이"
          />
          {session.nextState === "none" && <h2>추가로 안내할 동작이 없어요</h2>}
          <p className="sub">
            {session.status === "stopped"
              ? "중단한 상태를 기록했어요."
              : "직접 수행한 상태를 기록했어요."}
          </p>
          <p>
            {session.feedback
              ? labels[session.feedback]
              : "느낌은 아직 남기지 않았어요."}
          </p>
          {session.input.purpose === "daily" &&
            ["same", "worse"].includes(session.feedback ?? "") &&
            session.nextState !== "none" && (
              <PrimaryButton disabled={busy} onClick={() => event("next")}>
                조건에 맞는 다른 동작 확인
              </PrimaryButton>
            )}
          {session.input.purpose === "daily" &&
            session.feedbackSubmitted &&
            session.items.at(-1)?.reaction && (
              <p className="note">
                적합한 대안이 없다면 추가 동작 없이 마무리해요.
              </p>
            )}
          <PrimaryButton
            secondary
            onClick={() =>
              session.input.purpose === "warmup" ? begin("warmup") : home()
            }
          >
            {session.input.purpose === "warmup"
              ? "운동 선택으로"
              : "첫 화면으로"}
          </PrimaryButton>
          {memberName && (
            <button
              type="button"
              className="text-button"
              onClick={() => loadRecords()}
            >
              내 기록 확인
            </button>
          )}
          {context?.reviewAllowed && session.review && (
            <button
              type="button"
              className="text-button"
              onClick={() =>
                run(async () =>
                  setReviewDecision(
                    await api(`/review/sessions/${session.id}`),
                  ),
                )
              }
            >
              내부 추천 근거 확인
            </button>
          )}
          {reviewDecision !== null && (
            <pre className="review-json">
              {JSON.stringify(reviewDecision, null, 2)}
            </pre>
          )}
        </>
      )}
      {view === "records" && (
        <>
          {!records.length && !legacy.length && (
            <p className="sub">
              아직 기록이 없어요. 직접 수행한 경험부터 차근차근 남겨보세요.
            </p>
          )}
          {records.map((r) => (
            <details key={r.id} className="personal-record">
              <summary>
                <time>
                  {new Date(r.createdAt).toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </time>
                <strong>{names[r.input.purpose]}</strong>
                <span>
                  {r.feedback
                    ? labels[r.feedback]
                    : r.status === "active"
                      ? "진행 중"
                      : "느낌 미응답"}
                </span>
              </summary>
              <ul>
                {r.items.map((i) => (
                  <li key={i.itemId}>
                    {i.movement.name} ·{" "}
                    {i.state === "completed"
                      ? "수행"
                      : i.state === "skipped"
                        ? "넘김"
                        : i.state === "stopped"
                          ? "중단"
                          : "미완료"}
                    {i.skipReason === "space" ? " · 공간 부족" : ""}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setSession(r);
                  setInput(r.input);
                  setIndex(
                    Math.max(
                      0,
                      r.items.findIndex((i) => i.state === "pending"),
                    ),
                  );
                  setView(
                    r.status === "active" || r.status === "paused"
                      ? "perform"
                      : r.feedbackSubmitted
                        ? "complete"
                        : "feedback",
                  );
                }}
              >
                이용 상태 열기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(`/personalization/sessions/${r.id}/delete`, {});
                    setRecords((x) => x.filter((s) => s.id !== r.id));
                    if (session?.id === r.id) {
                      setSession(null);
                      request.current = null;
                      pendingEvent.current = null;
                      sessionStorage.removeItem(storageKey);
                    }
                  })
                }
              >
                이 기록 삭제
              </button>
              {r.feedbackSubmitted &&
                ["completed", "stopped"].includes(r.status) && (
                  <details>
                    <summary>
                      {r.input.purpose === "daily"
                        ? "기록한 느낌 정정"
                        : "묶음 느낌 정정"}
                    </summary>
                    <p className="note">
                      지금의 후속 느낌은 아래에 따로 남길 수 있어요. 정정은 당시
                      잘못 기록한 느낌을 바꿔요.
                    </p>
                    <div className="personal-actions">
                      {(
                        (r.input.purpose === "daily"
                          ? ["better", "same", "worse"]
                          : r.input.purpose === "warmup"
                            ? ["ready", "insufficient", "worse"]
                            : ["refreshed", "same", "worse"]) as Reaction[]
                      ).map((reaction) => (
                        <button
                          type="button"
                          key={reaction}
                          disabled={busy}
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
                              setRecords((rows) =>
                                rows.map((row) =>
                                  row.id === r.id ? updated : row,
                                ),
                              );
                              if (session?.id === r.id) setSession(updated);
                            })
                          }
                        >
                          {labels[reaction]}로 정정
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              {r.feedbackSubmitted &&
                !r.followup &&
                ["completed", "stopped"].includes(r.status) && (
                  <div className="personal-actions">
                    <span>그 뒤의 느낌 · 선택</span>
                    {(
                      [
                        ["continued_comfort", "편한 상태가 이어졌어요"],
                        ["same", "비슷해요"],
                        ["uncomfortable", "불편했어요"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setSession(r);
                          void run(async () => {
                            await api(
                              `/personalization/sessions/${r.id}/events`,
                              {
                                eventId: crypto.randomUUID(),
                                action: "followup",
                                followup: id,
                              },
                            );
                            setRecords((x) =>
                              x.map((s) =>
                                s.id === r.id
                                  ? Object.assign(
                                      { ...s },
                                      {
                                        followup: { value: id, at: Date.now() },
                                      },
                                    )
                                  : s,
                              ),
                            );
                          });
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
            </details>
          ))}
          {cursor && (
            <button
              type="button"
              disabled={busy}
              onClick={() => loadRecords(true)}
            >
              기록 더 보기
            </button>
          )}
          {legacy.length > 0 && <h2>이전 동작 기록</h2>}
          {legacy.map((r) => (
            <details key={r.id} className="personal-record">
              <summary>
                {new Date(r.createdAt).toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}{" "}
                · {r.snapshot.area.label} · {r.snapshot.routine.name}
              </summary>
              <p>{labels[r.feedback as Reaction] ?? r.feedback}</p>
              <ul>
                {r.snapshot.habits?.map((h, i) => (
                  <li key={`h-${i}`}>{h.label}</li>
                ))}
                {r.snapshot.recent?.map((h, i) => (
                  <li key={`r-${i}`}>{h.label}</li>
                ))}
              </ul>
            </details>
          ))}
        </>
      )}
      {view === "settings" && (
        <>
          <p className="sub">
            현재 상태는 이용할 때마다 새로 확인해요. 지난 습관은 다음 방문에
            불러와 수정할 수 있어요.
          </p>
          {context?.reviewAllowed && (
            <Select
              label="검토 전용 초안 모드"
              selected={input.review}
              onClick={switchReview}
            />
          )}
          {context?.growthAvailable && memberName && (
            <Select
              label="선택: 성장 표시 보기"
              selected={context.preferences.showGrowth ?? false}
              onClick={() =>
                run(async () => {
                  const showGrowth = !context.preferences.showGrowth;
                  await api("/personalization/preferences", {
                    habits: context.preferences.habits ?? {},
                    showGrowth,
                    sport: context.preferences.sport ?? null,
                    review: input.review,
                  });
                  setContext({
                    ...context,
                    preferences: { ...context.preferences, showGrowth },
                  });
                  change({ growth: showGrowth });
                })
              }
            />
          )}
          {context?.growth && (
            <div className="summary">
              <p>
                {
                  [...levels]
                    .reverse()
                    .find(([min]) => context.growth!.xp >= min)?.[1]
                }{" "}
                · {context.growth.xp} XP
              </p>
              <ul>
                {context.growth.badges
                  .map(
                    (id) =>
                      ({
                        "first-completion": "첫 묶음 완료",
                        "three-weeks": "서로 다른 3주 완료",
                        "five-feelings": "서로 다른 5회 느낌 기록",
                      })[id],
                  )
                  .filter(Boolean)
                  .map((label) => (
                    <li key={label}>{label}</li>
                  ))}
              </ul>
              <p>
                경험치는 건강 점수가 아니며 동작 난도·실시량을 바꾸지 않아요.
              </p>
            </div>
          )}
          {context?.aiAvailable && (
            <p className="note">
              AI는 별도 동의와 서버 설정이 있을 때만 내부 요약을 보조해요.
              추천은 규칙과 실제 반응을 사용해요.
            </p>
          )}
          <p className="note">
            회원 기능은 무료예요. 운영 동의·보관 정책은 검토 중인 초안이에요.
          </p>
          {memberName ? (
            <button type="button" className="text-button" onClick={onLogout}>
              로그아웃
            </button>
          ) : (
            <PrimaryButton onClick={onLogin}>로그인 · 회원가입</PrimaryButton>
          )}
        </>
      )}
      {view === "review" && context?.reviewAllowed && (
        <>
          <p className="sub">
            총 {reviewItems.length}개 등록 · 신규 항목의 공개 승인과 실시량은
            별도 검토합니다.
          </p>
          <label>
            콘텐츠 찾기
            <input
              value={reviewCode}
              onChange={(e) => setReviewCode(e.target.value)}
              placeholder="이름 또는 관리 코드"
            />
          </label>
          <Select
            label="세 콘텐츠를 초안 모드로 실행"
            selected={input.review}
            onClick={switchReview}
          />
          <div className="review-catalog">
            {reviewItems
              .filter((i) => `${i.catalogId} ${i.name}`.includes(reviewCode))
              .map((i) => (
                <details key={i.catalogId}>
                  <summary>
                    {i.catalogId} · {i.name}
                  </summary>
                  <p>{i.actualPose}</p>
                  {i.media.installed ? (
                    <img loading="lazy" src={i.media.path} alt={i.name} />
                  ) : (
                    <p role="status">새 PNG 원본 연결 대기</p>
                  )}
                  <ul>
                    {i.reviewReasons.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <ol>
                    {i.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <dl>
                    {Object.entries(i.mappingSource).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>SHA-256: {i.imageSha256}</p>
                </details>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
function MovementMedia({
  movement,
}: {
  movement: PublicSession["items"][number]["movement"];
}) {
  const [failed, setFailed] = useState(false);
  if (movement.media.type === "video")
    return (
      <video
        className="personal-media"
        controls
        playsInline
        preload="metadata"
        src={movement.media.src}
        aria-label={movement.name}
      />
    );
  return failed || movement.media.version === "awaiting-original" ? (
    <div className="personal-media missing" role="status">
      이 동작의 새 안내 이미지를 연결하고 있어요. 아래 수행 방법을 확인해주세요.
    </div>
  ) : (
    <img
      className="personal-media"
      src={movement.media.src}
      width={movement.media.width}
      height={movement.media.height}
      alt={`${movement.name} 정적 안내 이미지`}
      onError={() => setFailed(true)}
    />
  );
}
