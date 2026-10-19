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
  const active = data.regions.find((r) => r.id === selected);
  return (
    <div
      className="release-body"
      ref={ref}
      role="img"
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
        {active && (
          <span
            className="body-point"
            style={{
              left: `${active.point[0] * 100}%`,
              top: `${active.point[1] * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
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
