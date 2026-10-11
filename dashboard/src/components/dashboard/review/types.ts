export type ReviewStatus = "open" | "expected" | "snoozed";

/** What the reviewer did with an item. Local state until the review API exists. */
export interface ReviewEntry {
  status: ReviewStatus;
  snoozeLabel?: string;
  prNumber?: number;
}

export const SNOOZE_OPTIONS = ["1 hour", "1 day", "7 days"] as const;
