// The whole tenancy through the in-memory contract of mock mode, from node, with no browser:
//
//   node --test tests/unit/mock-flow.test.mjs
//
// A visitor takes a sample flat, gives notice, the demo landlord files the scripted move-out
// report, and the visitor contests: the money moves in the same call, damage to the landlord and
// wear back to the tenant. On the way the refusals a visitor can meet are walked too, each with
// its way out, and after every step no atto is created or lost.

import test from "node:test";
import assert from "node:assert/strict";

import * as mock from "../../lib/chain-mock.ts";
import { calls } from "../../lib/calls.ts";
import { sampleByKey, reportArgs } from "../../lib/demo-flats.ts";

const GEN = 10n ** 18n;
const ACCOUNTS = [mock.VISITOR, mock.DEMO_LANDLORD, mock.MY_LANDLORD, mock.EARLIER_TENANT, mock.PASSER_BY];

/** Every atto in the mock world: the accounts plus the contract's own balance. */
async function world() {
  let sum = mock.mockContractBalance();
  for (const a of ACCOUNTS) sum += await mock.balanceOf(a);
  return sum;
}

/** The contract holds exactly the deposits of its running tenancies, and nothing was created or lost. */
async function conserved(total, step) {
  const { held, balance } = mock.mockHeld();
  assert.equal(held, balance, `${step}: the contract's balance equals what it says it holds`);
  assert.equal(await world(), total, `${step}: no atto created or lost`);
}

async function finalOf(hash) {
  for (let i = 0; i < 40; i++) {
    const s = await mock.txStatus(hash);
    if (s.status === "FINALIZED") return s;
  }
  throw new Error("never finalized: " + hash);
}

async function send(as, call) {
  mock.setMockPersona(as);
  return finalOf(await mock.write(call));
}

const view = async (fn, args) => JSON.parse(await mock.view(fn, args));

async function openCopyOf(key) {
  const sample = sampleByKey(key);
  const page = await view("flats", [0, 20]);
  const row = page.rows.find((r) => r.status === "open" && r.title === sample.title && r.landlord === mock.DEMO_LANDLORD);
  assert.ok(row, `an open copy of ${key} is offered by the demo landlord`);
  return { id: row.flat, sample };
}

test("take, notice, the demo landlord's report, and a contest: the money moves with the verdict", async () => {
  const total = await world();
  await conserved(total, "seeded");
  const { id, sample } = await openCopyOf("bakery");
  const deposit = BigInt(sample.depositAtto);
  const visitorBefore = await mock.balanceOf(mock.VISITOR);
  const landlordBefore = await mock.balanceOf(mock.DEMO_LANDLORD);

  // take: exactly the deposit
  const take = await send(mock.VISITOR, calls.take(id, deposit));
  assert.equal(take.exec, "SUCCESS");
  assert.equal(take.result.ok, true);
  assert.equal(take.result.status, "let");
  assert.equal(await mock.balanceOf(mock.VISITOR), visitorBefore - deposit);
  let flat = await view("flat", [id]);
  assert.equal(flat.tenant, mock.VISITOR);
  assert.equal(flat.held, sample.depositAtto);
  assert.equal(flat.phase, "notice");
  await conserved(total, "take");

  // the demo landlord will not report before the notice
  const early = await mock.demoReport(id);
  assert.equal(early.ok, false);
  assert.match(early.reason, /has not given notice/);

  // notice
  const notice = await send(mock.VISITOR, calls.giveNotice(id));
  assert.equal(notice.result.status, "notice");
  flat = await view("flat", [id]);
  assert.equal(flat.phase, "report");
  assert.ok(flat.moveout_end > flat.notice_at);
  await conserved(total, "notice");

  // the demo landlord files the scripted report
  const answer = await mock.demoReport(id);
  assert.equal(answer.ok, true, answer.reason);
  const report = await finalOf(answer.hash);
  assert.equal(report.result.status, "reported");
  assert.equal(report.result.deductions, sample.deductions.length);
  flat = await view("flat", [id]);
  assert.equal(flat.phase, "answer");
  assert.deepEqual(flat.items.map((i) => i.move_out), sample.moveOut);
  assert.equal(flat.deductions.length, 4);
  assert.ok(flat.deductions.every((d) => d.verdict === "" && d.to === ""));
  await conserved(total, "report");

  // asked again, it refuses: the report is filed
  const again = await mock.demoReport(id);
  assert.equal(again.ok, false);
  assert.match(again.reason, /already filed/);

  // a stranger cannot answer for the tenant
  const stranger = await send(mock.PASSER_BY, calls.contest(id, [0]));
  assert.equal(stranger.exec, "ERROR");
  assert.match(stranger.message, /only the tenant of F\d+ may contest its report/);

  // contest the wall, the worktop and the carpet; leave the mirror
  const contest = await send(mock.VISITOR, calls.contest(id, [2, 0, 1]));
  assert.equal(contest.exec, "SUCCESS");
  assert.equal(contest.result.status, "judged");
  assert.equal(contest.result.verdict, "D1:wear,D2:damage,D3:wear");
  assert.deepEqual(
    contest.result.results.map((r) => `${r.verdict}>${r.to}`),
    ["wear>tenant", "damage>landlord", "wear>tenant", "uncontested>landlord"],
  );
  assert.equal(contest.result.paid_tenant, String((55n * GEN) / 100n));
  assert.equal(contest.result.paid_landlord, String((45n * GEN) / 100n));
  assert.equal(await mock.balanceOf(mock.VISITOR), visitorBefore - deposit + (55n * GEN) / 100n);
  assert.equal(await mock.balanceOf(mock.DEMO_LANDLORD), landlordBefore + (45n * GEN) / 100n);
  flat = await view("flat", [id]);
  assert.equal(flat.status, "judged");
  assert.equal(flat.phase, "closed");
  assert.equal(flat.held, "0");
  assert.deepEqual(flat.contested, [0, 1, 2]);
  await conserved(total, "contest");

  // a contest is final
  const twice = await send(mock.VISITOR, calls.contest(id, [3]));
  assert.equal(twice.exec, "ERROR");
  assert.match(twice.message, /only a filed report can be contested, once/);
  await conserved(total, "second contest");
});

test("before any clock moves, the landlord's own report: a stranger is refused, a report over the deposit is refused, a clean one returns everything", async () => {
  const total = await world();
  const sample = sampleByKey("harbour");
  // F19 belongs to "You, a landlord" and its tenant gave notice when the mock was seeded.
  const f19 = await view("flat", ["F19"]);
  assert.equal(f19.landlord, mock.MY_LANDLORD);
  assert.equal(f19.status, "notice");
  const notes = JSON.stringify(f19.items.map(() => "Left exactly as at move-in, clean and in working order throughout."));
  const stranger = await send(mock.PASSER_BY, { fn: "report", args: ["F19", notes, "[]"] });
  assert.match(stranger.message, /only the landlord of F19 may file its move-out report/);
  const over = await send(mock.MY_LANDLORD, {
    fn: "report",
    args: ["F19", notes, JSON.stringify([{ item: 0, amount: "5000000000000000000", reason: "Replacing the whole oven after the move-out." }])],
  });
  assert.match(over.message, /more than the deposit/);
  const float = await send(mock.MY_LANDLORD, {
    fn: "report",
    args: ["F19", notes, '[{"item": 0, "amount": 1.5, "reason": "Replacing the whole oven after the move-out."}]'],
  });
  assert.match(float.message, /the deductions are a JSON list/);
  const before = await mock.balanceOf(mock.EARLIER_TENANT);
  const clean = await send(mock.MY_LANDLORD, { fn: "report", args: ["F19", notes, "[]"] });
  assert.equal(clean.result.status, "clean");
  assert.equal(await mock.balanceOf(mock.EARLIER_TENANT), before + BigInt(f19.deposit));
  await conserved(total, "clean report");
  // reportArgs of a sample are what the demo landlord signs: valid JSON of the contract's shape
  const r = reportArgs(sample);
  assert.equal(JSON.parse(r.moveoutJson).length, sample.items.length);
  assert.ok(JSON.parse(r.deductionsJson).every((d) => Object.keys(d).sort().join() === "amount,item,reason"));
});

test("a refused take returns what was sent in the same call, and the visitor can still take it right", async () => {
  const total = await world();
  const { id, sample } = await openCopyOf("canal");
  const deposit = BigInt(sample.depositAtto);
  const before = await mock.balanceOf(mock.VISITOR);
  const half = await send(mock.VISITOR, calls.take(id, deposit / 2n));
  assert.equal(half.exec, "SUCCESS");
  assert.equal(half.result.ok, false);
  assert.match(half.result.reason, /send exactly the deposit/);
  assert.equal(half.result.returned, String(deposit / 2n));
  assert.equal(await mock.balanceOf(mock.VISITOR), before);
  await conserved(total, "refused take");
  // the way out: send exactly the deposit
  const right = await send(mock.VISITOR, calls.take(id, deposit));
  assert.equal(right.result.ok, true);
  // the landlord may not take its own flat; the refusal also returns the value
  const { id: other } = await openCopyOf("canal");
  const own = await send(mock.DEMO_LANDLORD, calls.take(other, deposit));
  assert.equal(own.result.ok, false);
  assert.match(own.result.reason, /may not take it/);
  // a flat somebody already took is refused, and refunded
  const late = await send(mock.EARLIER_TENANT, calls.take(id, deposit));
  assert.equal(late.result.ok, false);
  assert.match(late.result.reason, /is let and cannot be taken/);
  await conserved(total, "takes");
});

test("a landlord who never reports: once the window closes anyone reclaims the whole deposit", async () => {
  const total = await world();
  const { id, sample } = await openCopyOf("loft");
  const deposit = BigInt(sample.depositAtto);
  await send(mock.VISITOR, calls.take(id, deposit));
  await send(mock.VISITOR, calls.giveNotice(id));
  const tooEarly = await send(mock.PASSER_BY, calls.reclaim(id));
  assert.equal(tooEarly.exec, "ERROR");
  assert.match(tooEarly.message, /may still report, for \d+ seconds/);
  const before = await mock.balanceOf(mock.VISITOR);
  mock.advanceClock(sample.moveoutSeconds + 1);
  // too late for the demo landlord, and the reason names the way out
  const late = await mock.demoReport(id);
  assert.equal(late.ok, false);
  assert.match(late.reason, /reclaim/);
  const r = await send(mock.PASSER_BY, calls.reclaim(id));
  assert.equal(r.result.status, "reclaimed");
  assert.equal(r.result.paid_tenant, sample.depositAtto);
  assert.equal(await mock.balanceOf(mock.VISITOR), before + deposit);
  await conserved(total, "reclaim");
});

test("a tenant who never answers: once the window closes anyone settles it as filed", async () => {
  const total = await world();
  const { id, sample } = await openCopyOf("station");
  const deposit = BigInt(sample.depositAtto);
  await send(mock.VISITOR, calls.take(id, deposit));
  await send(mock.VISITOR, calls.giveNotice(id));
  const a = await mock.demoReport(id);
  assert.equal(a.ok, true, a.reason);
  await finalOf(a.hash);
  const early = await send(mock.PASSER_BY, calls.settle(id));
  assert.match(early.message, /may still answer, for \d+ seconds/);
  mock.advanceClock(sample.responseSeconds + 1);
  const accept = await send(mock.VISITOR, calls.accept(id));
  assert.match(accept.message, /response window of F\d+ closed; settle\(F\d+\) closes it as filed/);
  const s = await send(mock.PASSER_BY, calls.settle(id));
  assert.equal(s.result.status, "settled");
  const deducted = sample.deductions.reduce((x, d) => x + BigInt(d.amount), 0n);
  assert.equal(s.result.paid_landlord, String(deducted));
  assert.equal(s.result.paid_tenant, String(deposit - deducted));
  await conserved(total, "settle");
});

test("the views answer in the contract's shapes", async () => {
  const stats = await view("stats", []);
  for (const k of ["flats", "taken", "active", "judged", "damage", "wear", "unclear", "held", "paid_to_tenants", "paid_to_landlords", "refused_takes"])
    assert.ok(k in stats, k);
  const page = await view("flats", [0, 50]);
  assert.equal(page.limit, 20, "a page is at most 20 rows whatever is asked");
  const none = await view("flat", ["F999"]);
  assert.equal(none.error, "no flat F999");
  const mine = await view("flats_of", [mock.VISITOR.toUpperCase().replace("0X", "0x")]);
  assert.ok(mine.tenant.length >= 1);
  const rules = await view("rules", []);
  assert.deepEqual(rules.combine, { "yes then no": "damage", "no then yes": "wear", "anything else": "unclear" });
});
