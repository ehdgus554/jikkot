/* eslint-disable @next/next/no-img-element -- Native media preserves animated GIF/WebP frames and avoids an unavailable IMAGES binding. */
import type { Routine } from "@/app/jikkot-data";
export function RoutineMedia({
  routine,
}: {
  routine: Pick<Routine, "name" | "image" | "cue" | "dose" | "comfort">;
}) {
  return (
    <article className="space-y-4">
      <img
        src={routine.image}
        alt={`${routine.name} 동작 안내`}
        className="aspect-[4/3] w-full rounded-2xl bg-[#ecebff] object-contain"
      />
      <h2 className="text-2xl font-bold">{routine.name}</h2>
      <p className="text-sm text-[#6268ba]">{routine.dose}</p>
      <p>{routine.cue}</p>
      <p className="rounded-xl bg-[#ffe7dc] p-4">{routine.comfort}</p>
      <p className="text-xs text-gray-500">
        현재 미디어는 검수 전 임시 이미지입니다.
      </p>
    </article>
  );
}
