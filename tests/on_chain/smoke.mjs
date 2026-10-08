/* Deposit Back against GenLayer Studio (chain 61999), with throwaway accounts. Deploys its own copy.
 *
 *   npm ci                                        # genlayer-js 1.1.8 and viem 2.56.8, pinned by package-lock.json
 *   node tests/on_chain/smoke.mjs                 # the whole run, about forty minutes
 *   RESUME=1 node tests/on_chain/smoke.mjs        # continue a run that was cut off, from the saved state
 *   STATE=/some/dir/run.json RESUME=1 node ...    # the state file: keys, contract address, every step made
 *   FRESH=1 node tests/on_chain/smoke.mjs         # start over even though a saved run exists
 *
 * Three accounts the script generates and funds itself play the whole story: L is the landlord of four
 * flats, T rents all four, and S is a stranger. Every window a step has to land inside is LONG_SECONDS
 * (30 minutes) or more; the two windows nobody acts inside are SHORT_SECONDS (5 minutes, the contract's
 * least), so the run waits as little as it can.
 *
 * Phases:
 *   A  deploy; L offers F1, the two-bedroom flat above the bakery, with a deposit of 1 GEN and five items
 *      with their move-in notes. S tries to take it with half the deposit and the half comes back in the
 *      same transaction; T takes it with exactly the deposit. L offers three more flats: F2, whose
 *      landlord will never report; F3, whose tenant will never answer; F4, whose tenant will accept.
 *   B  T takes F2, F3 and F4 and gives notice on all four, F2 first so its short window starts early.
 *   C  S tries to file F1's move-out report and is refused. L files it: five move-out notes and four
 *      deductions (the scuffed living room wall 0.3, the burnt worktop 0.2, the flattened carpet 0.15,
 *      the cracked mirror 0.25). L files F3's report (a lock changed for a missing key, 0.2) and F4's
 *      (an oven clean, 0.1).
 *   D  T contests the wall, the worktop and the carpet of F1 and leaves the mirror alone: one consensus
 *      round, two askings per contested deduction, and the vector D1:wear,D2:damage,D3:wear. The money
 *      moves in the same transaction: 0.55 GEN back to T, 0.45 GEN to L. T accepts F4 (0.1 to L, 0.4
 *      back), then tries to contest F4 and is refused.
 *   E  after F2's report window S reclaims its whole deposit for T; after F3's response window S settles
 *      it as filed.
 *   F  the deployed code is read back and compared with contracts/deposit_back.py byte for byte; the
 *      views are read and checked against what the run did; the contract holds nothing; every account
 *      ends exactly where the settlement table says.
 *
 * Every refusal is a signed transaction. Balances are read before and after every step that moves
 * money. Transactions are polled with eth_getTransactionByHash, never with views (gen_call is limited
 * to 30 a minute per client, shared with sim_fundAccount). A round the validators do not carry stores
 * nothing; it is sent again and both transactions are kept. Every step is saved as it is made, so a run
 * cut off by a closed laptop continues with RESUME=1 without sending anything twice. A run cut off
 * inside a window may find that window closed when it continues; the checks then say so.
 */
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey } from "viem/accounts";
import { getAddress } from "viem";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const STATE = process.env.STATE || join(tmpdir(), "deposit-back-smoke-state.json");
const RECORD = process.env.RECORD || STATE.replace(/\.json$/, "") + "-record.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const rpc = async (m, p) => {
  let last;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) });
      const j = await r.json();
      if (j.error && (j.error.code === -32029 || r.status === 429)) { await sleep(((j.error.data?.retry_after_seconds) || 20) * 1000); continue; }
      if (j.error) { last = new Error(m + ": " + JSON.stringify(j.error).slice(0, 200)); await sleep(6000); continue; }
      return j.result;
    } catch (e) { last = e; await sleep(4000); }   // the connection itself failed, or the answer was not JSON
  }
  throw last;
};
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); return !!c; };
const note = (s) => console.log(`      .. ${s}`);
const GEN = 10n ** 18n;
const tally = (v) => `${v.agree} agree, ${v.disagree} disagree, ${v.idle} idle`;
const sha = (text) => createHash("sha256").update(text).digest("hex");

// ---------- state: keys, the contract address and every step already made survive a cut-off run ----------
if (existsSync(STATE) && !process.env.RESUME && !process.env.FRESH) {
  console.log(`A saved run exists at ${STATE}.\nRESUME=1 continues it; FRESH=1 starts over; STATE=<path> keeps another.`);
  process.exit(2);
}
const st = existsSync(STATE) && process.env.RESUME && !process.env.FRESH ? JSON.parse(readFileSync(STATE, "utf8")) : {};
st.keys = st.keys || {}; st.steps = st.steps || {}; st.views = st.views || {}; st.order = st.order || [];
const save = () => {
  writeFileSync(STATE, JSON.stringify(st, null, 1));
  const { keys, ...shown } = st;       // the record carries no key
  writeFileSync(RECORD, JSON.stringify(shown, null, 1));
};
const ROLES = { l: "the landlord of four flats", t: "the tenant of all four", s: "a stranger" };
for (const k of Object.keys(ROLES)) st.keys[k] = st.keys[k] || generatePrivateKey();
const acct = {}, client = {};
for (const k of Object.keys(ROLES)) { acct[k] = createAccount(st.keys[k]); client[k] = createClient({ chain: studionet, account: acct[k] }); }
const rd = createClient({ chain: studionet });
st.accounts = Object.fromEntries(Object.keys(ROLES).map((k) => [k, getAddress(acct[k].address)]));
save();
const low = (k) => acct[k].address.toLowerCase();

const balance = async (a) => BigInt(await rpc("eth_getBalance", [a, "latest"]) || "0x0");
const nonceOf = async (a) => Number(BigInt(await rpc("eth_getTransactionCount", [a, "latest"]) || "0x0"));
const fundOnce = async (k, whole) => {
  st.funded = st.funded || {};
  if (st.funded[k]) return;
  await rpc("sim_fundAccount", { account_address: getAddress(acct[k].address), amount: whole * 1e18 });   // checksummed
  for (let i = 0; i < 20 && (await balance(acct[k].address)) === 0n; i++) await sleep(3000);
  st.funded[k] = String(await balance(acct[k].address)); save();
};

// ---------- transactions ----------
const errText = (e) => String(e?.details || e?.shortMessage || e?.cause?.message || e?.message || e);
// A request the network refused or never received is made again. When the failure is ambiguous the
// sender's nonce says whether the transaction landed after all, and its hash is read back, so nothing
// is ever sent twice.
const sendRaw = async (who, what, make) => {
  const addr = acct[who].address;
  for (let i = 0; ; i++) {
    const n0 = await nonceOf(addr);
    try { return await make(); } catch (e) {
      const text = errText(e);
      if (i >= 8) throw e;
      console.log(`      ${what} was not taken (${text.slice(0, 70)}); looking again in 20s`);
      await sleep(20000);
      if ((await nonceOf(addr)) > n0) {
        const list = await rpc("sim_getTransactionsForAddress", [addr]);
        const hit = (list || []).find((t) => String(t.from_address).toLowerCase() === addr.toLowerCase() && Number(t.nonce) === n0);
        if (hit?.hash) return hit.hash;
        throw new Error(what + " landed but its hash could not be read back");
      }
    }
  }
};
const countVotes = (t) => { let a = 0, d = 0, idl = 0; for (const k in (t.consensus_data?.votes || {})) { const v = t.consensus_data.votes[k]; if (v === "agree") a++; else if (v === "disagree") d++; else idl++; } return { agree: a, disagree: d, idle: idl }; };
const wait = async (tx) => {
  let stuck = 0;
  for (let i = 0; i < 900; i++) {
    await sleep(4000);
    const t = await rpc("eth_getTransactionByHash", [tx]);
    if (t?.status === "FINALIZED") {
      const lr = t.consensus_data?.leader_receipt, one = Array.isArray(lr) ? lr[0] : lr;
      let msg = "";
      try { msg = Buffer.from(one.result, "base64").toString("utf8").replace(/[^\x20-\x7e]/g, " ").trim(); } catch (e) {}
      const v = countVotes(t);
      return { tx, msg, exec: one?.execution_result || "", votes: v, applied: v.agree * 2 > v.agree + v.disagree + v.idle, address: t.data?.contract_address || t.to_address || "" };
    }
    // a round no majority carried is final as it stands once it has been left alone for ten minutes
    if (t?.status === "UNDETERMINED" && (stuck = stuck + 1) > 150) return { tx, msg: "UNDETERMINED", exec: "", votes: countVotes(t), applied: false, address: "" };
    if (t?.status === "CANCELED") return { tx, msg: "CANCELED", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
    if (i > 0 && i % 75 === 0) console.log(`      [${stamp()}] still ${t?.status || "unknown"} after ${Math.round(i * 4 / 60)} minutes: ${tx}`);
  }
  return { tx, msg: "TIMEOUT", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
};
const jsonOf = (msg) => { const b = String(msg).indexOf("{"); if (b === -1) return null; try { return JSON.parse(String(msg).slice(b)); } catch (e) { return null; } };
const settleBalance = async (a, before, want) => { for (let i = 0; i < 45; i++) { const b = await balance(a); if (b - before === want) return b; await sleep(4000); } return await balance(a); };

// One step of the run: a signed transaction, its tally, what it returned, and the balances it moved.
// opt.value is what is sent with it; opt.watch names the accounts whose balances are read before and
// after; opt.expect is the change each should show once every transfer has landed, a table or a
// function of what the call returned. A step already in the saved state is not sent again.
const call = async (id, who, fn, args = [], opt = {}) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn, args: args.map(String), value: String(opt.value || 0n), tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const watch = opt.watch || [];
    if (!rec.before) { rec.before = {}; for (const k of watch) rec.before[k] = String(await balance(acct[k].address)); save(); }
    let r;
    for (;;) {
      if (!rec.pending) {
        rec.pending = await sendRaw(who, fn, () => client[who].writeContract({ address: st.contract, functionName: fn, args, ...(opt.value ? { value: opt.value } : {}) }));
        save();
      }
      r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg, at: stamp() });
      rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} ${fn}(${args.map((x) => String(x).slice(0, 18)).join(", ")})${opt.value ? " +" + Number(opt.value) / 1e18 + " GEN" : ""}  ${r.tx}  ${tally(r.votes)}  ${r.exec}`);
      if (r.msg === "TIMEOUT" || rec.tries.length >= 4) break;
      if (!r.applied) { console.log("      the validators did not carry that round (" + tally(r.votes) + "), so nothing was stored; sending it again"); continue; }
      break;
    }
    const expect = typeof opt.expect === "function" ? opt.expect(jsonOf(r.msg)) : opt.expect;
    rec.after = {}; rec.delta = {};
    for (const k of watch) {
      const before = BigInt(rec.before[k]);
      const want = expect && expect[k] !== undefined ? BigInt(expect[k]) : null;
      const now = want === null ? await balance(acct[k].address) : await settleBalance(acct[k].address, before, want);
      rec.after[k] = String(now); rec.delta[k] = String(now - before);
    }
    rec.done = true; save();
  }
  const last = rec.tries[rec.tries.length - 1];
  return { ...last, j: jsonOf(last.msg), tries: rec.tries, delta: rec.delta || {} };
};
const refused = (r, words) => r.exec === "ERROR" && r.msg.includes(words);
const moved = (r, k, want) => r.delta[k] === String(want);
const votes = (r) => r.tries.map((t) => tally(t.votes)).join(", then ");

const deploy = async (id, who, path) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn: "deploy " + path.split("/").pop(), args: [], value: "0", tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const code = readFileSync(new URL(path, import.meta.url));
    for (;;) {
      if (!rec.pending) { rec.pending = await sendRaw(who, "deploy", () => client[who].deployContract({ code, args: [], leaderOnly: false })); save(); }
      const r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg.slice(0, 300), at: stamp() });
      rec.address = r.address; rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} deploy ${path.split("/").pop()}  ${r.tx}  ${tally(r.votes)}  ${r.exec}  ${r.address}`);
      if (r.applied || r.msg === "TIMEOUT" || rec.tries.length >= 3) break;
    }
    rec.done = true; save();
  }
  return rec.address;
};

// ---------- reads: paced, and made again on a 429 or on "Contract not found" instead of failing ----------
let lastRead = 0;
const read = async (fn, args = []) => {
  for (let i = 0; i < 30; i++) {
    const gap = 3500 - (Date.now() - lastRead);
    if (gap > 0) await sleep(gap);
    lastRead = Date.now();
    try { return JSON.parse(String(await rd.readContract({ address: st.contract, functionName: fn, args }))); } catch (e) {
      if (i === 29) return { error: "VIEW ERROR " + fn + ": " + errText(e).slice(0, 100) };
      await sleep(/rate|429|limit/i.test(errText(e)) ? 25000 : 10000);
    }
  }
};
// a view read once for a check is kept with the run, so a continued run checks what was seen then
const seen = async (id, fn, args = []) => { if (!st.views[id]) { st.views[id] = { fn, args, at: stamp(), out: await read(fn, args) }; save(); } return st.views[id].out; };
// wait on the chain's own clock until a window of a flat has passed
const until = async (flat, field) => {
  for (;;) {
    const r = await read("flat", [flat]);
    if (!(Number(r[field]) > 0)) { note(`flat ${flat} could not be read (${r.error || "no " + field}); reading again`); await sleep(15000); continue; }
    const now = Number(r.now) > 0 ? Number(r.now) : Math.floor(Date.now() / 1000);
    const left = Number(r[field]) - now;
    if (left <= -10) return r;
    console.log(`      [${stamp()}] waiting ${left + 10}s for ${field} of ${flat}`);
    await sleep(Math.min(left + 10, 120) * 1000);
  }
};

// ---------- the demonstration text: concrete, and one thing changed per demonstration ----------
// Windows are long enough for a slow Studio: on 6 Oct 2026 a transaction took up to seven minutes to land.
// Every window a step must land inside is LONG; the windows nobody acts inside are SHORT, the contract's least.
const LONG = Number(process.env.LONG_SECONDS || 1800), SHORT = Number(process.env.SHORT_SECONDS || 300);
const DEPOSIT = 1n * GEN, HALF = GEN / 2n;
const WALL = 3n * GEN / 10n, WORKTOP = 2n * GEN / 10n, CARPET = 15n * GEN / 100n, MIRROR = 25n * GEN / 100n;
const REST = DEPOSIT - WALL - WORKTOP - CARPET - MIRROR;
const LOCK = GEN / 5n, OVEN = GEN / 10n;

const F1 = {
  title: "Two-bedroom flat above the bakery", address: "Flat 2, 14 Mill Lane, above the bakery",
  items: [
    { name: "Living room walls", move_in: "Freshly painted white throughout, no marks, holes or scuffs on any wall." },
    { name: "Kitchen worktop", move_in: "Grey laminate worktop, no burns, cuts, chips or stains anywhere along its length." },
    { name: "Bedroom carpet", move_in: "Beige carpet, professionally cleaned before move-in, no stains or worn areas." },
    { name: "Bathroom mirror", move_in: "Mirror above the basin is intact, with no cracks, chips or loose fixings." },
    { name: "Windows and frames", move_in: "Double glazed windows open and close smoothly, frames clean, seals intact." },
  ],
  out: [
    "Two small scuffs near the light switch where furniture touched the wall; the paint is otherwise clean.",
    "A 6 cm burn mark from a hot pan on the laminate next to the hob; the surface is blistered there.",
    "General flattening of the pile along the path from the door to the bed; no stains, tears or burns.",
    "The mirror is cracked across the lower left corner, with a crack about 15 cm long.",
    "Windows open and close smoothly, frames clean and seals intact, the same as at move-in.",
  ],
  deductions: [
    { item: 0, amount: String(WALL), reason: "Repainting the living room wall to remove the scuffs left near the light switch." },
    { item: 1, amount: String(WORKTOP), reason: "Cutting out and replacing the burnt section of the laminate worktop next to the hob." },
    { item: 2, amount: String(CARPET), reason: "Steam cleaning and re-stretching the bedroom carpet to lift the flattened walking path." },
    { item: 3, amount: String(MIRROR), reason: "Replacing the cracked bathroom mirror and its fixings." },
  ],
};
const F2 = { title: "Studio flat by the canal", address: "Unit 5, 3 Canal Walk", items: [F1.items[0], F1.items[2]] };
const F3 = {
  title: "One-bedroom flat on the hill", address: "Top floor, 9 Hill Road",
  items: [
    { name: "Hallway floor", move_in: "Oak boards in the hallway, sanded and oiled, no dents or scratches." },
    { name: "Front door lock", move_in: "Front door lock works with both keys; two keys handed over." },
  ],
  out: ["Oak boards in the hallway with light surface scratches near the door mat.",
    "The lock works, but only one of the two keys was handed back at move-out."],
  deductions: [{ item: 1, amount: String(LOCK), reason: "Changing the front door lock because one of the two keys was never returned." }],
};
const F4 = {
  title: "Garden flat behind the library", address: "Garden flat, 22 Library Street",
  items: [
    { name: "Oven", move_in: "Oven professionally cleaned before move-in, racks and floor free of grease." },
    { name: "Fridge", move_in: "Fridge clean and working, all shelves and drawers present and intact." },
  ],
  out: ["Burnt-on grease on both oven racks and the oven floor; the door glass is brown with grease.",
    "Fridge clean and working, all shelves and drawers present and intact."],
  deductions: [{ item: 0, amount: String(OVEN), reason: "Professional oven clean to remove the burnt-on grease from the racks and floor." }],
};
const EXPECTED = "D1:wear,D2:damage,D3:wear";
const offerArgs = (f, deposit, moveout, response) => [f.title, f.address, JSON.stringify(f.items), String(deposit), moveout, response];

await fundOnce("l", 5); await fundOnce("t", 20); await fundOnce("s", 5);
if (!st.start) { st.start = {}; for (const k of Object.keys(ROLES)) st.start[k] = String(await balance(acct[k].address)); st.started = new Date().toISOString(); save(); }
console.log(`[${stamp()}] ${Object.keys(ROLES).map((k) => k.toUpperCase() + " " + st.accounts[k] + "  " + ROLES[k]).join("\n           ")}\n           state ${STATE}`);

// ================================================================ phase A
console.log(`\n[${stamp()}] ---- phase A: deploy, the flat above the bakery offered and taken, three more offered`);
st.contract = st.contract || await deploy("deploy", "l", "../../contracts/deposit_back.py");
save();
console.log(`      Deposit Back at ${st.contract}`);
const o1 = await call("offerBakery", "l", "offer", offerArgs(F1, DEPOSIT, LONG, 2 * LONG));
ok("the landlord offers the flat above the bakery as F1: deposit 1 GEN, five items with their move-in notes", o1.j?.ok === true && o1.j?.flat === "F1" && o1.j?.items === 5 && o1.j?.deposit === String(DEPOSIT), `${votes(o1)}  ${o1.msg.slice(0, 120)}`);
const id1 = o1.j?.flat || "F1";
// The stranger's short take must land before the tenant's, or it would be refused for another reason. The
// landlord's other offers go out meanwhile from the landlord's own account. F2's report window is SHORT
// (nobody reports, and anyone reclaims once it closes); F3's response window is SHORT (nobody answers).
const [half, o2] = await Promise.all([
  call("takeHalf", "s", "take", [id1], { value: HALF, watch: ["s"], expect: { s: 0n } }),
  call("offerCanal", "l", "offer", offerArgs(F2, HALF, SHORT, LONG)),
]);
ok("a take sent with half the deposit is refused, and the half comes back in the same transaction", half.exec !== "ERROR" && half.j?.ok === false && String(half.j?.reason).includes("send exactly the deposit") && half.j?.returned === String(HALF) && moved(half, "s", 0n), `${votes(half)}  ${half.j?.reason}`);
ok("the landlord offers F2, the studio by the canal, deposit 0.5 GEN", o2.j?.ok === true && /^F\d+$/.test(String(o2.j?.flat)), `${votes(o2)}  ${o2.msg.slice(0, 100)}`);
const id2 = o2.j?.flat || "F2";
const later = (async () => [
  await call("offerHill", "l", "offer", offerArgs(F3, HALF, LONG, SHORT)),
  await call("offerGarden", "l", "offer", offerArgs(F4, HALF, LONG, LONG)),
])();
const tk1 = await call("takeBakery", "t", "take", [id1], { value: DEPOSIT, watch: ["t"], expect: { t: -DEPOSIT } });
ok("the tenant takes F1 with exactly the deposit, which accepts the move-in notes as written", tk1.j?.ok === true && tk1.j?.status === "let" && tk1.j?.tenant === low("t") && moved(tk1, "t", -DEPOSIT), `${votes(tk1)}  ${tk1.msg.slice(0, 100)}`);
const [o3, o4] = await later;
ok("the landlord offers F3 on the hill (a short response window) and F4 behind the library", o3.j?.ok === true && o4.j?.ok === true, `${votes(o3)} / ${votes(o4)}`);
const id3 = o3.j?.flat || "F3", id4 = o4.j?.flat || "F4";
{
  const v = await seen("bakeryLet", "flat", [id1]);
  ok("flat(F1) reads let: the tenant recorded, the deposit held, five items and no deduction yet", v.status === "let" && v.tenant === low("t") && v.held === String(DEPOSIT) && (v.items || []).length === 5 && (v.deductions || []).length === 0, JSON.stringify({ status: v.status, held: v.held }));
}

// ================================================================ phase B
console.log(`\n[${stamp()}] ---- phase B: three more flats taken, and notice on all four`);
for (const [step, id] of [["takeCanal", id2], ["takeHill", id3], ["takeGarden", id4]]) {
  const r = await call(step, "t", "take", [id], { value: HALF, watch: ["t"], expect: { t: -HALF } });
  ok(`the tenant takes ${id} with exactly its deposit of 0.5 GEN`, r.j?.ok === true && moved(r, "t", -HALF), `${votes(r)}  ${r.msg.slice(0, 80)}`);
}
// F2's notice first, so that its short report window runs while everything else happens
for (const [step, id] of [["noticeCanal", id2], ["noticeBakery", id1], ["noticeHill", id3], ["noticeGarden", id4]]) {
  const r = await call(step, "t", "give_notice", [id]);
  ok(`the tenant gives notice on ${id}, and the landlord's report window starts on the chain's clock`, r.j?.ok === true && r.j?.status === "notice" && Number(r.j?.moveout_end) > 0, `${votes(r)}  ${r.msg.slice(0, 90)}`);
}

// ================================================================ phase C
console.log(`\n[${stamp()}] ---- phase C: the move-out reports`);
{
  const [sr, lr] = await Promise.all([
    call("reportStranger", "s", "report", [id1, JSON.stringify(F1.out), JSON.stringify(F1.deductions)]),
    call("reportBakery", "l", "report", [id1, JSON.stringify(F1.out), JSON.stringify(F1.deductions)]),
  ]);
  ok("a stranger may not file the move-out report of F1", refused(sr, "only the landlord of " + id1 + " may file its move-out report"), `${votes(sr)}  ${sr.msg.slice(0, 110)}`);
  ok("the landlord files F1's report: five move-out notes and four deductions adding up to 0.9 GEN", lr.j?.ok === true && lr.j?.status === "reported" && lr.j?.deductions === 4 && lr.j?.deducted === String(DEPOSIT - REST), `${votes(lr)}  ${lr.msg.slice(0, 120)}`);
  const r3 = await call("reportHill", "l", "report", [id3, JSON.stringify(F3.out), JSON.stringify(F3.deductions)]);
  ok("the landlord files F3's report: a lock changed because a key was never returned, 0.2 GEN", r3.j?.ok === true && r3.j?.status === "reported", `${votes(r3)}  ${r3.msg.slice(0, 100)}`);
  const r4 = await call("reportGarden", "l", "report", [id4, JSON.stringify(F4.out), JSON.stringify(F4.deductions)]);
  ok("the landlord files F4's report: an oven clean for burnt-on grease, 0.1 GEN", r4.j?.ok === true && r4.j?.status === "reported", `${votes(r4)}  ${r4.msg.slice(0, 100)}`);
}

// ================================================================ phase D
console.log(`\n[${stamp()}] ---- phase D: the contest, the acceptance, and a contest after it`);
{
  const ct = await call("contestBakery", "t", "contest", [id1, JSON.stringify([0, 1, 2])], {
    watch: ["l", "t"],
    expect: (j) => ({ l: BigInt(j?.paid_landlord || 0), t: BigInt(j?.paid_tenant || 0) }),
  });
  ok("the validators carry one vector, in one consensus round", ct.applied && /^D1:(damage|wear|unclear),D2:(damage|wear|unclear),D3:(damage|wear|unclear)$/.test(String(ct.j?.verdict)), `${votes(ct)}  -> ${ct.j?.verdict}`);
  ok(`the scuffed wall and the flattened carpet are wear and the burnt worktop is damage: ${EXPECTED}`, ct.j?.verdict === EXPECTED, String(ct.j?.verdict));
  ok("in the same transaction the tenant gets the wall, the carpet and the rest back (0.55 GEN) and the landlord the worktop and the uncontested mirror (0.45 GEN)", ct.j?.paid_tenant === String(WALL + CARPET + REST) && ct.j?.paid_landlord === String(WORKTOP + MIRROR) && moved(ct, "t", WALL + CARPET + REST) && moved(ct, "l", WORKTOP + MIRROR), JSON.stringify(ct.delta));
  const v = await seen("bakeryJudged", "flat", [id1]);
  const where = (v.deductions || []).map((d) => `${d.id}:${d.verdict}:${d.to}`).join(" ");
  ok("flat(F1) shows every deduction, its verdict and where its money went", v.status === "judged" && where === "D1:wear:tenant D2:damage:landlord D3:wear:tenant D4:uncontested:landlord" && v.held === "0", where);
  const ac = await call("acceptGarden", "t", "accept", [id4], { watch: ["l", "t"], expect: { l: OVEN, t: HALF - OVEN } });
  ok("the tenant accepts F4: the oven clean goes to the landlord (0.1 GEN) and the rest back (0.4 GEN)", ac.j?.status === "accepted" && moved(ac, "l", OVEN) && moved(ac, "t", HALF - OVEN), `${votes(ac)}  ${JSON.stringify(ac.delta)}`);
  const late = await call("contestGarden", "t", "contest", [id4, JSON.stringify([0])]);
  ok("a contest after the tenant accepted is refused", refused(late, id4 + " is accepted; only a filed report can be contested"), `${votes(late)}  ${late.msg.slice(0, 110)}`);
}

// ================================================================ phase E
console.log(`\n[${stamp()}] ---- phase E: the windows nobody acted in`);
{
  await until(id2, "moveout_end");
  const rc = await call("reclaimCanal", "s", "reclaim", [id2], { watch: ["t"], expect: { t: HALF } });
  ok("F2's landlord never reported: after the window a stranger reclaims the whole deposit for the tenant", rc.j?.status === "reclaimed" && rc.j?.paid_tenant === String(HALF) && moved(rc, "t", HALF), `${votes(rc)}  ${rc.msg.slice(0, 100)}`);
  await until(id3, "response_end");
  const se = await call("settleHill", "s", "settle", [id3], { watch: ["l", "t"], expect: { l: LOCK, t: HALF - LOCK } });
  ok("F3's tenant never answered: after the response window a stranger settles it as filed", se.j?.status === "settled" && moved(se, "l", LOCK) && moved(se, "t", HALF - LOCK), `${votes(se)}  ${JSON.stringify(se.delta)}`);
}

// ================================================================ phase F
console.log(`\n[${stamp()}] ---- phase F: the code read back, the views, the balances`);
{
  const file = readFileSync(new URL("../../contracts/deposit_back.py", import.meta.url));
  const chain = Buffer.from(String(await rpc("gen_getContractCode", [st.contract])), "base64");
  st.code = { address: st.contract, bytes: chain.length, sha256: sha(chain), file_bytes: file.length, file_sha256: sha(file), identical: Buffer.compare(chain, file) === 0 };
  save();
  ok(`the code deployed at ${st.contract} is byte for byte contracts/deposit_back.py`, st.code.identical, `${chain.length} bytes, sha256 ${st.code.sha256}`);
  const stats = await seen("stats", "stats", []);
  ok("stats(): four flats, one judged, one accepted, one reclaimed, one settled, one refused take, three deductions read, nothing held", stats.flats === 4 && stats.taken === 4 && stats.active === 0 && stats.judged === 1 && stats.accepted === 1 && stats.reclaimed === 1 && stats.settled === 1 && stats.refused_takes === 1 && stats.contested === 3 && stats.damage === 1 && stats.wear === 2 && stats.held === "0", JSON.stringify(stats));
  const page = await seen("flats", "flats", [0, 20]);
  ok("flats(0, 20): all four, oldest first, with their endings", Array.isArray(page.rows) && page.rows.map((r) => r.flat + ":" + r.status).join(" ") === `${id1}:judged ${id2}:reclaimed ${id3}:settled ${id4}:accepted`, JSON.stringify((page.rows || []).map((r) => r.flat + ":" + r.status)));
  const mine = await seen("flatsOfTenant", "flats_of", [st.accounts.t]);
  ok("flats_of(the tenant) lists the four flats it took, and flats_of finds the address in any letter case", JSON.stringify(mine.tenant) === JSON.stringify([id1, id2, id3, id4]) && JSON.stringify(mine.landlord) === "[]", JSON.stringify(mine));
  const rules = await seen("rules", "rules", []);
  ok("rules() publishes the comparison and the combine table in the contract's own words", String(rules.compared).includes("exact string equality") && rules.combine?.["yes then no"] === "damage" && rules.combine?.["no then yes"] === "wear", String(rules.value));
  ok("the contract's own balance is zero", (await balance(st.contract)) === 0n, String(await balance(st.contract)));
  st.end = {}; for (const k of Object.keys(ROLES)) st.end[k] = String(await balance(acct[k].address));
  st.ended = new Date().toISOString(); save();
  const net = (k) => BigInt(st.end[k]) - BigInt(st.start[k]);
  const want = { l: WORKTOP + MIRROR + OVEN + LOCK, t: -(WORKTOP + MIRROR + OVEN + LOCK), s: 0n };
  ok("every account ends where the settlement table says: the landlord up 0.75 GEN, the tenant down 0.75 GEN, the stranger whole", Object.keys(want).every((k) => net(k) === want[k]), Object.keys(want).map((k) => k.toUpperCase() + " " + Number(net(k)) / 1e18).join("  "));
}

st.checks = { pass, fail }; save();
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Deposit Back: ${st.contract}  ${EXPLORER}/address/${st.contract}`);
console.log("transactions:", st.order.reduce((n, id) => n + st.steps[id].tries.length, 0), "in", st.order.length, "steps; sent a second time:", st.order.filter((id) => st.steps[id].tries.length > 1).join(", ") || "none");
for (const id of st.order) { const s = st.steps[id]; console.log(`${id.padEnd(15)} ${s.tries.map((t) => t.tx + " " + tally(t.votes) + " " + t.exec).join(" | ")}`); }
console.log("record:", RECORD);
process.exit(fail ? 1 : 0);
