// The site against the contract it talks to, read from contracts/deposit_back.py in this repository:
// every write builder names a real write method with the right number of arguments and sends value
// only to the payable one; every view the site reads exists; and every refusal sentence the
// in-memory contract raises is made of the contract's own words.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calls } from "../../lib/calls.ts";

// The contract's source with its escaped quotes read as quotes, so its sentences can be looked up.
const contract = readFileSync(new URL("../../../contracts/deposit_back.py", import.meta.url), "utf8").replace(/\\"/g, '"');
const chainSource = readFileSync(new URL("../../lib/chain.ts", import.meta.url), "utf8");
const mockSource = readFileSync(new URL("../../lib/chain-mock.ts", import.meta.url), "utf8");
const rulesSource = readFileSync(new URL("../../lib/rules.ts", import.meta.url), "utf8");

/** { name: { kind, payable, params } } for every public method of the contract. */
function methods() {
  const out = {};
  const re = /@gl\.public\.(write(?:\.payable)?|view)\s*\n\s*def (\w+)\(self(?:,\s*([^)]*))?\)/g;
  for (const m of contract.matchAll(re)) {
    const params = (m[3] ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    out[m[2]] = { kind: m[1].startsWith("view") ? "view" : "write", payable: m[1].endsWith("payable"), params: params.length };
  }
  return out;
}

test("every write builder names a write method of the contract, with its arguments and its value", () => {
  const all = methods();
  const built = [
    calls.offer("Title here", "Address here", [{ name: "One", moveIn: "x".repeat(20) }], 10n ** 17n, 300, 300),
    calls.withdrawOffer("F1"),
    calls.report("F1", ["x".repeat(20)], []),
    calls.take("F1", 10n ** 17n),
    calls.giveNotice("F1"),
    calls.accept("F1"),
    calls.contest("F1", [1, 0]),
    calls.reclaim("F1"),
    calls.settle("F1"),
  ];
  const writes = Object.entries(all).filter(([, m]) => m.kind === "write").map(([n]) => n).sort();
  assert.deepEqual([...new Set(built.map((c) => c.fn))].sort(), writes, "the site can send every write and nothing else");
  for (const c of built) {
    const m = all[c.fn];
    assert.equal(c.args.length, m.params, `${c.fn} takes ${m.params} arguments`);
    assert.equal(c.value !== undefined, m.payable, `${c.fn} sends value only when payable`);
  }
  assert.equal(calls.contest("F1", [2, 0]).args[1], "[0,2]");
  assert.equal(typeof calls.offer("T", "A", [], 1n, 300, 600).args[4], "number", "windows travel as integers");
});

test("every view the site reads is a view of the contract, and takes only ids, numbers or an address", () => {
  const all = methods();
  const read = [...chainSource.matchAll(/view\("(\w+)"/g)].map((m) => m[1]);
  assert.ok(read.length >= 5);
  for (const name of read) assert.equal(all[name]?.kind, "view", `${name} is a view`);
  for (const [name, m] of Object.entries(all)) if (m.kind === "view") assert.ok(read.includes(name), `the site reads ${name}`);
});

/** Every literal piece (between ${...} holes) of a template, long enough to mean something. */
const pieces = (template) =>
  template
    .split(/\$\{[^}]*\}/)
    .map((p) => p.trim().replace(/^[;:,.]\s*/, ""))
    .filter((p) => p.length >= 8);

test("every refusal the in-memory contract raises is in the contract's own words", () => {
  const raised = [...mockSource.matchAll(/fail\((`[^`]*`|"[^"]*")/g)].map((m) => m[1].slice(1, -1));
  assert.ok(raised.length >= 25, `found ${raised.length} refusals`);
  for (const r of raised) for (const p of pieces(r)) assert.ok(contract.includes(p), `the contract says "${p}"`);
  const refusedTakes = [...mockSource.matchAll(/problem = (`[^`]*`|"[^"]*")/g)].map((m) => m[1].slice(1, -1));
  assert.ok(refusedTakes.length >= 5);
  for (const r of refusedTakes) for (const p of pieces(r)) assert.ok(contract.includes(p), `the contract says "${p}"`);
});

test("every sentence the readers in lib/rules.ts give is in the contract's own words", () => {
  const start = rulesSource.indexOf("// ---- reading the caller");
  const end = rulesSource.indexOf("// ---- what the site sends");
  const said = [...rulesSource.slice(start, end).matchAll(/`([^`]*)`/g)].map((m) => m[1]);
  assert.ok(said.length >= 15);
  for (const r of said) for (const p of pieces(r)) assert.ok(contract.includes(p), `the contract says "${p}"`);
});
