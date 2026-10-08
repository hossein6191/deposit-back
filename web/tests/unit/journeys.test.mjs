// Seeded random journeys through the in-memory contract: anyone does anything, in any order, and the
// clock jumps. After every step no atto is created or lost, the contract holds exactly the deposits
// of its running tenancies, and every closed flat paid out exactly its deposit.

import test from "node:test";
import assert from "node:assert/strict";

import * as mock from "../../lib/chain-mock.ts";
import { calls } from "../../lib/calls.ts";
import { SAMPLE_FLATS } from "../../lib/demo-flats.ts";

const ACCOUNTS = [mock.VISITOR, mock.DEMO_LANDLORD, mock.MY_LANDLORD, mock.EARLIER_TENANT, mock.PASSER_BY];
const HOLDING = ["let", "notice", "reported"];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const view = async (fn, args) => JSON.parse(await mock.view(fn, args));

async function finalOf(hash) {
  for (let i = 0; i < 40; i++) {
    const s = await mock.txStatus(hash);
    if (s.status === "FINALIZED") return s;
  }
  throw new Error("never finalized");
}

async function check(total, step) {
  let sum = mock.mockContractBalance();
  for (const a of ACCOUNTS) sum += await mock.balanceOf(a);
  assert.equal(sum, total, `${step}: no atto created or lost`);
  const page = await view("flats", [0, 20]);
  const all = [...page.rows];
  for (let off = 20; off < page.total; off += 20) all.push(...(await view("flats", [off, 20])).rows);
  let held = 0n;
  for (const r of all) {
    if (HOLDING.includes(r.status)) held += BigInt(r.deposit);
    else if (r.status !== "open" && r.status !== "withdrawn")
      assert.equal(BigInt(r.paid_tenant) + BigInt(r.paid_landlord), BigInt(r.deposit), `${step}: ${r.flat} paid out exactly its deposit`);
  }
  const { held: said, balance } = mock.mockHeld();
  assert.equal(said, held, `${step}: held_total is the deposits of the running tenancies`);
  assert.equal(balance, held, `${step}: the contract's balance is what it holds`);
}

test("three hundred random steps keep every atto accounted for", async () => {
  const r = rng(20261008);
  const pick = (xs) => xs[Math.floor(r() * xs.length)];
  let total = mock.mockContractBalance();
  for (const a of ACCOUNTS) total += await mock.balanceOf(a);
  await check(total, "start");
  const reason = "Repairing the damage described in the move-out note.";
  for (let step = 0; step < 300; step++) {
    const who = pick(ACCOUNTS);
    mock.setMockPersona(who);
    const count = (await view("stats", [])).flats;
    const id = "F" + (1 + Math.floor(r() * count));
    const flat = await view("flat", [id]);
    const deposit = BigInt(flat.deposit);
    const roll = r();
    let hash = "";
    try {
      if (roll < 0.04) {
        mock.advanceClock(Math.floor(r() * 30 * 3600));
        continue;
      } else if (roll < 0.1) {
        const s = pick(SAMPLE_FLATS);
        hash = await mock.write(calls.offer(s.title, s.addressLine, s.items.map((i) => ({ name: i.name, moveIn: i.move_in })), BigInt(s.depositAtto), s.moveoutSeconds, s.responseSeconds));
      } else if (roll < 0.3) {
        const wrong = r() < 0.3;
        hash = await mock.write(calls.take(id, wrong ? deposit / 2n + 1n : deposit));
      } else if (roll < 0.42) hash = await mock.write(calls.giveNotice(id));
      else if (roll < 0.52) {
        const a = await mock.demoReport(id);
        if (a.ok) hash = a.hash;
      } else if (roll < 0.6) {
        const k = flat.items.length;
        const take = Array.from({ length: k }, (_, i) => i).filter(() => r() < 0.5).slice(0, 6);
        const each = take.length ? deposit / BigInt(take.length + 1) : 0n;
        hash = await mock.write(calls.report(id, flat.items.map(() => "As found at move-out, described in plain words."), take.map((i) => ({ item: i, amountAtto: each || 1n, reason }))));
      } else if (roll < 0.68) hash = await mock.write(calls.accept(id));
      else if (roll < 0.8) {
        const n = flat.deductions.length;
        const picked = Array.from({ length: n }, (_, i) => i).filter(() => r() < 0.6);
        hash = await mock.write(calls.contest(id, picked.length ? picked : [0]));
      } else if (roll < 0.88) hash = await mock.write(calls.reclaim(id));
      else if (roll < 0.96) hash = await mock.write(calls.settle(id));
      else hash = await mock.write(calls.withdrawOffer(id));
    } catch (e) {
      // a demo account without the deposit: the wallet refuses before anything is sent
      assert.match(String(e.message), /insufficient funds/);
    }
    if (hash) await finalOf(hash);
    await check(total, `step ${step}`);
  }
  const stats = await view("stats", []);
  assert.ok(stats.taken > 5 && stats.judged + stats.accepted + stats.settled + stats.reclaimed + stats.clean > 3, JSON.stringify(stats));
});
