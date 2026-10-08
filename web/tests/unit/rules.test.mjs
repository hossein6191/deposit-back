// The contract's rules in lib/rules.ts, which the forms and the in-memory contract are built on.

import test from "node:test";
import assert from "node:assert/strict";

import {
  combine,
  hasFraction,
  parseFlatId,
  payeeOf,
  phaseOf,
  plain,
  readDeductions,
  readIndices,
  readItems,
  readMoveout,
  readVector,
  sentence,
  splitOf,
  textProblem,
  vectorOf,
  whole,
  numberArg,
  pyStrip,
} from "../../lib/rules.ts";

const GEN = 10n ** 18n;

test("two framings into one word: yes then no is damage, no then yes is wear, anything else unclear", () => {
  assert.equal(combine("yes", "no"), "damage");
  assert.equal(combine("no", "yes"), "wear");
  for (const [a, b] of [["yes", "yes"], ["no", "no"], ["unclear", "no"], ["yes", ""], ["", ""], ["unclear", "unclear"]]) assert.equal(combine(a, b), "unclear");
});

test("damage and every untested deduction go to the landlord; wear and unclear go back to the tenant", () => {
  assert.equal(payeeOf("damage"), "landlord");
  for (const o of ["uncontested", "accepted", "unanswered"]) assert.equal(payeeOf(o), "landlord");
  assert.equal(payeeOf("wear"), "tenant");
  assert.equal(payeeOf("unclear"), "tenant");
  assert.equal(payeeOf(""), "");
});

test("every ending pays out exactly the deposit, split two ways", () => {
  const amounts = [3n * GEN / 10n, 2n * GEN / 10n, 15n * GEN / 100n, 25n * GEN / 100n];
  const s = splitOf(GEN, amounts, ["tenant", "landlord", "tenant", "landlord"]);
  assert.equal(s.landlord, 45n * GEN / 100n);
  assert.equal(s.tenant, 55n * GEN / 100n);
  assert.equal(s.landlord + s.tenant, GEN);
  assert.deepEqual(splitOf(GEN, [], []), { tenant: GEN, landlord: 0n });
});

test("the vector reads back exactly, and junk reads as nothing", () => {
  const v = vectorOf([["D1", "wear"], ["D2", "damage"], ["D3", "unclear"]]);
  assert.equal(v, "D1:wear,D2:damage,D3:unclear");
  assert.deepEqual(readVector(v), { D1: "wear", D2: "damage", D3: "unclear" });
  assert.deepEqual(readVector("D1:maybe,junk"), {});
  assert.deepEqual(readVector(""), {});
});

test("the phase on the clock, as the contract computes it", () => {
  assert.equal(phaseOf("open", 0, 0, 100), "take");
  assert.equal(phaseOf("let", 0, 0, 100), "notice");
  assert.equal(phaseOf("notice", 200, 0, 199), "report");
  assert.equal(phaseOf("notice", 200, 0, 200), "reclaim");
  assert.equal(phaseOf("reported", 0, 500, 499), "answer");
  assert.equal(phaseOf("reported", 0, 500, 500), "settle");
  assert.equal(phaseOf("notice", 200, 0, 0), "unknown");
  for (const s of ["withdrawn", "reclaimed", "clean", "accepted", "judged", "settled"]) assert.equal(phaseOf(s, 1, 1, 9), "closed");
});

test("texts: the contract's lengths in code points, printable ASCII on one line", () => {
  assert.equal(textProblem("ab", 3, 60, "the title"), "the title is 3 to 60 characters; this one is 2");
  assert.equal(textProblem("abc", 3, 60, "the title"), "");
  assert.equal(textProblem("café bar", 3, 60, "the title"), "the title is printable ASCII on one line");
  assert.equal(textProblem("a\nbc", 3, 60, "the title"), "the title is printable ASCII on one line");
  // one emoji is one character to Python, two UTF-16 units to JavaScript
  assert.equal(textProblem("ab\u{1F600}", 4, 60, "the title"), "the title is 4 to 60 characters; this one is 3");
  assert.equal(pyStrip("\x1c  x 　"), "x");
  assert.equal(plain("  “Two”   scuffs – near\nthe switch… "), '"Two" scuffs - near the switch...');
});

test("JSON with a fraction or an exponent is unreadable, as with the contract's parse hooks", () => {
  assert.equal(hasFraction('[{"item": 0, "amount": "1.5"}]'), false, "inside a string it is text");
  assert.equal(hasFraction('[{"item": 0, "amount": 1.5}]'), true);
  assert.equal(hasFraction('[{"item": 0, "amount": 1e18}]'), true);
  assert.equal(hasFraction('[true, false, null]'), false);
  assert.equal(whole(" 42 "), 42n);
  assert.equal(whole("4.2"), -1n);
  assert.equal(numberArg(true), -1n);
  assert.equal(numberArg(7), 7n);
  assert.equal(numberArg("12"), 12n);
  assert.equal(numberArg(-1), -1n);
});

test("items: two to eight, each a name and a move-in note, every name its own", () => {
  const note = "Freshly painted white throughout, no marks.";
  assert.equal(readItems(JSON.stringify([{ name: "Walls", move_in: note }, { name: "Floor", move_in: note }])).problem, "");
  assert.match(readItems(JSON.stringify([{ name: "Walls", move_in: note }])).problem, /JSON list of 2 to 8 objects/);
  assert.equal(
    readItems(JSON.stringify([{ name: "Walls", move_in: note }, { name: "walls", move_in: note }])).problem,
    "two items are named walls; every item has a name of its own",
  );
  assert.equal(readItems(JSON.stringify([{ name: "Walls", move_in: note, extra: 1 }, { name: "Floor", move_in: note }])).problem, "item 0 is an object with exactly a name and a move_in note");
  assert.equal(readItems(JSON.stringify([{ name: "Walls", move_in: "short" }, { name: "Floor", move_in: note }])).problem, "the move-in note of item 0 is 20 to 400 characters; this one is 5");
});

test("move-out notes: one per item, in order", () => {
  const note = "Two small scuffs near the light switch.";
  assert.equal(readMoveout(JSON.stringify([note, note]), 2).problem, "");
  assert.match(readMoveout(JSON.stringify([note]), 2).problem, /JSON list of 2 strings/);
  assert.match(readMoveout(JSON.stringify([note, 3]), 2).problem, /JSON list of 2 strings/);
});

test("deductions: at most six, one per item, whole atto, a reason, no more than the deposit", () => {
  const reason = "Repainting the wall to remove the scuffs.";
  const ok = readDeductions(JSON.stringify([{ item: 0, amount: "300", reason }, { item: 1, amount: 200, reason }]), 3, 1000n);
  assert.equal(ok.problem, "");
  assert.equal(ok.total, 500n);
  assert.deepEqual(ok.deductions.map((d) => d.amount), ["300", "200"]);
  assert.equal(readDeductions(JSON.stringify([{ item: 0, amount: "1", reason }, { item: 0, amount: "1", reason }]), 3, 1000n).problem, "item 0 has two deductions; one deduction per item");
  assert.equal(readDeductions(JSON.stringify([{ item: 3, amount: "1", reason }]), 3, 1000n).problem, "the item of deduction 0 is an index from 0 to 2");
  assert.equal(readDeductions(JSON.stringify([{ item: true, amount: "1", reason }]), 3, 1000n).problem, "the item of deduction 0 is an index from 0 to 2");
  assert.equal(readDeductions(JSON.stringify([{ item: 0, amount: "0", reason }]), 3, 1000n).problem, "the amount of deduction 0 is a whole number of atto, at least 1");
  assert.equal(readDeductions(JSON.stringify([{ item: 0, amount: "2000", reason }]), 3, 1000n).problem, "the deductions add up to 2000 atto, more than the deposit of 1000");
  assert.equal(readDeductions("[]", 3, 1000n).problem, "");
  const seven = Array.from({ length: 7 }, (_, k) => ({ item: k, amount: "1", reason }));
  assert.match(readDeductions(JSON.stringify(seven), 8, 1000n).problem, /at most 6 objects/);
});

test("contested indices: non-empty, each once, in range, sorted", () => {
  assert.deepEqual(readIndices("[2, 0, 1]", 4), { picked: [0, 1, 2], problem: "" });
  for (const bad of ["[]", "[0, 0]", "[4]", "[-1]", "[true]", "[0.5]", "nope", "{}"]) assert.notEqual(readIndices(bad, 4).problem, "", bad);
});

test("flat ids and sentences", () => {
  assert.equal(parseFlatId("F12"), "F12");
  assert.equal(parseFlatId("f7"), "F7");
  assert.equal(parseFlatId("7"), "F7");
  for (const bad of ["F0", "F-1", "X3", "", "F1234567890", "%E0%A4%A"]) assert.equal(parseFlatId(bad), "", bad);
  assert.equal(sentence("[EXPECTED] only the tenant of F1 may give notice"), "Only the tenant of F1 may give notice.");
});
