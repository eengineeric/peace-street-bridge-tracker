export type StrikeStatus = "clear" | "struck" | "unknown";

export type DailyRecord = {
  date: string;
  status: StrikeStatus;
  time?: string;
  vehicle?: string;
  notes?: string;
  sourceUrl?: string;
  updatedAt: string;
};
