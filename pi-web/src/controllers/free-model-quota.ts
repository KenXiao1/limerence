export const DEFAULT_FREE_MODEL_ID = "gemini-3-flash-preview";
export const DEFAULT_DAILY_FREE_MODEL_LIMIT = 25;

export type DailyQuotaRecord = {
  day: string;
  count: number;
};

export type QuotaDecision = {
  allowed: boolean;
  next: DailyQuotaRecord;
  remaining: number;
};

export function resolveFreeModelId(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : DEFAULT_FREE_MODEL_ID;
}

export function resolveDailyLimit(raw: string | null | undefined): number {
  if (raw == null) return DEFAULT_DAILY_FREE_MODEL_LIMIT;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_DAILY_FREE_MODEL_LIMIT;
  return value;
}

export function toUtcDayString(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function computeQuotaDecision(
  previous: DailyQuotaRecord | null,
  now: Date,
  dailyLimit: number,
): QuotaDecision {
  const day = toUtcDayString(now);
  const count = previous?.day === day ? Math.max(0, previous.count) : 0;

  if (dailyLimit <= 0) {
    return {
      allowed: true,
      next: { day, count: count + 1 },
      remaining: Number.POSITIVE_INFINITY,
    };
  }

  if (count >= dailyLimit) {
    return {
      allowed: false,
      next: { day, count },
      remaining: 0,
    };
  }

  const nextCount = count + 1;
  return {
    allowed: true,
    next: { day, count: nextCount },
    remaining: Math.max(0, dailyLimit - nextCount),
  };
}
