// The shapes the pages use, in one place with no runtime code: lib/chain.ts maps every view answer
// into these, and lib/chain-mock.ts answers in the contract's own JSON so the same mappers run in
// both modes.

import type { FlatStatus, Outcome, Payee, Phase } from "./rules.ts";

export type Item = {
  index: number;
  name: string;
  moveIn: string;
  /** "" until the landlord files the move-out report */
  moveOut: string;
};

export type Deduction = {
  /** "D1" */
  id: string;
  index: number;
  /** the item it names, counted from 0 */
  item: number;
  itemName: string;
  amountAtto: string;
  reason: string;
  contested: boolean;
  /** damage, wear, unclear, uncontested, accepted, unanswered; "" while the flat is open */
  verdict: Outcome;
  /** where its money went; "" while the flat is open */
  to: Payee;
};

/** flat(id): one flat in full. Every instant is seconds on the message clock; 0 until it happens. */
export type Flat = {
  id: string;
  title: string;
  addressLine: string;
  status: FlatStatus;
  /** the phase the contract computed when it was read; recomputed on the browser's clock for display */
  phase: Phase;
  landlord: string;
  /** "" until somebody takes it */
  tenant: string;
  depositAtto: string;
  heldAtto: string;
  moveoutSeconds: number;
  responseSeconds: number;
  offeredAt: number;
  takenAt: number;
  noticeAt: number;
  moveoutEnd: number;
  reportedAt: number;
  responseEnd: number;
  items: Item[];
  deductions: Deduction[];
  deductedAtto: string;
  contested: number[];
  /** the agreed vector, "D1:wear,D2:damage"; "" unless contested */
  verdict: string;
  paidTenantAtto: string;
  paidLandlordAtto: string;
  settledAt: number;
  settledBy: string;
  /** the contract's clock when it answered; 0 when it had none */
  now: number;
};

/** flats(offset, limit): one short row per flat. */
export type FlatRow = {
  id: string;
  title: string;
  addressLine: string;
  status: FlatStatus;
  phase: Phase;
  landlord: string;
  tenant: string;
  depositAtto: string;
  items: number;
  deductions: number;
  deductedAtto: string;
  verdict: string;
  paidTenantAtto: string;
  paidLandlordAtto: string;
  moveoutEnd: number;
  responseEnd: number;
};

export type FlatPage = { total: number; offset: number; limit: number; rows: FlatRow[]; now: number };

/** flats_of(address): the flats an address offered and took, oldest first. */
export type MyFlats = { address: string; landlord: string[]; tenant: string[] };

/** stats(): the contract's counters. Amounts in atto. */
export type Stats = {
  flats: number;
  taken: number;
  active: number;
  withdrawn: number;
  reclaimed: number;
  clean: number;
  accepted: number;
  judged: number;
  settled: number;
  contested: number;
  damage: number;
  wear: number;
  unclear: number;
  heldAtto: string;
  paidToTenantsAtto: string;
  paidToLandlordsAtto: string;
  refusedTakes: number;
};

/** rules(): the contract's own words, kept as it wrote them. */
export type Rules = Record<string, unknown>;

export type Votes = { agree: number; disagree: number; idle: number };

export type TxStatus = {
  /** PENDING | PROPOSING | COMMITTING | REVEALING | ACCEPTED | FINALIZED | CANCELED | UNDETERMINED | UNKNOWN */
  status: string;
  votes: Votes;
  /** null until votes exist */
  applied: boolean | null;
  /** finished with no majority: nothing was stored */
  undetermined: boolean;
  /** SUCCESS | ERROR | null */
  exec: string | null;
  /** the contract's JSON return, if any */
  result: Record<string, unknown> | null;
  /** the decoded return or error text */
  message: string;
};

export type ReadResult<T> = { data: T; source: "chain" | "mock" };

/** The contract's write methods, by name. */
export type WriteFn = "offer" | "withdraw_offer" | "report" | "take" | "give_notice" | "accept" | "contest" | "reclaim" | "settle";

export type Arg = string | number;

/** One contract call, ready to sign: the method, its arguments in the contract's order, and the value sent. */
export type Call = { fn: WriteFn; args: Arg[]; value?: bigint };

/** What the demo landlord answered when asked to file a sample flat's move-out report. */
export type DemoReportAnswer = { ok: true; hash: string } | { ok: false; reason: string; retryAfter?: number };

/** Whether the demo landlord can sign right now, and who it is. */
export type DemoStatus = { online: boolean; landlord: string; reason: string };
