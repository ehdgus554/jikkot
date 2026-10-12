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
    <p className="rounded-xl bg-[#ecebff] p-4 text-sm">
      동작 안내 이미지 연결을 기다리고 있어요.
    </p>
  ) : (
    <Dialog>
      <img
        src={routine.image}
        alt={`${routine.name} 동작 안내`}
        className="h-auto w-full rounded-2xl object-contain"
        onError={() => setMissing(true)}
      />
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
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
    <article className="space-y-4">
      {routine.displayNumber && (
        <p className="text-sm text-[#6268ba]">동작 {routine.displayNumber}</p>
      )}
      <GuideImage key={routine.image} routine={routine} />
      <h2 className="text-2xl font-bold">{routine.name}</h2>
      {routine.dose && <p className="text-sm text-[#6268ba]">{routine.dose}</p>}
      {routine.steps?.length ? (
        <ol className="list-decimal space-y-2 pl-5">
          {routine.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : (
        <p>{routine.cue}</p>
      )}
      {routine.comfort && (
        <p className="rounded-xl bg-[#ffe7dc] p-4">{routine.comfort}</p>
      )}
    </article>
  );
}
