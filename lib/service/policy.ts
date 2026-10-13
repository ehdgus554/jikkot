/** Draft policy: change only after the owner reviews collection/retention copy. */
export const consentPolicy = {
  version: "draft-v1",
  reviewedForLaunch: false,
} as const;
export const operationalPolicy = {
  operatorName: "Jikkot",
  contactEmail: null as string | null,
  retentionPolicy: "untilWithdrawal",
  retentionDays: null as number | null,
  reviewedForLaunch: false,
};
