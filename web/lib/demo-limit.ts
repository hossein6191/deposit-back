// The demo landlord's rate limit: one report attempt per flat every two minutes, a ten-minute hold
// on a flat once its report was sent, and at most a dozen attempts a minute in all. Pure, so node
// runs it in tests/unit; the server route keeps one limiter for as long as its process lives.

export type LimitAnswer = { ok: true } | { ok: false; retryAfter: number };

export type Limiter = {
  /** may `key` try now? Counts the attempt when it may. */
  attempt: (key: string, nowMs: number) => LimitAnswer;
  /** no attempt for `key` until `ms` from now (after a report was sent) */
  hold: (key: string, ms: number, nowMs: number) => void;
};

export function createLimiter(opts: { perKeyMs: number; globalMax: number; globalWindowMs: number }): Limiter {
  const nextFor = new Map<string, number>();
  let recent: number[] = [];
  return {
    attempt(key, nowMs) {
      const until = nextFor.get(key) ?? 0;
      if (until > nowMs) return { ok: false, retryAfter: Math.ceil((until - nowMs) / 1000) };
      recent = recent.filter((t) => nowMs - t < opts.globalWindowMs);
      if (recent.length >= opts.globalMax) return { ok: false, retryAfter: Math.ceil((opts.globalWindowMs - (nowMs - recent[0])) / 1000) };
      recent.push(nowMs);
      nextFor.set(key, nowMs + opts.perKeyMs);
      if (nextFor.size > 5000) {
        for (const [k, t] of nextFor) if (t <= nowMs) nextFor.delete(k);
      }
      return { ok: true };
    },
    hold(key, ms, nowMs) {
      nextFor.set(key, Math.max(nextFor.get(key) ?? 0, nowMs + ms));
    },
  };
}

export const DEMO_LIMITS = { perKeyMs: 120_000, globalMax: 12, globalWindowMs: 60_000, sentHoldMs: 600_000 };
