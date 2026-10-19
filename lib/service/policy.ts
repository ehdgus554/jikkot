/** Release decisions, 2026-10-19. Processing location is read from the actual database. */
export const consentPolicy = {
  version: "2026-10-19",
  reviewedForLaunch: false,
} as const;
export const operationalPolicy = {
  operatorName: "김동현",
  contactEmail: "ehdgus554@gmail.com",
  retentionPolicy: "untilWithdrawal",
  retentionDays: null as number | null,
  reviewedForLaunch: false,
  guestRetention: "nextMidnightKST",
  deletionSchedule: "every10Minutes",
  externalAiEnabled: false,
};
export const guestRetentionCopy =
  "비회원 이용 횟수와 기록은 매일 밤 12시(한국 시간)에 초기화돼요.";
