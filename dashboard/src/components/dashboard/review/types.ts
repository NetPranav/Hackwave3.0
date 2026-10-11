export type ReviewStatus = "open" | "expected" | "snoozed";

/** What the reviewer did with an item (live mode also sends it to POST /v1/review). */
export interface ReviewEntry {
  status: ReviewStatus;
  snoozeLabel?: string;
  prNumber?: number;
  prUrl?: string;
  /** why the action failed, shown on the card */
  error?: string;
}

export const SNOOZE_OPTIONS = ["1 hour", "1 day", "7 days"] as const;
