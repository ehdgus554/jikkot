"use client";
/* eslint-disable @next/next/no-img-element -- Supplied release illustrations keep their original ratio. */
import { useEffect, useRef, useState } from "react";
import data from "../lib/personalization/release/body-selection.json";
import type { Area } from "../lib/personalization/types";
const root = "/assets/jikkot-release/2026-10-17/ui/";
export function BodyRegionSelector({
  region,
  back,
  selected,
  onSelect,
  onViewChange,
  reducedMotion = false,
}: {
  region: "upper" | "lower";
  back: boolean;
  selected?: Area;
  onSelect?: (a: Area) => void;
  onViewChange: (back: boolean) => void;
  reducedMotion?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const camera = data.camera[region],
    height = 390 / (camera.yMax - camera.yMin),
    imageWidth = height * data.imageAspectRatio;
  const [hovered, setHovered] = useState<string | null>(null);
  const visible = data.regions.filter(
    (r) =>
      r.section === region &&
      (r.view === "either" || r.view === (back ? "back" : "front")) &&
      (r.id !== "thigh" || !back) &&
      (r.id !== "hamstring" || back),
  );
  return (
    <div
      className="release-body"
      ref={ref}
      role="group"
      aria-label={`${region === "upper" ? "상체" : "하체"} ${back ? "뒤" : "앞"} 부위 그림`}
    >
      <div
        className="body-camera"
        style={{
          height,
          width: imageWidth,
          left: (width - imageWidth) / 2,
          top: -height * camera.yMin,
          transitionDuration: reducedMotion ? "0ms" : undefined,
        }}
      >
        <img
          src={root + "body-front.webp"}
          width={1024}
          height={1536}
          alt=""
          style={{ opacity: back ? 0 : 1 }}
          draggable={false}
        />
        <img
          src={root + "body-back.webp"}
          width={1024}
          height={1536}
          alt=""
          style={{ opacity: back ? 1 : 0 }}
          draggable={false}
        />
        <svg
          className="body-hit-map"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          role="radiogroup"
          aria-label="불편 부위"
        >
          {visible.map((r) => (
            <g
              key={r.id}
              role="radio"
              tabIndex={0}
              aria-label={r.label}
              aria-checked={selected === r.id}
              data-area={r.id}
              onClick={() => onSelect?.(r.id as Area)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(r.id as Area);
                }
              }}
              onMouseEnter={() => setHovered(r.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(r.id)}
              onBlur={() => setHovered(null)}
            >
              {r.polygons.map((polygon, n) => (
                <polygon
                  key={n}
                  points={polygon
                    .map(([x, y]) => `${x * 1000},${y * 1000}`)
                    .join(" ")}
                  className={selected === r.id ? "selected" : ""}
                />
              ))}
              {hovered === r.id && (
                <text
                  x={r.point[0] * 1000}
                  y={r.point[1] * 1000}
                  textAnchor="middle"
                  aria-hidden="true"
                >
                  {r.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <button
        type="button"
        className="body-side front"
        aria-label="앞쪽 보기"
        onClick={() => onViewChange(false)}
      >
        앞
      </button>
      <button
        type="button"
        className="body-side back"
        aria-label="뒤쪽 보기"
        onClick={() => onViewChange(true)}
      >
        뒤
      </button>
    </div>
  );
}
