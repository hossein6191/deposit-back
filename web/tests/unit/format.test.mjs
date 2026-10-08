import test from "node:test";
import assert from "node:assert/strict";

import { gen, genText, share, span, toAtto, tryAtto, windowLabel } from "../../lib/format.ts";

const GEN = 10n ** 18n;

test("amounts", () => {
  assert.equal(gen(GEN), "1 GEN");
  assert.equal(gen((55n * GEN) / 100n), "0.55 GEN");
  assert.equal(gen("150000000000000000"), "0.15 GEN");
  assert.equal(gen(1n), "<0.0001 GEN");
  assert.equal(gen("junk"), "? GEN");
  assert.equal(toAtto("0.25"), GEN / 4n);
  assert.equal(toAtto("12"), 12n * GEN);
  assert.equal(tryAtto("1,5"), null);
  assert.equal(tryAtto("-1"), null);
  assert.equal(genText((3n * GEN) / 10n), "0.3");
  assert.equal(share(GEN / 4n, GEN), 25);
  assert.equal(share(2n * GEN, GEN), 100);
  assert.equal(share(1n, 0n), 0);
});

test("times", () => {
  assert.equal(span(0), "0 s");
  assert.equal(span(59), "59 s");
  assert.equal(span(125), "2 min 5 s");
  assert.equal(span(7200), "2 h");
  assert.equal(span(90061), "1 d 1 h");
  assert.equal(windowLabel(7200), "2 hours");
  assert.equal(windowLabel(86400), "1 day");
  assert.equal(windowLabel(1800), "30 minutes");
});
