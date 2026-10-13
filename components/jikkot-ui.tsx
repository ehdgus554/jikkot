"use client";
/* eslint-disable @next/next/no-img-element -- Supplied brand artwork is displayed without conversion. */
import { useState, type ReactNode } from "react";
import { areas, type AreaCode } from "@/app/jikkot-data";

export function Logo() {
  return (
    <img
      className="logo"
      src="/assets/brand/wordmark-ui.png"
      width={360}
      height={126}
      alt="직꼿"
    />
  );
}
export function Header({
  back,
  right,
  busy = false,
}: {
  back?: () => void;
  right?: ReactNode;
  busy?: boolean;
}) {
  return (
    <header className="top">
      {back ? (
        <button className="back" type="button" onClick={back} disabled={busy}>
          ‹ 이전
        </button>
      ) : (
        <Logo />
      )}
      {back ? <Logo /> : right}
      {back && <span className="header-spacer" aria-hidden="true" />}
    </header>
  );
}
export function Surface({
  children,
  busy = false,
}: {
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <section className="screen" aria-busy={busy}>
      {children}
    </section>
  );
}
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  secondary = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={secondary ? "secondary" : "primary"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function ChoiceCard({
  label,
  selected,
  onClick,
  disabled = false,
  description,
  wide = false,
  special = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  description?: string;
  wide?: boolean;
  special?: boolean;
}) {
  return (
    <button
      type="button"
      className={special ? "special" : wide ? "wide-choice" : "choice"}
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      {description && <small>{description}</small>}
      {!wide && !special && (
        <span className="tick" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
export function QuestionProgress({ step }: { step: number }) {
  return (
    <div className="question-progress">
      <span className="sr-only">추천 질문 {step + 1} / 3</span>
      <div className="steps" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span className={`step ${i <= step ? "done" : ""}`} key={i} />
        ))}
      </div>
    </div>
  );
}
export function AreaContext({ label }: { label: string }) {
  return (
    <p className="context">
      선택한 부위 <span className="area-label">{label}</span>
    </p>
  );
}
export function ResultSummary({
  area,
  routine,
  feedback,
}: {
  area: string;
  routine: string;
  feedback: string;
}) {
  return (
    <dl className="summary">
      {[
        ["불편했던 부위", area],
        ["오늘 한 동작", routine],
        ["동작 후 느낌", feedback],
      ].map(([label, value]) => (
        <div className="summary-row" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ConsentRow({
  checked,
  onChange,
  label,
  onDetails,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  onDetails: () => void;
}) {
  return (
    <div className="consent">
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          {label} <em>필수</em>
        </span>
      </label>
      <button className="text-button" type="button" onClick={onDetails}>
        보기<span className="sr-only">: {label}</span>
      </button>
    </div>
  );
}
export function Home({
  memberName,
  begin,
  login,
  logout,
  records,
  comingSoon,
  busy,
}: {
  memberName?: string;
  begin: () => void;
  login: () => void;
  logout: () => void;
  records: () => void;
  comingSoon: () => void;
  busy: boolean;
}) {
  return (
    <>
      <Header
        right={
          memberName ? (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={logout}
            >
              로그아웃
            </button>
          ) : (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={login}
            >
              로그인 · 회원가입
            </button>
          )
        }
      />
      <div className="center">
        <p className="eyebrow">일상 속 작은 이완</p>
        <h1 className="home-title">
          잠깐, 몸도
          <br />
          쉬어갈까요?
        </h1>
        <img
          className="mascot"
          src="/assets/brand/turtle-home.png"
          alt="편안히 쉬는 직꼿 거북이"
          width={190}
          height={221}
        />
        <p className="sub">
          지금 불편한 곳과 평소 습관을 알려주세요.
          <br />
          따라 하기 쉬운 동작 하나를 안내해드려요.
        </p>
        <PrimaryButton onClick={begin} disabled={busy}>
          내 몸 풀어주기
        </PrimaryButton>
        <p className="note">
          {memberName
            ? `${memberName}님, 필요할 때 가볍게 움직여보세요.`
            : "로그인 없이 하루 1회 체험할 수 있어요"}
        </p>
      </div>
      <nav className="nav" aria-label="서비스 메뉴">
        <button type="button" aria-current="page">
          홈
        </button>
        <button type="button" onClick={records} disabled={busy}>
          내 기록
        </button>
        <button type="button" onClick={comingSoon}>
          스트레칭<small>준비 중</small>
        </button>
        <button type="button" onClick={comingSoon}>
          쇼핑<small>준비 중</small>
        </button>
      </nav>
    </>
  );
}
const regions: Record<
  AreaCode,
  { shape: ReactNode; hit: ReactNode; line: string; className: string }
> = {
  head: {
    shape: <ellipse cx="512" cy="114" rx="73" ry="85" />,
    hit: <ellipse cx="512" cy="110" rx="80" ry="87" />,
    line: "M584 115 L796 115",
    className: "head",
  },
  neck: {
    shape: <path d="M468 182 Q513 199 556 182 L559 240 Q514 257 464 240 Z" />,
    hit: <path d="M463 194 L561 194 L568 257 L456 257 Z" />,
    line: "M464 220 L229 220",
    className: "neck",
  },
  shoulder: {
    shape: (
      <path d="M436 265 Q372 266 334 307 Q311 335 318 373 Q350 391 380 363 Q396 317 449 305 Z M588 265 Q652 266 690 307 Q713 335 706 373 Q674 391 644 363 Q628 317 575 305 Z" />
    ),
    hit: (
      <>
        <path d="M315 287 L457 257 L456 305 L397 330 L382 388 L310 380 Z M709 287 L567 257 L568 305 L627 330 L642 388 L714 380 Z" />
        <rect x="315" y="270" width="400" height="70" />
      </>
    ),
    line: "M704 340 L796 340",
    className: "shoulder",
  },
  back: {
    shape: (
      <path d="M432 310 Q512 326 592 310 L642 375 Q620 455 610 530 Q510 552 414 530 Q404 455 382 375 Z" />
    ),
    hit: <path d="M409 340 L615 340 L631 530 L393 530 Z" />,
    line: "M409 447 L229 447",
    className: "back-part",
  },
  lower: {
    shape: (
      <path d="M414 551 Q512 573 610 551 Q615 607 639 656 Q512 685 385 656 Q409 607 414 551 Z" />
    ),
    hit: <path d="M400 540 L624 540 L650 677 L374 677 Z" />,
    line: "M625 605 L796 605",
    className: "waist",
  },
};
export function BodySelector({
  selected,
  onChange,
  disabled = false,
}: {
  selected?: AreaCode;
  onChange: (area?: AreaCode) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<AreaCode>(),
    [focused, setFocused] = useState<AreaCode>();
  return (
    <div className="body-map">
      <svg
        viewBox="0 0 1024 1536"
        className="anatomy"
        role="group"
        aria-label="불편한 부위 선택"
      >
        <image
          href="/assets/brand/body-soft-sketch.jpg"
          width="1024"
          height="1536"
        />
        {areas.map((area) => {
          const active =
            area.id === selected || area.id === hovered || area.id === focused;
          return (
            <g key={area.id}>
              <g
                className={`region ${active ? "preview" : ""} ${selected === area.id ? "selected" : ""} ${focused === area.id ? "keyboard-focus" : ""}`}
                aria-hidden="true"
              >
                {regions[area.id].shape}
              </g>
              <path
                className={`leader ${active ? "is-visible" : ""}`}
                d={regions[area.id].line}
                aria-hidden="true"
              />
              <g
                className="body-hit"
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={area.label}
                aria-pressed={selected === area.id}
                aria-disabled={disabled}
                onClick={() =>
                  !disabled &&
                  onChange(selected === area.id ? undefined : area.id)
                }
                onKeyDown={(event) => {
                  if (["Enter", " "].includes(event.key)) {
                    event.preventDefault();
                    if (!disabled)
                      onChange(selected === area.id ? undefined : area.id);
                  }
                }}
                onPointerEnter={(event) =>
                  event.pointerType !== "touch" && setHovered(area.id)
                }
                onPointerLeave={() => setHovered(undefined)}
                onPointerCancel={() => setHovered(undefined)}
                onFocus={() => setFocused(area.id)}
                onBlur={() => setFocused(undefined)}
              >
                {regions[area.id].hit}
              </g>
            </g>
          );
        })}
      </svg>
      {areas.map((area) => (
        <span
          key={area.id}
          aria-hidden="true"
          className={`body-label ${regions[area.id].className} ${[selected, hovered, focused].includes(area.id) ? "visible" : ""}`}
        >
          {area.label}
        </span>
      ))}
    </div>
  );
}
