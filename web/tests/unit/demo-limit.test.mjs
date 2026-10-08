// The demo landlord's rate limit: per flat, after a report was sent, and in all.

import test from "node:test";
import assert from "node:assert/strict";

import { createLimiter } from "../../lib/demo-limit.ts";

test("one attempt per flat per window, a hold once sent, and a ceiling in all", () => {
  const l = createLimiter({ perKeyMs: 120_000, globalMax: 3, globalWindowMs: 60_000 });
  assert.deepEqual(l.attempt("F1", 0), { ok: true });
  assert.deepEqual(l.attempt("F1", 1000), { ok: false, retryAfter: 119 });
  assert.deepEqual(l.attempt("F1", 120_000), { ok: true });
  l.hold("F1", 600_000, 120_000);
  assert.equal(l.attempt("F1", 300_000).ok, false);
  assert.deepEqual(l.attempt("F2", 130_000), { ok: true });
  assert.deepEqual(l.attempt("F3", 131_000), { ok: true });
  const capped = l.attempt("F4", 132_000);
  assert.equal(capped.ok, false, "the fourth attempt inside a minute waits");
  assert.ok(capped.retryAfter > 0 && capped.retryAfter <= 60);
  assert.deepEqual(l.attempt("F4", 200_000), { ok: true });
});
