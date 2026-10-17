"use client";
import { useState } from "react";
import { areas, type Area } from "../lib/personalization/types";
const shapes: Record<Area, string> = {
  head: "M270 25 Q320 -8 370 25 L370 105 Q350 143 320 147 Q290 143 270 105 Z",
  neck: "M285 132 L355 132 L363 178 Q320 193 277 178 Z",
  shoulder:
    "M245 169 Q205 180 195 221 L240 245 L275 196 Z M395 169 Q435 180 445 221 L400 245 L365 196 Z",
  back: "M265 222 Q320 235 375 222 L398 285 L380 374 Q320 398 260 374 L242 285 Z",
  lower: "M260 374 Q320 399 380 374 L390 437 Q320 460 250 437 Z",
  thigh:
    "M248 444 Q275 458 309 450 L307 610 L252 615 Z M331 450 Q365 458 392 444 L388 615 L333 610 Z",
  hamstring:
    "M248 444 Q275 458 309 450 L307 610 L252 615 Z M331 450 Q365 458 392 444 L388 615 L333 610 Z",
  knee: "M252 610 Q279 596 307 610 L306 661 Q278 678 252 662 Z M333 610 Q361 596 388 610 L388 662 Q361 678 334 661 Z",
  calf: "M252 664 Q281 682 306 663 L303 804 Q278 824 258 800 Z M334 663 Q359 682 388 664 L382 800 Q362 824 337 804 Z",
  ankle:
    "M258 812 L304 812 L307 870 Q281 895 255 870 Z M336 812 L382 812 L385 870 Q359 895 333 870 Z",
};
export function BodyRegionSelector({
  region,
  back,
  selected,
  onSelect,
}: {
  region: "upper" | "lower";
  back: boolean;
  selected?: Area;
  onSelect: (area: Area) => void;
}) {
  const [highlight, setHighlight] = useState<Area | null>(null);
  const visible = areas.filter(([id], i) =>
    region === "upper"
      ? i < 5 && (back || id !== "back")
      : i >= 5 &&
        (back
          ? ["hamstring", "calf", "ankle"].includes(id)
          : ["thigh", "knee", "ankle"].includes(id)),
  );
  return (
    <div className="personal-body">
      <svg
        viewBox={region === "upper" ? "115 0 410 470" : "180 430 280 500"}
        role="group"
        aria-label={`${region === "upper" ? "상체" : "하체"} ${back ? "뒤쪽" : "앞쪽"} 부위 그림`}
      >
        <image
          href="/assets/brand/body-soft-sketch.jpg"
          width="640"
          height="960"
          preserveAspectRatio="xMidYMid meet"
        />
        {back ? (
          <g fill="none" stroke="#777494" strokeWidth="2" opacity=".5">
            <path d="M284 222 Q265 250 285 282 M356 222 Q375 250 355 282 M320 220 L320 370" />
          </g>
        ) : (
          <g fill="none" stroke="#777494" strokeWidth="2" opacity=".5">
            <path d="M280 185 Q320 206 360 185 M265 625 Q280 611 295 625 M345 625 Q360 611 375 625" />
          </g>
        )}
        {visible.map(([id, label]) => {
          const active = selected === id || highlight === id;
          return (
            <g
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`그림에서 ${label} 선택`}
              aria-pressed={selected === id}
              className={`body-region ${active ? "active" : ""}`}
              onPointerEnter={() => setHighlight(id)}
              onPointerLeave={() => setHighlight(null)}
              onFocus={() => setHighlight(id)}
              onBlur={() => setHighlight(null)}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(id);
                }
              }}
            >
              <title>{label}</title>
              <path d={shapes[id]} />
            </g>
          );
        })}
      </svg>
      <p className="note" aria-live="polite">
        {areas.find(([id]) => id === (highlight ?? selected))?.[1] ??
          "그림에 초점을 두거나 부위를 눌러주세요"}
      </p>
    </div>
  );
}
