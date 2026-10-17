import { z } from "zod";

export type AiContext = {
  patterns: string[];
  evidence: { id: string; reaction: string | null; purpose: string }[];
};
export interface SummaryAdapter {
  summarize(context: AiContext, signal: AbortSignal): Promise<unknown>;
}
const outputSchema = z
  .object({
    tags: z.array(z.string()).max(21),
    observations: z
      .array(
        z.enum([
          "few_observations",
          "repeated_same",
          "adverse_history",
          "mixed_reactions",
        ]),
      )
      .max(4),
    evidenceIds: z.array(z.string()).max(30),
  })
  .strict();
export async function safeSummary(
  adapter: SummaryAdapter | undefined,
  context: AiContext,
  consent: boolean,
  timeoutMs = 2500,
) {
  if (!adapter || !consent)
    return { source: "rules" as const, aiUsed: false, summary: null };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("timeout"));
      }, timeoutMs);
    });
    const parsed = outputSchema.parse(
      await Promise.race([
        adapter.summarize(context, controller.signal),
        timeout,
      ]),
    );
    if (
      parsed.tags.some((x) => !context.patterns.includes(x)) ||
      parsed.evidenceIds.some(
        (id) => !context.evidence.some((e) => e.id === id),
      )
    )
      throw new Error("Unsupported AI evidence");
    return { source: "ai" as const, aiUsed: true, summary: parsed };
  } catch {
    return { source: "rules" as const, aiUsed: false, summary: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export function openAiAdapter(
  apiKey: string | undefined,
  model: string | undefined,
): SummaryAdapter | undefined {
  if (!apiKey || !model) return undefined;
  return {
    async summarize(context, signal) {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "Return JSON only: tags (subset of supplied patterns), observations (few_observations, repeated_same, adverse_history, mixed_reactions), evidenceIds (subset of supplied IDs). Summarize only; never diagnose, prescribe movements, change constraints, dosage or approvals.",
              },
              { role: "user", content: JSON.stringify(context) },
            ],
            response_format: { type: "json_object" },
          }),
        },
      );
      if (!response.ok) throw new Error("AI unavailable");
      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return JSON.parse(body.choices?.[0]?.message?.content ?? "null");
    },
  };
}
