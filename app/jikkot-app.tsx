"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Check,
  Footprints,
  LibraryBig,
  LockKeyhole,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import {
  allowedPositions,
  areas,
  getRoutine,
  habitIdsByArea,
  habits,
  movements,
  recentActionIdsByArea,
  recentActions,
  routes,
  routines,
  tierLabels,
  type AreaCode,
  type MovementMode,
  type Routine,
  type RoutineRole,
} from "@/app/jikkot-data";

type Step = "movement" | "area" | "recent" | "habit" | "loading" | "result";

type Member = {
  id: string;
  username: string;
  tier: "member" | "lifetime" | "admin";
};

type AccessState = {
  loading: boolean;
  member: Member | null;
  guestUsed: boolean;
  firstRoutineId: string | null;
};

type RecommendationItem = {
  slotRole: RoutineRole;
  routine: Routine;
};

const areaIcons: Record<AreaCode, string> = {
  HEAD: "머",
  NECK: "목",
  SHOULDER: "어",
  LOW_BACK: "허",
  HIP_PELVIS: "골",
};

const stepOrder = ["movement", "area", "recent", "habit"] as const;

function Stepper({ step }: { step: Step }) {
  const effective = step === "loading" || step === "result" ? 4 : Math.max(1, stepOrder.indexOf(step as (typeof stepOrder)[number]) + 1);
  const labels = ["움직임", "불편한 곳", "최근 행동", "생활습관"];

  return (
    <div className="mb-8 space-y-3" aria-label="추천 진행 단계">
      <Progress value={effective * 25} className="h-1.5 bg-[#dce7e2] [&_[data-slot=progress-indicator]]:bg-[#286a58]" />
      <div className="grid grid-cols-4 gap-1">
        {labels.map((label, index) => (
          <div
            key={label}
            className={`text-center text-[0.72rem] font-extrabold ${index + 1 <= effective ? "text-[#1a5043]" : "text-[#9ba39f]"}`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChoiceButton({
  selected,
  title,
  description,
  icon,
  onClick,
  compact = false,
}: {
  selected: boolean;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`group flex w-full items-center rounded-2xl border text-left shadow-[0_8px_24px_rgba(13,42,36,0.05)] transition hover:-translate-y-0.5 hover:border-[#8fb5a6] hover:shadow-[0_12px_30px_rgba(13,42,36,0.09)] ${
        compact ? "h-[5.5rem] gap-3 p-3.5" : "h-[7.5rem] gap-4 p-4"
      } ${selected ? "border-[#286a58] bg-[#edf5f1] ring-2 ring-[#286a58]/10" : "border-[#dfe5e1] bg-white"}`}
    >
      {icon ? (
        <span className={`grid shrink-0 place-items-center rounded-xl ${compact ? "size-9" : "size-12"} ${selected ? "bg-[#286a58] text-white" : "bg-[#edf5f1] text-[#1a5043]"}`}>
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col justify-center">
        <strong className="line-clamp-2 block text-[0.96rem] leading-snug tracking-[-0.025em] text-[#18201d]">{title}</strong>
        {description ? <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-[#66716c]">{description}</span> : null}
      </span>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${selected ? "border-[#286a58] bg-[#286a58] text-white" : "border-[#cbd3cf] bg-white text-transparent"}`}>
        <Check className="size-3.5" />
      </span>
    </button>
  );
}

function ScreenHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#286a58]">{eyebrow}</p>
      <h1 className="text-[clamp(1.75rem,7vw,2.35rem)] font-black leading-[1.18] tracking-[-0.055em] text-[#0d2a24]">{title}</h1>
      <p className="mt-3 text-base leading-7 text-[#66716c]">{description}</p>
    </div>
  );
}

function isAllowed(routine: Routine, mode: MovementMode) {
  return routine.positions.some((position) => allowedPositions[mode].includes(position));
}

function makeRecommendation(
  mode: MovementMode,
  area: AreaCode,
  recentIds: string[],
  habitIds: string[],
) {
  const recentTags = recentIds
    .map((id) => recentActions.find((item) => item.id === id)?.tag)
    .filter((tag): tag is string => Boolean(tag));
  const habitTags = habitIds
    .map((id) => habits.find((item) => item.id === id)?.tag)
    .filter((tag): tag is string => Boolean(tag) && tag !== "NONE");
  const route =
    routes[area].find((candidate) => candidate.tags.some((tag) => recentTags.includes(tag))) ??
    routes[area][routes[area].length - 1];
  const used = new Set<string>();

  const choose = (ids: string[], slotRole: RoutineRole) => {
    const ranked = ids
      .map(getRoutine)
      .filter((routine): routine is Routine => Boolean(routine))
      .filter((routine) => isAllowed(routine, mode))
      .map((routine, index) => ({
        routine,
        index,
        habitMatch: routine.clusters.some((tag) => habitTags.includes(tag)) ? 1 : 0,
      }))
      .sort((a, b) => b.habitMatch - a.habitMatch || a.index - b.index);

    let selected = ranked.find(({ routine }) => !used.has(routine.id))?.routine;
    if (!selected) {
      selected = routines.find(
        (routine) =>
          routine.role === slotRole &&
          routine.areas.includes(area) &&
          isAllowed(routine, mode) &&
          !used.has(routine.id),
      );
    }
    if (!selected) {
      selected = routines.find(
        (routine) => routine.areas.includes(area) && isAllowed(routine, mode) && !used.has(routine.id),
      );
    }
    if (!selected) selected = routines.find((routine) => isAllowed(routine, mode) && !used.has(routine.id));
    if (!selected) throw new Error("추천 가능한 동작이 없습니다.");
    used.add(selected.id);
    return { slotRole, routine: selected };
  };

  return {
    reason: route.reason,
    items: [
      choose(route.relax, "긴장 완화"),
      choose(route.move, "움직임 회복"),
      choose(route.control, "근육 조절"),
    ] as RecommendationItem[],
  };
}

async function readJson(response: Response) {
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "요청을 완료하지 못했습니다.");
  return payload;
}

export default function JikkotApp() {
  const [step, setStep] = useState<Step>("movement");
  const [movement, setMovement] = useState<MovementMode | null>(null);
  const [area, setArea] = useState<AreaCode | null>(null);
  const [selectedRecent, setSelectedRecent] = useState<string[]>([]);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof makeRecommendation> | null>(null);
  const [access, setAccess] = useState<AccessState>({ loading: true, member: null, guestUsed: false, firstRoutineId: null });
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<"default" | "gate">("default");
  const [authTab, setAuthTab] = useState("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [detailRoutine, setDetailRoutine] = useState<Routine | null>(null);
  const [detailRole, setDetailRole] = useState<RoutineRole | null>(null);
  const [pendingRoutine, setPendingRoutine] = useState<{ routine: Routine; role: RoutineRole } | null>(null);
  const [logicOpen, setLogicOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<"ALL" | AreaCode>("ALL");

  const currentArea = areas.find((item) => item.id === area);
  const visibleRecent = useMemo(
    () => area
      ? recentActionIdsByArea[area].flatMap((id) => {
          const item = recentActions.find((candidate) => candidate.id === id);
          return item ? [item] : [];
        })
      : [],
    [area],
  );
  const visibleHabits = useMemo(
    () => area
      ? habitIdsByArea[area].flatMap((id) => {
          const item = habits.find((candidate) => candidate.id === id);
          return item ? [item] : [];
        })
      : [],
    [area],
  );

  useEffect(() => {
    fetch("/api/access/status", { cache: "no-store" })
      .then(readJson)
      .then((payload) => {
        const member = (payload.member as Member | null) ?? null;
        const guest = payload.guest as { used?: boolean; routineId?: string | null } | null;
        setAccess({
          loading: false,
          member,
          guestUsed: Boolean(guest?.used),
          firstRoutineId: guest?.routineId ?? null,
        });
      })
      .catch(() => setAccess((current) => ({ ...current, loading: false })));
  }, []);

  const reset = () => {
    setStep("movement");
    setMovement(null);
    setArea(null);
    setSelectedRecent([]);
    setSelectedHabits([]);
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleLimited = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    current: string[],
    noneId: string,
  ) => {
    if (id === noneId) {
      setter(current.includes(id) ? [] : [id]);
      return;
    }
    const withoutNone = current.filter((item) => item !== noneId);
    if (withoutNone.includes(id)) {
      setter(withoutNone.filter((item) => item !== id));
      return;
    }
    if (withoutNone.length >= 2) {
      toast("최대 2개까지 선택할 수 있어요.");
      return;
    }
    setter([...withoutNone, id]);
  };

  const runRecommendation = () => {
    if (!movement || !area) return;
    const effectiveRecent = selectedRecent.length ? selectedRecent : ["RA99"];
    setStep("loading");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => {
      setResult(makeRecommendation(movement, area, effectiveRecent, selectedHabits));
      setStep("result");
    }, 650);
  };

  const openRoutine = async (routine: Routine, role: RoutineRole) => {
    if (access.member) {
      setDetailRole(role);
      setDetailRoutine(routine);
      return;
    }
    try {
      const response = await fetch("/api/access/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ routineId: routine.id }),
      });
      const payload = (await response.json()) as {
        allowed?: boolean;
        code?: string;
        message?: string;
        firstRoutineId?: string | null;
        error?: string;
      };
      if (response.ok && payload.allowed) {
        setAccess((current) => ({ ...current, guestUsed: true, firstRoutineId: routine.id }));
        setDetailRole(role);
        setDetailRoutine(routine);
        return;
      }
      if (payload.code === "LOGIN_REQUIRED") {
        setAccess((current) => ({ ...current, guestUsed: true, firstRoutineId: payload.firstRoutineId ?? current.firstRoutineId }));
        setPendingRoutine({ routine, role });
        setAuthReason("gate");
        setAuthTab("login");
        setAuthError("");
        setAuthOpen(true);
        return;
      }
      throw new Error(payload.error ?? "열람 권한을 확인하지 못했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "열람 권한을 확인하지 못했습니다.");
    }
  };

  const finishAuth = (member: Member) => {
    setAccess({ loading: false, member, guestUsed: false, firstRoutineId: null });
    setAuthOpen(false);
    setAuthReason("default");
    toast.success("로그인되었습니다.");
    if (pendingRoutine) {
      setDetailRole(pendingRoutine.role);
      setDetailRoutine(pendingRoutine.routine);
      setPendingRoutine(null);
    }
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>, mode: "login" | "signup") => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const payload = await readJson(response);
      finishAuth(payload.member as Member);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "요청을 완료하지 못했습니다.");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try {
      await readJson(await fetch("/api/auth/logout", { method: "POST" }));
      setAccess({ loading: false, member: null, guestUsed: false, firstRoutineId: null });
      setAuthOpen(false);
      setLibraryOpen(false);
      toast("로그아웃되었습니다.");
      const status = await readJson(await fetch("/api/access/status", { cache: "no-store" }));
      const guest = status.guest as { used?: boolean; routineId?: string | null } | null;
      setAccess({ loading: false, member: null, guestUsed: Boolean(guest?.used), firstRoutineId: guest?.routineId ?? null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "로그아웃하지 못했습니다.");
    }
  };

  const openAuth = () => {
    setAuthReason("default");
    setAuthError("");
    setAuthOpen(true);
  };

  const libraryRoutines = libraryFilter === "ALL" ? routines : routines.filter((routine) => routine.areas.includes(libraryFilter));

  return (
    <div className="min-h-screen bg-[#0d2a24] sm:px-5 sm:py-6">
      <div className="mx-auto min-h-screen w-full max-w-[720px] overflow-hidden bg-[#f7f5ef] shadow-[0_0_90px_rgba(0,0,0,0.24)] sm:min-h-[calc(100vh-3rem)] sm:rounded-[28px]">
        <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-3 border-b border-white/10 bg-[#123b32]/95 px-4 py-3 text-white backdrop-blur-xl sm:px-8">
          <button type="button" onClick={reset} className="flex items-center gap-2.5 text-left">
            <span className="grid size-10 place-items-center rounded-[13px_13px_13px_4px] bg-[#d1a94c] text-base font-black text-[#0d2a24]">직</span>
            <span>
              <strong className="block text-lg font-black leading-none tracking-[-0.04em]">직꼿</strong>
              <small className="mt-1 block text-[0.62rem] font-extrabold tracking-[0.1em] text-white/55">VER9 PROTOTYPE</small>
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" onClick={() => setLogicOpen(true)} className="hidden h-10 text-white/75 hover:bg-white/10 hover:text-white xs:inline-flex sm:inline-flex">추천 기준</Button>
            <Button type="button" onClick={openAuth} className="h-10 max-w-32 rounded-full bg-[#d1a94c] font-black text-[#0d2a24] hover:bg-[#e0bd65]">
              {access.member ? <><UserRound className="size-4" />{access.member.username}</> : "로그인"}
            </Button>
          </div>
        </header>

        <main className="px-4 pb-14 pt-4 sm:px-9 sm:pt-5">
          <section
            className={`mb-2 flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${
              access.member
                ? "border-[#ead597] bg-[#f5e9c8] text-[#745811]"
                : access.guestUsed
                  ? "border-[#eccbc4] bg-[#f8e8e4] text-[#7d352c]"
                  : "border-[#c9ddd5] bg-[#dcebe5] text-[#123b32]"
            }`}
            aria-live="polite"
          >
            <div className="flex min-w-0 items-center gap-2 font-extrabold">
              {access.member ? <ShieldCheck className="size-4 shrink-0" /> : access.guestUsed ? <LockKeyhole className="size-4 shrink-0" /> : <Sparkles className="size-4 shrink-0" />}
              <span className="truncate">
                {access.loading
                  ? "이용 상태 확인 중"
                  : access.member
                    ? `${tierLabels[access.member.tier]} · 전체 루틴 열람 가능`
                    : access.guestUsed
                      ? "비회원 · 오늘 1개를 이미 열람했어요"
                      : "비회원 · 오늘 1개 열람 가능"}
              </span>
            </div>
            <span className="shrink-0 text-[0.7rem] opacity-70">한국 시간 기준</span>
          </section>

          <p className="mb-7 mt-2 text-xs leading-relaxed text-[#66716c]">
            <Badge className="mr-1.5 bg-[#286a58] text-white">시제품</Badge>
            사진·동작·추천 연결은 검수 전 임시 콘텐츠입니다.
          </p>

          {step !== "result" ? <Stepper step={step} /> : null}

          {step === "movement" ? (
            <section>
              <ScreenHeading eyebrow="1 / 4" title="지금 가능한 움직임은?" description="현재 있는 공간에서 편하게 할 수 있는 범위를 골라주세요." />
              <div className="grid auto-rows-fr items-stretch gap-3 sm:grid-cols-3">
                {movements.map((item, index) => {
                  const Icon = [Armchair, Footprints, BedDouble][index];
                  return (
                    <ChoiceButton
                      key={item.id}
                      selected={movement === item.id}
                      title={item.label}
                      description={item.description}
                      icon={<Icon className="size-5" />}
                      onClick={() => {
                        setMovement(item.id);
                        setStep("area");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === "area" ? (
            <section>
              <ScreenHeading eyebrow="2 / 4" title="어디가 가장 불편한가요?" description="세부 위치 대신 큰 부위 한 곳만 고르면 됩니다." />
              <div className="grid auto-rows-fr items-stretch gap-2.5">
                {areas.map((item) => (
                  <ChoiceButton
                    key={item.id}
                    selected={area === item.id}
                    title={item.label}
                    description={item.description}
                    icon={<span className="font-black">{areaIcons[item.id]}</span>}
                    compact
                    onClick={() => {
                      setArea(item.id);
                      setSelectedRecent([]);
                      setSelectedHabits([]);
                      setStep("recent");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                ))}
              </div>
              <Button type="button" variant="outline" onClick={() => setStep("movement")} className="mt-6 h-12 w-full rounded-xl border-[#cfd8d3] bg-white">
                <ArrowLeft /> 이전
              </Button>
            </section>
          ) : null}

          {step === "recent" ? (
            <section>
              <ScreenHeading eyebrow="3 / 4" title="최근 어떤 행동을 했나요?" description={`${currentArea?.label ?? "선택한 부위"}와 관련 가능성이 높은 행동만 추렸어요. 최대 2개를 골라주세요.`} />
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#66716c]">관련 문항 {visibleRecent.length}개</p>
                <p className="w-fit rounded-full bg-[#edf5f1] px-3 py-1.5 text-xs font-black text-[#286a58]">{selectedRecent.length}/2 선택</p>
              </div>
              <div className="grid auto-rows-fr items-stretch gap-2.5">
                {visibleRecent.map((item) => (
                  <ChoiceButton
                    key={item.id}
                    selected={selectedRecent.includes(item.id)}
                    title={item.label}
                    icon={<Check className="size-4" />}
                    compact
                    onClick={() => toggleLimited(item.id, setSelectedRecent, selectedRecent, "RA99")}
                  />
                ))}
              </div>
              <div className="sticky bottom-3 z-20 mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#dfe5e1] bg-[#f7f5ef]/95 p-2.5 shadow-[0_14px_35px_rgba(13,42,36,0.14)] backdrop-blur-xl">
                <Button type="button" variant="outline" onClick={() => setStep("area")} className="h-12 w-full rounded-xl border-[#cfd8d3] bg-white"><ArrowLeft /> 이전</Button>
                <Button type="button" disabled={!selectedRecent.length} onClick={() => { setStep("habit"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="h-12 w-full rounded-xl bg-[#123b32] font-black text-white hover:bg-[#1a5043]">다음 <ArrowRight /></Button>
              </div>
            </section>
          ) : null}

          {step === "habit" ? (
            <section>
              <ScreenHeading eyebrow="4 / 4 · 선택 사항" title="평소 생활습관은 어떤가요?" description={`${currentArea?.label ?? "선택한 부위"}와 연관 가능성이 높은 습관만 보여드려요. 최대 2개만 선택하세요.`} />
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#66716c]">관련 문항 {visibleHabits.length}개</p>
                <p className="w-fit rounded-full bg-[#edf5f1] px-3 py-1.5 text-xs font-black text-[#286a58]">{selectedHabits.length}/2 선택</p>
              </div>
              <div className="grid auto-rows-fr items-stretch gap-2.5">
                {visibleHabits.map((item) => (
                  <ChoiceButton
                    key={item.id}
                    selected={selectedHabits.includes(item.id)}
                    title={item.label}
                    icon={<Check className="size-4" />}
                    compact
                    onClick={() => toggleLimited(item.id, setSelectedHabits, selectedHabits, "HB99")}
                  />
                ))}
              </div>
              <div className="sticky bottom-3 z-20 mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#dfe5e1] bg-[#f7f5ef]/95 p-2.5 shadow-[0_14px_35px_rgba(13,42,36,0.14)] backdrop-blur-xl">
                <Button type="button" variant="outline" onClick={() => setStep("recent")} className="h-12 w-full rounded-xl border-[#cfd8d3] bg-white"><ArrowLeft /> 이전</Button>
                <Button type="button" onClick={runRecommendation} className="h-12 w-full rounded-xl bg-[#123b32] font-black text-white hover:bg-[#1a5043]">루틴 추천받기 <Sparkles /></Button>
              </div>
            </section>
          ) : null}

          {step === "loading" ? (
            <section className="grid min-h-[390px] place-items-center text-center">
              <div>
                <div className="mx-auto mb-7 flex w-fit gap-2" aria-hidden="true">
                  {[0, 1, 2].map((item) => <span key={item} className="size-3 animate-bounce rounded-full bg-[#286a58]" style={{ animationDelay: `${item * 120}ms` }} />)}
                </div>
                <h1 className="text-3xl font-black tracking-[-0.05em] text-[#0d2a24]">가능한 동작을 고르고 있어요</h1>
                <p className="mt-3 text-[#66716c]">선택한 자세와 최근 행동을 먼저 반영합니다.</p>
              </div>
            </section>
          ) : null}

          {step === "result" && result ? (
            <section>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#286a58]">VER9 임시 추천</p>
                  <h1 className="text-[clamp(1.8rem,7vw,2.4rem)] font-black tracking-[-0.055em] text-[#0d2a24]">지금 해볼 3가지</h1>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={reset} className="rounded-xl bg-[#edf5f1] font-extrabold text-[#286a58] hover:bg-[#dcebe5]"><RotateCcw /> 처음부터</Button>
              </div>
              <p className="mt-4 text-[0.96rem] leading-7 text-[#66716c]">{result.reason}</p>
              <div className="my-5 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-[#d4e5de] bg-[#edf5f1] text-[#123b32]">{movements.find((item) => item.id === movement)?.label}</Badge>
                <Badge variant="outline" className="border-[#d4e5de] bg-[#edf5f1] text-[#123b32]">{currentArea?.label}</Badge>
                <Badge variant="outline" className="border-[#d4e5de] bg-[#edf5f1] text-[#123b32]">최근 행동 {selectedRecent[0] === "RA99" ? 0 : selectedRecent.length}개</Badge>
              </div>

              <div className="grid auto-rows-fr items-stretch gap-4 md:grid-cols-3">
                {result.items.map((item, index) => (
                  <article key={`${item.slotRole}-${item.routine.id}`} className="flex h-full flex-col overflow-hidden rounded-[24px] border border-[#dfe5e1] bg-white shadow-[0_10px_30px_rgba(13,42,36,0.07)]">
                    <div className="relative h-52 overflow-hidden bg-[#dfe8e3] md:h-40">
                      <img src={item.routine.image} alt={`${item.routine.name} 임시 사진`} className="h-full w-full object-cover" />
                      <Badge className="absolute right-3 top-3 bg-white/90 text-[#123b32] backdrop-blur">임시 사진</Badge>
                      <Badge className="absolute bottom-3 left-3 bg-[#d1a94c] text-[#0d2a24]">{index + 1}번째</Badge>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <span className="text-xs font-black text-[#286a58]">{item.slotRole}</span>
                      <h2 className="mt-1.5 text-lg font-black leading-snug tracking-[-0.04em] text-[#0d2a24]">{item.routine.name}</h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#66716c]">{item.routine.cue}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{item.routine.dose}</Badge>
                        <Badge variant="secondary">{item.routine.positions.join("·")}</Badge>
                        {item.routine.role !== item.slotRole ? <Badge className="bg-[#f5e9c8] text-[#745811]">시제품 연결 검토</Badge> : null}
                      </div>
                      <div className="mt-auto pt-4">
                        <Button type="button" onClick={() => openRoutine(item.routine, item.slotRole)} className={`h-12 w-full rounded-xl font-black ${!access.member && access.guestUsed ? "bg-[#f5e5e1] text-[#76443c] hover:bg-[#efd8d2]" : "bg-[#123b32] text-white hover:bg-[#1a5043]"}`}>
                          {!access.member && access.guestUsed ? <><LockKeyhole /> 로그인하고 보기</> : <>자세히 보기 <ArrowRight /></>}
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {access.member ? (
                <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-[#123b32] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <strong className="block">회원은 시제품 후보 30개를 모두 볼 수 있어요.</strong>
                    <span className="mt-1 block text-xs text-white/60">현재는 모두 검수 전 상태입니다.</span>
                  </div>
                  <Button type="button" onClick={() => setLibraryOpen(true)} className="rounded-xl bg-[#d1a94c] font-black text-[#0d2a24] hover:bg-[#e0bd65]"><LibraryBig /> 전체 루틴 보기</Button>
                </div>
              ) : null}

              <p className="mt-6 border-t border-[#dfe5e1] pt-5 text-xs leading-6 text-[#7a837e]">
                이 추천은 질환을 진단하거나 치료를 대신하지 않습니다. 최종 서비스에는 사용자 승인과 전문가 검수를 마친 동작만 노출합니다.
              </p>
            </section>
          ) : null}
        </main>

        <footer className="flex items-center justify-between gap-3 bg-[#0d2a24] px-5 py-5 text-[0.7rem] text-white/55 sm:px-9">
          <span>직꼿 VER9 · 기능 검증용 시제품</span>
          <button type="button" onClick={() => setLogicOpen(true)} className="font-bold text-white/75">추천 구조 보기</button>
        </footer>
      </div>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-[#dfe5e1] bg-[#f7f5ef] p-6 sm:max-w-md">
          {access.member ? (
            <div className="pt-3 text-center">
              <div className="mx-auto mb-5 grid size-20 place-items-center rounded-[25px_25px_25px_8px] bg-[#d1a94c] text-2xl font-black text-[#0d2a24]">직</div>
              <span className="text-xs font-black tracking-[0.08em] text-[#286a58]">로그인됨</span>
              <DialogTitle className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#0d2a24]">{access.member.username}</DialogTitle>
              <p className="mt-2 text-sm text-[#66716c]">서버에 저장된 직꼿 계정</p>
              <div className="my-6 flex items-center justify-between rounded-xl bg-[#edf5f1] p-4 text-sm">
                <span className="text-[#66716c]">회원 등급</span>
                <strong className="text-[#123b32]">{tierLabels[access.member.tier]}</strong>
              </div>
              <Button type="button" onClick={() => { setAuthOpen(false); setLibraryOpen(true); }} className="h-12 w-full rounded-xl bg-[#123b32] font-black"><LibraryBig /> 전체 루틴 30개 보기</Button>
              <Button type="button" variant="outline" onClick={logout} className="mt-2 h-12 w-full rounded-xl border-[#cfd8d3] bg-white"><LogOut /> 로그아웃</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <span className="text-xs font-black tracking-[0.08em] text-[#286a58]">직꼿 회원</span>
                <DialogTitle className="text-2xl font-black tracking-[-0.04em] text-[#0d2a24]">{authReason === "gate" ? "로그인이 필요합니다!" : "로그인"}</DialogTitle>
                <DialogDescription className="leading-6 text-[#66716c]">
                  {authReason === "gate" ? "비회원은 한국 시간 기준 하루에 루틴 1개만 볼 수 있어요. 로그인하면 모든 시제품 루틴을 볼 수 있습니다." : "로그인하면 모든 시제품 루틴을 볼 수 있어요."}
                </DialogDescription>
              </DialogHeader>
              <Tabs value={authTab} onValueChange={(value) => { setAuthTab(value); setAuthError(""); }}>
                <TabsList className="grid h-11 w-full grid-cols-2 bg-[#e7ebe8]">
                  <TabsTrigger value="login" className="font-extrabold">로그인</TabsTrigger>
                  <TabsTrigger value="signup" className="font-extrabold">회원가입</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <form onSubmit={(event) => submitAuth(event, "login")} className="mt-4 grid gap-3">
                    <label className="grid gap-1.5 text-sm font-bold text-[#48534e]">아이디<Input name="username" autoComplete="username" minLength={4} maxLength={20} required placeholder="영문 소문자, 숫자, 밑줄" className="h-12 rounded-xl border-[#ccd5d0] bg-white" /></label>
                    <label className="grid gap-1.5 text-sm font-bold text-[#48534e]">비밀번호<Input name="password" type="password" autoComplete="current-password" minLength={8} maxLength={72} required placeholder="비밀번호" className="h-12 rounded-xl border-[#ccd5d0] bg-white" /></label>
                    {authError ? <p className="rounded-xl bg-[#f8e8e4] px-3 py-2.5 text-sm font-bold text-[#9a3f34]">{authError}</p> : null}
                    <Button type="submit" disabled={authBusy} className="mt-1 h-12 rounded-xl bg-[#123b32] font-black hover:bg-[#1a5043]">{authBusy ? "확인 중…" : "로그인"}</Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={(event) => submitAuth(event, "signup")} className="mt-4 grid gap-3">
                    <div className="rounded-xl border border-[#d4e5de] bg-[#edf5f1] px-3 py-2.5 text-xs leading-5 text-[#286a58]">계정은 서버 DB에 저장됩니다. 아이디는 영문 소문자·숫자·밑줄 4~20자로 만들어주세요.</div>
                    <label className="grid gap-1.5 text-sm font-bold text-[#48534e]">아이디<Input name="username" autoComplete="username" minLength={4} maxLength={20} pattern="[a-z0-9_]+" required placeholder="예: jikkot_user" className="h-12 rounded-xl border-[#ccd5d0] bg-white" /></label>
                    <label className="grid gap-1.5 text-sm font-bold text-[#48534e]">비밀번호<Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required placeholder="8자 이상" className="h-12 rounded-xl border-[#ccd5d0] bg-white" /></label>
                    {authError ? <p className="rounded-xl bg-[#f8e8e4] px-3 py-2.5 text-sm font-bold text-[#9a3f34]">{authError}</p> : null}
                    <Button type="submit" disabled={authBusy} className="mt-1 h-12 rounded-xl bg-[#123b32] font-black hover:bg-[#1a5043]">{authBusy ? "저장 중…" : "회원가입"}</Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailRoutine)} onOpenChange={(open) => { if (!open) setDetailRoutine(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-0 bg-[#f7f5ef] p-0 sm:max-w-xl">
          {detailRoutine ? (
            <div>
              <div className="relative h-[min(43vh,360px)] overflow-hidden bg-[#dfe8e3]">
                <img src={detailRoutine.image} alt={`${detailRoutine.name} 임시 사진`} className="h-full w-full object-cover" />
                <Badge className="absolute left-4 top-4 bg-[#fff1d8] text-[#77422f]">검수 전 · 임시 사진</Badge>
              </div>
              <div className="p-6">
                <span className="text-xs font-black text-[#286a58]">{detailRole ?? detailRoutine.role}</span>
                <DialogTitle className="mt-2 text-2xl font-black leading-tight tracking-[-0.05em] text-[#0d2a24]">{detailRoutine.name}</DialogTitle>
                <p className="mt-3 leading-7 text-[#66716c]">{detailRoutine.cue}</p>
                <div className="mt-4 flex flex-wrap gap-2"><Badge variant="secondary">{detailRoutine.dose}</Badge><Badge variant="secondary">{detailRoutine.positions.join("·")}</Badge></div>
                <ol className="mt-6 grid gap-2.5">
                  {[
                    `안정된 ${detailRoutine.positions[0]} 자세를 만들고 숨을 편하게 쉬어요.`,
                    detailRoutine.cue,
                    `${detailRoutine.dose} 진행한 뒤 천천히 처음 자세로 돌아와요.`,
                  ].map((instruction, index) => (
                    <li key={instruction} className="grid grid-cols-[2rem_1fr] items-start gap-3 rounded-xl border border-[#dfe5e1] bg-white p-3.5 leading-6 text-[#3e4944]">
                      <b className="grid size-8 place-items-center rounded-lg bg-[#286a58] text-xs text-white">{index + 1}</b>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 rounded-xl bg-[#f5e9c8] p-4 text-sm leading-6 text-[#654e16]"><strong>편한 범위</strong><br />{detailRoutine.comfort}</div>
                <p className="mt-5 text-xs leading-5 text-[#7a837e]">이 화면은 영상 제작 전 흐름 확인용입니다. 사진과 안내 문구는 사용자 검수 및 전문가 동작 검수 후 교체됩니다.</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={logicOpen} onOpenChange={setLogicOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-[#dfe5e1] bg-[#f7f5ef] p-6 sm:max-w-2xl">
          <DialogHeader>
            <span className="text-xs font-black tracking-[0.08em] text-[#286a58]">VER9 추천 구조</span>
            <DialogTitle className="text-2xl font-black tracking-[-0.04em] text-[#0d2a24]">네 가지 답을 세 역할로 연결해요</DialogTitle>
            <DialogDescription className="leading-6 text-[#66716c]">진단명이나 확률 점수를 만들지 않고 정해진 순서표로 같은 입력에 같은 결과를 냅니다.</DialogDescription>
          </DialogHeader>
          <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-4">
            {[
              ["1", "가능한 움직임", "자세 후보를 먼저 제한"],
              ["2", "큰 불편 부위", "세부 위치 질문은 생략"],
              ["3", "연관 최근 행동", "부위별 6개 중 최대 2개"],
              ["4", "연관 생활습관", "부위별 5개 중 최대 2개"],
            ].map(([number, title, copy]) => (
              <article key={number} className="h-full rounded-2xl border border-[#dfe5e1] bg-white p-3.5">
                <b className="grid size-7 place-items-center rounded-lg bg-[#d1a94c] text-xs text-[#0d2a24]">{number}</b>
                <strong className="mt-3 block text-sm text-[#0d2a24]">{title}</strong>
                <span className="mt-1 block text-xs leading-5 text-[#66716c]">{copy}</span>
              </article>
            ))}
          </div>
          <div className="grid gap-2">
            {[
              ["1번째", "긴장 완화", "호흡과 턱·어깨의 힘을 편하게 놓기"],
              ["2번째", "움직임 회복", "목·어깨·몸통·골반을 가볍게 움직이기"],
              ["3번째", "근육 조절", "날개뼈·몸통·엉덩이를 가볍게 사용하기"],
            ].map(([number, title, copy]) => (
              <article key={number} className="rounded-2xl border border-[#d4e5de] bg-[#edf5f1] p-4">
                <span className="text-[0.68rem] font-black text-[#286a58]">{number}</span>
                <strong className="mt-1 block text-[#0d2a24]">{title}</strong>
                <p className="mt-1 text-xs leading-5 text-[#66716c]">{copy}</p>
              </article>
            ))}
          </div>
          <div className="rounded-xl bg-[#f5e9c8] p-4 text-sm leading-6 text-[#654e16]"><strong>검수 원칙</strong><br />최종판은 사용자 승인, 전문가 동작 검수, 추천 연결 승인을 모두 마친 콘텐츠만 사용합니다.</div>
        </DialogContent>
      </Dialog>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-[#dfe5e1] bg-[#f7f5ef] p-6 sm:max-w-3xl">
          <DialogHeader>
            <span className="text-xs font-black tracking-[0.08em] text-[#286a58]">회원 전용 · 시제품</span>
            <DialogTitle className="text-2xl font-black tracking-[-0.04em] text-[#0d2a24]">동작 후보 30개</DialogTitle>
            <DialogDescription className="leading-6 text-[#66716c]">모든 후보는 검수 전입니다. 촬영·검수 뒤 승인된 동작만 최종 서비스에 남깁니다.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button type="button" size="sm" variant={libraryFilter === "ALL" ? "default" : "outline"} onClick={() => setLibraryFilter("ALL")} className={libraryFilter === "ALL" ? "rounded-full bg-[#286a58]" : "rounded-full bg-white"}>전체</Button>
            {areas.map((item) => <Button key={item.id} type="button" size="sm" variant={libraryFilter === item.id ? "default" : "outline"} onClick={() => setLibraryFilter(item.id)} className={libraryFilter === item.id ? "shrink-0 rounded-full bg-[#286a58]" : "shrink-0 rounded-full bg-white"}>{item.label}</Button>)}
          </div>
          <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-3 sm:grid-cols-3">
            {libraryRoutines.map((routine) => (
              <button key={routine.id} type="button" onClick={() => { setLibraryOpen(false); setDetailRole(routine.role); setDetailRoutine(routine); }} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#dfe5e1] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg">
                <img src={routine.image} alt={`${routine.name} 임시 사진`} className="h-28 w-full bg-[#dfe8e3] object-cover" />
                <div className="flex min-h-20 flex-1 flex-col p-3">
                  <span className="text-[0.66rem] font-black text-[#286a58]">{routine.id} · {routine.role}</span>
                  <strong className="mt-1 line-clamp-2 block text-sm leading-5 text-[#0d2a24]">{routine.name}</strong>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-center" richColors />
    </div>
  );
}
