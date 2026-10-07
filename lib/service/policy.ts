/** Draft policy: change only after the owner reviews collection/retention copy. */
export const consentPolicy = {
  version: "draft-v1",
  reviewedForLaunch: false,
} as const;
export const operationalPolicy = {
  retentionDays: null as number | null,
  reviewedForLaunch: false,
};
