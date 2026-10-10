// The landlord's one-click suggestions: every title, address, deposit, item, move-out note, reason
// and amount a chip can fill is something the contract accepts, for any item name it may be built from.

import test from "node:test";
import assert from "node:assert/strict";

import { SAMPLE_FLATS } from "../../lib/demo-flats.ts";
import {
  MAX_ADDRESS,
  MAX_DEPOSIT,
  MAX_ITEMS,
  MAX_NAME,
  MAX_NOTE,
  MAX_REASON,
  MAX_TITLE,
  MIN_ADDRESS,
  MIN_DEPOSIT,
  MIN_NAME,
  MIN_NOTE,
  MIN_REASON,
  MIN_TITLE,
  plain,
  readDeductions,
  readItems,
  readMoveout,
  textProblem,
} from "../../lib/rules.ts";
import { tryAtto } from "../../lib/format.ts";
import {
  ADDRESS_SUGGESTIONS,
  AMOUNT_SUGGESTIONS,
  DEPOSIT_SUGGESTIONS,
  ITEM_SUGGESTIONS,
  NOTE_KINDS,
  REASON_KINDS,
  REASONS_FOR,
  TITLE_SUGGESTIONS,
  deductionReason,
  inSentence,
  moveOutNote,
  reasonsFor,
} from "../../lib/suggestions.ts";

const GEN = 10n ** 18n;
/** Stored exactly as suggested: the form's plain() and the contract's strip change nothing. */
const asIs = (t) => assert.equal(plain(t), t, `"${t}" is sent as it is`);

test("eight titles and eight address lines, each inside the contract's limits and no sample flat's", () => {
  assert.equal(TITLE_SUGGESTIONS.length, 8);
  assert.equal(ADDRESS_SUGGESTIONS.length, 8);
  assert.equal(new Set(TITLE_SUGGESTIONS).size, 8);
  assert.equal(new Set(ADDRESS_SUGGESTIONS).size, 8);
  const sampleTitles = new Set(SAMPLE_FLATS.map((s) => s.title));
  for (const t of TITLE_SUGGESTIONS) {
    assert.equal(textProblem(t, MIN_TITLE, MAX_TITLE, "the title"), "");
    assert.ok(!sampleTitles.has(t), `${t} is not a sample's title`);
    asIs(t);
  }
  for (const a of ADDRESS_SUGGESTIONS) {
    assert.equal(textProblem(a, MIN_ADDRESS, MAX_ADDRESS, "the address line"), "");
    asIs(a);
  }
});

test("deposits of 0.5, 1, 1.5, 2 and 3 GEN, each inside the contract's limits", () => {
  assert.deepEqual(DEPOSIT_SUGGESTIONS, ["0.5", "1", "1.5", "2", "3"]);
  for (const v of DEPOSIT_SUGGESTIONS) {
    const atto = tryAtto(v);
    assert.ok(atto !== null && atto >= MIN_DEPOSIT && atto <= MAX_DEPOSIT, `${v} GEN`);
  }
});

test("twenty-four common items, each a name and a move-in note the contract accepts", () => {
  assert.equal(ITEM_SUGGESTIONS.length, 24);
  assert.equal(new Set(ITEM_SUGGESTIONS.map((s) => s.name.toLowerCase())).size, 24, "every name its own");
  for (const s of ITEM_SUGGESTIONS) {
    assert.equal(textProblem(s.name, MIN_NAME, MAX_NAME, "the name"), "");
    assert.equal(textProblem(s.moveIn, MIN_NOTE, MAX_NOTE, "the move-in note"), "");
    asIs(s.name);
    asIs(s.moveIn);
  }
  // Any eight of them make a flat the contract takes.
  const items = ITEM_SUGGESTIONS.slice(0, MAX_ITEMS).map((s) => ({ name: s.name, move_in: s.moveIn }));
  assert.equal(readItems(JSON.stringify(items)).problem, "");
  const last = ITEM_SUGGESTIONS.slice(-MAX_ITEMS).map((s) => ({ name: s.name, move_in: s.moveIn }));
  assert.equal(readItems(JSON.stringify(last)).problem, "");
});

// The shortest and the longest names the contract allows, and the names of every sample and suggestion.
const NAMES = [
  "Hob",
  "x".repeat(MAX_NAME),
  "TV unit",
  "A very long name for an item, forty chr",
  ...ITEM_SUGGESTIONS.map((s) => s.name),
  ...SAMPLE_FLATS.flatMap((s) => s.items.map((i) => i.name)),
];

test("every move-out chip, for every item name, writes a note the contract accepts", () => {
  assert.deepEqual(
    NOTE_KINDS.map((n) => n.label),
    ["No change from move-in", "Light scuffs", "Small burn mark", "Crack", "Stain", "Faded", "Missing", "Broken"],
  );
  for (const name of NAMES) {
    assert.ok(name.length >= MIN_NAME && name.length <= MAX_NAME, name);
    for (const { kind } of NOTE_KINDS) {
      const note = moveOutNote(kind, name);
      assert.equal(textProblem(note, MIN_NOTE, MAX_NOTE, "the note"), "", `${kind} for ${name}`);
      asIs(note);
    }
  }
  const notes = NOTE_KINDS.map((n) => moveOutNote(n.kind, "Kitchen worktop"));
  assert.equal(readMoveout(JSON.stringify(notes), notes.length).problem, "");
  assert.match(moveOutNote("burn", "Kitchen worktop"), /burn mark .* on the kitchen worktop/);
  assert.equal(inSentence("TV unit"), "TV unit");
  assert.equal(inSentence("Oven"), "oven");
});

test("every reason chip, after every move-out chip and after a note written by hand, writes a reason the contract accepts", () => {
  assert.deepEqual(REASON_KINDS.map((r) => r.label), ["Repaint", "Replace", "Deep clean", "Repair", "Refinish"]);
  for (const name of NAMES)
    for (const note of [...NOTE_KINDS.map((n) => n.kind), ""])
      for (const { kind } of REASON_KINDS) {
        const reason = deductionReason(kind, note, name);
        assert.equal(textProblem(reason, MIN_REASON, MAX_REASON, "the reason"), "", `${kind} after ${note || "a hand-written note"} for ${name}`);
        asIs(reason);
      }
  // The reasons offered follow the note: something missing is only ever replaced; a hand-written note gets all five.
  assert.deepEqual(reasonsFor("missing"), ["replace"]);
  assert.deepEqual(reasonsFor(""), REASON_KINDS.map((r) => r.kind));
  for (const note of NOTE_KINDS) assert.ok(REASONS_FOR[note.kind].length >= 1);
  assert.match(deductionReason("repair", "crack", "Bathroom mirror"), /^Repairing the bathroom mirror .*the crack/);
});

test("amount chips of 0.05 to 0.5 GEN; six of them on one deposit never pass it unless the chips allow it", () => {
  assert.deepEqual(AMOUNT_SUGGESTIONS, ["0.05", "0.1", "0.2", "0.3", "0.5"]);
  const attos = AMOUNT_SUGGESTIONS.map((v) => tryAtto(v));
  for (const a of attos) assert.ok(a !== null && a >= 1n && a < GEN);
  // The form greys out a chip above what the other lines leave; a report built that way always passes.
  const deposit = GEN / 2n;
  let left = deposit;
  const deductions = [];
  for (let item = 0; item < 6; item++) {
    const pick = [...attos].reverse().find((a) => a <= left);
    if (pick === undefined) break;
    left -= pick;
    deductions.push({ item, amount: pick.toString(), reason: deductionReason("repair", "crack", "Kitchen worktop") });
  }
  const read = readDeductions(JSON.stringify(deductions), 6, deposit);
  assert.equal(read.problem, "");
  assert.ok(read.total <= deposit);
});
