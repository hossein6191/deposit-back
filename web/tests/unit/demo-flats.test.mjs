// The six sample flats: every text inside the contract's limits, a clear mix in every report, and
// the rule the demo landlord follows before it signs anything.

import test from "node:test";
import assert from "node:assert/strict";

import { SAMPLE_FLATS, demoReportProblem, offerArgs, reportArgs, sampleFor } from "../../lib/demo-flats.ts";
import { MAX_ADDRESS, MAX_TITLE, MAX_WINDOW, MIN_ADDRESS, MIN_DEPOSIT, MAX_DEPOSIT, MIN_TITLE, MIN_WINDOW, readDeductions, readItems, readMoveout, textProblem } from "../../lib/rules.ts";

test("there are six, each with its own key and title", () => {
  assert.equal(SAMPLE_FLATS.length, 6);
  assert.equal(new Set(SAMPLE_FLATS.map((s) => s.key)).size, 6);
  assert.equal(new Set(SAMPLE_FLATS.map((s) => s.title)).size, 6);
});

for (const s of SAMPLE_FLATS) {
  test(`${s.key}: the offer and the report are what the contract accepts`, () => {
    const [title, address, itemsJson, deposit, moveout, response] = offerArgs(s);
    assert.equal(textProblem(title, MIN_TITLE, MAX_TITLE, "the title"), "");
    assert.equal(textProblem(address, MIN_ADDRESS, MAX_ADDRESS, "the address line"), "");
    assert.equal(readItems(itemsJson).problem, "");
    assert.ok(BigInt(deposit) >= MIN_DEPOSIT && BigInt(deposit) <= MAX_DEPOSIT);
    assert.ok(moveout >= MIN_WINDOW && moveout <= MAX_WINDOW && response >= MIN_WINDOW && response <= MAX_WINDOW);
    const r = reportArgs(s);
    assert.equal(readMoveout(r.moveoutJson, s.items.length).problem, "");
    const d = readDeductions(r.deductionsJson, s.items.length, BigInt(deposit));
    assert.equal(d.problem, "");
    assert.ok(d.total <= BigInt(deposit));
    // every text exactly as stored: no stripping happens, so the copy on chain matches the sample word for word
    for (const it of s.items) assert.equal(it.name, it.name.trim());
  });

  test(`${s.key}: a clear mix of plainly damage, plainly wear, and an item left as found`, () => {
    assert.ok(s.deductions.some((d) => d.expect === "damage"), "at least one damage");
    assert.ok(s.deductions.some((d) => d.expect === "wear"), "at least one wear");
    const deducted = new Set(s.deductions.map((d) => d.item));
    assert.ok(s.items.some((_, k) => !deducted.has(k)), "at least one item with no deduction");
    assert.equal(s.plan.items.length, s.items.length, "a place on the plan for every item");
    assert.ok(s.lesson.length > 20 && s.blurb.length > 20);
  });
}

test("a copy on chain is recognised by its title and its items, word for word", () => {
  const s = SAMPLE_FLATS[2];
  const items = s.items.map((i) => ({ name: i.name, moveIn: i.move_in }));
  assert.equal(sampleFor(s.title, items)?.key, s.key);
  assert.equal(sampleFor(s.title, items.map((i, k) => (k === 0 ? { ...i, moveIn: i.moveIn + " Edited." } : i))), null);
  assert.equal(sampleFor(s.title + "!", items), null);
});

test("the demo landlord files only its own sample copies, after the notice, inside the window, once", () => {
  const s = SAMPLE_FLATS[0];
  const demo = "0x00000000000000000000000000000000000000d1";
  const flat = { landlord: demo, status: "notice", title: s.title, items: s.items.map((i) => ({ name: i.name, moveIn: i.move_in })), depositAtto: s.depositAtto, moveoutEnd: 1000 };
  assert.equal(demoReportProblem(flat, demo, 999), "");
  assert.match(demoReportProblem(flat, "", 999), /offline/);
  assert.match(demoReportProblem({ ...flat, landlord: "0x00000000000000000000000000000000000000e2" }, demo, 999), /not one of the demo landlord's/);
  assert.match(demoReportProblem({ ...flat, status: "let" }, demo, 999), /has not given notice/);
  assert.match(demoReportProblem({ ...flat, status: "reported" }, demo, 999), /already filed/);
  assert.match(demoReportProblem(flat, demo, 1000), /report window has closed/);
  assert.match(demoReportProblem({ ...flat, depositAtto: "1" }, demo, 999), /deposit is not the sample's/);
  assert.match(demoReportProblem({ ...flat, title: "Somewhere else" }, demo, 999), /not a copy of a sample flat/);
});
