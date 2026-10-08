// The floor plans: every item has a marker inside its own room, every door joins two rooms that
// touch, and a plan can be drawn for any flat from its items alone.

import test from "node:test";
import assert from "node:assert/strict";

import { SAMPLE_FLATS } from "../../lib/demo-flats.ts";
import { buildPlan, genericSpec, guessKind, itemStates, planForFlat, planSvg, strongest } from "../../lib/plans.ts";

const inside = (m, r) => m.x > r.x && m.x < r.x + r.w && m.y > r.y && m.y < r.y + r.h;

for (const s of SAMPLE_FLATS) {
  test(`${s.key}: one marker per item, inside its room; a door for every pair; walls all round`, () => {
    const plan = buildPlan(s.plan);
    assert.equal(plan.markers.length, s.items.length);
    for (const m of plan.markers) assert.ok(inside(m, plan.rooms.find((r) => r.id === m.room)), `item ${m.item} sits in ${m.room}`);
    for (let a = 0; a < plan.markers.length; a++)
      for (let b = a + 1; b < plan.markers.length; b++)
        assert.ok(Math.hypot(plan.markers[a].x - plan.markers[b].x, plan.markers[a].y - plan.markers[b].y) >= 20, "markers do not overlap");
    assert.equal(plan.doors.filter((d) => !d.entry).length, s.plan.doors.length, "every door found its shared wall");
    assert.equal(plan.doors.filter((d) => d.entry).length, 1, "one front door");
    assert.ok(plan.outer.length >= 4);
    assert.ok(plan.windows.length >= 2);
    const svg = planSvg(plan, itemStates(s.items.length, s.deductions.map((d, index) => ({ item: d.item, index, verdict: d.expect }))));
    assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ \d+"/);
    assert.ok(!/NaN|undefined/.test(svg));
  });
}

test("any flat gets a plan from its items, two to eight of them", () => {
  for (let n = 2; n <= 8; n++) {
    const items = Array.from({ length: n }, (_, k) => ({ name: ["Oven", "Sofa", "Mirror", "Bed", "Desk", "Fence", "Table", "Carpet"][k] }));
    const plan = buildPlan(genericSpec(items));
    assert.equal(plan.markers.length, n);
    for (const m of plan.markers) assert.ok(inside(m, plan.rooms.find((r) => r.id === m.room)));
    assert.equal(plan.doors.filter((d) => !d.entry).length, n, `${n} items: a door from the hall into every room`);
  }
  assert.equal(guessKind("Kitchen worktop"), "kitchen");
  assert.equal(guessKind("Bathroom mirror"), "bath");
  assert.equal(guessKind("Mattress"), "bed");
  assert.equal(guessKind("Front door"), "living");
});

test("a copy of a sample keeps the sample's own plan", () => {
  const s = SAMPLE_FLATS[5];
  const plan = planForFlat(s.title, s.items.map((i) => ({ name: i.name, moveIn: i.move_in })));
  assert.deepEqual(plan.rooms.map((r) => r.label), s.plan.rooms.map((r) => r.label));
});

test("the state of each item, and which state a room shows", () => {
  const deductions = [
    { item: 0, index: 0, verdict: "wear" },
    { item: 1, index: 1, verdict: "" },
    { item: 2, index: 2, verdict: "" },
    { item: 3, index: 3, verdict: "uncontested" },
  ];
  assert.deepEqual(itemStates(5, deductions, new Set([2])), ["wear", "deducted", "contested", "deducted", "untouched"]);
  assert.equal(strongest(["wear", "damage", "untouched"]), "damage");
  assert.equal(strongest([]), "untouched");
});
