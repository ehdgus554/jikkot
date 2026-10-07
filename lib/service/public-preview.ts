import {
  validateAnswers,
  makeRecommendation,
  snapshot,
} from "./recommendation";
/** The real recommendation engine, in memory only: no identity or saved submission. */
export function previewRecommendation(
  input: unknown,
  recommendationId: string,
) {
  const answers = validateAnswers(input);
  const recommendation = makeRecommendation(answers);
  return {
    recommendationId,
    reason: recommendation.reason,
    snapshot: snapshot(answers, recommendation.routine, recommendation.pattern),
  };
}
