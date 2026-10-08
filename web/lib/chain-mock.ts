// A stand-in for the contract, in memory, for NEXT_PUBLIC_MOCK=1. lib/chain.ts delegates here.
//
// It follows contracts/deposit_back.py on everything deterministic: who may call what and when, the
// order of the checks and their refusal sentences word for word, the windows on the clock, the money
// of every ending, the counters, and every view answered in the contract's own JSON shape, so the
// mappers in lib/chain.ts run on the same rows in both modes. The one thing it cannot do is ask a
// model: the verdict on a contested deduction is SCRIPTED here (the sample flat's `expect`, or a word
// list for any other flat) and the demo bar says so on every page.
//
// The visitor acts as one of a few demo accounts. The demo landlord owns two copies of every sample
// flat and files their move-out reports (demoReport, the in-memory twin of POST /api/demo/report).
// A few finished tenancies are seeded so the ledger and the home page have something to show, and
// the clock can be moved on so a closed window can be seen. State lasts as long as the tab.

import type { Call, DemoReportAnswer, DemoStatus, TxStatus, WriteFn } from "./types.ts";
import { notify } from "./browser-store.ts";
import { SAMPLE_FLATS, demoReportProblem, offerArgs, reportArgs, sampleByKey, sampleFor, type SampleFlat } from "./demo-flats.ts";
import {
  ID_CHARS,
  ADDRESS_CHARS,
  HOLDING,
  MAX_DEPOSIT,
  MAX_WINDOW,
  MIN_ADDRESS,
  MIN_DEPOSIT,
  MIN_TITLE,
  MAX_ADDRESS,
  MAX_TITLE,
  MIN_WINDOW,
  PAGE,
  ZERO,
  deductionId,
  numberArg,
  phaseOf,
  pyStrip,
  readDeductions,
  readIndices,
  readItems,
  readMoveout,
  textProblem,
  vectorOf,
  type Payee,
  type Verdict,
} from "./rules.ts";

const GEN = 10n ** 18n;
export const MOCK_REGISTER = "0x000000000000000000000000000000000de9b5ac";

const inBrowser = typeof window !== "undefined";
const delay = (ms: number) => (inBrowser ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

// ---- the clock -----------------------------------------------------------------------------------

let clockOffset = 0;
/** The mock's message clock, in seconds: the browser's clock plus however far the visitor moved it on. */
export const mockNow = (): number => Math.floor(Date.now() / 1000) + clockOffset;
/** How far the clock has been moved on, in seconds: a stable snapshot for useSyncExternalStore. */
export const mockClockOffset = (): number => clockOffset;
/** Moves the mock clock on, so a window that is still open can be seen closed. */
export function advanceClock(seconds: number): void {
  clockOffset += Math.max(0, Math.floor(seconds));
  notify();
}

// ---- who the visitor is acting as -----------------------------------------------------------------

export type Persona = { address: string; name: string; note: string };

export const VISITOR = "0x5a1c9e0d47b3f2861e0c7d4a93b5f20e8c61d7a4";
export const DEMO_LANDLORD = "0xd3e0b5a1c7f94e2b86a0d1c35f7e9b4a02c8e613";
export const MY_LANDLORD = "0x7e41c08b2d95f3a6e1b07c4d92a5e38f16b0c2d9";
export const EARLIER_TENANT = "0x29b6f4e1a0c83d57b9e26f1a4c0d8e75b3a91f62";
export const PASSER_BY = "0xa08f3c6e2b917d4f50e8a3c1b6d2947e0f5c8b31";

/** The accounts a visitor can act as in mock mode. The first is a newcomer with test GEN. */
export const PERSONAS: Persona[] = [
  { address: VISITOR, name: "You, a tenant", note: "take a flat, give notice, contest the report" },
  { address: MY_LANDLORD, name: "You, a landlord", note: "a tenant has given notice on F19: file its report" },
  { address: EARLIER_TENANT, name: "An earlier tenant", note: "four finished tenancies and one unreported" },
  { address: PASSER_BY, name: "A passer-by", note: "anyone may reclaim or settle once a window closes" },
  { address: DEMO_LANDLORD, name: "The demo landlord", note: "owns the sample flats" },
];

let persona = VISITOR;
/** The address the mock treats as the connected wallet. */
export const mockAddress = (): string => persona;
export function setMockPersona(address: string): void {
  if (PERSONAS.some((p) => p.address === address)) persona = address;
  notify();
}

// ---- balances -------------------------------------------------------------------------------------

const balances = new Map<string, bigint>([
  [VISITOR, 20n * GEN],
  [MY_LANDLORD, 6n * GEN],
  [EARLIER_TENANT, 30n * GEN],
  [PASSER_BY, 4n * GEN],
  [DEMO_LANDLORD, 5n * GEN],
]);
const balance = (a: string) => balances.get(a.toLowerCase()) ?? 0n;
const credit = (a: string, v: bigint) => {
  balances.set(a.toLowerCase(), balance(a) + v);
  notify();
};
/** The balance as a decimal string: a stable snapshot for useSyncExternalStore. */
export const mockBalanceText = (address: string): string => balance(address).toString();
/** The contract's own balance: every deposit it holds. */
let contractBalance = 0n;
export const mockContractBalance = (): bigint => contractBalance;

// ---- the contract's state -----------------------------------------------------------------------

type FlatRec = {
  landlord: string;
  tenant: string;
  title: string;
  address_line: string;
  items_json: string;
  n_items: number;
  deposit: bigint;
  moveout_seconds: number;
  response_seconds: number;
  status: string;
  offered_at: number;
  taken_at: number;
  notice_at: number;
  moveout_end: number;
  reported_at: number;
  response_end: number;
  moveout_json: string;
  deductions_json: string;
  n_deductions: number;
  deducted: bigint;
  contested_json: string;
  verdict: string;
  results_json: string;
  paid_tenant: bigint;
  paid_landlord: bigint;
  settled_at: number;
  settled_by: string;
};

const flatRows = new Map<string, FlatRec>();
const byLandlord = new Map<string, string>();
const byTenant = new Map<string, string>();
const n = {
  flat_count: 0,
  held_total: 0n,
  paid_to_tenants: 0n,
  paid_to_landlords: 0n,
  refused_takes: 0,
  n_taken: 0,
  n_withdrawn: 0,
  n_reclaimed: 0,
  n_clean: 0,
  n_accepted: 0,
  n_judged: 0,
  n_settled: 0,
  n_contested: 0,
  n_damage: 0,
  n_wear: 0,
  n_unclear: 0,
};

/** A refusal that raises: nothing is stored, and the receipt carries the sentence. */
class Refused extends Error {}
const fail = (message: string): never => {
  throw new Refused("[EXPECTED] " + message);
};

type Ctx = { sender: string; value: bigint; now: number };
type Row = Record<string, unknown>;
type Result = Row;

const clock = (c: Ctx): number => {
  if (c.now < 0) fail("no readable clock on this transaction; no window can be measured");
  return c.now;
};

const isStr = (v: unknown): v is string => typeof v === "string";

function flatOf(id: string): FlatRec {
  const f = flatRows.get(id);
  if (!f) return fail("no flat " + id.slice(0, ID_CHARS));
  return f;
}

function index(table: Map<string, string>, key: string, id: string): void {
  const current = table.has(key) ? (JSON.parse(table.get(key)!) as string[]) : [];
  current.push(id);
  table.set(key, JSON.stringify(current));
}

function transfer(to: string, value: bigint): void {
  contractBalance -= value;
  credit(to, value);
}

/** The single exit for a deposit: write the ending, then move the money. */
function close(f: FlatRec, status: string, results: { verdict: string; to: Payee }[], c: Ctx): [bigint, bigint] {
  const deductions = JSON.parse(f.deductions_json) as { amount: string }[];
  let toLandlord = 0n;
  for (let k = 0; k < deductions.length; k++) if (results[k].to === "landlord") toLandlord += BigInt(deductions[k].amount);
  const toTenant = f.deposit - toLandlord;
  f.status = status;
  f.results_json = JSON.stringify(results);
  f.paid_tenant = toTenant;
  f.paid_landlord = toLandlord;
  f.settled_at = c.now;
  f.settled_by = c.sender;
  n.held_total -= f.deposit;
  n.paid_to_tenants += toTenant;
  n.paid_to_landlords += toLandlord;
  if (status === "reclaimed") n.n_reclaimed++;
  else if (status === "clean") n.n_clean++;
  else if (status === "accepted") n.n_accepted++;
  else if (status === "judged") n.n_judged++;
  else n.n_settled++;
  if (toTenant > 0n) transfer(f.tenant, toTenant);
  if (toLandlord > 0n) transfer(f.landlord, toLandlord);
  return [toTenant, toLandlord];
}

// ---- the scripted reading -----------------------------------------------------------------------

const DAMAGE_WORDS = /\b(burn|burnt|burned|scorch\w*|crack\w*|broken|smashed|shattered|tear|torn|ripped|hole|holes|stain\w*|gouge\w*|missing|chipped|dent\w*|snapped|soaked|lost|leak\w*)\b/i;
const WEAR_WORDS = /\b(faded|fading|worn|flatten\w*|scuff\w*|light scratch\w*|slight\w*|minor|creas\w*|weathered|duller|thinning|softer|grey|marks? at)\b/i;
/** "no stains, tears or burns" names damage only to deny it: such phrases are dropped before reading. */
const denied = (text: string) => text.replace(/\b(no|without|not)\b[^.;]*/gi, " ");

/**
 * The verdict the in-memory contract gives a contested deduction. A copy of a sample flat answers
 * its script; any other flat is read with two word lists. On chain the validators decide.
 */
function scriptedVerdict(f: FlatRec, k: number): Verdict {
  const items = JSON.parse(f.items_json) as { name: string; move_in: string }[];
  const notes = JSON.parse(f.moveout_json) as string[];
  const d = (JSON.parse(f.deductions_json) as { item: number; reason: string }[])[k];
  const sample = sampleFor(f.title, items);
  const scripted = sample?.deductions.find((x) => x.item === d.item && x.reason === d.reason);
  if (scripted) return scripted.expect;
  const out = denied(notes[d.item] ?? "");
  if (DAMAGE_WORDS.test(out)) return "damage";
  if (WEAR_WORDS.test(out)) return "wear";
  return "unclear";
}

// ---- the writes -----------------------------------------------------------------------------------

function offer(c: Ctx, title: unknown, addressLine: unknown, itemsJson: unknown, depositAtto: unknown, moveoutSeconds: unknown, responseSeconds: unknown): Result {
  if (!isStr(title) || !isStr(addressLine) || !isStr(itemsJson)) fail("the title, the address line and the items are strings");
  const t = pyStrip(title as string);
  let problem = textProblem(t, MIN_TITLE, MAX_TITLE, "the title");
  if (problem) fail(problem);
  const a = pyStrip(addressLine as string);
  problem = textProblem(a, MIN_ADDRESS, MAX_ADDRESS, "the address line");
  if (problem) fail(problem);
  const read = readItems(itemsJson as string);
  if (read.problem) fail(read.problem);
  const deposit = numberArg(depositAtto);
  if (deposit < MIN_DEPOSIT || deposit > MAX_DEPOSIT)
    fail(`the deposit is a whole number of atto from ${MIN_DEPOSIT} (0.1 GEN) to ${MAX_DEPOSIT} (1000 GEN)`);
  const mo = numberArg(moveoutSeconds);
  const re = numberArg(responseSeconds);
  if (!(BigInt(MIN_WINDOW) <= mo && mo <= BigInt(MAX_WINDOW))) fail(`the report window is ${MIN_WINDOW} to ${MAX_WINDOW} seconds`);
  if (!(BigInt(MIN_WINDOW) <= re && re <= BigInt(MAX_WINDOW))) fail(`the response window is ${MIN_WINDOW} to ${MAX_WINDOW} seconds`);
  const now = clock(c);
  n.flat_count++;
  const id = "F" + n.flat_count;
  flatRows.set(id, {
    landlord: c.sender, tenant: ZERO, title: t, address_line: a, items_json: JSON.stringify(read.items), n_items: read.items.length,
    deposit, moveout_seconds: Number(mo), response_seconds: Number(re), status: "open", offered_at: now, taken_at: 0, notice_at: 0,
    moveout_end: 0, reported_at: 0, response_end: 0, moveout_json: "[]", deductions_json: "[]", n_deductions: 0, deducted: 0n,
    contested_json: "[]", verdict: "", results_json: "[]", paid_tenant: 0n, paid_landlord: 0n, settled_at: 0, settled_by: ZERO,
  });
  index(byLandlord, c.sender, id);
  return { ok: true, flat: id, landlord: c.sender, deposit: deposit.toString(), items: read.items.length, offered_at: now };
}

function withdrawOffer(c: Ctx, raw: unknown): Result {
  if (!isStr(raw)) fail("the flat id is a string");
  const id = pyStrip(raw as string);
  const f = flatOf(id);
  if (c.sender !== f.landlord) fail(`only the landlord of ${id} may withdraw its offer`);
  if (f.status !== "open") fail(`${id} is ${f.status}; only an offer nobody has taken can be withdrawn`);
  const now = clock(c);
  f.status = "withdrawn";
  f.settled_at = now;
  f.settled_by = c.sender;
  n.n_withdrawn++;
  return { ok: true, flat: id, status: "withdrawn" };
}

function report(c: Ctx, raw: unknown, moveoutJson: unknown, deductionsJson: unknown): Result {
  if (!isStr(raw) || !isStr(moveoutJson) || !isStr(deductionsJson)) fail("the flat id, the move-out notes and the deductions are strings");
  const id = pyStrip(raw as string);
  const f = flatOf(id);
  if (c.sender !== f.landlord) fail(`only the landlord of ${id} may file its move-out report`);
  if (f.status !== "notice") fail(`${id} is ${f.status}; a report is filed after the tenant's notice, once`);
  const now = clock(c);
  if (now >= f.moveout_end) fail(`the report window of ${id} closed; reclaim(${id}) returns the whole deposit to the tenant`);
  const notes = readMoveout(moveoutJson as string, f.n_items);
  if (notes.problem) fail(notes.problem);
  const ded = readDeductions(deductionsJson as string, f.n_items, f.deposit);
  if (ded.problem) fail(ded.problem);
  f.moveout_json = JSON.stringify(notes.notes);
  f.deductions_json = JSON.stringify(ded.deductions);
  f.n_deductions = ded.deductions.length;
  f.deducted = ded.total;
  f.reported_at = now;
  if (!ded.deductions.length) {
    const [pt, pl] = close(f, "clean", [], c);
    return { ok: true, flat: id, status: "clean", deductions: 0, paid_tenant: pt.toString(), paid_landlord: pl.toString() };
  }
  f.response_end = now + f.response_seconds;
  f.status = "reported";
  return { ok: true, flat: id, status: "reported", deductions: ded.deductions.length, deducted: ded.total.toString(), response_end: f.response_end };
}

function take(c: Ctx, raw: unknown): Result {
  const value = c.value;
  const who = c.sender;
  let problem = "";
  let id = "";
  if (!isStr(raw)) problem = "the flat id is a string";
  else {
    id = pyStrip(raw);
    if (!flatRows.has(id)) problem = "no flat " + id.slice(0, ID_CHARS);
  }
  let now = -1;
  if (!problem) {
    const f = flatRows.get(id)!;
    now = c.now;
    if (who === f.landlord) problem = `the landlord of ${id} may not take it`;
    else if (f.status !== "open") problem = `${id} is ${f.status} and cannot be taken`;
    else if (now < 0) problem = "no readable clock on this transaction; no window can be measured";
    else if (value !== f.deposit) problem = `send exactly the deposit of ${f.deposit} atto to take ${id}; this one sent ${value}`;
  }
  if (problem) {
    n.refused_takes++;
    if (value > 0n) transfer(c.sender, value);
    return { ok: false, flat: id.slice(0, ID_CHARS), reason: problem, returned: value.toString() };
  }
  const f = flatRows.get(id)!;
  f.tenant = c.sender;
  f.taken_at = now;
  f.status = "let";
  n.held_total += value;
  n.n_taken++;
  index(byTenant, who, id);
  return { ok: true, flat: id, tenant: who, deposit: value.toString(), status: "let" };
}

function giveNotice(c: Ctx, raw: unknown): Result {
  if (!isStr(raw)) fail("the flat id is a string");
  const id = pyStrip(raw as string);
  const f = flatOf(id);
  if (c.sender !== f.tenant) fail(`only the tenant of ${id} may give notice`);
  if (f.status !== "let") fail(`${id} is ${f.status}; notice is given once, while the flat is let`);
  const now = clock(c);
  f.notice_at = now;
  f.moveout_end = now + f.moveout_seconds;
  f.status = "notice";
  return { ok: true, flat: id, status: "notice", moveout_end: f.moveout_end };
}

function accept(c: Ctx, raw: unknown): Result {
  if (!isStr(raw)) fail("the flat id is a string");
  const id = pyStrip(raw as string);
  const f = flatOf(id);
  if (c.sender !== f.tenant) fail(`only the tenant of ${id} may accept its report`);
  if (f.status !== "reported") fail(`${id} is ${f.status}; only a filed report can be accepted`);
  const now = clock(c);
  if (now >= f.response_end) fail(`the response window of ${id} closed; settle(${id}) closes it as filed`);
  const results = Array.from({ length: f.n_deductions }, () => ({ verdict: "accepted", to: "landlord" as Payee }));
  const [pt, pl] = close(f, "accepted", results, c);
  return { ok: true, flat: id, status: "accepted", paid_tenant: pt.toString(), paid_landlord: pl.toString() };
}

function contest(c: Ctx, raw: unknown, indicesJson: unknown): Result {
  if (!isStr(raw) || !isStr(indicesJson)) fail("the flat id and the contested deductions are strings");
  const id = pyStrip(raw as string);
  const f = flatOf(id);
  if (c.sender !== f.tenant) fail(`only the tenant of ${id} may contest its report`);
  if (f.status !== "reported") fail(`${id} is ${f.status}; only a filed report can be contested, once`);
  const now = clock(c);
  if (now >= f.response_end) fail(`the response window of ${id} closed; settle(${id}) closes it as filed`);
  const read = readIndices(indicesJson as string, f.n_deductions);
  if (read.problem) fail(read.problem);
  const verdicts = new Map<string, Verdict>();
  for (const k of read.picked) verdicts.set(deductionId(k), scriptedVerdict(f, k));
  const vector = vectorOf(read.picked.map((k) => [deductionId(k), verdicts.get(deductionId(k))!]));
  const results: { verdict: string; to: Payee }[] = [];
  for (let k = 0; k < f.n_deductions; k++) {
    if (read.picked.includes(k)) {
      const v = verdicts.get(deductionId(k))!;
      results.push({ verdict: v, to: v === "damage" ? "landlord" : "tenant" });
    } else results.push({ verdict: "uncontested", to: "landlord" });
  }
  f.contested_json = JSON.stringify(read.picked);
  f.verdict = vector;
  n.n_contested += read.picked.length;
  for (const v of verdicts.values()) {
    if (v === "damage") n.n_damage++;
    else if (v === "wear") n.n_wear++;
    else n.n_unclear++;
  }
  const [pt, pl] = close(f, "judged", results, c);
  return { ok: true, flat: id, status: "judged", verdict: vector, results, paid_tenant: pt.toString(), paid_landlord: pl.toString() };
}

function reclaim(c: Ctx, raw: unknown): Result {
  if (!isStr(raw)) fail("the flat id is a string");
  const id = pyStrip(raw as string);
  const f = flatOf(id);
  if (f.status !== "notice") fail(`${id} is ${f.status}; only a flat waiting for its report can be reclaimed`);
  const now = clock(c);
  if (now < f.moveout_end) fail(`the landlord of ${id} may still report, for ${f.moveout_end - now} seconds`);
  const [pt, pl] = close(f, "reclaimed", [], c);
  return { ok: true, flat: id, status: "reclaimed", paid_tenant: pt.toString(), paid_landlord: pl.toString() };
}

function settle(c: Ctx, raw: unknown): Result {
  if (!isStr(raw)) fail("the flat id is a string");
  const id = pyStrip(raw as string);
  const f = flatOf(id);
  if (f.status !== "reported") fail(`${id} is ${f.status}; only a report nobody answered can be settled`);
  const now = clock(c);
  if (now < f.response_end) fail(`the tenant of ${id} may still answer, for ${f.response_end - now} seconds`);
  const results = Array.from({ length: f.n_deductions }, () => ({ verdict: "unanswered", to: "landlord" as Payee }));
  const [pt, pl] = close(f, "settled", results, c);
  return { ok: true, flat: id, status: "settled", paid_tenant: pt.toString(), paid_landlord: pl.toString() };
}

function run(fn: WriteFn, a: unknown[], c: Ctx): Result {
  switch (fn) {
    case "offer":
      return offer(c, a[0], a[1], a[2], a[3], a[4], a[5]);
    case "withdraw_offer":
      return withdrawOffer(c, a[0]);
    case "report":
      return report(c, a[0], a[1], a[2]);
    case "take":
      return take(c, a[0]);
    case "give_notice":
      return giveNotice(c, a[0]);
    case "accept":
      return accept(c, a[0]);
    case "contest":
      return contest(c, a[0], a[1]);
    case "reclaim":
      return reclaim(c, a[0]);
    case "settle":
      return settle(c, a[0]);
  }
}

// ---- the views, in the contract's JSON shapes -------------------------------------------------------

const tenantOf = (f: FlatRec) => (f.tenant === ZERO ? "" : f.tenant);

function rowOf(id: string, now: number): Row {
  const r = flatRows.get(id)!;
  const items = JSON.parse(r.items_json) as { name: string; move_in: string }[];
  const notes = JSON.parse(r.moveout_json) as string[];
  const deductions = JSON.parse(r.deductions_json) as { item: number; amount: string; reason: string }[];
  const results = JSON.parse(r.results_json) as { verdict: string; to: string }[];
  const contested = JSON.parse(r.contested_json) as number[];
  return {
    flat: id, title: r.title, address_line: r.address_line, status: r.status,
    phase: phaseOf(r.status, r.moveout_end, r.response_end, now), landlord: r.landlord, tenant: tenantOf(r),
    deposit: r.deposit.toString(), held: (HOLDING as string[]).includes(r.status) ? r.deposit.toString() : "0",
    moveout_seconds: r.moveout_seconds, response_seconds: r.response_seconds, offered_at: r.offered_at, taken_at: r.taken_at,
    notice_at: r.notice_at, moveout_end: r.moveout_end, reported_at: r.reported_at, response_end: r.response_end,
    items: items.map((it, k) => ({ index: k, name: it.name, move_in: it.move_in, move_out: k < notes.length ? notes[k] : "" })),
    deductions: deductions.map((d, k) => {
      const res = k < results.length ? results[k] : { verdict: "", to: "" };
      return {
        id: deductionId(k), index: k, item: d.item, item_name: items[d.item].name, amount: d.amount, reason: d.reason,
        contested: contested.includes(k), verdict: res.verdict, to: res.to,
      };
    }),
    deducted: r.deducted.toString(), contested, verdict: r.verdict, paid_tenant: r.paid_tenant.toString(),
    paid_landlord: r.paid_landlord.toString(), settled_at: r.settled_at, settled_by: r.settled_by === ZERO ? "" : r.settled_by, now,
  };
}

const RULES = {
  value: 'one verdict per contested deduction, in the deductions\' order: "D1:wear,D2:damage"',
  askings: [
    "order 1: ITEM, MOVE-IN, MOVE-OUT, REASON, and the damage question: Is the change from move-in to move-out damage that goes beyond ordinary wear and tear, so the tenant should pay for it?",
    "order 2: REASON, MOVE-OUT, MOVE-IN, ITEM, and the wear question: Is the change ordinary wear and tear from normal living, or not shown by the notes at all, so the tenant should not pay for it?",
  ],
  combine: { "yes then no": "damage", "no then yes": "wear", "anything else": "unclear" },
  compared:
    "the whole vector, by exact string equality; every validator reruns every asking itself inside one consensus block and never agrees with a leader that raised",
  model_sees: "the item's name, its move-in note, its move-out note and the landlord's reason; never an amount, an address or the deposit",
  settlement: {
    contest:
      "damage to the landlord; wear and unclear back to the tenant, because the burden of proof is the landlord's; an uncontested deduction to the landlord; the rest of the deposit to the tenant",
    accept: "every deduction to the landlord, the rest of the deposit to the tenant",
    settle: "after the response window with no answer: every deduction to the landlord, the rest to the tenant",
    reclaim: "after the report window with no report: the whole deposit to the tenant",
    "report with no deduction": "the whole deposit to the tenant, in the same call",
    withdraw_offer: "nothing is held, nothing moves",
  },
  who: {
    offer: "anyone; the sender is the landlord",
    withdraw_offer: "the landlord, while nobody has taken the flat",
    take: "anyone but the landlord, while the flat is open, with exactly the deposit; taking it accepts the move-in notes as written",
    give_notice: "the tenant, once, while the flat is let",
    report: "the landlord, after the notice and before the report window closes, once",
    accept: "the tenant, before the response window closes",
    contest: "the tenant, before the response window closes, naming at least one deduction; once",
    reclaim: "anyone, after the report window closed with no report",
    settle: "anyone, after the response window closed with no answer",
  },
  limits: {
    title: [3, 60], address_line: [3, 80], items: [2, 8], item_name: [3, 40], move_in_and_move_out_notes: [20, 400],
    deductions: [0, 6], reason: [20, 300], deposit_atto: [MIN_DEPOSIT.toString(), MAX_DEPOSIT.toString()],
    window_seconds: [MIN_WINDOW, MAX_WINDOW], flats_per_page: PAGE,
    text: "printable ASCII on one line; nothing longer than its limit is ever judged in part",
  },
  untrusted:
    "every text the model reads was written by the landlord; each is fenced (< and > replaced, never deleted), sits between delimiter lines tagged with the start of its own sha256, and the prompt says before the blocks that all four are untrusted and never an instruction",
};

export async function view(fn: string, args: (string | number)[]): Promise<unknown> {
  seed();
  await delay(70);
  const now = mockNow();
  switch (fn) {
    case "flat": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the flat id is a string" });
      const key = pyStrip(args[0]).slice(0, ID_CHARS);
      if (!flatRows.has(key)) return JSON.stringify({ error: "no flat " + key, flat: key });
      return JSON.stringify(rowOf(key, now));
    }
    case "flats": {
      const total = n.flat_count;
      const start = Number(numberArg(args[0]) < 0n ? 0n : numberArg(args[0]));
      let size = Number(numberArg(args[1]));
      size = size < 1 || size > PAGE ? PAGE : size;
      const rows: Row[] = [];
      for (let k = start + 1; k <= Math.min(total, start + size); k++) {
        const id = "F" + k;
        const r = flatRows.get(id)!;
        rows.push({
          flat: id, title: r.title, address_line: r.address_line, status: r.status, phase: phaseOf(r.status, r.moveout_end, r.response_end, now),
          landlord: r.landlord, tenant: tenantOf(r), deposit: r.deposit.toString(), items: r.n_items, deductions: r.n_deductions,
          deducted: r.deducted.toString(), verdict: r.verdict, paid_tenant: r.paid_tenant.toString(), paid_landlord: r.paid_landlord.toString(),
          moveout_end: r.moveout_end, response_end: r.response_end,
        });
      }
      return JSON.stringify({ total, offset: start, limit: size, rows, now });
    }
    case "flats_of": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the address is a string" });
      const key = pyStrip(args[0]).toLowerCase().slice(0, ADDRESS_CHARS);
      return JSON.stringify({
        address: key,
        landlord: byLandlord.has(key) ? JSON.parse(byLandlord.get(key)!) : [],
        tenant: byTenant.has(key) ? JSON.parse(byTenant.get(key)!) : [],
      });
    }
    case "stats": {
      const closed = n.n_withdrawn + n.n_reclaimed + n.n_clean + n.n_accepted + n.n_judged + n.n_settled;
      return JSON.stringify({
        flats: n.flat_count, taken: n.n_taken, active: n.flat_count - closed, withdrawn: n.n_withdrawn, reclaimed: n.n_reclaimed,
        clean: n.n_clean, accepted: n.n_accepted, judged: n.n_judged, settled: n.n_settled, contested: n.n_contested,
        damage: n.n_damage, wear: n.n_wear, unclear: n.n_unclear, held: n.held_total.toString(),
        paid_to_tenants: n.paid_to_tenants.toString(), paid_to_landlords: n.paid_to_landlords.toString(), refused_takes: n.refused_takes,
      });
    }
    case "rules":
      return JSON.stringify(RULES);
    default:
      throw new Error("the mock has no view " + fn);
  }
}

// ---- transactions ---------------------------------------------------------------------------------

const pending = new Map<string, { fn: string; polls: number; result: Row; error: string; judged: boolean }>();
let txCount = 0;
const fakeHash = () => "0x" + (++txCount).toString(16).padStart(8, "0") + "de9b5ac0".repeat(7);

/** Runs one call as `sender` and records it as a transaction; the hash comes back at once. */
function send(sender: string, fn: WriteFn, args: unknown[], value: bigint): string {
  if (value > balance(sender)) throw new Error("insufficient funds for this demo account");
  if (value > 0n) {
    credit(sender, -value);
    contractBalance += value;
  }
  let result: Row = {};
  let error = "";
  try {
    result = run(fn, args, { sender, value, now: mockNow() });
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    // A raised refusal changes nothing and returns what was sent (no write here takes value and raises).
    if (value > 0n) {
      contractBalance -= value;
      credit(sender, value);
    }
    error = e.message;
  }
  const hash = fakeHash();
  pending.set(hash, { fn, polls: 0, result, error, judged: fn === "contest" && !error });
  notify();
  return hash;
}

export async function write(call: Call): Promise<string> {
  seed();
  await delay(250);
  return send(persona.toLowerCase(), call.fn, call.args, call.value ?? 0n);
}

const STAGES = ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED", "FINALIZED"];
const NO_VOTES = { agree: 0, disagree: 0, idle: 0 };

export async function txStatus(hash: string): Promise<TxStatus> {
  await delay(60);
  const p = pending.get(hash);
  if (!p) return { status: "UNKNOWN", votes: NO_VOTES, applied: null, undetermined: false, exec: null, result: null, message: "" };
  p.polls += 1;
  // A contest is read by every validator, twice per deduction, so it moves slower than a plain call.
  const stages = p.judged ? Math.max(1, Math.floor(p.polls / 2)) : p.polls;
  const done = stages >= STAGES.length;
  // Studio assigns five validators and one is often idle in a round; the mock shows the same shape.
  const agree = done ? 4 : p.judged ? Math.min(Math.max(0, stages - 2), 4) : 0;
  return {
    status: STAGES[Math.min(stages - 1, STAGES.length - 1)],
    votes: { agree, disagree: 0, idle: done || agree ? 5 - agree : 0 },
    applied: done ? true : null,
    undetermined: false,
    exec: done ? (p.error ? "ERROR" : "SUCCESS") : null,
    result: done && !p.error ? p.result : null,
    message: done ? p.error || JSON.stringify(p.result) : "",
  };
}

export async function balanceOf(address: string): Promise<bigint> {
  await delay(40);
  return balance(address);
}

export async function faucet(address: string): Promise<bigint> {
  await delay(500);
  credit(address, 10n * GEN);
  return balance(address);
}

// ---- the demo landlord ---------------------------------------------------------------------------

export function demoStatus(): DemoStatus {
  return { online: true, landlord: DEMO_LANDLORD, reason: "" };
}

/** The in-memory twin of POST /api/demo/report: the demo landlord files a sample flat's scripted report. */
export async function demoReport(flatRaw: string): Promise<DemoReportAnswer> {
  seed();
  await delay(300);
  const id = pyStrip(String(flatRaw ?? "")).slice(0, ID_CHARS);
  const f = flatRows.get(id);
  if (!f) return { ok: false, reason: "no flat " + id };
  const items = (JSON.parse(f.items_json) as { name: string; move_in: string }[]).map((it) => ({ name: it.name, moveIn: it.move_in }));
  const problem = demoReportProblem(
    { landlord: f.landlord, status: f.status, title: f.title, items, depositAtto: f.deposit.toString(), moveoutEnd: f.moveout_end },
    DEMO_LANDLORD,
    mockNow(),
  );
  if (problem) return { ok: false, reason: problem };
  const sample = sampleFor(f.title, items)!;
  const r = reportArgs(sample);
  return { ok: true, hash: send(DEMO_LANDLORD, "report", [id, r.moveoutJson, r.deductionsJson], 0n) };
}

// ---- seeding ---------------------------------------------------------------------------------------

let seeded = false;

/** Runs a call at a given instant, outside the transaction log: the seeded past. */
function at(sender: string, now: number, fn: WriteFn, args: unknown[], value = 0n): Result {
  if (value > 0n) {
    credit(sender, -value);
    contractBalance += value;
  }
  return run(fn, args, { sender, value, now });
}

function seedTenancy(sample: SampleFlat, t0: number, story: (id: string, f: FlatRec) => void): void {
  const r = at(DEMO_LANDLORD, t0, "offer", offerArgs(sample));
  const id = String(r.flat);
  story(id, flatRows.get(id)!);
}

function seed(): void {
  if (seeded) return;
  seeded = true;
  const now = mockNow();
  const DAY = 86400;
  const HOUR = 3600;
  // Two open copies of every sample flat, offered three days ago: F1 to F12.
  for (const s of SAMPLE_FLATS) {
    at(DEMO_LANDLORD, now - 3 * DAY, "offer", offerArgs(s));
    at(DEMO_LANDLORD, now - 3 * DAY + 60, "offer", offerArgs(s));
  }
  const bakery = sampleByKey("bakery")!;
  const canal = sampleByKey("canal")!;
  const garden = sampleByKey("garden")!;
  const station = sampleByKey("station")!;
  const loft = sampleByKey("loft")!;
  const harbour = sampleByKey("harbour")!;
  const T = EARLIER_TENANT;
  // F13, above the bakery: the README's story. Three deductions contested, the mirror left alone.
  seedTenancy(bakery, now - 40 * DAY, (id, f) => {
    at(T, now - 39 * DAY, "take", [id], f.deposit);
    at(T, now - 2 * DAY, "give_notice", [id]);
    const rep = reportArgs(bakery);
    at(DEMO_LANDLORD, now - 2 * DAY + HOUR, "report", [id, rep.moveoutJson, rep.deductionsJson]);
    at(T, now - DAY, "contest", [id, "[0, 1, 2]"]);
  });
  // F14, by the canal: the landlord never reported, and a passer-by reclaimed the whole deposit.
  seedTenancy(canal, now - 30 * DAY, (id, f) => {
    at(T, now - 29 * DAY, "take", [id], f.deposit);
    at(T, now - 5 * DAY, "give_notice", [id]);
    at(PASSER_BY, now - 5 * DAY + 3 * HOUR, "reclaim", [id]);
  });
  // F15, behind the library: the tenant accepted the report as filed.
  seedTenancy(garden, now - 25 * DAY, (id, f) => {
    at(T, now - 24 * DAY, "take", [id], f.deposit);
    at(T, now - 4 * DAY, "give_notice", [id]);
    const rep = reportArgs(garden);
    at(DEMO_LANDLORD, now - 4 * DAY + HOUR, "report", [id, rep.moveoutJson, rep.deductionsJson]);
    at(T, now - 4 * DAY + 5 * HOUR, "accept", [id]);
  });
  // F16, on Station Road: the tenant never answered, and a passer-by settled it as filed.
  seedTenancy(station, now - 20 * DAY, (id, f) => {
    at(T, now - 19 * DAY, "take", [id], f.deposit);
    at(T, now - 3 * DAY, "give_notice", [id]);
    const rep = reportArgs(station);
    at(DEMO_LANDLORD, now - 3 * DAY + HOUR, "report", [id, rep.moveoutJson, rep.deductionsJson]);
    at(PASSER_BY, now - DAY, "settle", [id]);
  });
  // F17, the loft room: notice given, the report window closed with no report; anyone may reclaim it now.
  seedTenancy(loft, now - 15 * DAY, (id, f) => {
    at(T, now - 14 * DAY, "take", [id], f.deposit);
    at(T, now - 5 * HOUR, "give_notice", [id]);
  });
  // F18, with the balcony: the visitor's own tenancy, reported an hour ago and waiting for an answer.
  seedTenancy(harbour, now - 12 * DAY, (id, f) => {
    at(VISITOR, now - 11 * DAY, "take", [id], f.deposit);
    at(VISITOR, now - 2 * HOUR, "give_notice", [id]);
    const rep = reportArgs(harbour);
    at(DEMO_LANDLORD, now - HOUR, "report", [id, rep.moveoutJson, rep.deductionsJson]);
  });
  // F19: a flat of the visitor's own as a landlord, written by hand; its tenant gave notice this morning.
  const attic = at(MY_LANDLORD, now - 60 * DAY, "offer", [
    "Attic flat on Quarry Hill",
    "Flat 6, 12 Quarry Hill",
    JSON.stringify([
      { name: "Kitchen oven", move_in: "Electric oven cleaned before move-in, racks and glass door free of grease." },
      { name: "Bedroom wardrobe", move_in: "Pine wardrobe, both doors hang straight and close, rail and shelf in place." },
      { name: "Living room carpet", move_in: "Grey wool carpet, cleaned before move-in, no stains, burns or worn patches." },
    ]),
    (GEN * 9n / 10n).toString(),
    6 * HOUR,
    DAY,
  ]);
  const atticId = String(attic.flat);
  at(EARLIER_TENANT, now - 59 * DAY, "take", [atticId], GEN * 9n / 10n);
  at(EARLIER_TENANT, now - HOUR, "give_notice", [atticId]);
  // F20: another of the visitor's own, still to let.
  at(MY_LANDLORD, now - 2 * DAY, "offer", [
    "Narrow house on Weaver Street",
    "4 Weaver Street",
    JSON.stringify([
      { name: "Front door", move_in: "Painted blue front door, lock works with both keys, letterbox flap intact." },
      { name: "Stair carpet", move_in: "Green stair carpet fitted last year, rods in place, no loose or worn treads." },
    ]),
    (GEN * 7n / 10n).toString(),
    6 * HOUR,
    DAY,
  ]);
}

/** Test hook: the contract's held total and its own balance, which must always be equal. */
export function mockHeld(): { held: bigint; balance: bigint } {
  seed();
  return { held: n.held_total, balance: contractBalance };
}
