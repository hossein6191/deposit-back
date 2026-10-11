// The waiting words of lib/guide.ts, for every state and every role, from node with no browser: each
// in-between state of a flat says what is happening and who it waits for, how long or until when,
// what is needed from the viewer, whether they can close the page, and where the deposit is; each
// settled flat says nothing is left to do and where every part of the deposit went. Then the main
// flow through the in-memory contract (take, notice, the demo landlord's report, a contest, the
// verdict), and the two clock endings (reclaim, settle), with the guide asked at every step.

import test from "node:test";
import assert from "node:assert/strict";

import { KICKERS, NOTHING_LEFT, NOTHING_NEEDED, flatGuide, flatLine, offerGuide, signGuide } from "../../lib/guide.ts";
import { clockTime, gen } from "../../lib/format.ts";
import * as mock from "../../lib/chain-mock.ts";
import { calls } from "../../lib/calls.ts";
import { sampleByKey } from "../../lib/demo-flats.ts";

const GEN = 10n ** 18n;
const NOW = 1_800_000_000;
const ROLES = ["tenant", "landlord", "other"];

/** Every guide has all five answers, in words, and a kicker. */
function complete(g, where) {
  assert.ok(g, `${where}: a guide`);
  for (const k of ["id", "kicker", "now", "time", "need", "leave", "money"]) assert.ok(typeof g[k] === "string" && g[k].trim().length > 0, `${where}: ${k} is said`);
  assert.equal(typeof g.canLeave, "boolean", `${where}: whether to stay is said`);
  assert.ok(["busy", "clock", "late", "ready", "done"].includes(g.tone), `${where}: a known tone`);
  assert.ok(!/undefined|NaN|null/.test(JSON.stringify(g)), `${where}: no missing value printed`);
  if (g.canLeave) assert.match(g.leave, /You can close this page/, `${where}: says plainly that the page can be closed`);
  else assert.match(g.leave, /^Stay/, `${where}: says plainly to stay`);
}

const flat = (over = {}) => ({
  role: "tenant",
  now: NOW,
  id: "F12",
  status: "let",
  depositAtto: GEN.toString(),
  deductedAtto: "0",
  moveoutSeconds: 600,
  responseSeconds: 600,
  moveoutEnd: 0,
  responseEnd: 0,
  paidTenantAtto: "0",
  paidLandlordAtto: "0",
  ...over,
});

const REPORTED = { status: "reported", deductedAtto: (GEN * 3n / 10n).toString(), moveoutEnd: NOW - 100, responseEnd: NOW + 600 };
const STATES = {
  "to-let": { status: "open" },
  let: {},
  report: { status: "notice", moveoutEnd: NOW + 600 },
  "demo-asking": { status: "notice", moveoutEnd: NOW + 600, demo: true, demoState: "asking" },
  "demo-filing": { status: "notice", moveoutEnd: NOW + 600, demo: true, demoState: "filing" },
  "demo-failed": { status: "notice", moveoutEnd: NOW + 600, demo: true, demoState: "failed", demoReason: "The demo landlord is resting." },
  "demo-offline": { status: "notice", moveoutEnd: NOW + 600, demo: true, demoState: "offline", demoReason: "No key is set." },
  "demo-idle": { status: "notice", moveoutEnd: NOW + 600, demo: true, demoState: "idle" },
  reclaim: { status: "notice", moveoutEnd: NOW - 1 },
  answer: REPORTED,
  settle: { ...REPORTED, responseEnd: NOW - 1 },
  "closed-reclaimed": { status: "reclaimed", paidTenantAtto: GEN.toString(), settledAt: NOW - 50 },
  "closed-clean": { status: "clean", paidTenantAtto: GEN.toString(), settledAt: NOW - 50 },
  "closed-accepted": { status: "accepted", paidTenantAtto: (GEN * 7n / 10n).toString(), paidLandlordAtto: (GEN * 3n / 10n).toString() },
  "closed-judged": { status: "judged", paidTenantAtto: (GEN * 8n / 10n).toString(), paidLandlordAtto: (GEN * 2n / 10n).toString() },
  "closed-settled": { status: "settled", paidTenantAtto: (GEN * 7n / 10n).toString(), paidLandlordAtto: (GEN * 3n / 10n).toString() },
  "closed-withdrawn": { status: "withdrawn" },
};
const SENDING = ["take", "give_notice", "report", "accept", "contest", "reclaim", "settle", "withdraw_offer", "offer"];

test("every state of a flat, for the tenant, the landlord and anyone else, answers all five questions", () => {
  for (const [name, over] of Object.entries(STATES))
    for (const role of ROLES) {
      const g = flatGuide(flat({ ...over, role }));
      if (name === "to-let" && role !== "landlord") {
        assert.equal(g, null, "a flat to let is not a wait for anyone but its landlord");
        continue;
      }
      complete(g, `${name} as ${role}`);
      if (name !== "to-let" && name !== "closed-withdrawn") assert.match(g.money, /GEN/, `${name} as ${role}: an amount is said`);
      const line = flatLine(flat({ ...over, role }));
      assert.ok(line.text.length > 5 && !/undefined|NaN/.test(line.text), `${name} as ${role}: ${line.text}`);
    }
  assert.equal(flatGuide(flat({ status: "notice", moveoutEnd: NOW + 600, now: 0 })), null, "no clock, no guess");
});

test("every transaction on its way, and every wallet prompt, says where the deposit is", () => {
  for (const fn of SENDING)
    for (const role of ROLES)
      for (const demo of [false, true]) {
        const g = flatGuide(flat({ ...REPORTED, role, demo, sending: fn }));
        complete(g, `sending ${fn} as ${role}`);
        assert.equal(g.waitsFor, "validators");
      }
  for (const fn of SENDING) {
    const g = signGuide({ fn, label: "Doing it", depositAtto: GEN.toString(), deductedAtto: REPORTED.deductedAtto });
    complete(g, `sign ${fn}`);
    assert.equal(g.canLeave, false);
    assert.equal(g.waitsFor, "you");
    complete(signGuide({ fn, label: "Doing it", depositAtto: GEN.toString(), mock: true }), `mock sign ${fn}`);
  }
  assert.equal(signGuide({ fn: "take", label: "Taking F12", depositAtto: GEN.toString() }).money, "1 GEN is still in your wallet; it leaves only when you confirm.");
  complete(offerGuide(), "offer");
  const notice = flatGuide(flat({ sending: "give_notice", demo: true }));
  assert.equal(notice.canLeave, false, "on a sample flat this page asks the demo landlord: stay");
  assert.equal(flatGuide(flat({ sending: "give_notice" })).canLeave, true);
  const contest = flatGuide(flat({ ...REPORTED, sending: "contest" }));
  assert.equal(contest.id, "judging");
  assert.match(contest.time, /1 to 2 minutes/);
  assert.match(contest.money, /0\.7 GEN comes back to you whatever happens/);
});

test("living in the flat: nothing to do until notice, and the deposit is held", () => {
  const g = flatGuide(flat());
  assert.equal(g.id, "living");
  assert.equal(g.waitsFor, "nobody");
  assert.match(g.need, /^Nothing is needed from you\. When you have moved out, press "I have moved out: give notice" below\.$/);
  assert.equal(g.leave, "You can close this page; F12 stays under Mine.");
  assert.equal(g.money, "Your 1 GEN deposit is held by the contract; the landlord cannot touch it.");
  assert.equal(flatGuide(flat({ role: "landlord" })).waitsFor, "tenant");
});

test("after notice: the landlord has until a time, and after it the tenant reclaims everything", () => {
  const end = clockTime(NOW + 600, NOW);
  const t = flatGuide(flat({ status: "notice", moveoutEnd: NOW + 600 }));
  assert.equal(t.id, "report-wait");
  assert.equal(t.waitsFor, "landlord");
  assert.equal(t.need, NOTHING_NEEDED);
  assert.match(t.leave, new RegExp(`^You can close this page; F12 stays under Mine\\. If no report has come by ${end}, you can reclaim the whole deposit there`));
  assert.match(t.money, new RegExp(`If no report comes by ${end}, all of it goes back to you`));
  assert.equal(t.left, 600);
  const l = flatGuide(flat({ role: "landlord", status: "notice", moveoutEnd: NOW + 600 }));
  assert.equal(l.id, "report-due");
  assert.equal(l.waitsFor, "you");
  const filing = flatGuide(flat({ status: "notice", moveoutEnd: NOW + 600, demo: true, demoState: "filing" }));
  assert.equal(filing.waitsFor, "demo");
  assert.equal(filing.canLeave, true);
  assert.equal(flatGuide(flat({ status: "notice", moveoutEnd: NOW + 600, demo: true, demoState: "asking" })).canLeave, false);
  const r = flatGuide(flat({ status: "notice", moveoutEnd: NOW - 1 }));
  assert.equal(r.id, "reclaim-ready");
  assert.equal(r.waitsFor, "you");
  assert.equal(r.money, "1 GEN is still held by the contract; the reclaim sends all of it to you.");
  assert.equal(flatGuide(flat({ role: "other", status: "notice", moveoutEnd: NOW - 1 })).waitsFor, "anyone");
});

test("report filed: the tenant has until a time; silence lets anyone settle it as filed", () => {
  const end = clockTime(NOW + 600, NOW);
  const t = flatGuide(flat(REPORTED));
  assert.equal(t.id, "answer-due");
  assert.equal(t.waitsFor, "you");
  assert.match(t.leave, new RegExp(`until ${end}\\. If you have not answered by then, the report stands as filed and anyone may settle it`));
  assert.equal(t.money, "Your 1 GEN is held by the contract: 0.3 GEN is deducted until you answer, and 0.7 GEN comes back to you whatever happens.");
  const l = flatGuide(flat({ ...REPORTED, role: "landlord" }));
  assert.equal(l.id, "answer-wait");
  assert.equal(l.need, NOTHING_NEEDED);
  const s = flatGuide(flat({ ...REPORTED, role: "landlord", responseEnd: NOW - 1 }));
  assert.equal(s.id, "settle-ready");
  assert.equal(s.need, 'Press "Settle as filed" and 0.3 GEN reaches you; 0.7 GEN goes back to the tenant.');
  assert.equal(flatGuide(flat({ ...REPORTED, responseEnd: NOW - 1 })).waitsFor, "anyone");
});

test("every settled flat says nothing is left to do and where each part of the deposit went", () => {
  for (const status of ["reclaimed", "clean", "accepted", "judged", "settled", "withdrawn"])
    for (const role of ROLES) {
      const g = flatGuide(flat({ ...STATES["closed-" + status], role }));
      assert.equal(g.id, "closed-" + status);
      assert.equal(g.tone, "done");
      assert.equal(g.need, NOTHING_LEFT);
      if (status === "withdrawn") assert.match(g.money, /Nothing was ever held/);
      else if (status === "reclaimed" || status === "clean") assert.match(g.money, /1 GEN/);
      else assert.match(g.money, /GEN .*GEN/, `${status} as ${role}: both parts are named`);
    }
  assert.equal(flatGuide(flat({ ...STATES["closed-judged"] })).money, "0.8 GEN came back to your wallet and 0.2 GEN went to the landlord.");
  assert.equal(flatGuide(flat({ ...STATES["closed-judged"], role: "landlord" })).money, "0.2 GEN came to your wallet and 0.8 GEN went back to the tenant.");
  assert.equal(flatGuide(flat({ ...STATES["closed-reclaimed"] })).kicker, KICKERS.done);
});

test("the one-line status marks only what waits for that side", () => {
  assert.deepEqual(flatLine(flat()), { text: "You live here · nothing to do until you give notice", yours: false });
  assert.equal(flatLine(flat({ role: "landlord", status: "notice", moveoutEnd: NOW + 600 })).yours, true);
  assert.equal(flatLine(flat({ status: "notice", moveoutEnd: NOW + 600 })).yours, false);
  assert.match(flatLine(flat({ status: "notice", moveoutEnd: NOW + 600 })).text, /nothing to do, you can leave$/);
  assert.equal(flatLine(flat(REPORTED)).yours, true);
  assert.equal(flatLine(flat({ ...REPORTED, role: "landlord" })).yours, false);
  assert.equal(flatLine(flat({ status: "notice", moveoutEnd: NOW - 1 })).text, "No report in time · press reclaim to get 1 GEN back");
});

// ---- walks through the in-memory contract -------------------------------------------------------------

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
const asFlat = (r, role, over = {}) => ({
  role,
  now: mock.mockNow(),
  id: r.flat,
  status: r.status,
  depositAtto: String(r.deposit),
  deductedAtto: String(r.deducted),
  moveoutSeconds: r.moveout_seconds,
  responseSeconds: r.response_seconds,
  moveoutEnd: r.moveout_end,
  responseEnd: r.response_end,
  paidTenantAtto: String(r.paid_tenant),
  paidLandlordAtto: String(r.paid_landlord),
  settledAt: r.settled_at,
  ...over,
});
async function openCopyOf(key) {
  const sample = sampleByKey(key);
  const page = await view("flats", [0, 40]);
  const row = page.rows.find((r) => r.status === "open" && r.title === sample.title && r.landlord === mock.DEMO_LANDLORD);
  assert.ok(row, `an open copy of ${key}`);
  return { id: row.flat, sample };
}

test("the main flow, step by step: take, notice, the demo landlord's report, a contest, the verdict", async () => {
  const { id, sample } = await openCopyOf("bakery");
  let f = await view("flat", [id]);
  assert.equal(flatGuide(asFlat(f, "other")), null);
  assert.equal(flatGuide(asFlat(f, "other", { sending: "take" })).id, "taking");
  await send(mock.VISITOR, calls.take(id, BigInt(sample.depositAtto)));
  f = await view("flat", [id]);
  assert.equal(flatGuide(asFlat(f, "tenant")).id, "living");

  await send(mock.VISITOR, calls.giveNotice(id));
  f = await view("flat", [id]);
  assert.equal(flatGuide(asFlat(f, "tenant", { demo: true, demoState: "filing" })).id, "demo-filing");
  assert.equal(flatGuide(asFlat(f, "landlord")).id, "report-due");

  const answer = await mock.demoReport(id);
  assert.equal(answer.ok, true);
  await finalOf(answer.hash);
  f = await view("flat", [id]);
  const due = flatGuide(asFlat(f, "tenant"));
  assert.equal(due.id, "answer-due");
  assert.equal(due.waitsFor, "you");
  assert.equal(flatGuide(asFlat(f, "landlord")).need, NOTHING_NEEDED);

  assert.equal(flatGuide(asFlat(f, "tenant", { sending: "contest" })).id, "judging");
  await send(mock.VISITOR, calls.contest(id, [0, 1]));
  f = await view("flat", [id]);
  assert.equal(f.status, "judged");
  const done = flatGuide(asFlat(f, "tenant"));
  assert.equal(done.id, "closed-judged");
  assert.equal(done.need, NOTHING_LEFT);
  assert.equal(done.money, `${gen(String(f.paid_tenant))} came back to your wallet and ${gen(String(f.paid_landlord))} went to the landlord.`);
});

test("the clock endings: no report, then reclaim; no answer, then settle", async () => {
  const a = await openCopyOf("canal");
  await send(mock.VISITOR, calls.take(a.id, BigInt(a.sample.depositAtto)));
  await send(mock.VISITOR, calls.giveNotice(a.id));
  let f = await view("flat", [a.id]);
  mock.advanceClock(f.moveout_end - mock.mockNow() + 1);
  assert.equal(flatGuide(asFlat(f, "tenant")).id, "reclaim-ready");
  await send(mock.PASSER_BY, calls.reclaim(a.id));
  f = await view("flat", [a.id]);
  const reclaimed = flatGuide(asFlat(f, "tenant"));
  assert.equal(reclaimed.id, "closed-reclaimed");
  assert.match(reclaimed.money, /the whole deposit, came back to your wallet/);

  const b = await openCopyOf("garden");
  await send(mock.VISITOR, calls.take(b.id, BigInt(b.sample.depositAtto)));
  await send(mock.VISITOR, calls.giveNotice(b.id));
  const filed = await mock.demoReport(b.id);
  assert.equal(filed.ok, true);
  await finalOf(filed.hash);
  f = await view("flat", [b.id]);
  mock.advanceClock(f.response_end - mock.mockNow() + 1);
  assert.equal(flatGuide(asFlat(f, "landlord")).id, "settle-ready");
  await send(mock.PASSER_BY, calls.settle(b.id));
  f = await view("flat", [b.id]);
  const settled = flatGuide(asFlat(f, "landlord"));
  assert.equal(settled.id, "closed-settled");
  assert.equal(settled.need, NOTHING_LEFT);
});
