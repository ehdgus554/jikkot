"use client";
/* eslint-disable @next/next/no-img-element -- Original static PNG guides must stay intact and zoomable. */
import { useState } from "react";
import type { Routine } from "@/app/jikkot-data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
type Guide = Pick<Routine, "name" | "image" | "cue" | "dose" | "comfort"> &
  Partial<Pick<Routine, "steps" | "displayNumber">>;
function GuideImage({ routine }: { routine: Guide }) {
  const [missing, setMissing] = useState(false);
  return missing ? (
    <p role="alert" className="error-panel">
      동작 안내 이미지 연결을 기다리고 있어요.
    </p>
  ) : (
    <Dialog>
      <img
        src={routine.image}
        alt={`${routine.name} 동작 안내`}
        className="guide-image"
        onError={() => setMissing(true)}
      />
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full min-h-11">
          안내 이미지 확대
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>{routine.name}</DialogTitle>
          <DialogDescription>
            원본 그림을 크게 보고 좌우로 움직여 확인하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-auto">
          <img
            src={routine.image}
            alt={`${routine.name} 확대 안내`}
            className="h-auto w-[1536px] max-w-none object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function RoutineMedia({ routine }: { routine: Guide }) {
  return (
    <article className="routine-guide">
      <GuideImage key={routine.image} routine={routine} />
      <h2 className="routine-heading">{routine.name}</h2>
      {routine.dose && <p className="routine-meta">{routine.dose}</p>}
      {routine.steps?.length ? (
        <ol className="instructions">
          {routine.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : (
        <p>{routine.cue}</p>
      )}
      {routine.comfort && <p className="care">{routine.comfort}</p>}
    </article>
  );
}
